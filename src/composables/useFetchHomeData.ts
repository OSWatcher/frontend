import { computed, effectScope, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  useFetchBranchesQuery,
  useFetchCommitHistoryQuery,
  CommitHistoryDirection
} from '@/graphql-types'
import type { FetchBranchesQuery, FetchCommitHistoryQuery } from '@/graphql-types'

type BranchData = NonNullable<FetchBranchesQuery['branches']>[0]
type CommitData = NonNullable<FetchCommitHistoryQuery['fetchCommitHistory']>[0]

export type CommitWithExpandable = CommitData & {
  expandableNextCommits: { hash: string }[]
}

export interface BranchWithCommits {
  branch: BranchData
  commits: ComputedRef<CommitWithExpandable[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

function useBranchesData() {
  const mainBranches = computed(() => ['ubuntu-server', 'windows'])

  return effectScope().run(() => {
    const {
      result: branchesResult,
      loading: branchesLoading,
      error: branchesError
    } = useFetchBranchesQuery()

    const branches = computed(() =>
      (branchesResult.value?.branches || []).filter((branch) =>
        mainBranches.value.includes(branch.name)
      )
    )

    return {
      branches,
      loading: branchesLoading,
      error: branchesError
    }
  })!
}

function useCommitHistoryForBranch(branch: BranchData) {
  return effectScope().run(() => {
    // Skip fetching if branch has no tracked commit
    const commitHash = branch.tracks?.hash
    if (!commitHash) {
      return {
        commits: computed(() => []),
        loading: ref(false),
        error: ref(null)
      }
    }

    const {
      result: commitResult,
      loading: commitLoading,
      error: commitError
    } = useFetchCommitHistoryQuery({
      commitHash,
      direction: CommitHistoryDirection.Backward
    })

    const commits = computed(() => commitResult.value?.fetchCommitHistory || [])

    return {
      commits,
      loading: commitLoading,
      error: commitError
    }
  })!
}

function createBranchWithCommits(branch: BranchData): BranchWithCommits {
  const { commits, loading, error } = useCommitHistoryForBranch(branch)

  const commitsWithExpandability = computed(() => {
    // Create a set of all commit hashes currently displayed in this branch
    const commitHashes = new Set(commits.value.map((commit) => commit.hash))

    return commits.value.map((commit) => {
      // Find next commits that are NOT already in current history (these are expandable)
      const expandableNextCommits =
        commit.next?.filter((nextCommit) => !commitHashes.has(nextCommit.hash)) || []

      // PoC validation: each commit should have at most 1 expandable next commit
      if (expandableNextCommits.length > 1) {
        console.warn(
          `Commit ${commit.name} (${commit.hash}) has ${expandableNextCommits.length} expandable next commits. Expected 1 or 0.`,
          expandableNextCommits
        )
      }

      return {
        ...commit,
        expandableNextCommits
      }
    })
  })

  return {
    branch,
    commits: commitsWithExpandability,
    loading,
    error
  }
}

export function useFetchHomeData() {
  const { branches, loading: branchesLoading, error: branchesError } = useBranchesData()

  // Store stable query subscriptions per branch (key = branch name)
  const branchQueriesMap = ref<Map<string, BranchWithCommits>>(new Map())

  // Watch branches and create queries for any new branches
  // Queries are created ONCE per branch and remain stable
  watch(
    branches,
    (currentBranches) => {
      currentBranches.forEach((branch) => {
        if (!branchQueriesMap.value.has(branch.name)) {
          const branchData = createBranchWithCommits(branch)
          branchQueriesMap.value.set(branch.name, branchData as any)
        }
      })

      // Clean up queries for branches that no longer exist
      const currentBranchNames = new Set(currentBranches.map((b) => b.name))
      for (const branchName of branchQueriesMap.value.keys()) {
        if (!currentBranchNames.has(branchName)) {
          branchQueriesMap.value.delete(branchName)
        }
      }
    },
    { immediate: true }
  )

  // Computed just returns the data from stable queries
  // This computed does NOT create new queries, so it won't cause loops
  const branchesWithCommits = computed(() => {
    return branches.value
      .map((branch) => branchQueriesMap.value.get(branch.name))
      .filter((data) => data !== undefined) as unknown as BranchWithCommits[]
  })

  const allCommitsLoaded = computed(() =>
    branchesWithCommits.value.every((branchData) => !branchData.loading.value)
  )

  const commitErrors = computed(() =>
    branchesWithCommits.value
      .filter((branchData) => branchData.error.value)
      .map((branchData) => branchData.error.value)
  )

  return {
    branchesWithCommits,
    loading: branchesLoading,
    error: branchesError,
    allCommitsLoaded,
    commitErrors
  }
}

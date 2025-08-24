import { computed, effectScope, type ComputedRef, type Ref } from 'vue'
import { useFetchBranchesQuery, useFetchCommitHistoryQuery, CommitHistoryDirection } from '@/graphql-types'
import type { FetchBranchesQuery, FetchCommitHistoryQuery } from '@/graphql-types'

type BranchData = NonNullable<FetchBranchesQuery['branches']>[0]
type CommitData = NonNullable<FetchCommitHistoryQuery['fetchCommitHistory']>[0]

type CommitWithExpandable = CommitData & {
  expandableNextCommits: { hash: string }[]
}

export interface BranchWithCommits {
  branch: BranchData
  commits: ComputedRef<CommitWithExpandable[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

function useBranchesData() {
  const ALLOWED_BRANCHES = ['master', 'ubuntu-server']

  return effectScope().run(() => {
    const {
      result: branchesResult,
      loading: branchesLoading,
      error: branchesError
    } = useFetchBranchesQuery({
      where: {
        name_IN: ALLOWED_BRANCHES
      }
    })

    const branches = computed(() => branchesResult.value?.branches || [])

    return {
      branches,
      loading: branchesLoading,
      error: branchesError
    }
  })!
}

function useCommitHistoryForBranch(branch: BranchData) {
  return effectScope().run(() => {
    const {
      result: commitResult,
      loading: commitLoading,
      error: commitError
    } = useFetchCommitHistoryQuery({ 
      commitHash: branch.tracks?.hash || '',
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
      const expandableNextCommits = commit.next?.filter((nextCommit) => 
        !commitHashes.has(nextCommit.hash)
      ) || []
      
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

  const branchesWithCommits = computed(() =>
    branches.value.map((branch) => createBranchWithCommits(branch))
  )

  const allCommitsLoaded = computed(() =>
    branchesWithCommits.value.every((branchData) => !branchData.loading)
  )

  const commitErrors = computed(() =>
    branchesWithCommits.value
      .filter((branchData) => branchData.error)
      .map((branchData) => branchData.error)
  )

  return {
    branchesWithCommits,
    loading: branchesLoading,
    error: branchesError,
    allCommitsLoaded,
    commitErrors
  }
}

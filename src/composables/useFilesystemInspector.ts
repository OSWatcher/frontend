import { ref, computed, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { GET_FS_ROOT, TRAVERSE_PATH, LIST_ENTRIES_FOR_TREE, DIFF_NODES } from '@/queries'
import type {
  InspectorMode,
  InspectorLayout,
  CommitContext,
  FilesystemEntry,
  FilesystemDiffEntry
} from '@/types/inspector'
import { TreeNodeType } from '@/types'
import { DiffStatus } from '@/graphql-types'
import {
  parseFilesystemEntries,
  parseFilesystemDiffEntries,
  generateBreadcrumbs,
  sortEntries,
  getParentPath
} from '@/utils/filesystem'

export function useFilesystemInspector(
  mode: InspectorMode,
  layout: InspectorLayout,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext,
  targetDirectory = '/',
  highlightFile = ''
) {
  const currentPath = ref<string>(targetDirectory)
  const highlightedFile = ref<string>(highlightFile)
  const rawEntries = ref<any[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<Error | null>(null)
  const fsRootHash = ref<string>('')
  const baseFsRootHash = ref<string>('')
  const diffeeFsRootHash = ref<string>('')
  const statusFilter = ref<DiffStatus[]>([])

  // Debounce timer for filter changes
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const entries = computed<FilesystemEntry[] | FilesystemDiffEntry[]>(() => {
    if (mode === 'single') {
      const parsed = parseFilesystemEntries(rawEntries.value, currentPath.value)
      return sortEntries(parsed)
    } else {
      const parsed = parseFilesystemDiffEntries(rawEntries.value, currentPath.value)
      return sortEntries(parsed)
    }
  })

  const breadcrumbs = computed(() => {
    return generateBreadcrumbs(currentPath.value)
  })

  async function fetchFsRootHash(commitHash: string): Promise<string> {
    try {
      const response = await gqlClient.query({
        query: GET_FS_ROOT,
        variables: { where: { hash: commitHash } }
      })
      const commit = response.data?.commits?.[0]
      if (!commit) {
        throw new Error(`Commit ${commitHash} not found`)
      }
      const fsRoot = commit.filesystemConnection?.edges?.[0]?.node?.hash
      if (!fsRoot) {
        throw new Error(`Commit ${commitHash} has no filesystem`)
      }
      return fsRoot
    } catch (err) {
      console.error('Error fetching filesystem root:', err)
      throw err
    }
  }

  async function traverseToPath(treeHash: string, path: string): Promise<string | null> {
    try {
      const response = await gqlClient.query({
        query: TRAVERSE_PATH,
        variables: { parent_label: 'Tree', tree_hash: treeHash, path: path }
      })
      const targetHash = response.data?.traversePath
      if (!targetHash) {
        console.warn(`Path ${path} not found in tree ${treeHash}`)
        return null
      }
      return targetHash
    } catch (err) {
      console.warn('Error traversing path:', err)
      return null
    }
  }

  async function fetchEntriesForSingleMode(treeHash: string): Promise<any[]> {
    try {
      const response = await gqlClient.query({
        query: LIST_ENTRIES_FOR_TREE,
        variables: { where: { hash: treeHash } }
      })
      const tree = response.data?.trees?.[0]
      if (!tree) {
        return []
      }
      const blobs =
        tree.child_blobsConnection?.edges?.map((edge: any) => ({
          name: edge.properties.name,
          type: TreeNodeType.Blob,
          hash: edge.node.hash,
          size: edge.node.size
        })) || []
      const trees =
        tree.child_treesConnection?.edges?.map((edge: any) => ({
          name: edge.properties.name,
          type: TreeNodeType.Tree,
          hash: edge.node.hash
        })) || []
      return [...blobs, ...trees]
    } catch (err) {
      console.error('Error fetching entries:', err)
      throw err
    }
  }

  async function fetchEntriesForComparisonMode(
    baseTreeHash: string,
    diffeeTreeHash: string,
    path: string
  ): Promise<any[]> {
    try {
      // Build options with optional status filter
      const options: any = { offset: 0, limit: 1000 }
      if (statusFilter.value.length > 0) {
        options.status_filter = statusFilter.value
      }

      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Tree',
          baseNodeHash: baseTreeHash,
          diffeeNodeHash: diffeeTreeHash,
          atPath: path,
          maxDepth: 0,
          filter: ['Blob'],
          options
        }
      })
      const diffResult = response.data?.diffNodesAt
      if (!diffResult) {
        return []
      }
      return (
        diffResult.items?.map((item: any) => ({
          name: item.path.split('/').pop(),
          type: item.type.toLowerCase(),
          old_props: item.old_props,
          new_props: item.new_props
        })) || []
      )
    } catch (err) {
      console.error('Error fetching diff entries:', err)
      throw err
    }
  }

  async function navigateToDirectory(dirPath: string, fileToHighlight?: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      if (mode === 'single') {
        if (!commit) {
          throw new Error('Commit is required for single mode')
        }
        if (!fsRootHash.value) {
          fsRootHash.value = await fetchFsRootHash(commit.hash)
        }
        const targetTreeHash =
          dirPath === '/' ? fsRootHash.value : await traverseToPath(fsRootHash.value, dirPath)
        if (!targetTreeHash) {
          throw new Error(`Directory ${dirPath} not found`)
        }
        const entries = await fetchEntriesForSingleMode(targetTreeHash)
        rawEntries.value = entries
        currentPath.value = dirPath
        highlightedFile.value = fileToHighlight || ''
      } else {
        if (!baseCommit || !diffeeCommit) {
          throw new Error('Base and diffee commits are required for comparison mode')
        }
        if (!baseFsRootHash.value) {
          baseFsRootHash.value = await fetchFsRootHash(baseCommit.hash)
        }
        if (!diffeeFsRootHash.value) {
          diffeeFsRootHash.value = await fetchFsRootHash(diffeeCommit.hash)
        }
        // Pass root tree hashes and let DIFF_NODES handle path traversal internally
        const entries = await fetchEntriesForComparisonMode(
          baseFsRootHash.value,
          diffeeFsRootHash.value,
          dirPath
        )
        rawEntries.value = entries
        currentPath.value = dirPath
        highlightedFile.value = fileToHighlight || ''
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      rawEntries.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Backward compatibility function that intelligently handles file vs directory paths
  async function navigateToPath(path: string, type?: TreeNodeType): Promise<void> {
    if (path === '/') {
      return navigateToDirectory('/')
    }

    // If type is explicitly provided, use it
    if (type === TreeNodeType.Tree) {
      return navigateToDirectory(path)
    }
    if (type === TreeNodeType.Blob) {
      const parentDir = getParentPath(path)
      const fileName = path.split('/').pop() || ''
      return navigateToDirectory(parentDir, fileName)
    }

    // Fallback: try to detect if this is likely a file path
    const fileName = path.split('/').pop() || ''
    const hasExtension = fileName.includes('.')

    if (hasExtension) {
      // Likely a file - navigate to parent directory and highlight file
      const parentDir = getParentPath(path)
      return navigateToDirectory(parentDir, fileName)
    } else {
      // Likely a directory
      return navigateToDirectory(path)
    }
  }

  async function refresh(): Promise<void> {
    await navigateToDirectory(currentPath.value, highlightedFile.value)
  }

  function setStatusFilter(statuses: DiffStatus[]): void {
    statusFilter.value = statuses

    // Cancel pending debounce
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer)
    }

    // Debounce the refetch
    filterDebounceTimer = setTimeout(() => {
      navigateToDirectory(currentPath.value, highlightedFile.value)
    }, 1000)
  }

  watch(
    () => [mode, commit, baseCommit, diffeeCommit],
    () => {
      navigateToDirectory(currentPath.value, highlightedFile.value)
    },
    { immediate: true }
  )

  return {
    currentPath,
    entries,
    breadcrumbs,
    isLoading,
    error,
    navigateToPath,
    navigateToDirectory,
    highlightedFile,
    refresh,
    statusFilter,
    setStatusFilter
  }
}

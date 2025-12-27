/**
 * Registry Inspector Composable
 *
 * Reactive state management and data fetching for the unified Registry Inspector.
 * Handles both single mode (viewing one commit) and comparison mode (diffing two commits).
 */

import { ref, computed, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { DIFF_NODES, LIST_ENTRIES_FOR_KEY, TRAVERSE_PATH } from '@/queries'
import type { InspectorMode, InspectorLayout, CommitContext } from '@/types/inspector'
import type { RegistryEntry, RegistryDiffEntry, RegistryHive } from '@/types/registry'
import { DiffStatus } from '@/graphql-types'
import {
  parseRegistryEntries,
  parseRegistryDiffEntries,
  generateRegistryBreadcrumbs,
  sortRegistryEntries
} from '@/utils/registry'
import { GetSystemHives } from '@/windows/registry'

export function useRegistryInspector(
  mode: InspectorMode,
  layout: InspectorLayout,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext
) {
  const currentPath = ref<string>('/')
  const rawEntries = ref<any[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<Error | null>(null)

  // Available hives
  const availableHives = ref<RegistryHive[]>([])
  const selectedHive = ref<RegistryHive | null>(null)
  const isLoadingHives = ref<boolean>(false)

  // Diff status filter
  const statusFilter = ref<DiffStatus[]>([])
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Parsed and sorted entries
   */
  const entries = computed<RegistryEntry[] | RegistryDiffEntry[]>(() => {
    if (mode === 'single') {
      const parsed = parseRegistryEntries(rawEntries.value, currentPath.value)
      return sortRegistryEntries(parsed)
    } else {
      const parsed = parseRegistryDiffEntries(rawEntries.value, currentPath.value)
      return sortRegistryEntries(parsed)
    }
  })

  /**
   * Breadcrumbs for navigation
   */
  const breadcrumbs = computed(() => {
    if (!selectedHive.value) return []
    return generateRegistryBreadcrumbs(selectedHive.value.mountPath, currentPath.value)
  })

  /**
   * Fetch available registry hives
   */
  async function fetchAvailableHives(): Promise<void> {
    isLoadingHives.value = true
    error.value = null

    try {
      if (mode === 'single') {
        if (!commit) {
          throw new Error('Commit is required for single mode')
        }
        const hives = await GetSystemHives(commit.hash)
        availableHives.value = hives
          .filter((hive) => hive.winreg_hash)
          .map((hive) => ({
            mountPath: hive.mount_path,
            hash: hive.winreg_hash!
          }))
      } else {
        if (!baseCommit || !diffeeCommit) {
          throw new Error('Base and diffee commits are required for comparison mode')
        }
        // For comparison mode, fetch hives from base commit
        // (assuming both commits have the same hive structure)
        const baseHives = await GetSystemHives(baseCommit.hash)
        const diffeeHives = await GetSystemHives(diffeeCommit.hash)

        availableHives.value = baseHives
          .filter((baseHive, index) => baseHive.winreg_hash && diffeeHives[index]?.winreg_hash)
          .map((baseHive, index) => ({
            mountPath: baseHive.mount_path,
            hash: baseHive.winreg_hash!,
            diffeeHash: diffeeHives[index].winreg_hash!
          }))
      }

      // Select a useful default hive (prefer SOFTWARE > SYSTEM > first available)
      if (availableHives.value.length > 0) {
        const softwareHive = availableHives.value.find((h) =>
          h.mountPath.toUpperCase().includes('SOFTWARE')
        )
        const systemHive = availableHives.value.find((h) =>
          h.mountPath.toUpperCase().includes('SYSTEM')
        )
        selectedHive.value = softwareHive || systemHive || availableHives.value[0]
      }
    } catch (err) {
      console.error('Error fetching registry hives:', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      availableHives.value = []
    } finally {
      isLoadingHives.value = false
    }
  }

  /**
   * Fetch registry entries for single mode
   */
  async function fetchEntriesForSingleMode(regKeyHash: string, path: string): Promise<any[]> {
    try {
      // First, traverse to the target path to get the actual hash
      let targetHash = regKeyHash
      if (path !== '/') {
        const traverseResponse = await gqlClient.query({
          query: TRAVERSE_PATH,
          variables: {
            parent_label: 'WinRegKey',
            tree_hash: regKeyHash,
            path: path
          }
        })
        targetHash = traverseResponse.data?.traversePath
        if (!targetHash) {
          return []
        }
      }

      // Now list entries at this path
      const response = await gqlClient.query({
        query: LIST_ENTRIES_FOR_KEY,
        variables: {
          where: { hash: targetHash }
        }
      })

      const regKey = response.data?.winRegKeys?.[0]
      if (!regKey) {
        return []
      }

      const entries: any[] = []

      // Add child keys
      if (regKey.child_keysConnection?.edges) {
        for (const edge of regKey.child_keysConnection.edges) {
          entries.push({
            name: edge.properties?.name,
            type: 'WinRegKey',
            hash: edge.node?.hash
          })
        }
      }

      // Add child values
      if (regKey.child_valuesConnection?.edges) {
        for (const edge of regKey.child_valuesConnection.edges) {
          entries.push({
            name: edge.properties?.name,
            type: 'WinRegValue',
            value: edge.node?.value,
            value_type: edge.node?.type,
            hash: edge.node?.hash
          })
        }
      }

      return entries
    } catch (err) {
      console.error('Error fetching registry entries:', err)
      throw err
    }
  }

  /**
   * Fetch registry entries for comparison mode
   */
  async function fetchEntriesForComparisonMode(
    baseRegKeyHash: string,
    diffeeRegKeyHash: string,
    path: string
  ): Promise<any[]> {
    try {
      // Build options with optional status filter
      const options: any = {}
      if (statusFilter.value.length > 0) {
        options.status_filter = statusFilter.value
      }

      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'WinRegKey',
          baseNodeHash: baseRegKeyHash,
          diffeeNodeHash: diffeeRegKeyHash,
          atPath: path,
          maxDepth: 0,
          filter: ['WinRegValue'],
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
          type: item.type,
          status: item.status,
          old_props: item.old_props?.properties || null,
          new_props: item.new_props?.properties || null
        })) || []
      )
    } catch (err) {
      console.error('Error fetching diff entries:', err)
      throw err
    }
  }

  /**
   * Navigate to a new registry path
   */
  async function navigateToPath(path: string): Promise<void> {
    if (!selectedHive.value) {
      error.value = new Error('No hive selected')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      if (mode === 'single') {
        const entries = await fetchEntriesForSingleMode(selectedHive.value.hash, path)
        rawEntries.value = entries
        currentPath.value = path
      } else {
        const entries = await fetchEntriesForComparisonMode(
          selectedHive.value.hash,
          (selectedHive.value as any).diffeeHash,
          path
        )
        rawEntries.value = entries
        currentPath.value = path
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      rawEntries.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Change selected hive
   */
  async function selectHive(hive: RegistryHive): Promise<void> {
    selectedHive.value = hive
    currentPath.value = '/'
    await navigateToPath('/')
  }

  /**
   * Refresh current view
   */
  async function refresh(): Promise<void> {
    await navigateToPath(currentPath.value)
  }

  /**
   * Set status filter with debounce
   */
  function setStatusFilter(statuses: DiffStatus[]): void {
    statusFilter.value = statuses

    // Cancel pending debounce
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer)
    }

    // Debounce the refetch
    filterDebounceTimer = setTimeout(() => {
      navigateToPath(currentPath.value)
    }, 1000)
  }

  /**
   * Watch for changes and initialize
   */
  watch(
    () => [mode, commit, baseCommit, diffeeCommit],
    async () => {
      await fetchAvailableHives()
      if (selectedHive.value) {
        await navigateToPath('/')
      }
    },
    { immediate: true }
  )

  return {
    currentPath,
    entries,
    breadcrumbs,
    isLoading,
    isLoadingHives,
    error,
    availableHives,
    selectedHive,
    navigateToPath,
    selectHive,
    refresh,
    statusFilter,
    setStatusFilter
  }
}

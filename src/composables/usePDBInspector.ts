/**
 * PDB Inspector Composable
 *
 * Reactive state management for Symbols and Structs exploration.
 * Supports both single mode and comparison mode for symbols.
 */

import { ref, computed, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_SYMBOLS, LIST_WINSTRUCT, DIFF_NODES } from '@/queries'
import type { InspectorMode, CommitContext } from '@/types/inspector'
import type {
  SymbolEntry,
  SymbolDiffEntry,
  StructEntry,
  StructDiffEntry,
  StructFieldDiffEntry,
  PDBContext,
  PDBContextDiff
} from '@/types/pdb'
import {
  parseSymbolEntries,
  parseSymbolDiffEntries,
  sortSymbols,
  parseStructEntries,
  parseStructDiffEntries,
  sortStructs,
  parseFieldDiffEntries
} from '@/utils/pdb'
import { resolvePDBContext, resolvePDBContextDiff } from '@/windows/pdb'

export function usePDBInspector(
  mode: InspectorMode,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext
) {
  // ============================================
  // State
  // ============================================

  const isLoading = ref(false)
  const isLoadingContext = ref(false)
  const error = ref<Error | null>(null)

  // PDB Context (resolved ntoskrnl.exe)
  const pdbContext = ref<PDBContext | null>(null)
  const pdbContextDiff = ref<PDBContextDiff | null>(null)

  // Active sub-tab
  const activeSubTab = ref<'symbols' | 'structs'>('symbols')

  // Symbols state
  const rawSymbols = ref<any[]>([])
  const totalSymbols = ref(0)

  // Progressive loading state for symbols (single mode only)
  const symbolsOffset = ref(0)
  const symbolsBatchSize = ref(1000) // 1000 symbols per batch
  const hasMoreSymbols = ref(true)
  const isLoadingMoreSymbols = ref(false)

  // Structs state
  const rawStructs = ref<any[]>([])
  const totalStructs = ref(0)
  const expandedStructNames = ref<Set<string>>(new Set())

  // Progressive loading state (single mode only)
  const structsOffset = ref(0)
  const structsBatchSize = ref(400) // 400 structs per batch
  const hasMoreStructs = ref(true)
  const isLoadingMoreStructs = ref(false)

  // Pagination state for comparison mode - Symbols only
  const symbolsCurrentPage = ref(1)
  const symbolsPageSize = 1000

  // Struct fields for comparison mode (cached for field-level diffs)
  const computedFieldDiffs = ref<Map<string, StructFieldDiffEntry[]>>(new Map()) // Cache computed field diffs

  // ============================================
  // Computed
  // ============================================

  const symbols = computed<SymbolEntry[] | SymbolDiffEntry[]>(() => {
    if (mode === 'single') {
      return sortSymbols(parseSymbolEntries(rawSymbols.value))
    } else {
      return sortSymbols(parseSymbolDiffEntries(rawSymbols.value))
    }
  })

  const hasPDBData = computed(() => pdbContext.value !== null || pdbContextDiff.value !== null)

  const structs = computed<StructEntry[] | StructDiffEntry[]>(() => {
    if (mode === 'single') {
      return sortStructs(parseStructEntries(rawStructs.value))
    } else {
      const parsedStructs = sortStructs(parseStructDiffEntries(rawStructs.value))
      // Merge in computed field diffs for comparison mode
      return parsedStructs.map((struct) => ({
        ...struct,
        fields: computedFieldDiffs.value.get(struct.name)
      }))
    }
  })

  // Computed page count for symbols pagination (comparison mode)
  const totalSymbolPages = computed(() => Math.ceil(totalSymbols.value / symbolsPageSize))

  // ============================================
  // Data Fetching - Single Mode
  // ============================================

  async function fetchSymbolsSingle(): Promise<void> {
    if (!pdbContext.value) {
      console.warn('Cannot fetch symbols: no PDB context')
      return
    }

    isLoading.value = true
    error.value = null

    // Reset progressive loading state
    symbolsOffset.value = 0
    hasMoreSymbols.value = true
    rawSymbols.value = [] // Clear existing

    try {
      const response = await gqlClient.query({
        query: LIST_SYMBOLS,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: symbolsBatchSize.value, offset: 0 },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      rawSymbols.value = response.data?.fetchSymbols || []
      totalSymbols.value = response.data?.symbolsAggregate?.count || 0

      // Update state for progressive loading
      symbolsOffset.value = rawSymbols.value.length
      hasMoreSymbols.value = rawSymbols.value.length < totalSymbols.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error fetching symbols:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ============================================
  // Data Fetching - Comparison Mode
  // ============================================

  async function fetchSymbolsComparison(): Promise<void> {
    if (!pdbContextDiff.value) {
      console.warn('Cannot fetch symbol diff: no PDB context diff')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Calculate offset for pagination
      const offset = (symbolsCurrentPage.value - 1) * symbolsPageSize

      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: '/',
          maxDepth: 0, // Only immediate children (symbols are direct children of Blob)
          filter: ['Symbol'],
          options: { offset, limit: symbolsPageSize }
        }
      })

      rawSymbols.value = response.data?.diffNodesAt?.items || []
      totalSymbols.value = response.data?.diffNodesAt?.total_count || 0
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error fetching symbol diff:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ============================================
  // Progressive Loading - Symbols (Single Mode)
  // ============================================

  async function loadMoreSymbols(): Promise<void> {
    if (!pdbContext.value || !hasMoreSymbols.value || isLoadingMoreSymbols.value) {
      return // Prevent duplicate requests
    }

    isLoadingMoreSymbols.value = true

    try {
      const response = await gqlClient.query({
        query: LIST_SYMBOLS,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: symbolsBatchSize.value, offset: symbolsOffset.value },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      const newSymbols = response.data?.fetchSymbols || []

      // APPEND to existing symbols
      rawSymbols.value = [...rawSymbols.value, ...newSymbols]

      // Update state
      symbolsOffset.value += newSymbols.length
      hasMoreSymbols.value = rawSymbols.value.length < totalSymbols.value
    } catch (err) {
      console.error('Error loading more symbols:', err)
      // Don't set global error - just log and allow retry
    } finally {
      isLoadingMoreSymbols.value = false
    }
  }

  function handleSymbolsScroll(event: Event): void {
    if (mode !== 'single' || !hasMoreSymbols.value) {
      return
    }

    const target = event.target as HTMLElement
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight

    // Calculate scroll percentage
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when scrolled past 80%
    if (scrollPercentage > 0.8) {
      loadMoreSymbols()
    }
  }

  function handleSymbolsPageChange(page: number): void {
    if (mode === 'comparison') {
      symbolsCurrentPage.value = page
      fetchSymbols()
    }
  }

  // ============================================
  // Struct Data Fetching - Single Mode
  // ============================================

  async function fetchStructsSingle(): Promise<void> {
    if (!pdbContext.value) {
      console.warn('Cannot fetch structs: no PDB context')
      return
    }

    isLoading.value = true
    error.value = null

    // Reset progressive loading state
    structsOffset.value = 0
    hasMoreStructs.value = true
    rawStructs.value = [] // Clear existing

    try {
      const response = await gqlClient.query({
        query: LIST_WINSTRUCT,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: structsBatchSize.value, offset: 0 },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      rawStructs.value = response.data?.fetchStructs || []
      totalStructs.value = response.data?.structsAggregate?.count || 0

      // Update state for progressive loading
      structsOffset.value = rawStructs.value.length
      hasMoreStructs.value = rawStructs.value.length < totalStructs.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error fetching structs:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ============================================
  // Struct Data Fetching - Comparison Mode
  // ============================================

  async function fetchStructsComparison(): Promise<void> {
    if (!pdbContextDiff.value) {
      console.warn('Cannot fetch struct diff: no PDB context diff')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: '/',
          maxDepth: 0, // Only immediate children (structs are direct children of Blob)
          filter: ['Struct']
          // NO OPTIONS - fetch all diffs at once
        }
      })

      rawStructs.value = response.data?.diffNodesAt?.items || []
      totalStructs.value = response.data?.diffNodesAt?.total_count || 0
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error fetching struct diff:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ============================================
  // Progressive Loading - Single Mode
  // ============================================

  async function loadMoreStructs(): Promise<void> {
    if (!pdbContext.value || !hasMoreStructs.value || isLoadingMoreStructs.value) {
      return // Prevent duplicate requests
    }

    isLoadingMoreStructs.value = true

    try {
      const response = await gqlClient.query({
        query: LIST_WINSTRUCT,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: structsBatchSize.value, offset: structsOffset.value },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      const newStructs = response.data?.fetchStructs || []

      // APPEND to existing structs
      rawStructs.value = [...rawStructs.value, ...newStructs]

      // Update state
      structsOffset.value += newStructs.length
      hasMoreStructs.value = rawStructs.value.length < totalStructs.value
    } catch (err) {
      console.error('Error loading more structs:', err)
      // Don't set global error - just log and allow retry
    } finally {
      isLoadingMoreStructs.value = false
    }
  }

  function handleStructsScroll(event: Event): void {
    if (mode !== 'single' || !hasMoreStructs.value) {
      return
    }

    const target = event.target as HTMLElement
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight

    // Calculate scroll percentage
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when scrolled past 80%
    if (scrollPercentage > 0.8) {
      loadMoreStructs()
    }
  }

  // ============================================
  // Field-Level Diff (Comparison Mode)
  // ============================================

  async function fetchStructFieldDiff(structName: string): Promise<StructFieldDiffEntry[]> {
    if (!pdbContextDiff.value) {
      return []
    }

    try {
      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: `/${structName}`,
          maxDepth: 0,
          filter: ['StructField'],
          options: {
            status_filter: ['NEW', 'MOD', 'DEL', 'UNCHANGED']
          }
        }
      })

      return parseFieldDiffEntries(response.data?.diffNodesAt?.items || [])
    } catch (err) {
      console.error('Error fetching struct field diff:', err)
      return []
    }
  }

  // ============================================
  // Public Methods
  // ============================================

  async function fetchSymbols(): Promise<void> {
    if (mode === 'single') {
      await fetchSymbolsSingle()
    } else {
      await fetchSymbolsComparison()
    }
  }

  async function fetchStructs(): Promise<void> {
    if (mode === 'single') {
      await fetchStructsSingle()
    } else {
      await fetchStructsComparison()
    }
  }

  async function toggleStructExpansion(structName: string): Promise<void> {
    if (expandedStructNames.value.has(structName)) {
      // Collapse
      expandedStructNames.value.delete(structName)
    } else {
      // Expand
      expandedStructNames.value.add(structName)

      // Fetch field-level data in comparison mode
      if (mode === 'comparison' && !computedFieldDiffs.value.has(structName)) {
        const fieldDiff = await fetchStructFieldDiff(structName)
        computedFieldDiffs.value.set(structName, fieldDiff)
      }
    }
  }

  // ============================================
  // Initialization
  // ============================================

  async function initialize(): Promise<void> {
    isLoadingContext.value = true
    error.value = null

    try {
      if (mode === 'single' && commit) {
        pdbContext.value = await resolvePDBContext(commit.hash)
        pdbContextDiff.value = null

        if (!pdbContext.value) {
          console.warn('Could not resolve PDB context for commit:', commit.hash)
          return
        }
      } else if (mode === 'comparison' && baseCommit && diffeeCommit) {
        pdbContextDiff.value = await resolvePDBContextDiff(baseCommit.hash, diffeeCommit.hash)
        pdbContext.value = null

        if (!pdbContextDiff.value) {
          console.warn('Could not resolve PDB context diff for commits')
          return
        }
      } else {
        console.warn('Invalid mode or missing commits')
        return
      }

      // Fetch initial symbols data
      await fetchSymbols()
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error initializing PDB inspector:', err)
    } finally {
      isLoadingContext.value = false
    }
  }

  // Watch for mode/commit changes
  watch(
    () => [mode, commit, baseCommit, diffeeCommit],
    () => {
      initialize()
    },
    { immediate: true }
  )

  // Watch for sub-tab changes
  watch(activeSubTab, async (newTab) => {
    if (newTab === 'symbols' && rawSymbols.value.length === 0) {
      await fetchSymbols()
    } else if (newTab === 'structs' && rawStructs.value.length === 0) {
      await fetchStructs()
    }
  })

  return {
    // State
    isLoading,
    isLoadingContext,
    error,
    hasPDBData,
    pdbContext,
    pdbContextDiff,
    activeSubTab,

    // Symbols
    symbols,
    totalSymbols,

    // Symbols progressive loading (single mode)
    hasMoreSymbols,
    isLoadingMoreSymbols,

    // Symbols pagination (comparison mode)
    symbolsCurrentPage,
    symbolsPageSize,
    totalSymbolPages,

    // Structs
    structs,
    totalStructs,
    expandedStructNames,

    // Structs progressive loading (single mode)
    hasMoreStructs,
    isLoadingMoreStructs,

    // Methods
    fetchSymbols,
    handleSymbolsScroll,
    handleSymbolsPageChange,
    fetchStructs,
    handleStructsScroll,
    toggleStructExpansion
  }
}

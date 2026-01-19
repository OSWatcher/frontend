/**
 * PDB Inspector Composable
 *
 * Reactive state management for Symbols and Structs exploration.
 * Supports both single mode and comparison mode for symbols.
 */

import { ref, computed, watch } from 'vue'
import gqlClient from '@/graphql-client'
import {
  LIST_SYMBOLS_CONNECTION,
  LIST_WINSTRUCT,
  FETCH_STRUCT_FIELDS,
  DIFF_NODES,
  FETCH_SYMBOL_BY_NAME,
  FETCH_STRUCT_BY_NAME
} from '@/queries'
import type { InspectorMode, CommitContext } from '@/types/inspector'
import type {
  SymbolEntry,
  SymbolDiffEntry,
  StructEntry,
  StructFieldEntry,
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
  parseStructFieldEntries,
  parseStructDiffEntries,
  sortStructs,
  parseFieldDiffEntries,
  parseSymbolConnectionEdges,
  parseSymbolConnectionEdge,
  parseStructConnectionEdges,
  parseStructConnectionEdge
} from '@/utils/pdb'
import { resolvePDBContext, resolvePDBContextDiff } from '@/windows/pdb'
import { DiffStatus } from '@/graphql-types'

export function usePDBInspector(
  mode: InspectorMode,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext,
  targetSymbolName?: string,
  targetPdbTab?: 'symbols' | 'structs',
  targetStructName?: string
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
  const activeSubTab = ref<'symbols' | 'structs'>(targetPdbTab || 'symbols')

  // Symbols state
  const rawSymbols = ref<any[]>([])
  const totalSymbols = ref(0)

  // Progressive loading state for symbols (single mode only) - cursor-based pagination
  const symbolsEndCursor = ref<string | null>(null)
  const symbolsBatchSize = ref(1000) // 1000 symbols per batch
  const hasMoreSymbols = ref(true)
  const isLoadingMoreSymbols = ref(false)

  // Structs state
  const rawStructs = ref<any[]>([])
  const totalStructs = ref(0)
  const expandedStructNames = ref<Set<string>>(new Set())

  // Progressive loading state (single mode only) - cursor-based pagination
  const structsEndCursor = ref<string | null>(null)
  const structsBatchSize = ref(400) // 400 structs per batch
  const hasMoreStructs = ref(true)
  const isLoadingMoreStructs = ref(false)

  // Pagination state for comparison mode - Symbols only
  const symbolsCurrentPage = ref(1)
  const symbolsPageSize = 1000

  // Struct fields cache (for both modes - lazy loaded on expansion)
  const structFieldsCache = ref<Map<string, StructFieldEntry[] | StructFieldDiffEntry[]>>(new Map())

  // Status filter state (comparison mode only)
  const symbolsStatusFilter = ref<DiffStatus[]>([])
  const structsStatusFilter = ref<DiffStatus[]>([])
  let symbolsFilterDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let structsFilterDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // Target search state (for search navigation)
  const isSearchingForTargetSymbol = ref(false)
  const targetSymbolNotFound = ref(false)
  const isSearchingForTargetStruct = ref(false)
  const targetStructNotFound = ref(false)

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
      const parsedStructs = sortStructs(parseStructEntries(rawStructs.value))
      // Merge in cached fields for single mode (lazy loaded)
      return parsedStructs.map((struct) => ({
        ...struct,
        fields: structFieldsCache.value.get(struct.hash || struct.name) as
          | StructFieldEntry[]
          | undefined
      }))
    } else {
      const parsedStructs = sortStructs(parseStructDiffEntries(rawStructs.value))
      // Merge in cached field diffs for comparison mode
      return parsedStructs.map((struct) => ({
        ...struct,
        fields: structFieldsCache.value.get(struct.name) as StructFieldDiffEntry[] | undefined
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
    symbolsEndCursor.value = null
    hasMoreSymbols.value = true
    rawSymbols.value = [] // Clear existing

    try {
      const response = await gqlClient.query({
        query: LIST_SYMBOLS_CONNECTION,
        variables: {
          blobHash: pdbContext.value.blobHash,
          first: symbolsBatchSize.value,
          after: null
        }
      })

      const connection = response.data?.blobs?.[0]?.has_symbolConnection
      if (connection) {
        rawSymbols.value = parseSymbolConnectionEdges(connection.edges)
        totalSymbols.value = connection.totalCount || 0
        symbolsEndCursor.value = connection.pageInfo?.endCursor || null
        hasMoreSymbols.value = connection.pageInfo?.hasNextPage || false
      }
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

      // Build options with optional status filter
      const options: any = { offset, limit: symbolsPageSize }
      if (symbolsStatusFilter.value.length > 0) {
        options.status_filter = symbolsStatusFilter.value
      }

      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: '/',
          maxDepth: 1, // Only immediate children (symbols are direct children of Blob)
          filter: ['Symbol'],
          options
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
        query: LIST_SYMBOLS_CONNECTION,
        variables: {
          blobHash: pdbContext.value.blobHash,
          first: symbolsBatchSize.value,
          after: symbolsEndCursor.value
        }
      })

      const connection = response.data?.blobs?.[0]?.has_symbolConnection
      if (connection) {
        const newSymbols = parseSymbolConnectionEdges(connection.edges)

        // APPEND to existing symbols
        rawSymbols.value = [...rawSymbols.value, ...newSymbols]

        // Update cursor-based pagination state
        symbolsEndCursor.value = connection.pageInfo?.endCursor || null
        hasMoreSymbols.value = connection.pageInfo?.hasNextPage || false
      }
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
    structsEndCursor.value = null
    hasMoreStructs.value = true
    rawStructs.value = [] // Clear existing

    try {
      const response = await gqlClient.query({
        query: LIST_WINSTRUCT,
        variables: {
          blobHash: pdbContext.value.blobHash,
          first: structsBatchSize.value,
          after: null
        }
      })

      const connection = response.data?.blobs?.[0]?.has_structConnection
      if (connection) {
        rawStructs.value = parseStructConnectionEdges(connection.edges)
        totalStructs.value = connection.totalCount || 0
        structsEndCursor.value = connection.pageInfo?.endCursor || null
        hasMoreStructs.value = connection.pageInfo?.hasNextPage || false
      }
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
      // Build options with optional status filter
      const options: any = {}
      if (structsStatusFilter.value.length > 0) {
        options.status_filter = structsStatusFilter.value
      }

      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: '/',
          maxDepth: 1, // Only immediate children (structs are direct children of Blob)
          filter: ['Struct'],
          options: Object.keys(options).length > 0 ? options : undefined
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
          first: structsBatchSize.value,
          after: structsEndCursor.value
        }
      })

      const connection = response.data?.blobs?.[0]?.has_structConnection
      if (connection) {
        const newStructs = parseStructConnectionEdges(connection.edges)

        // APPEND to existing structs
        rawStructs.value = [...rawStructs.value, ...newStructs]

        // Update cursor-based pagination state
        structsEndCursor.value = connection.pageInfo?.endCursor || null
        hasMoreStructs.value = connection.pageInfo?.hasNextPage || false
      }
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
          maxDepth: 1,
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

  /**
   * Fetch struct fields for single mode (lazy loading)
   */
  async function fetchStructFields(structHash: string): Promise<StructFieldEntry[]> {
    try {
      const response = await gqlClient.query({
        query: FETCH_STRUCT_FIELDS,
        variables: { structHash }
      })

      const edges = response.data?.structs?.[0]?.fieldsConnection?.edges || []
      return parseStructFieldEntries(edges)
    } catch (err) {
      console.error('Error fetching struct fields:', err)
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

  async function toggleStructExpansion(structName: string, structHash?: string): Promise<void> {
    if (expandedStructNames.value.has(structName)) {
      // Collapse
      expandedStructNames.value.delete(structName)
    } else {
      // Expand
      expandedStructNames.value.add(structName)

      // Determine cache key: hash for single mode, name for comparison mode
      const cacheKey = mode === 'single' && structHash ? structHash : structName

      // Fetch field-level data if not already cached
      if (!structFieldsCache.value.has(cacheKey)) {
        if (mode === 'comparison') {
          const fieldDiff = await fetchStructFieldDiff(structName)
          structFieldsCache.value.set(cacheKey, fieldDiff)
        } else if (structHash) {
          // Single mode: fetch fields by hash
          const fields = await fetchStructFields(structHash)
          structFieldsCache.value.set(cacheKey, fields)
        }
      }
    }
  }

  // ============================================
  // Target Item Fetching (Search Navigation)
  // ============================================

  async function fetchSymbolByName(symbolName: string): Promise<void> {
    if (!symbolName || !pdbContext.value) return

    // Check if already in loaded symbols
    const existing = rawSymbols.value.find((s: any) => s.name === symbolName)
    if (existing) return

    isSearchingForTargetSymbol.value = true
    targetSymbolNotFound.value = false

    try {
      const response = await gqlClient.query({
        query: FETCH_SYMBOL_BY_NAME,
        variables: {
          blobHash: pdbContext.value.blobHash,
          symbolName: symbolName
        }
      })

      const edges = response.data?.blobs?.[0]?.has_symbolConnection?.edges || []
      if (edges.length > 0) {
        // Add to rawSymbols if not already present
        const newSymbol = parseSymbolConnectionEdge(edges[0])
        // Prepend to make it visible at top
        rawSymbols.value = [newSymbol, ...rawSymbols.value]
      } else {
        targetSymbolNotFound.value = true
      }
    } catch (err) {
      console.error('Error fetching symbol by name:', err)
      targetSymbolNotFound.value = true
    } finally {
      isSearchingForTargetSymbol.value = false
    }
  }

  async function fetchStructByName(structName: string): Promise<void> {
    if (!structName || !pdbContext.value) return

    // Check if already in loaded structs
    const existing = rawStructs.value.find((s: any) => s.name === structName)
    if (existing) return

    isSearchingForTargetStruct.value = true
    targetStructNotFound.value = false

    try {
      const response = await gqlClient.query({
        query: FETCH_STRUCT_BY_NAME,
        variables: {
          blobHash: pdbContext.value.blobHash,
          structName: structName
        }
      })

      const edges = response.data?.blobs?.[0]?.has_structConnection?.edges || []
      if (edges.length > 0) {
        // Add to rawStructs if not already present
        const newStruct = parseStructConnectionEdge(edges[0])
        // Prepend to make it visible at top
        rawStructs.value = [newStruct, ...rawStructs.value]
      } else {
        targetStructNotFound.value = true
      }
    } catch (err) {
      console.error('Error fetching struct by name:', err)
      targetStructNotFound.value = true
    } finally {
      isSearchingForTargetStruct.value = false
    }
  }

  // ============================================
  // Status Filter Handlers
  // ============================================

  function setSymbolsStatusFilter(statuses: DiffStatus[]): void {
    symbolsStatusFilter.value = statuses

    // Cancel pending debounce
    if (symbolsFilterDebounceTimer) {
      clearTimeout(symbolsFilterDebounceTimer)
    }

    // Debounce the refetch (1 second)
    symbolsFilterDebounceTimer = setTimeout(() => {
      fetchSymbols()
    }, 1000)
  }

  function setStructsStatusFilter(statuses: DiffStatus[]): void {
    structsStatusFilter.value = statuses

    // Cancel pending debounce
    if (structsFilterDebounceTimer) {
      clearTimeout(structsFilterDebounceTimer)
    }

    // Debounce the refetch (1 second)
    structsFilterDebounceTimer = setTimeout(() => {
      fetchStructs()
    }, 1000)
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

      // If navigating from search with a target symbol, fetch it if not already loaded
      if (mode === 'single' && targetSymbolName) {
        await fetchSymbolByName(targetSymbolName)
      }

      // If the active tab is structs (from search navigation), fetch structs and target
      if (activeSubTab.value === 'structs') {
        await fetchStructs()
        if (mode === 'single' && targetStructName) {
          await fetchStructByName(targetStructName)
        }
      }
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
      // Fetch target symbol if provided from search navigation
      if (mode === 'single' && targetSymbolName) {
        await fetchSymbolByName(targetSymbolName)
      }
    } else if (newTab === 'structs' && rawStructs.value.length === 0) {
      await fetchStructs()
      // Fetch target struct if provided from search navigation
      if (mode === 'single' && targetStructName) {
        await fetchStructByName(targetStructName)
      }
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
    toggleStructExpansion,

    // Status filters (comparison mode)
    symbolsStatusFilter,
    setSymbolsStatusFilter,
    structsStatusFilter,
    setStructsStatusFilter,

    // Target search state (for search navigation)
    isSearchingForTargetSymbol,
    targetSymbolNotFound,
    isSearchingForTargetStruct,
    targetStructNotFound
  }
}

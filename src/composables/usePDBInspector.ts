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
  PDBContext,
  PDBContextDiff
} from '@/types/pdb'
import {
  parseSymbolEntries,
  parseSymbolDiffEntries,
  sortSymbols,
  parseStructEntries,
  sortStructs
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
  const symbolPage = ref(1)
  const symbolPageSize = ref(50)

  // Structs state
  const rawStructs = ref<any[]>([])
  const totalStructs = ref(0)
  const structPage = ref(1)
  const structPageSize = ref(50)
  const expandedStructHashes = ref<Set<string>>(new Set())

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

  const symbolPageCount = computed(() => Math.ceil(totalSymbols.value / symbolPageSize.value))

  const structs = computed<StructEntry[]>(() => {
    return sortStructs(parseStructEntries(rawStructs.value))
  })

  const structPageCount = computed(() => Math.ceil(totalStructs.value / structPageSize.value))

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

    try {
      const offset = (symbolPage.value - 1) * symbolPageSize.value
      const response = await gqlClient.query({
        query: LIST_SYMBOLS,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: symbolPageSize.value, offset },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      rawSymbols.value = response.data?.fetchSymbols || []
      totalSymbols.value = response.data?.symbolsAggregate?.count || 0
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
      const offset = (symbolPage.value - 1) * symbolPageSize.value
      const response = await gqlClient.query({
        query: DIFF_NODES,
        variables: {
          parentLabel: 'Blob',
          baseNodeHash: pdbContextDiff.value.baseBlobHash,
          diffeeNodeHash: pdbContextDiff.value.diffeeBlobHash,
          atPath: '/',
          maxDepth: 0, // Only immediate children (symbols are direct children of Blob)
          filter: ['Symbol'],
          options: { offset, limit: symbolPageSize.value }
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
  // Struct Data Fetching - Single Mode
  // ============================================

  async function fetchStructsSingle(): Promise<void> {
    if (!pdbContext.value) {
      console.warn('Cannot fetch structs: no PDB context')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const offset = (structPage.value - 1) * structPageSize.value
      const response = await gqlClient.query({
        query: LIST_WINSTRUCT,
        variables: {
          blobHash: pdbContext.value.blobHash,
          options: { limit: structPageSize.value, offset },
          where: { blob: { hash: pdbContext.value.blobHash } }
        }
      })

      rawStructs.value = response.data?.fetchStructs || []
      totalStructs.value = response.data?.structsAggregate?.count || 0
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error fetching structs:', err)
    } finally {
      isLoading.value = false
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

  function setSymbolPage(page: number): void {
    symbolPage.value = page
    fetchSymbols()
  }

  async function fetchStructs(): Promise<void> {
    // For now, only single mode is supported
    if (mode === 'single') {
      await fetchStructsSingle()
    }
    // TODO: Add comparison mode support later
  }

  function setStructPage(page: number): void {
    structPage.value = page
    fetchStructs()
  }

  function toggleStructExpansion(structHash: string): void {
    if (expandedStructHashes.value.has(structHash)) {
      expandedStructHashes.value.delete(structHash)
    } else {
      expandedStructHashes.value.add(structHash)
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
    symbolPage,
    symbolPageSize,
    symbolPageCount,

    // Structs
    structs,
    totalStructs,
    structPage,
    structPageSize,
    structPageCount,
    expandedStructHashes,

    // Methods
    fetchSymbols,
    setSymbolPage,
    fetchStructs,
    setStructPage,
    toggleStructExpansion
  }
}

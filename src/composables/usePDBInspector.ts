/**
 * PDB Inspector Composable
 *
 * Reactive state management for Symbols and Structs exploration.
 * Currently supports symbols only in single mode.
 */

import { ref, computed, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_SYMBOLS } from '@/queries'
import type { CommitContext } from '@/types/inspector'
import type { SymbolEntry, PDBContext } from '@/types/pdb'
import { parseSymbolEntries, sortSymbols } from '@/utils/pdb'
import { resolvePDBContext } from '@/windows/pdb'

export function usePDBInspector(commit?: CommitContext) {
  // ============================================
  // State
  // ============================================

  const isLoading = ref(false)
  const isLoadingContext = ref(false)
  const error = ref<Error | null>(null)

  // PDB Context (resolved ntoskrnl.exe)
  const pdbContext = ref<PDBContext | null>(null)

  // Active sub-tab
  const activeSubTab = ref<'symbols' | 'structs'>('symbols')

  // Symbols state
  const rawSymbols = ref<any[]>([])
  const totalSymbols = ref(0)
  const symbolPage = ref(1)
  const symbolPageSize = ref(50)

  // ============================================
  // Computed
  // ============================================

  const symbols = computed<SymbolEntry[]>(() => {
    return sortSymbols(parseSymbolEntries(rawSymbols.value))
  })

  const hasPDBData = computed(() => pdbContext.value !== null)

  const symbolPageCount = computed(() => Math.ceil(totalSymbols.value / symbolPageSize.value))

  // ============================================
  // Data Fetching - Single Mode
  // ============================================

  async function fetchSymbols(): Promise<void> {
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
  // Public Methods
  // ============================================

  function setSymbolPage(page: number): void {
    symbolPage.value = page
    fetchSymbols()
  }

  // ============================================
  // Initialization
  // ============================================

  async function initialize(): Promise<void> {
    if (!commit) {
      console.warn('No commit provided to PDB inspector')
      return
    }

    isLoadingContext.value = true
    error.value = null

    try {
      pdbContext.value = await resolvePDBContext(commit.hash)

      if (!pdbContext.value) {
        console.warn('Could not resolve PDB context for commit:', commit.hash)
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

  // Watch for commit changes
  watch(
    () => commit,
    () => {
      initialize()
    },
    { immediate: true }
  )

  // Watch for sub-tab changes (for future struct support)
  watch(activeSubTab, async (newTab) => {
    if (newTab === 'symbols' && rawSymbols.value.length === 0) {
      await fetchSymbols()
    }
    // Future: handle 'structs' tab
  })

  return {
    // State
    isLoading,
    isLoadingContext,
    error,
    hasPDBData,
    pdbContext,
    activeSubTab,

    // Symbols
    symbols,
    totalSymbols,
    symbolPage,
    symbolPageSize,
    symbolPageCount,

    // Methods
    fetchSymbols,
    setSymbolPage
  }
}

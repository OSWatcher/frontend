import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

interface UseTableFilterOptions<T> {
  entries: Ref<T[]> | ComputedRef<T[]>
  filterKey?: keyof T
  clearOnChange?: Ref<unknown> | ComputedRef<unknown>
}

interface UseTableFilterReturn<T> {
  searchQuery: Ref<string>
  filteredEntries: ComputedRef<T[]>
  totalCount: ComputedRef<number>
  filterInputRef: Ref<HTMLInputElement | null>
  clearFilter: () => void
}

export function useTableFilter<T extends Record<string, unknown>>(
  options: UseTableFilterOptions<T>
): UseTableFilterReturn<T> {
  const { entries, filterKey = 'name' as keyof T, clearOnChange } = options

  const searchQuery = ref('')
  const filterInputRef = ref<HTMLInputElement | null>(null)

  const filteredEntries = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    if (!query) return entries.value
    return entries.value.filter((entry) => {
      const value = entry[filterKey]
      return typeof value === 'string' && value.toLowerCase().includes(query)
    })
  })

  const totalCount = computed(() => entries.value.length)

  const clearFilter = () => {
    searchQuery.value = ''
  }

  // Clear filter when watched value changes (e.g., currentPath)
  if (clearOnChange) {
    watch(clearOnChange, clearFilter)
  }

  // Keyboard shortcuts
  onMounted(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // "/" to focus filter (when not already in an input)
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        filterInputRef.value?.focus()
      }
      // Escape to clear filter
      if (e.key === 'Escape' && searchQuery.value) {
        clearFilter()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
  })

  return {
    searchQuery,
    filteredEntries,
    totalCount,
    filterInputRef,
    clearFilter
  }
}

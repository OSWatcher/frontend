import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface CommitInfo {
  hash: string
  name: string
}

/**
 * Commit Selection Store
 *
 * Manages selection of commits for diff comparison.
 * Replaces props drilling pattern from old CommitsTable component.
 */
export const useCommitSelectionStore = defineStore('commitSelection', () => {
  // State
  const selectedCommits = ref<CommitInfo[]>([])
  const maxSelection = 2

  // Computed
  const canDiff = computed(() => selectedCommits.value.length === maxSelection)

  const diffLink = computed(() => {
    if (canDiff.value) {
      const [base, diffee] = selectedCommits.value
      return `/diff/${base.hash}/${diffee.hash}?base_name=${encodeURIComponent(base.name)}&diffee_name=${encodeURIComponent(diffee.name)}`
    }
    return null
  })

  const canSelect = computed(() => selectedCommits.value.length < maxSelection)

  // Actions
  function toggle(hash: string, name: string) {
    const index = selectedCommits.value.findIndex((c) => c.hash === hash)
    if (index >= 0) {
      // Remove if already selected
      selectedCommits.value.splice(index, 1)
    } else if (selectedCommits.value.length < maxSelection) {
      // Add if under limit
      selectedCommits.value.push({ hash, name })
    }
  }

  function isSelected(hash: string): boolean {
    return selectedCommits.value.some((c) => c.hash === hash)
  }

  function clear() {
    selectedCommits.value = []
  }

  function getSelectionLabel(hash: string): string | null {
    const index = selectedCommits.value.findIndex((c) => c.hash === hash)
    if (index === -1) return null
    return index === 0 ? 'Base' : 'Diffee'
  }

  return {
    // State
    selectedCommits,
    maxSelection,

    // Computed
    canDiff,
    diffLink,
    canSelect,

    // Actions
    toggle,
    isSelected,
    clear,
    getSelectionLabel
  }
})

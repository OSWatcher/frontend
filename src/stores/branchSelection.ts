import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Branch Selection Store
 *
 * Manages the currently selected branch across the application.
 * Used by HomeView and search functionality.
 */
export const useBranchSelectionStore = defineStore('branchSelection', () => {
  // State
  const selectedBranchName = ref<string>('')
  const selectedBranchHash = ref<string>('')

  // Actions
  function selectBranch(branchName: string, commitHash: string) {
    selectedBranchName.value = branchName
    selectedBranchHash.value = commitHash
  }

  function clear() {
    selectedBranchName.value = ''
    selectedBranchHash.value = ''
  }

  return {
    // State
    selectedBranchName,
    selectedBranchHash,

    // Actions
    selectBranch,
    clear
  }
})

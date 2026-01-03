import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Search Context Store
 *
 * Manages search context to communicate active inspector tab to the search modal.
 * Used by InspectorView to signal which tab is active, and by App.vue to
 * determine default entity types for search.
 */
export const useSearchContextStore = defineStore('searchContext', () => {
  // State
  const activeInspectorTab = ref<'filesystem' | 'registry' | null>(null)
  const isInInspectorView = ref(false)

  // Getters
  const isInspectorMode = computed(
    () => isInInspectorView.value && activeInspectorTab.value !== null
  )

  // Actions
  function setActiveTab(tab: 'filesystem' | 'registry' | null) {
    activeInspectorTab.value = tab
  }

  function setInspectorView(inInspector: boolean) {
    isInInspectorView.value = inInspector
    if (!inInspector) {
      activeInspectorTab.value = null
    }
  }

  function clear() {
    activeInspectorTab.value = null
    isInInspectorView.value = false
  }

  return {
    // State
    activeInspectorTab,
    isInInspectorView,

    // Getters
    isInspectorMode,

    // Actions
    setActiveTab,
    setInspectorView,
    clear
  }
})

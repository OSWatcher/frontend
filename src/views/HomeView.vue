<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BButton, BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import { useFetchHomeData } from '@/composables/useFetchHomeData'
import { useCommitSelectionStore } from '@/stores/commitSelection'
import CommitGraph from '@/components/CommitGraph.vue'

const { branchesWithCommits, error } = useFetchHomeData()
const commitSelection = useCommitSelectionStore()

// Branch selection
const selectedBranch = ref('')

// Auto-select first branch when data loads
watch(branchesWithCommits, (branches) => {
  if (branches.length > 0 && !selectedBranch.value) {
    selectedBranch.value = branches[0].branch.name
  }
}, { immediate: true })

const maintenanceMode = computed(() => !!error.value)
</script>

<template>
  <main class="container mt-4">
    <!-- Maintenance mode -->
    <div v-if="maintenanceMode" class="alert alert-warning">
      <h3><i class="bi bi-tools"></i> Maintenance Mode</h3>
      <p>The backend is currently unavailable.</p>
    </div>

    <!-- Main content -->
    <div v-else>
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-git"></i> Commit History</h2>

        <div class="d-flex gap-2 align-items-center">
          <!-- Branch selector -->
          <BDropdown :text="`Branch: ${selectedBranch}`" variant="outline-secondary" v-if="branchesWithCommits.length > 1">
            <BDropdownItem
              v-for="branchData in branchesWithCommits"
              :key="branchData.branch.name"
              :active="selectedBranch === branchData.branch.name"
              @click="selectedBranch = branchData.branch.name"
            >
              {{ branchData.branch.name }}
            </BDropdownItem>
          </BDropdown>
          <h4 v-else class="mb-0 text-muted">{{ selectedBranch }}</h4>

          <!-- Compare button -->
          <BButton
            v-if="commitSelection.canDiff"
            variant="success"
            :to="commitSelection.diffLink || ''"
          >
            <i class="bi bi-file-diff"></i> Compare Selected ({{ commitSelection.selectedCommits.length }}/2)
          </BButton>
          <span v-else class="text-muted small">
            Select 2 commits to compare
          </span>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="branchesWithCommits.some((b) => b.loading.value)" class="text-center p-5">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading commits...</span>
        </div>
      </div>

      <!-- Commit graph visualization -->
      <div v-else-if="branchesWithCommits.length > 0">
        <CommitGraph
          :branches-with-commits="branchesWithCommits"
          :selected-branch="selectedBranch"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="text-center p-5 text-muted">
        <i class="bi bi-inbox" style="font-size: 3rem"></i>
        <p>No commits found for this branch.</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Minimal styles - most styling is in CommitGraph component */
</style>

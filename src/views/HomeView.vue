<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BCard, BButton, BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import { useFetchHomeData } from '@/composables/useFetchHomeData'
import CommitTable from '@/components/CommitsTable.vue'

// Use the new composable for data fetching
const { branchesWithCommits, error } = useFetchHomeData()

const fields = [
  { key: 'name', label: 'Commit Name' },
  { key: 'description', label: 'Description' },
  { key: 'view', label: '' }
]

// Track selected commits separately from data
const selectedCommits = ref<any[]>([])
const maintenanceMode = computed(() => !!error.value)

// Branch selection state - default to first available branch
const selectedBranch = ref('')

// Set default branch when data loads
watch(branchesWithCommits, (newBranches) => {
  if (newBranches.length > 0 && !selectedBranch.value) {
    selectedBranch.value = newBranches[0].branch.name
  }
}, { immediate: true })

// Get the currently selected branch data
const currentBranchData = computed(() =>
  branchesWithCommits.value.find((b) => b.branch.name === selectedBranch.value)
)

// Helper function to check if a commit is selected
const isCommitSelected = (commit: any) => selectedCommits.value.some((c) => c.hash === commit.hash)

function handleCheckboxChange(item: any, checked: boolean) {
  if (checked) {
    if (selectedCommits.value.length < 2) {
      selectedCommits.value.push(item)
    } else {
      alert('You can only select up to 2 commits.')
    }
  } else {
    selectedCommits.value = selectedCommits.value.filter((commit) => commit.hash !== item.hash)
  }
}

const diffViewLink = computed(() => {
  if (selectedCommits.value.length !== 2) {
    return {}
  }
  return {
    name: 'DiffView',
    params: {
      base_hash: selectedCommits.value[0]?.hash,
      diffee_hash: selectedCommits.value[1]?.hash
    },
    query: {
      base_name: selectedCommits.value[0]?.name,
      diffee_name: selectedCommits.value[1]?.name
    }
  }
})
</script>

<template>
  <main class="container mt-3">
    <!-- Maintenance mode display -->
    <div v-if="maintenanceMode">
      <BCard>
        <h1><i class="bi bi-tools"></i> Maintenance</h1>
      </BCard>
    </div>

    <!-- Main content when not in maintenance mode -->
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-git"></i> Branch: {{ selectedBranch }}</h2>

        <div class="d-flex gap-2">
          <!-- Branch Selector Dropdown -->
          <BDropdown :text="selectedBranch" variant="outline-secondary">
            <BDropdownItem
              v-for="branchData in branchesWithCommits"
              :key="branchData.branch.name"
              :active="selectedBranch === branchData.branch.name"
              @click="selectedBranch = branchData.branch.name"
            >
              {{ branchData.branch.name }}
            </BDropdownItem>
          </BDropdown>

          <!-- Diff Button -->
          <BButton variant="primary" :disabled="selectedCommits.length !== 2" :to="diffViewLink">
            Diff
          </BButton>
        </div>
      </div>

      <!-- Single Branch Display -->
      <div v-if="currentBranchData" class="card">
        <div class="card-header">
          <strong>{{ currentBranchData.branch.name }}</strong>
        </div>
        <CommitTable
          :commits="currentBranchData.commits.value"
          :fields="fields"
          :selectedCommits="selectedCommits"
          :isLoading="currentBranchData.loading.value"
          :isCommitSelected="isCommitSelected"
          @handleCheckboxChange="handleCheckboxChange"
        />
      </div>
    </div>
  </main>
</template>

<style>
.badge {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75px;
  display: inline-block;
}
</style>

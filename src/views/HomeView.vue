<script setup lang="ts">
import { ref, computed } from 'vue'
import { BCard, BButton, TableItem } from 'bootstrap-vue-next'
import { useFetchHomeData } from '@/composables/useFetchHomeData'
import CommitTable from '@/components/CommitsTable.vue'

// Use the new composable for data fetching
const { branchesWithCommits, loading, error } = useFetchHomeData()

const MAIN_BRANCH: string = 'master'

const fields = [
  { key: 'name', label: 'Commit Name' },
  { key: 'description', label: 'Description' },
  { key: 'view', label: '' }
]

// Track selected commits separately from data
const selectedCommits = ref<any[]>([])
const maintenanceMode = computed(() => !!error.value)

// Find the master branch data
const masterBranchData = computed(() =>
  branchesWithCommits.value.find((b) => b.branch.name === MAIN_BRANCH)
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
      <h2 class="mb-4"><i class="bi bi-git"></i> {{ MAIN_BRANCH }} Branch</h2>

      <!-- Main card containing the branch and commit information -->
      <div class="card">
        <!-- Card header with branch name and Diff button -->
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>{{ MAIN_BRANCH }}</strong>
          <BButton
            variant="primary"
            class="ms-auto"
            :disabled="selectedCommits.length !== 2"
            :to="diffViewLink"
          >
            Diff
          </BButton>
        </div>
        <CommitTable
          v-if="masterBranchData"
          :commits="masterBranchData.commits.value"
          :fields="fields"
          :selectedCommits="selectedCommits"
          :isLoading="masterBranchData.loading.value"
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NDropdown, NSpin, NAlert } from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { useFetchHomeData } from '@/composables/useFetchHomeData'
import { useCommitSelectionStore } from '@/stores/commitSelection'
import CommitGraph from '@/components/CommitGraph.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { branchesWithCommits, error } = useFetchHomeData()
const commitSelection = useCommitSelectionStore()

// Branch selection
const selectedBranch = ref('')

// Auto-select first branch when data loads
watch(
  branchesWithCommits,
  (branches) => {
    if (branches.length > 0 && !selectedBranch.value) {
      const firstBranch = branches[0]
      if (firstBranch) {
        selectedBranch.value = firstBranch.branch.name
      }
    }
  },
  { immediate: true }
)

const maintenanceMode = computed(() => !!error.value)

// Dropdown options for branch selector
const branchOptions = computed<DropdownOption[]>(() =>
  branchesWithCommits.value
    .filter((branchData) => branchData !== undefined)
    .map((branchData) => ({
      label: branchData.branch.name,
      key: branchData.branch.name,
    }))
)

function handleBranchSelect(key: string) {
  selectedBranch.value = key
}

function handleCompare() {
  if (commitSelection.diffLink) {
    router.push(commitSelection.diffLink)
  }
}
</script>

<template>
  <main class="home-container">
    <!-- Maintenance mode -->
    <NAlert v-if="maintenanceMode" type="warning" class="maintenance-alert">
      <template #header>
        <div class="alert-header">
          <i class="bi bi-tools"></i>
          <span>Maintenance Mode</span>
        </div>
      </template>
      The backend is currently unavailable.
    </NAlert>

    <!-- Main content -->
    <div v-else class="content">
      <!-- Header -->
      <div class="header">
        <h2 class="title">
          <i class="bi bi-git"></i>
          Commit History
        </h2>

        <div class="actions">
          <!-- Branch selector -->
          <NDropdown
            v-if="branchesWithCommits.length > 1"
            :options="branchOptions"
            @select="handleBranchSelect"
            trigger="click"
          >
            <NButton secondary>
              Branch: {{ selectedBranch }}
              <template #icon>
                <i class="bi bi-chevron-down"></i>
              </template>
            </NButton>
          </NDropdown>
          <span v-else class="branch-label">{{ selectedBranch }}</span>

          <!-- Compare button -->
          <NButton
            v-if="commitSelection.canDiff"
            type="success"
            @click="handleCompare"
          >
            <template #icon>
              <i class="bi bi-file-diff"></i>
            </template>
            Compare Selected ({{ commitSelection.selectedCommits.length }}/2)
          </NButton>
          <span v-else class="hint-text">
            Select 2 commits to compare
          </span>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="branchesWithCommits.some((b) => b?.loading)" class="loading-container">
        <NSpin size="large" />
        <p class="loading-text">Loading commits...</p>
      </div>

      <!-- Commit graph visualization -->
      <div v-else-if="branchesWithCommits.length > 0">
        <CommitGraph
          :branches-with-commits="branchesWithCommits"
          :selected-branch="selectedBranch"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <i class="bi bi-inbox"></i>
        <p>No commits found for this branch.</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.home-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.maintenance-alert {
  margin-bottom: 24px;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.branch-label {
  font-size: 18px;
  font-weight: 500;
  color: #666;
}

.hint-text {
  font-size: 13px;
  color: #999;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
}

.loading-text {
  margin: 0;
  color: #666;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
}

/* Bootstrap icons styling */
.bi {
  line-height: 1;
}
</style>

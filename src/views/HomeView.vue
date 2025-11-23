<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BCard, BButton, BDropdown, BDropdownItem, BBadge } from 'bootstrap-vue-next'
import { useFetchHomeData } from '@/composables/useFetchHomeData'
import { useCommitSelectionStore } from '@/stores/commitSelection'
import { useFetchCommitHistoryQuery, CommitHistoryDirection } from '@/graphql-types'

const { branchesWithCommits, error } = useFetchHomeData()
const commitSelection = useCommitSelectionStore()

// Debug: log branches
watch(branchesWithCommits, (branches) => {
  console.log('Branches loaded:', branches.map(b => ({
    branchName: b.branch.name,
    commitCount: b.commits.value.length
  })))
}, { immediate: true })

// Track which commits have expanded updates
const expandedCommits = ref<Record<string, boolean>>({})
const loadedUpdates = ref<Record<string, any[]>>({})

// Branch selection
const selectedBranch = ref('')

// Auto-select first branch when data loads
watch(branchesWithCommits, (branches) => {
  if (branches.length > 0 && !selectedBranch.value) {
    selectedBranch.value = branches[0].branch.name
  }
}, { immediate: true })

// Get current branch data
const currentBranchData = computed(() =>
  branchesWithCommits.value.find((b) => b.branch.name === selectedBranch.value)
)

// Toggle expansion of update commits
async function toggleExpand(commitHash: string, expandableNextCommits: any[]) {
  expandedCommits.value[commitHash] = !expandedCommits.value[commitHash]

  // Lazy load updates if not already loaded
  if (expandedCommits.value[commitHash] && !loadedUpdates.value[commitHash]) {
    if (expandableNextCommits.length > 0) {
      const firstUpdateHash = expandableNextCommits[0].hash

      const { result } = useFetchCommitHistoryQuery({
        commitHash: firstUpdateHash,
        direction: CommitHistoryDirection.Forward
      })

      // Watch for result
      const stopWatch = watch(result, (newResult) => {
        if (newResult?.fetchCommitHistory) {
          loadedUpdates.value[commitHash] = newResult.fetchCommitHistory
          stopWatch()
        }
      })
    }
  }
}

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
      <div v-if="currentBranchData?.loading.value" class="text-center p-5">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading commits...</span>
        </div>
      </div>

      <!-- Commits list -->
      <div v-else-if="currentBranchData" class="commits-list">
        <!-- Each commit card -->
        <div
          v-for="(commit, index) in currentBranchData.commits.value"
          :key="commit.hash"
          class="commit-row"
        >
          <div class="commit-graph">
            <!-- Graph line (vertical connector) -->
            <div v-if="index > 0" class="graph-line"></div>

            <!-- Commit dot -->
            <div class="graph-dot"></div>

            <!-- Branch line to updates -->
            <div
              v-if="commit.expandableNextCommits && commit.expandableNextCommits.length > 0"
              class="graph-branch-line"
              :class="{ expanded: expandedCommits[commit.hash] }"
            ></div>
          </div>

          <div class="commit-content">
            <div
              class="commit-card"
              :class="{ selected: commitSelection.isSelected(commit.hash) }"
            >
              <!-- Commit header -->
              <div class="commit-header">
                <div class="d-flex align-items-center gap-3">
                  <!-- Selection checkbox -->
                  <input
                    type="checkbox"
                    :checked="commitSelection.isSelected(commit.hash)"
                    @change="commitSelection.toggle(commit.hash)"
                    :disabled="!commitSelection.isSelected(commit.hash) && !commitSelection.canSelect"
                    class="form-check-input"
                  />

                  <!-- Commit name -->
                  <div>
                    <h4 class="mb-0">{{ commit.name }}</h4>
                    <small class="text-muted">{{ new Date(commit.date).toLocaleString() }}</small>
                  </div>

                  <!-- Selection badge -->
                  <BBadge v-if="commitSelection.isSelected(commit.hash)" variant="success">
                    {{ commitSelection.getSelectionLabel(commit.hash) }}
                  </BBadge>
                </div>

                <!-- Actions -->
                <div class="d-flex gap-2">
                  <BButton
                    :to="{ name: 'OSView', params: { os_hash: commit.hash }, query: { os_title: commit.name } }"
                    variant="primary"
                    size="sm"
                  >
                    <i class="bi bi-eye"></i> View Snapshot
                  </BButton>
                </div>
              </div>

              <!-- Commit description -->
              <p class="commit-description text-muted mb-2">{{ commit.description }}</p>

              <!-- Expand updates button -->
              <BButton
                v-if="commit.expandableNextCommits && commit.expandableNextCommits.length > 0"
                @click="toggleExpand(commit.hash, commit.expandableNextCommits)"
                variant="link"
                size="sm"
                class="p-0"
              >
                <i :class="expandedCommits[commit.hash] ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
                {{ expandedCommits[commit.hash] ? 'Hide' : 'Show' }} update history
                ({{ commit.expandableNextCommits.length }} commits)
              </BButton>
            </div>

            <!-- Expanded updates -->
            <div v-if="expandedCommits[commit.hash]" class="updates-list mt-3">
              <div
                v-for="(update, updateIndex) in loadedUpdates[commit.hash]"
                :key="update.hash"
                class="update-row"
              >
                <div class="update-graph">
                  <!-- Update line -->
                  <div v-if="updateIndex > 0" class="update-line"></div>
                  <!-- Update dot -->
                  <div class="update-dot"></div>
                </div>

                <div
                  class="update-card"
                  :class="{ selected: commitSelection.isSelected(update.hash) }"
                >
                  <div class="d-flex align-items-start gap-2">
                    <!-- Checkbox -->
                    <input
                      type="checkbox"
                      :checked="commitSelection.isSelected(update.hash)"
                      @change="commitSelection.toggle(update.hash)"
                      :disabled="!commitSelection.isSelected(update.hash) && !commitSelection.canSelect"
                      class="form-check-input mt-1"
                    />

                    <!-- Update info -->
                    <div class="flex-grow-1">
                      <div class="d-flex justify-content-between align-items-start">
                        <div>
                          <h5 class="mb-0">{{ update.name }}</h5>
                          <small class="text-muted">{{ new Date(update.date).toLocaleString() }}</small>
                          <p class="mb-0 text-muted small">{{ update.description }}</p>
                        </div>

                        <!-- Update actions -->
                        <BButton
                          :to="{ name: 'OSView', params: { os_hash: update.hash }, query: { os_title: update.name } }"
                          variant="outline-primary"
                          size="sm"
                        >
                          View
                        </BButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Loading updates -->
              <div v-if="!loadedUpdates[commit.hash]" class="updates-loading">
                <div class="update-graph">
                  <div class="update-dot loading"></div>
                </div>
                <div class="text-center p-3">
                  <div class="spinner-border spinner-border-sm" role="status">
                    <span class="visually-hidden">Loading updates...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
.commits-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Commit row with graph */
.commit-row {
  display: flex;
  gap: 24px;
  position: relative;
  min-height: 60px;
}

/* Graph column */
.commit-graph {
  width: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex-shrink: 0;
  padding-top: 8px;
}

/* Vertical line connecting commits */
.graph-line {
  width: 2px;
  background: #3b82f6;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

/* Commit dot */
.graph-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid white;
  box-shadow: 0 0 0 1px #3b82f6;
  z-index: 2;
  position: relative;
  flex-shrink: 0;
}

/* Branch line for updates */
.graph-branch-line {
  width: 2px;
  background: #cbd5e1;
  position: absolute;
  top: 18px;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.graph-branch-line.expanded {
  background: #10b981;
}

/* Commit content */
.commit-content {
  flex: 1;
  padding-top: 0;
}

.commit-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px 20px;
  background: white;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.commit-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12);
}

.commit-card.selected {
  border-color: #10b981;
  background-color: #f0fdf4;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
}

.commit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.commit-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.commit-description {
  margin-left: 44px;
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 0.9rem;
}

/* Updates list */
.updates-list {
  margin-left: 30px;
  margin-top: 0;
  padding-left: 24px;
  border-left: 2px solid #10b981;
  position: relative;
}

.update-row {
  display: flex;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
  position: relative;
}

.update-row::before {
  content: '';
  position: absolute;
  left: -25px;
  top: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  border: 2px solid white;
  box-shadow: 0 0 0 1px #10b981;
}

.update-graph {
  display: none;
}

.update-card {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px 16px;
  background: #fafafa;
  transition: all 0.2s;
  flex: 1;
}

.update-card:hover {
  border-color: #10b981;
  background: white;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.1);
}

.update-card.selected {
  border-color: #10b981;
  background-color: #f0fdf4;
}

.update-card h5 {
  font-size: 0.9rem;
  font-weight: 500;
  margin: 0 0 4px 0;
}

.updates-loading {
  padding: 20px;
  text-align: center;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

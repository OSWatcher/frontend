<script setup lang="ts">
import { computed, effectScope } from 'vue'
import { BButton, BButtonGroup, BFormCheckbox, BBadge } from 'bootstrap-vue-next'
import { useFetchCommitHistoryQuery, CommitHistoryDirection } from '@/graphql-types'

const props = defineProps<{
  expandableNextCommits: { hash: string }[]
  fields: any[]
  selectedCommits: any[]
  isCommitSelected: (commit: any) => boolean
}>()

const emit = defineEmits(['handleCheckboxChange'])

// Get the first update commit hash to fetch from
const firstUpdateHash = computed(() => props.expandableNextCommits[0]?.hash || '')

// Fetch commit history starting from the first update, going forward
const { result, loading, error } = effectScope().run(() => {
  return useFetchCommitHistoryQuery({
    commitHash: firstUpdateHash.value,
    direction: CommitHistoryDirection.Forward
  })
})!

const expandedCommits = computed(() => result.value?.fetchCommitHistory || [])

function handleCheckboxChange(item: any, checked: boolean) {
  emit('handleCheckboxChange', item, checked)
}

function getCommitPosition(commit: any): number {
  return props.selectedCommits.findIndex((selectedCommit) => selectedCommit.hash === commit.hash)
}

function getCommitLabel(position: number): string {
  return position === 0 ? 'Base' : 'Target'
}
</script>

<template>
  <div class="commit-expansion">
    <!-- Loading state -->
    <div v-if="loading" class="text-center p-3">
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Loading expansion...</span>
      </div>
      <span class="ms-2 text-muted">Loading commit history...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="alert alert-warning mb-0">
      <i class="bi bi-exclamation-triangle"></i>
      Failed to load commit expansion: {{ error.message }}
    </div>

    <!-- Expanded commits -->
    <div v-else-if="expandedCommits.length > 0" class="expanded-commits">
      <div class="text-muted small mb-2">
        <i class="bi bi-arrow-return-right"></i>
        Update history ({{ expandedCommits.length }} commits)
      </div>

      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <tbody>
            <tr v-for="commit in expandedCommits" :key="commit.hash" class="expanded-commit-row">
              <td class="ps-4">
                <span class="me-2 text-muted">└─</span>
                {{ commit.name }}
              </td>
              <td>{{ commit.description }}</td>
              <td class="text-end">
                <BButtonGroup size="sm">
                  <BButton
                    :to="{
                      name: 'OSView',
                      params: { os_hash: commit.hash },
                      query: { os_title: commit.name }
                    }"
                    variant="primary"
                    size="sm"
                  >
                    View
                  </BButton>
                  <BFormCheckbox
                    :model-value="isCommitSelected(commit)"
                    @change="handleCheckboxChange(commit, $event.target.checked)"
                    :disabled="!isCommitSelected(commit) && selectedCommits.length >= 2"
                    button
                    button-variant="outline-warning"
                    size="sm"
                  >
                    <i class="bi bi-file-diff-fill"></i>Diff
                    <BBadge v-if="getCommitPosition(commit) !== -1" variant="success" pill>
                      {{ getCommitLabel(getCommitPosition(commit)) }}
                    </BBadge>
                  </BFormCheckbox>
                </BButtonGroup>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-muted p-3">No update history found for this commit.</div>
  </div>
</template>

<style scoped>
.commit-expansion {
  background-color: var(--bs-light);
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color);
}

.expanded-commit-row {
  background-color: transparent;
}

.expanded-commit-row:hover {
  background-color: var(--bs-gray-100);
}

.table-sm td {
  padding: 0.5rem;
  vertical-align: middle;
}
</style>

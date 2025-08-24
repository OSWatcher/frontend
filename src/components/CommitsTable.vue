<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import { BTable, BButton, BButtonGroup, BFormCheckbox, BBadge } from 'bootstrap-vue-next'

const props = defineProps<{
  commits: any[]
  fields: any[]
  selectedCommits: any[]
  isLoading: boolean
  isCommitSelected: (commit: any) => boolean
}>()

const emit = defineEmits(['handleCheckboxChange'])

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
  <BTable :busy="isLoading" :items="commits" :fields="fields" select-mode="multi">
    <template #cell(name)="row">
      <b-button
        v-if="row.item.isExpandable"
        @click="row.toggleDetails"
        class="me-2"
        :variant="row.detailsShowing ? 'outline-secondary' : 'outline-success'"
        size="sm"
      >
        <i :class="row.detailsShowing ? 'bi-three-dots' : 'bi-plus-lg'"></i>
      </b-button>
      <span v-else class="me-2 d-inline-block" style="width: 24px"></span>
      {{ row.item.name }}
    </template>

    <template #cell(description)="row">
      {{ row.item.description }}
    </template>

    <template #cell(view)="data">
      <div class="d-flex justify-content-center align-items-center">
        <BButtonGroup>
          <BButton
            :to="{
              name: 'OSView',
              params: { os_hash: data.item.hash },
              query: { os_title: data.item.name }
            }"
            variant="primary"
          >
            View
          </BButton>
          <BFormCheckbox
            :model-value="isCommitSelected(data.item)"
            @change="handleCheckboxChange(data.item, $event.target.checked)"
            :disabled="!isCommitSelected(data.item) && selectedCommits.length >= 2"
            button
            button-variant="outline-warning"
          >
            <i class="bi bi-file-diff-fill"></i>Diff
            <BBadge v-if="getCommitPosition(data.item) !== -1" variant="success" pill>
              {{ getCommitLabel(getCommitPosition(data.item)) }}
            </BBadge>
          </BFormCheckbox>
        </BButtonGroup>
      </div>
    </template>

    <template #row-details="row">
      <!-- TODO: Implement commit expansion logic here -->
      <div class="p-3 text-muted">
        Commit expansion will be implemented here for: {{ row.item.name }}
      </div>
    </template>
  </BTable>
</template>

<style scoped>
.b-table {
  margin-bottom: 0rem;
}
</style>

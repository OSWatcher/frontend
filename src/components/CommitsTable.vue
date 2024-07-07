<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import { BTable, BButton, BButtonGroup, BFormCheckbox, BBadge } from 'bootstrap-vue-next'
import type { Commit, BranchesWithCommits } from '@/types'
import CommitTable from '@/components/CommitsTable.vue'

const props = defineProps<{
  branch: string
  fields: any[]
  branchesWithCommits: BranchesWithCommits
  selectedCommits: Commit[]
  isLoading: boolean
}>()

const emit = defineEmits(['handleCheckboxChange'])

function handleCheckboxChange(item: Commit, checked: boolean) {
  emit('handleCheckboxChange', item, checked)
}

function getCommitPosition(commit: Commit): number {
  return props.selectedCommits.findIndex((selectedCommit) => selectedCommit.hash === commit.hash)
}

function getCommitLabel(position: number): string {
  return position === 0 ? 'Base' : 'Target'
}
</script>

<template>
  <BTable
    :busy="isLoading"
    :items="branchesWithCommits[branch]"
    :fields="fields"
    select-mode="multi"
  >
    <template #cell(name)="row">
      <b-button
        v-if="branchesWithCommits[row.item.name]"
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
            v-model="data.item.selected"
            @change="handleCheckboxChange(data.item, $event.target.checked)"
            :disabled="!data.item.selected && selectedCommits.length >= 2"
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
      <CommitTable
        v-if="branchesWithCommits[row.item.name]"
        :branch="row.item.name"
        :fields="fields"
        :branchesWithCommits="branchesWithCommits"
        :selectedCommits="selectedCommits"
        :isLoading="isLoading"
        @handleCheckboxChange="handleCheckboxChange"
      />
    </template>
  </BTable>
</template>

<style scoped>
.b-table {
  margin-bottom: 0rem;
}
</style>

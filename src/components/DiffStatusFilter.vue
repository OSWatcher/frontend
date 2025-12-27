<script setup lang="ts">
import { NButton, NButtonGroup } from 'naive-ui'
import { DiffStatus } from '@/graphql-types'

const props = defineProps<{
  modelValue: DiffStatus[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DiffStatus[]]
}>()

const statusColors = {
  [DiffStatus.New]: { bg: '#dcfce7', text: '#166534' },
  [DiffStatus.Mod]: { bg: '#fef3c7', text: '#92400e' },
  [DiffStatus.Del]: { bg: '#fee2e2', text: '#991b1b' }
}

function isStatusSelected(status: DiffStatus): boolean {
  return props.modelValue.includes(status)
}

function toggleStatus(status: DiffStatus): void {
  const current = [...props.modelValue]
  const index = current.indexOf(status)

  if (index === -1) {
    current.push(status)
  } else {
    current.splice(index, 1)
  }

  emit('update:modelValue', current)
}

function getButtonStyle(status: DiffStatus, isSelected: boolean) {
  if (!isSelected) return {}
  return {
    backgroundColor: statusColors[status].bg,
    color: statusColors[status].text,
    borderColor: statusColors[status].bg
  }
}
</script>

<template>
  <NButtonGroup size="small">
    <NButton
      :type="isStatusSelected(DiffStatus.New) ? 'success' : 'tertiary'"
      :style="getButtonStyle(DiffStatus.New, isStatusSelected(DiffStatus.New))"
      @click="toggleStatus(DiffStatus.New)"
      title="Filter Added files"
    >
      A
    </NButton>
    <NButton
      :type="isStatusSelected(DiffStatus.Mod) ? 'warning' : 'tertiary'"
      :style="getButtonStyle(DiffStatus.Mod, isStatusSelected(DiffStatus.Mod))"
      @click="toggleStatus(DiffStatus.Mod)"
      title="Filter Modified files"
    >
      M
    </NButton>
    <NButton
      :type="isStatusSelected(DiffStatus.Del) ? 'error' : 'tertiary'"
      :style="getButtonStyle(DiffStatus.Del, isStatusSelected(DiffStatus.Del))"
      @click="toggleStatus(DiffStatus.Del)"
      title="Filter Deleted files"
    >
      D
    </NButton>
  </NButtonGroup>
</template>

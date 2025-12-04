<script setup lang="ts">
import { type PropType } from 'vue'
import { NCard, NButton, NButtonGroup, NIcon, NBreadcrumb, NBreadcrumbItem } from 'naive-ui'
import {
  HomeOutline,
  GitBranchOutline,
  FileTrayFullOutline,
  FolderOutline,
  GitCompareOutline,
  CloseOutline,
  ReorderFourOutline,
  GridOutline
} from '@vicons/ionicons5'
import type { InspectorMode, InspectorLayout, CommitContext } from '@/types/inspector'

const _props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  layout: { type: String as PropType<InspectorLayout>, default: 'unified' },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined },
  branchName: { type: String, default: '' },
  activeTab: { type: String, default: '' }
})

const emit = defineEmits<{
  removeComparison: []
  layoutChange: [layout: InspectorLayout]
}>()

function shortHash(hash: string | undefined): string {
  if (!hash) return ''
  return hash.slice(0, 7)
}

function handleRemoveComparison() {
  emit('removeComparison')
}

function handleLayoutChange(newLayout: InspectorLayout) {
  emit('layoutChange', newLayout)
}
</script>

<template>
  <div class="inspector-header">
    <NBreadcrumb class="header-breadcrumb">
      <NBreadcrumbItem
        ><NIcon :size="16"><HomeOutline /></NIcon>Home</NBreadcrumbItem
      >
      <NBreadcrumbItem v-if="branchName"
        ><NIcon :size="16"><GitBranchOutline /></NIcon>{{ branchName }}</NBreadcrumbItem
      >
      <NBreadcrumbItem
        ><NIcon :size="16"><FileTrayFullOutline /></NIcon
        >{{ mode === 'single' ? 'Snapshot' : 'Comparison' }}</NBreadcrumbItem
      >
      <NBreadcrumbItem v-if="activeTab"
        ><NIcon :size="16"><FolderOutline /></NIcon>{{ activeTab }}</NBreadcrumbItem
      >
    </NBreadcrumb>

    <div class="commit-selector">
      <div v-if="mode === 'single'" class="single-mode-selector">
        <NCard size="small" class="commit-card">
          <div class="commit-info">
            <NIcon :size="20" class="commit-icon"><FileTrayFullOutline /></NIcon>
            <div class="commit-details">
              <span class="commit-name">{{ commit?.name }}</span>
              <span class="commit-hash">{{ shortHash(commit?.hash) }}</span>
            </div>
          </div>
        </NCard>
      </div>

      <div v-else class="comparison-mode-selector">
        <div class="commits-row">
          <NCard size="small" class="commit-card">
            <div class="commit-info">
              <NIcon :size="20"><FileTrayFullOutline /></NIcon>
              <div class="commit-details">
                <span class="commit-label">Base</span>
                <span class="commit-name">{{ baseCommit?.name }}</span>
                <span class="commit-hash">{{ shortHash(baseCommit?.hash) }}</span>
              </div>
            </div>
          </NCard>
          <div class="vs-indicator">
            <NIcon :size="24"><GitCompareOutline /></NIcon><span>vs</span>
          </div>
          <NCard size="small" class="commit-card">
            <div class="commit-info">
              <NIcon :size="20"><FileTrayFullOutline /></NIcon>
              <div class="commit-details">
                <span class="commit-label">Diffee</span>
                <span class="commit-name">{{ diffeeCommit?.name }}</span>
                <span class="commit-hash">{{ shortHash(diffeeCommit?.hash) }}</span>
              </div>
              <NButton
                text
                circle
                size="small"
                class="remove-button"
                @click="handleRemoveComparison"
              >
                <template #icon
                  ><NIcon><CloseOutline /></NIcon
                ></template>
              </NButton>
            </div>
          </NCard>
        </div>
        <div class="layout-toggle">
          <NButtonGroup>
            <NButton
              :type="layout === 'unified' ? 'primary' : 'default'"
              @click="handleLayoutChange('unified')"
            >
              <template #icon
                ><NIcon><ReorderFourOutline /></NIcon></template
              >Unified
            </NButton>
            <NButton
              :type="layout === 'side-by-side' ? 'primary' : 'default'"
              @click="handleLayoutChange('side-by-side')"
            >
              <template #icon
                ><NIcon><GridOutline /></NIcon></template
              >Side-by-Side
            </NButton>
          </NButtonGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}
.commit-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.single-mode-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}
.commit-card {
  flex: 1;
  max-width: 500px;
}
.commit-info {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}
.commit-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.commit-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
}
.commit-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.commit-hash {
  font-size: 12px;
  font-family: monospace;
  color: #9ca3af;
}
.comparison-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.commits-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.vs-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  font-weight: 600;
  font-size: 12px;
}
.remove-button {
  position: absolute;
  top: -4px;
  right: -4px;
}
.layout-toggle {
  display: flex;
  justify-content: flex-end;
}
</style>

<script setup lang="ts">
import { computed, h, type PropType } from 'vue'
import {
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
  NIcon,
  NButton,
  NTag,
  NSpin,
  NAlert,
  NEmpty,
  type DataTableColumns
} from 'naive-ui'
import { DocumentOutline, FolderOutline, DownloadOutline, HomeOutline } from '@vicons/ionicons5'
import { useFilesystemInspector } from '@/composables/useFilesystemInspector'
import type {
  InspectorMode,
  InspectorLayout,
  CommitContext,
  FilesystemEntry,
  FilesystemDiffEntry
} from '@/types/inspector'
import { formatFileSize, getStatusTagType, getDownloadUrl } from '@/utils/filesystem'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  layout: { type: String as PropType<InspectorLayout>, default: 'unified' },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined },
  initialPath: { type: String, default: '/' }
})

const { entries, breadcrumbs, isLoading, error, navigateToPath } = useFilesystemInspector(
  props.mode,
  props.layout,
  props.commit,
  props.baseCommit,
  props.diffeeCommit,
  props.initialPath
)

const singleModeColumns = computed<DataTableColumns<FilesystemEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'blob' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'tree' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'tree' ? 'pointer' : 'default',
            fontWeight: row.type === 'tree' ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'type',
    title: 'Type',
    width: 100,
    render: (row) => (row.type === 'blob' ? 'File' : 'Directory')
  },
  { key: 'size', title: 'Size', width: 120, render: (row) => formatFileSize(row.size) },
  {
    key: 'actions',
    title: 'Actions',
    width: 120,
    render: (row) => {
      if (row.type === 'blob') {
        return h(
          NButton,
          {
            size: 'small',
            secondary: true,
            tag: 'a',
            href: getDownloadUrl(row.hash),
            download: row.name
          },
          { icon: () => h(NIcon, () => h(DownloadOutline)), default: () => 'Download' }
        )
      }
      return null
    }
  }
])

const comparisonModeColumns = computed<DataTableColumns<FilesystemDiffEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'blob' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'tree' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'tree' ? 'pointer' : 'default',
            fontWeight: row.type === 'tree' ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'status',
    title: 'Status',
    width: 120,
    render: (row) =>
      h(NTag, { type: getStatusTagType(row.status), size: 'small' }, () => row.status)
  },
  { key: 'size', title: 'Size', width: 200, render: (row) => formatFileSize(row.size) }
])

const sideBySideColumns = computed<DataTableColumns<FilesystemEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'blob' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'tree' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'tree' ? 'pointer' : 'default',
            fontWeight: row.type === 'tree' ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'type',
    title: 'Type',
    width: 100,
    render: (row) => (row.type === 'blob' ? 'File' : 'Directory')
  },
  { key: 'size', title: 'Size', width: 120, render: (row) => formatFileSize(row.size) }
])

const baseEntries = computed<FilesystemEntry[]>(() => {
  if (props.mode !== 'comparison') return []
  return (entries.value as FilesystemDiffEntry[])
    .filter((entry) => entry.status !== 'NEW')
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      hash: entry.baseHash || entry.hash,
      size: entry.baseSize || entry.size,
      path: entry.path
    }))
})

const diffeeEntries = computed<FilesystemEntry[]>(() => {
  if (props.mode !== 'comparison') return []
  return (entries.value as FilesystemDiffEntry[])
    .filter((entry) => entry.status !== 'DELETED')
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      hash: entry.diffeeHash || entry.hash,
      size: entry.diffeeSize || entry.size,
      path: entry.path
    }))
})

const tableColumns = computed(() => {
  if (props.mode === 'single') {
    return singleModeColumns.value
  } else {
    return comparisonModeColumns.value
  }
})

const paginationConfig = { pageSize: 50, showSizePicker: true, pageSizes: [20, 50, 100, 200] }

function getIconComponent(iconName: string) {
  switch (iconName) {
    case 'home':
      return HomeOutline
    case 'folder':
      return FolderOutline
    default:
      return FolderOutline
  }
}

function getRowProps(row: FilesystemEntry | FilesystemDiffEntry) {
  if (props.mode === 'single') return {}
  const diffEntry = row as FilesystemDiffEntry
  return { class: `diff-row-${diffEntry.status.toLowerCase()}` }
}
</script>

<template>
  <div class="filesystem-inspector">
    <NBreadcrumb class="breadcrumb-nav">
      <NBreadcrumbItem
        v-for="(item, index) in breadcrumbs"
        :key="index"
        :clickable="!!item.path"
        @click="item.path ? navigateToPath(item.path) : undefined"
      >
        <NIcon v-if="item.icon" :size="16"><component :is="getIconComponent(item.icon)" /></NIcon>
        {{ item.label }}
      </NBreadcrumbItem>
    </NBreadcrumb>

    <div v-if="isLoading" class="loading-container">
      <NSpin size="large" />
      <p class="loading-text">Loading filesystem...</p>
    </div>

    <NAlert v-else-if="error" type="error" title="Error Loading Filesystem">{{
      error.message
    }}</NAlert>

    <div v-else>
      <!-- Unified View (Single Mode or Unified Layout) -->
      <div v-if="mode === 'single' || layout === 'unified'">
        <NDataTable
          :columns="tableColumns"
          :data="entries"
          :pagination="paginationConfig"
          :row-props="getRowProps"
          striped
          virtual-scroll
          :max-height="600"
        />
        <NEmpty v-if="entries.length === 0 && !isLoading" description="No entries found" />
      </div>

      <!-- Side-by-Side View (Comparison Mode Only) -->
      <div
        v-else-if="mode === 'comparison' && layout === 'side-by-side'"
        class="side-by-side-container"
      >
        <div class="side-by-side-panel">
          <h3 class="panel-title">Base ({{ baseCommit?.name }})</h3>
          <NDataTable
            :columns="sideBySideColumns"
            :data="baseEntries"
            :pagination="paginationConfig"
            striped
            virtual-scroll
            :max-height="600"
          />
        </div>
        <div class="side-by-side-panel">
          <h3 class="panel-title">Diffee ({{ diffeeCommit?.name }})</h3>
          <NDataTable
            :columns="sideBySideColumns"
            :data="diffeeEntries"
            :pagination="paginationConfig"
            striped
            virtual-scroll
            :max-height="600"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filesystem-inspector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.breadcrumb-nav {
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  gap: 16px;
}
.loading-text {
  margin: 0;
  color: #666;
}
:deep(.diff-row-new) {
  background-color: #f0fdf4 !important;
}
:deep(.diff-row-modified) {
  background-color: #fffbeb !important;
}
:deep(.diff-row-deleted) {
  background-color: #fef2f2 !important;
  opacity: 0.7;
}
.side-by-side-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.side-by-side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}
</style>

<script setup lang="ts">
import { computed, h, type PropType } from 'vue'
import {
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
  NIcon,
  NButton,
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
import { getDownloadUrl } from '@/utils/filesystem'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  layout: { type: String as PropType<InspectorLayout>, default: 'unified' },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined },
  initialPath: { type: String, default: '/' },
  targetDirectory: { type: String, default: '/' },
  highlightFile: { type: String, default: '' }
})

const { entries, breadcrumbs, isLoading, error, navigateToPath, highlightedFile } =
  useFilesystemInspector(
    props.mode,
    props.layout,
    props.commit,
    props.baseCommit,
    props.diffeeCommit,
    props.targetDirectory,
    props.highlightFile
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
          style: {
            fontWeight: row.type === 'tree' ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'actions',
    title: 'Actions',
    width: 100,
    render: (row) => {
      if (row.type === 'blob') {
        return h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            tag: 'a',
            href: getDownloadUrl(row.hash),
            download: row.name,
            onClick: (e: Event) => e.stopPropagation()
          },
          { icon: () => h(NIcon, { size: 18 }, () => h(DownloadOutline)) }
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
          style: {
            fontWeight: row.type === 'tree' ? '600' : '400'
          }
        },
        row.name
      )
  }
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
  }
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
  const baseProps: any = {}

  // Add click handler for folders
  if (row.type === 'tree') {
    baseProps.onClick = () => navigateToPath(row.path)
    baseProps.style = { cursor: 'pointer' }
  }

  // Add diff status class for comparison mode
  if (props.mode === 'comparison') {
    const diffEntry = row as FilesystemDiffEntry
    baseProps.class = `diff-row-${diffEntry.status.toLowerCase()}`
  }

  // Add highlighting class for highlighted files
  if (highlightedFile.value && row.name === highlightedFile.value) {
    baseProps.class = baseProps.class ? `${baseProps.class} highlighted-file` : 'highlighted-file'
  }

  return baseProps
}
</script>

<template>
  <div class="filesystem-inspector">
    <NBreadcrumb class="breadcrumb-nav">
      <NBreadcrumbItem v-for="(item, index) in breadcrumbs" :key="index" :clickable="!!item.path"
        @click="item.path ? navigateToPath(item.path) : undefined">
        <NIcon v-if="item.icon" :size="16">
          <component :is="getIconComponent(item.icon)" />
        </NIcon>
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
      <!-- Empty State -->
      <div v-if="entries.length === 0" class="empty-folder">
        <NEmpty description="This folder is empty" />
      </div>

      <!-- Unified View (Single Mode or Unified Layout) -->
      <div v-else-if="mode === 'single' || layout === 'unified'" class="table-container">
        <NDataTable :columns="tableColumns" :data="entries" :row-props="getRowProps" striped virtual-scroll
          :max-height="900" />
      </div>

      <!-- Side-by-Side View (Comparison Mode Only) -->
      <div v-else-if="mode === 'comparison' && layout === 'side-by-side'" class="side-by-side-container">
        <div class="side-by-side-panel">
          <h3 class="panel-title">Base ({{ baseCommit?.name }})</h3>
          <NDataTable :columns="sideBySideColumns" :data="baseEntries" striped virtual-scroll :max-height="900" />
        </div>
        <div class="side-by-side-panel">
          <h3 class="panel-title">Diffee ({{ diffeeCommit?.name }})</h3>
          <NDataTable :columns="sideBySideColumns" :data="diffeeEntries" striped virtual-scroll :max-height="900" />
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
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

.empty-folder {
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* Diff row styling with subtle and appealing visual backgrounds */
:deep(.n-data-table-tr.diff-row-new),
:deep(.n-data-table-tr.diff-row-new .n-data-table-td) {
  background-color: #dcfce7 !important;
  /* light green */
}

:deep(.n-data-table-tr.diff-row-modified),
:deep(.n-data-table-tr.diff-row-modified .n-data-table-td) {
  background-color: #fef3c7 !important;
  /* light amber */
}

:deep(.n-data-table-tr.diff-row-deleted),
:deep(.n-data-table-tr.diff-row-deleted .n-data-table-td) {
  background-color: #fee2e2 !important;
  /* light red */
  opacity: 0.9 !important;
}

/* Subtle hover effects */
:deep(.n-data-table-tr.diff-row-new:hover),
:deep(.n-data-table-tr.diff-row-new:hover .n-data-table-td) {
  background-color: #bbf7d0 !important;
  /* green-200 */
}

:deep(.n-data-table-tr.diff-row-modified:hover),
:deep(.n-data-table-tr.diff-row-modified:hover .n-data-table-td) {
  background-color: #fde68a !important;
  /* amber-200 */
}

:deep(.n-data-table-tr.diff-row-deleted:hover),
:deep(.n-data-table-tr.diff-row-deleted:hover .n-data-table-td) {
  background-color: #fecaca !important;
  /* red-200 */
}

/* File highlighting styles */
:deep(.n-data-table-tr.highlighted-file),
:deep(.n-data-table-tr.highlighted-file .n-data-table-td) {
  background-color: #eff6ff !important;
  /* blue-50 - subtle blue background */
}

:deep(.n-data-table-tr.highlighted-file:hover),
:deep(.n-data-table-tr.highlighted-file:hover .n-data-table-td) {
  background-color: #dbeafe !important;
  /* blue-100 - slightly darker on hover */
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
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 16px;
}

.panel-title {
  margin: 0 -16px 12px -16px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

/* Improve row hover state */
:deep(.n-data-table-tr:hover) {
  background-color: #f0f9ff !important;
}

/* Improve font sizing for better readability */
:deep(.n-data-table-td) {
  font-size: 14px;
}

:deep(.n-data-table-th) {
  font-size: 13px;
  font-weight: 600;
}

/* Icon styling for better visual appearance */
/* Default gray for all table icons */
:deep(.n-data-table-td:first-child .n-icon) {
  color: #6b7280 !important;
  /* gray-500 for files by default */
}

/* Yellow for folder rows - target the row that has folder behavior */
:deep(.n-data-table-tr[style*='cursor: pointer'] .n-data-table-td:first-child .n-icon) {
  color: #f59e0b !important;
  /* amber-500 for folders */
}

/* Breadcrumb icons styling */
:deep(.breadcrumb-nav .n-icon) {
  color: #f59e0b !important;
  /* amber-500 for breadcrumb icons */
}
</style>

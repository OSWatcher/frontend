<script setup lang="ts">
import { computed, h, inject, ref, type PropType } from 'vue'
import {
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
  NIcon,
  NButton,
  NDropdown,
  NSpin,
  NAlert,
  NEmpty,
  NInput,
  type DataTableColumns,
  type DropdownOption
} from 'naive-ui'
import {
  DocumentOutline,
  FolderOutline,
  DownloadOutline,
  HomeOutline,
  ChevronDownOutline,
  SearchOutline,
  TimeOutline
} from '@vicons/ionicons5'
import { useAuth0 } from '@auth0/auth0-vue'
import { useFilesystemInspector } from '@/composables/useFilesystemInspector'
import { useTableFilter } from '@/composables/useTableFilter'
import type {
  InspectorMode,
  InspectorLayout,
  CommitContext,
  FilesystemEntry,
  FilesystemDiffEntry
} from '@/types/inspector'
import { TreeNodeType, treeNodeTypeToString } from '@/types'
import { downloadBlob } from '@/utils/filesystem'
import { downloadJsonFile, generateExportFilename } from '@/utils/exportDiff'
import gqlClient from '@/graphql-client'
import { GET_FS_ROOT, DIFF_NODES } from '@/queries'
import DiffStatusFilter from './DiffStatusFilter.vue'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  layout: { type: String as PropType<InspectorLayout>, default: 'unified' },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined },
  targetDirectory: { type: String, default: '/' },
  highlightFile: { type: String, default: '' }
})

const {
  entries,
  breadcrumbs,
  isLoading,
  error,
  navigateToPath,
  highlightedFile,
  currentPath,
  statusFilter,
  setStatusFilter
} = useFilesystemInspector(
  props.mode,
  props.layout,
  props.commit,
  props.baseCommit,
  props.diffeeCommit,
  props.targetDirectory,
  props.highlightFile
)

// Table filtering
const { searchQuery, filteredEntries, filterInputRef } = useTableFilter({
  entries: entries as any,
  filterKey: 'name',
  clearOnChange: currentPath
})

// Authentication for full export and blob downloads
const { isAuthenticated, getAccessTokenSilently } = useAuth0()
const isExporting = ref(false)
const downloadingHash = ref<string | null>(null)

// Git log
const openGitLog = inject<(path: string, entityType: string) => void>('openGitLog')

function renderHistoryButton(rowName: string) {
  const fullPath = currentPath.value === '/' ? `/${rowName}` : `${currentPath.value}/${rowName}`
  return h(
    NButton,
    {
      size: 'small',
      quaternary: true,
      title: 'Show history',
      onClick: (e: Event) => {
        e.stopPropagation()
        openGitLog?.(fullPath, 'FILESYSTEM')
      }
    },
    { icon: () => h(NIcon, { size: 18 }, () => h(TimeOutline)) }
  )
}

// Helper to generate download filename with commit name and hash
function getDownloadFilename(name: string, commitName: string, hash: string): string {
  const shortHash = hash.substring(0, 8)
  const sanitizedCommit = commitName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
  const lastDot = name.lastIndexOf('.')
  if (lastDot === -1) {
    return `${name}_${sanitizedCommit}_${shortHash}`
  }
  return `${name.substring(0, lastDot)}_${sanitizedCommit}_${shortHash}${name.substring(lastDot)}`
}

// Export local diff (current directory only)
async function exportLocalDiff() {
  const diffEntries = entries.value as FilesystemDiffEntry[]

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      baseCommit: { name: props.baseCommit?.name || '', hash: props.baseCommit?.hash || '' },
      diffeeCommit: { name: props.diffeeCommit?.name || '', hash: props.diffeeCommit?.hash || '' },
      scope: 'local' as const,
      path: currentPath.value,
      totalEntries: diffEntries.length
    },
    entries: diffEntries.map((e) => ({
      path: e.path,
      name: e.name,
      type: treeNodeTypeToString(e.type),
      status: e.status,
      baseHash: e.baseHash,
      diffeeHash: e.diffeeHash,
      baseSize: e.baseSize,
      diffeeSize: e.diffeeSize
    }))
  }

  const filename = generateExportFilename(
    'filesystem',
    props.baseCommit?.name || 'base',
    props.diffeeCommit?.name || 'diffee',
    'local'
  )
  downloadJsonFile(exportData, filename)
}

// Export full diff (recursive)
async function exportFullDiff() {
  if (!isAuthenticated.value) return

  isExporting.value = true
  try {
    // Fetch filesystem root hashes
    const baseRootResponse = await gqlClient.query({
      query: GET_FS_ROOT,
      variables: { where: { hash: props.baseCommit?.hash } }
    })
    const diffeeRootResponse = await gqlClient.query({
      query: GET_FS_ROOT,
      variables: { where: { hash: props.diffeeCommit?.hash } }
    })

    const baseTreeHash =
      baseRootResponse.data?.commits?.[0]?.filesystemConnection?.edges?.[0]?.node?.hash
    const diffeeTreeHash =
      diffeeRootResponse.data?.commits?.[0]?.filesystemConnection?.edges?.[0]?.node?.hash

    if (!baseTreeHash || !diffeeTreeHash) {
      throw new Error('Could not fetch filesystem root hashes')
    }

    // Call DIFF_NODES with maxDepth: null for recursive
    const response = await gqlClient.query({
      query: DIFF_NODES,
      variables: {
        parentLabel: 'Tree',
        baseNodeHash: baseTreeHash,
        diffeeNodeHash: diffeeTreeHash,
        atPath: '/',
        maxDepth: null, // Recursive!
        filter: ['Blob'],
        options: { offset: 0, limit: 10000 }
      }
    })

    const items = response.data?.diffNodesAt?.items || []
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        baseCommit: { name: props.baseCommit?.name || '', hash: props.baseCommit?.hash || '' },
        diffeeCommit: {
          name: props.diffeeCommit?.name || '',
          hash: props.diffeeCommit?.hash || ''
        },
        scope: 'full' as const,
        path: '/',
        totalEntries: items.length
      },
      entries: items.map((item: any) => ({
        path: item.path,
        name: item.path.split('/').pop() || '',
        type: item.type,
        status: item.status,
        baseHash: item.old_props?.hash,
        diffeeHash: item.new_props?.hash
      }))
    }

    const filename = generateExportFilename(
      'filesystem',
      props.baseCommit?.name || 'base',
      props.diffeeCommit?.name || 'diffee',
      'full'
    )
    downloadJsonFile(exportData, filename)
  } catch (err) {
    console.error('Error exporting full diff:', err)
    alert('Error exporting full diff. Please try again.')
  } finally {
    isExporting.value = false
  }
}

// Export dropdown options
const exportOptions = computed<DropdownOption[]>(() => [
  {
    label: 'Export Current Directory',
    key: 'local',
    disabled: isExporting.value,
    props: {
      onClick: exportLocalDiff
    }
  },
  {
    label: 'Export Full Tree',
    key: 'full',
    disabled: !isAuthenticated.value || isExporting.value,
    props: {
      onClick: () => {
        if (isAuthenticated.value) {
          exportFullDiff()
        }
      }
    },
    children: !isAuthenticated.value
      ? [
          {
            type: 'render',
            render: () =>
              h(
                'div',
                { style: { padding: '8px 12px', fontSize: '12px', color: '#999' } },
                '🔒 Login required'
              )
          }
        ]
      : undefined
  }
])

const singleModeColumns = computed<DataTableColumns<FilesystemEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === TreeNodeType.Blob ? DocumentOutline : FolderOutline) }
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
            fontWeight: row.type === TreeNodeType.Tree ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'actions',
    title: 'Actions',
    width: 120,
    render: (row) => {
      const buttons = [renderHistoryButton(row.name)]
      if (row.type === TreeNodeType.Blob) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: async (e: Event) => {
                e.stopPropagation()
                try {
                  const tokenGetter = isAuthenticated.value ? getAccessTokenSilently : undefined
                  await downloadBlob(row.hash, row.name, tokenGetter)
                } catch (error) {
                  console.error('Download failed:', error)
                  alert(error instanceof Error ? error.message : 'Download failed')
                }
              }
            },
            { icon: () => h(NIcon, { size: 18 }, () => h(DownloadOutline)) }
          )
        )
      }
      return h('div', { style: { display: 'flex', gap: '4px' } }, buttons)
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
        { default: () => h(row.type === TreeNodeType.Blob ? DocumentOutline : FolderOutline) }
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
            fontWeight: row.type === TreeNodeType.Tree ? '600' : '400'
          }
        },
        row.name
      )
  },
  {
    key: 'actions',
    title: 'Actions',
    width: 120,
    render: (row) => {
      const historyBtn = renderHistoryButton(row.name)
      if (row.type !== TreeNodeType.Blob) {
        return h('div', { style: { display: 'flex', gap: '4px' } }, [historyBtn])
      }

      const handleDownload = async (hash: string, commitName: string) => {
        downloadingHash.value = hash
        try {
          const tokenGetter = isAuthenticated.value ? getAccessTokenSilently : undefined
          const filename = getDownloadFilename(row.name, commitName, hash)
          await downloadBlob(hash, filename, tokenGetter)
        } catch (error) {
          console.error('Download failed:', error)
          alert(error instanceof Error ? error.message : 'Download failed')
        } finally {
          downloadingHash.value = null
        }
      }

      // For MODIFIED: show dropdown with old/new options
      if (row.status === 'MODIFIED' && row.baseHash && row.diffeeHash) {
        const isLoading =
          downloadingHash.value === row.baseHash || downloadingHash.value === row.diffeeHash
        const dropdownOptions = [
          {
            label: `Download old (${props.baseCommit?.name || 'base'})`,
            key: 'old',
            props: {
              onClick: () => handleDownload(row.baseHash!, props.baseCommit?.name || 'old')
            }
          },
          {
            label: `Download new (${props.diffeeCommit?.name || 'new'})`,
            key: 'new',
            props: {
              onClick: () => handleDownload(row.diffeeHash!, props.diffeeCommit?.name || 'new')
            }
          }
        ]
        const downloadBtn = h(
          NDropdown,
          { options: dropdownOptions, trigger: 'click', disabled: isLoading },
          {
            default: () =>
              h(
                NButton,
                { size: 'small', type: 'primary', loading: isLoading },
                isLoading
                  ? undefined
                  : {
                      default: () => [
                        h(NIcon, { size: 18 }, () => h(DownloadOutline)),
                        h(NIcon, { size: 14, style: { marginLeft: '2px' } }, () =>
                          h(ChevronDownOutline)
                        )
                      ]
                    }
              )
          }
        )
        return h('div', { style: { display: 'flex', gap: '4px' } }, [historyBtn, downloadBtn])
      }

      // For NEW, DELETED, UNCHANGED: direct download
      const hash = row.diffeeHash || row.baseHash
      const commitName = row.diffeeHash
        ? props.diffeeCommit?.name || 'new'
        : props.baseCommit?.name || 'old'
      const isLoading = downloadingHash.value === hash

      const downloadBtn = h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          loading: isLoading,
          onClick: (e: Event) => {
            e.stopPropagation()
            if (!isLoading) handleDownload(hash!, commitName)
          }
        },
        isLoading ? undefined : { icon: () => h(NIcon, { size: 18 }, () => h(DownloadOutline)) }
      )
      return h('div', { style: { display: 'flex', gap: '4px' } }, [historyBtn, downloadBtn])
    }
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
        { default: () => h(row.type === TreeNodeType.Blob ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === TreeNodeType.Tree && navigateToPath(row.path, row.type),
          style: {
            cursor: row.type === TreeNodeType.Tree ? 'pointer' : 'default',
            fontWeight: row.type === TreeNodeType.Tree ? '600' : '400'
          }
        },
        row.name
      )
  }
])

const baseEntries = computed<FilesystemEntry[]>(() => {
  if (props.mode !== 'comparison') return []
  const query = searchQuery.value.toLowerCase().trim()
  return (entries.value as FilesystemDiffEntry[])
    .filter((entry) => entry.status !== 'NEW')
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
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
  const query = searchQuery.value.toLowerCase().trim()
  return (entries.value as FilesystemDiffEntry[])
    .filter((entry) => entry.status !== 'DELETED')
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
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
  if (row.type === TreeNodeType.Tree) {
    baseProps.onClick = () => navigateToPath(row.path, row.type)
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
    <!-- Header row with breadcrumb, filter, and export buttons -->
    <div class="header-row">
      <NBreadcrumb class="breadcrumb-nav">
        <NBreadcrumbItem
          v-for="(item, index) in breadcrumbs"
          :key="index"
          :clickable="!!item.path"
          @click="item.path ? navigateToPath(item.path) : undefined"
        >
          <NIcon v-if="item.icon" :size="16">
            <component :is="getIconComponent(item.icon)" />
          </NIcon>
          {{ item.label }}
        </NBreadcrumbItem>
      </NBreadcrumb>

      <!-- Filter input -->
      <div class="filter-container">
        <NInput
          ref="filterInputRef"
          v-model:value="searchQuery"
          placeholder="Filter files... (press / to focus)"
          clearable
          size="small"
          style="width: 250px"
        >
          <template #prefix>
            <NIcon :component="SearchOutline" />
          </template>
        </NInput>
      </div>

      <!-- Filter and Export buttons (only in comparison mode) -->
      <div v-if="mode === 'comparison'" class="header-actions">
        <!-- Status Filter Buttons -->
        <DiffStatusFilter v-model="statusFilter" @update:model-value="setStatusFilter" />

        <!-- Export Dropdown -->
        <NDropdown :options="exportOptions" trigger="click">
          <NButton size="small" :loading="isExporting">
            <template #icon
              ><NIcon><DownloadOutline /></NIcon
            ></template>
            Export
          </NButton>
        </NDropdown>
      </div>
    </div>

    <div v-if="isLoading" class="loading-container">
      <NSpin size="large" />
      <p class="loading-text">Loading filesystem...</p>
    </div>

    <NAlert v-else-if="error" type="error" title="Error Loading Filesystem">{{
      error.message
    }}</NAlert>

    <div v-else>
      <!-- Empty State -->
      <div v-if="filteredEntries.length === 0" class="empty-folder">
        <NEmpty
          :description="
            searchQuery ? `No entries matching '${searchQuery}'` : 'This folder is empty'
          "
        />
      </div>

      <!-- Unified View (Single Mode or Unified Layout) -->
      <div v-else-if="mode === 'single' || layout === 'unified'" class="table-container">
        <NDataTable
          :columns="tableColumns"
          :data="filteredEntries as any"
          :row-props="getRowProps"
          striped
          virtual-scroll
          :max-height="900"
        />
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
            striped
            virtual-scroll
            :max-height="900"
          />
        </div>
        <div class="side-by-side-panel">
          <h3 class="panel-title">Diffee ({{ diffeeCommit?.name }})</h3>
          <NDataTable
            :columns="sideBySideColumns"
            :data="diffeeEntries"
            striped
            virtual-scroll
            :max-height="900"
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

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.breadcrumb-nav {
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.filter-container {
  flex-shrink: 0;
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

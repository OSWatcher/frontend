<script setup lang="ts">
import { computed, h, ref, type PropType } from 'vue'
import {
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
  NIcon,
  NSelect,
  NTag,
  NButton,
  NDropdown,
  NInput,
  NSpin,
  NAlert,
  NEmpty,
  NSpace,
  type DataTableColumns,
  type SelectOption,
  type DropdownOption
} from 'naive-ui'
import {
  DocumentOutline,
  HomeOutline,
  FolderOutline,
  DownloadOutline,
  SearchOutline
} from '@vicons/ionicons5'
import { useAuth0 } from '@auth0/auth0-vue'
import { useRegistryInspector } from '@/composables/useRegistryInspector'
import { useTableFilter } from '@/composables/useTableFilter'
import type { InspectorMode, InspectorLayout, CommitContext } from '@/types/inspector'
import type { RegistryEntry, RegistryDiffEntry } from '@/types/registry'
import { DiffStatus } from '@/graphql-types'
import { formatRegistryValue, getRegistryStatusTagType } from '@/utils/registry'
import { downloadJsonFile, generateExportFilename } from '@/utils/exportDiff'
import gqlClient from '@/graphql-client'
import { DIFF_NODES } from '@/queries'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  layout: { type: String as PropType<InspectorLayout>, default: 'unified' },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined }
})

const {
  entries,
  breadcrumbs,
  isLoading,
  isLoadingHives,
  error,
  availableHives,
  selectedHive,
  navigateToPath,
  selectHive,
  currentPath
} = useRegistryInspector(
  props.mode,
  props.layout,
  props.commit,
  props.baseCommit,
  props.diffeeCommit
)

// Table filtering
const { searchQuery, filteredEntries, totalCount, filterInputRef } = useTableFilter({
  entries,
  filterKey: 'name',
  clearOnChange: currentPath
})

// Authentication for full export
const { isAuthenticated } = useAuth0()
const isExporting = ref(false)

// Export local diff (current registry key level only)
async function exportLocalDiff() {
  const diffEntries = entries.value as RegistryDiffEntry[]

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      baseCommit: { name: props.baseCommit?.name || '', hash: props.baseCommit?.hash || '' },
      diffeeCommit: { name: props.diffeeCommit?.name || '', hash: props.diffeeCommit?.hash || '' },
      scope: 'local' as const,
      path: currentPath.value,
      hive: selectedHive.value?.mountPath || '',
      totalEntries: diffEntries.length
    },
    entries: diffEntries.map((e) => ({
      path: e.path,
      name: e.name,
      type: e.type,
      status: e.status,
      valueType: e.valueType,
      value: e.value,
      baseValue: e.baseValue,
      diffeeValue: e.diffeeValue,
      baseValueType: e.baseValueType,
      diffeeValueType: e.diffeeValueType
    }))
  }

  const filename = generateExportFilename(
    'registry',
    props.baseCommit?.name || 'base',
    props.diffeeCommit?.name || 'diffee',
    'local'
  )
  downloadJsonFile(exportData, filename)
}

// Export full diff (recursive)
async function exportFullDiff() {
  if (!isAuthenticated.value || !selectedHive.value) return

  isExporting.value = true
  try {
    // Call DIFF_NODES with maxDepth: null for recursive
    const response = await gqlClient.query({
      query: DIFF_NODES,
      variables: {
        parentLabel: 'WinRegKey',
        baseNodeHash: selectedHive.value.hash,
        diffeeNodeHash: (selectedHive.value as any).diffeeHash,
        atPath: '/',
        maxDepth: null, // Recursive!
        filter: ['WinRegValue'],
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
        hive: selectedHive.value?.mountPath || '',
        totalEntries: items.length
      },
      entries: items.map((item: any) => ({
        path: item.path,
        name: item.path.split('/').pop() || '',
        type: item.type === 'WinRegKey' ? 'key' : 'value',
        status: item.status,
        valueType: item.new_props?.type || item.old_props?.type,
        value: item.new_props?.value || item.old_props?.value,
        baseValue: item.old_props?.value,
        diffeeValue: item.new_props?.value,
        baseValueType: item.old_props?.type,
        diffeeValueType: item.new_props?.type
      }))
    }

    const filename = generateExportFilename(
      'registry',
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
    label: 'Export Current Key',
    key: 'local',
    disabled: isExporting.value,
    props: {
      onClick: exportLocalDiff
    }
  },
  {
    label: 'Export Full Hive',
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

// Hive selector options
const hiveOptions = computed<SelectOption[]>(() =>
  availableHives.value.map((hive) => ({
    label: hive.mountPath.replace(/\//g, ' / '),
    value: hive.mountPath
  }))
)

const selectedHiveValue = computed({
  get: () => selectedHive.value?.mountPath || null,
  set: (value: string | null) => {
    const hive = availableHives.value.find((h) => h.mountPath === value)
    if (hive) {
      selectHive(hive)
    }
  }
})

// Single mode columns
const singleModeColumns = computed<DataTableColumns<RegistryEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'value' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'key' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'key' ? 'pointer' : 'default',
            fontWeight: row.type === 'key' ? '600' : '400',
            fontFamily: 'monospace'
          }
        },
        row.name
      )
  },
  { key: 'type', title: 'Type', width: 140, render: (row) => row.valueType || '-' },
  {
    key: 'value',
    title: 'Value',
    ellipsis: { tooltip: true },
    render: (row) =>
      h(
        'span',
        { style: { fontFamily: 'monospace', fontSize: '12px' } },
        formatRegistryValue(row.value, 200)
      )
  }
])

// Comparison mode columns
const comparisonModeColumns = computed<DataTableColumns<RegistryDiffEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'value' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'key' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'key' ? 'pointer' : 'default',
            fontWeight: row.type === 'key' ? '600' : '400',
            fontFamily: 'monospace'
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
      h(NTag, { type: getRegistryStatusTagType(row.status), size: 'small' }, () => row.status)
  },
  { key: 'type', title: 'Type', width: 140, render: (row) => row.valueType || '-' },
  {
    key: 'value',
    title: 'Value',
    ellipsis: { tooltip: true },
    render: (row) =>
      h(
        'span',
        { style: { fontFamily: 'monospace', fontSize: '12px' } },
        formatRegistryValue(row.value, 200)
      )
  }
])

// Side-by-side columns (simpler, no status)
const sideBySideColumns = computed<DataTableColumns<RegistryEntry>>(() => [
  {
    key: 'icon',
    title: '',
    width: 50,
    render: (row) =>
      h(
        NIcon,
        { size: 20 },
        { default: () => h(row.type === 'value' ? DocumentOutline : FolderOutline) }
      )
  },
  {
    key: 'name',
    title: 'Name',
    render: (row) =>
      h(
        'span',
        {
          onClick: () => row.type === 'key' && navigateToPath(row.path),
          style: {
            cursor: row.type === 'key' ? 'pointer' : 'default',
            fontWeight: row.type === 'key' ? '600' : '400',
            fontFamily: 'monospace'
          }
        },
        row.name
      )
  },
  { key: 'type', title: 'Type', width: 140, render: (row) => row.valueType || '-' },
  {
    key: 'value',
    title: 'Value',
    ellipsis: { tooltip: true },
    render: (row) =>
      h(
        'span',
        { style: { fontFamily: 'monospace', fontSize: '12px' } },
        formatRegistryValue(row.value, 150)
      )
  }
])

// Base entries for side-by-side
const baseEntries = computed<RegistryEntry[]>(() => {
  if (props.mode !== 'comparison') return []
  const query = searchQuery.value.toLowerCase().trim()
  return (entries.value as RegistryDiffEntry[])
    .filter((entry) => entry.status !== DiffStatus.New)
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      path: entry.path,
      value: entry.baseValue,
      valueType: entry.baseValueType
    }))
})

// Diffee entries for side-by-side
const diffeeEntries = computed<RegistryEntry[]>(() => {
  if (props.mode !== 'comparison') return []
  const query = searchQuery.value.toLowerCase().trim()
  return (entries.value as RegistryDiffEntry[])
    .filter((entry) => entry.status !== DiffStatus.Del)
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      path: entry.path,
      value: entry.diffeeValue,
      valueType: entry.diffeeValueType
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

function getRowProps(row: RegistryEntry | RegistryDiffEntry) {
  const baseProps: any = {}
  const classes: string[] = []

  // Add click handler for registry keys (like folders)
  if (row.type === 'key') {
    baseProps.onClick = () => navigateToPath(row.path)
    baseProps.style = { cursor: 'pointer' }
    classes.push('registry-key')
  }

  // Add diff status class for comparison mode
  if (props.mode === 'comparison') {
    const diffEntry = row as RegistryDiffEntry
    classes.push(`diff-row-${diffEntry.status.toLowerCase()}`)
  }

  if (classes.length > 0) {
    baseProps.class = classes.join(' ')
  }

  return baseProps
}
</script>

<template>
  <div class="registry-inspector">
    <!-- Hive Selector -->
    <div v-if="!isLoadingHives && availableHives.length > 0" class="hive-selector">
      <NSpace align="center">
        <span class="hive-label">Registry Hive:</span>
        <NSelect
          v-model:value="selectedHiveValue"
          :options="hiveOptions"
          placeholder="Select a hive"
          style="min-width: 300px"
        />
      </NSpace>
    </div>

    <!-- Loading Hives State -->
    <div v-if="isLoadingHives" class="loading-container">
      <NSpin size="large" />
      <p class="loading-text">Loading registry hives...</p>
    </div>

    <!-- No Hives Available -->
    <NAlert
      v-else-if="availableHives.length === 0 && !isLoadingHives"
      type="warning"
      title="No Registry Data"
    >
      This commit does not contain Windows registry data.
    </NAlert>

    <!-- Main Content -->
    <template v-else-if="selectedHive">
      <!-- Header row with breadcrumb, filter, and export buttons -->
      <div class="header-row">
        <NBreadcrumb class="breadcrumb-nav">
          <NBreadcrumbItem
            v-for="(item, index) in breadcrumbs"
            :key="index"
            :clickable="!!item.path"
            @click="item.path ? navigateToPath(item.path) : undefined"
          >
            <NIcon v-if="item.icon" :size="16"
              ><component :is="getIconComponent(item.icon)"
            /></NIcon>
            {{ item.label }}
          </NBreadcrumbItem>
        </NBreadcrumb>

        <div class="header-actions">
          <!-- Filter input -->
          <div class="filter-controls">
            <NInput
              ref="filterInputRef"
              v-model:value="searchQuery"
              placeholder="Filter by name..."
              clearable
              size="small"
              style="width: 200px"
            >
              <template #prefix>
                <NIcon :size="16"><SearchOutline /></NIcon>
              </template>
            </NInput>
            <span v-if="searchQuery" class="filter-count">
              {{ filteredEntries.length }} of {{ totalCount }}
            </span>
          </div>

          <!-- Export button with dropdown (only in comparison mode) -->
          <div v-if="mode === 'comparison'" class="export-buttons">
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
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <NSpin size="large" />
        <p class="loading-text">Loading registry entries...</p>
      </div>

      <!-- Error State -->
      <NAlert v-else-if="error" type="error" title="Error Loading Registry">{{
        error.message
      }}</NAlert>

      <!-- Data Tables -->
      <div v-else>
        <!-- Unified View -->
        <div v-if="mode === 'single' || layout === 'unified'">
          <div v-if="filteredEntries.length > 0" class="table-container">
            <NDataTable
              :columns="tableColumns"
              :data="filteredEntries"
              :row-props="getRowProps"
              striped
              virtual-scroll
              :max-height="900"
            />
          </div>
          <div v-else class="empty-folder">
            <NEmpty
              :description="
                searchQuery ? `No entries matching '${searchQuery}'` : 'No entries found'
              "
            />
          </div>
        </div>

        <!-- Side-by-Side View -->
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
    </template>
  </div>
</template>

<style scoped>
.registry-inspector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hive-selector {
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.hive-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
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

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-count {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.export-buttons {
  flex-shrink: 0;
}

/* Breadcrumb icons (yellow) */
:deep(.breadcrumb-nav .n-icon) {
  color: #f59e0b !important; /* amber-500 */
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

/* Empty state styling */
.empty-folder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #9ca3af;
}

/* Table container styling */
.table-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* Registry value icon color (gray, like files) - default for all */
:deep(.n-data-table-td:first-child .n-icon) {
  color: #6b7280 !important; /* gray-500 for registry values */
}

/* Registry key icon color (yellow, like folders) - override for keys */
:deep(.n-data-table-tr.registry-key .n-data-table-td:first-child .n-icon) {
  color: #f59e0b !important; /* amber-500 for registry keys */
}

/* Row hover effect */
:deep(.n-data-table-tr:hover) {
  background-color: #f0f9ff !important; /* light blue hover */
}

/* Font sizing */
:deep(.n-data-table-td) {
  font-size: 14px;
}

:deep(.n-data-table-th) {
  font-size: 13px;
  font-weight: 600;
}

/* Diff status - NEW (green) */
:deep(.n-data-table-tr.diff-row-new),
:deep(.n-data-table-tr.diff-row-new .n-data-table-td) {
  background-color: #dcfce7 !important; /* green-200 - matches file explorer */
}
:deep(.n-data-table-tr.diff-row-new:hover),
:deep(.n-data-table-tr.diff-row-new:hover .n-data-table-td) {
  background-color: #bbf7d0 !important; /* green-300 */
}

/* Diff status - MOD (amber) - API returns "MOD" not "MODIFIED" */
:deep(.n-data-table-tr.diff-row-mod),
:deep(.n-data-table-tr.diff-row-mod .n-data-table-td) {
  background-color: #fef3c7 !important; /* amber-200 - matches file explorer */
}
:deep(.n-data-table-tr.diff-row-mod:hover),
:deep(.n-data-table-tr.diff-row-mod:hover .n-data-table-td) {
  background-color: #fde68a !important; /* amber-300 */
}

/* Diff status - DEL (red) - API returns "DEL" not "DELETED" */
:deep(.n-data-table-tr.diff-row-del),
:deep(.n-data-table-tr.diff-row-del .n-data-table-td) {
  background-color: #fee2e2 !important; /* red-200 - matches file explorer */
  opacity: 0.9 !important;
}
:deep(.n-data-table-tr.diff-row-del:hover),
:deep(.n-data-table-tr.diff-row-del:hover .n-data-table-td) {
  background-color: #fecaca !important; /* red-300 */
}

/* Side-by-side container */
.side-by-side-container {
  display: flex;
  gap: 16px;
  height: 100%;
  margin-top: 16px;
}

.side-by-side-panel {
  flex: 1;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  margin: 0 0 12px 0;
}
</style>

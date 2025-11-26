<script setup lang="ts">
import { computed, h, type PropType } from 'vue'
import {
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
  NIcon,
  NSelect,
  NTag,
  NSpin,
  NAlert,
  NEmpty,
  NSpace,
  type DataTableColumns,
  type SelectOption
} from 'naive-ui'
import { DocumentOutline, HomeOutline, FolderOutline } from '@vicons/ionicons5'
import { useRegistryInspector } from '@/composables/useRegistryInspector'
import type { InspectorMode, InspectorLayout, CommitContext } from '@/types/inspector'
import type { RegistryEntry, RegistryDiffEntry } from '@/types/registry'
import { DiffStatus } from '@/graphql-types'
import { formatRegistryValue, getRegistryStatusTagType } from '@/utils/registry'

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
  selectHive
} = useRegistryInspector(
  props.mode,
  props.layout,
  props.commit,
  props.baseCommit,
  props.diffeeCommit
)

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
  return (entries.value as RegistryDiffEntry[])
    .filter((entry) => entry.status !== DiffStatus.New)
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
  return (entries.value as RegistryDiffEntry[])
    .filter((entry) => entry.status !== DiffStatus.Del)
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

function getRowProps(row: RegistryEntry | RegistryDiffEntry) {
  if (props.mode === 'single') return {}
  const diffEntry = row as RegistryDiffEntry
  return { class: `diff-row-${diffEntry.status.toLowerCase()}` }
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
      <!-- Breadcrumbs -->
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

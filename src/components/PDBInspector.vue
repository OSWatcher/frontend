<script setup lang="ts">
import { computed, h, watch, type PropType } from 'vue'
import {
  NTabs,
  NTabPane,
  NDataTable,
  NSpin,
  NAlert,
  NPagination,
  NInput,
  NButton,
  NIcon,
  NSelect,
  type DataTableColumns
} from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'
import { usePDBInspector } from '@/composables/usePDBInspector'
import { useTableFilter } from '@/composables/useTableFilter'
import type { InspectorMode, CommitContext } from '@/types/inspector'
import type {
  SymbolEntry,
  SymbolDiffEntry,
  StructEntry,
  StructDiffEntry,
  SymbolBlob
} from '@/types/pdb'
import { formatOffset, formatSize } from '@/utils/pdb'
import DiffStatusFilter from './DiffStatusFilter.vue'
import MonacoStructDiff from './MonacoStructDiff.vue'
import MonacoStructView from './MonacoStructView.vue'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined },
  targetSymbolName: { type: String, default: '' },
  targetPdbTab: { type: String as PropType<'symbols' | 'structs'>, default: 'symbols' },
  targetStructName: { type: String, default: '' },
  targetBlobPath: { type: String, default: '' }
})

const {
  isLoading,
  isLoadingContext,
  error,
  hasPDBData,
  pdbContext: _pdbContext,
  pdbContextDiff: _pdbContextDiff,
  activeSubTab,
  availableBlobs,
  diffeeAvailableBlobs,
  selectedBlob,
  selectedDiffeeBlob,
  selectBlob,
  selectComparisonBlobs,
  symbols,
  totalSymbols,
  hasMoreSymbols,
  isLoadingMoreSymbols,
  handleSymbolsScroll,
  symbolsCurrentPage,
  symbolsPageSize,
  totalSymbolPages,
  handleSymbolsPageChange,
  structs,
  totalStructs,
  expandedStructNames,
  hasMoreStructs,
  isLoadingMoreStructs,
  handleStructsScroll,
  toggleStructExpansion,
  symbolsStatusFilter,
  setSymbolsStatusFilter,
  structsStatusFilter,
  setStructsStatusFilter,
  isSearchingForTargetSymbol,
  targetSymbolNotFound,
  isSearchingForTargetStruct,
  targetStructNotFound,
  allBlobsUnchanged
} = usePDBInspector(
  props.mode,
  props.commit,
  props.baseCommit,
  props.diffeeCommit,
  props.targetSymbolName,
  props.targetPdbTab,
  props.targetStructName,
  props.targetBlobPath
)

// ============================================
// Blob Selector
// ============================================

const baseBlobSelectOptions = computed(() =>
  availableBlobs.value.map((blob: SymbolBlob) => ({
    label: blob.blobPath,
    value: blob.blobPath
  }))
)

// Unified blob selector for comparison mode: list of changed binary paths
const comparisonBlobSelectOptions = computed(() => {
  const paths = new Set<string>()
  availableBlobs.value.forEach((b: SymbolBlob) => paths.add(b.blobPath))
  diffeeAvailableBlobs.value.forEach((b: SymbolBlob) => paths.add(b.blobPath))
  return Array.from(paths)
    .sort()
    .map((path) => ({ label: path, value: path }))
})

const selectedBlobPath = computed({
  get: () => selectedBlob.value?.blobPath || selectedDiffeeBlob.value?.blobPath || null,
  set: (path: string | null) => {
    if (!path) return
    if (props.mode === 'comparison') {
      const baseBlob = availableBlobs.value.find((b: SymbolBlob) => b.blobPath === path)
      const diffeeBlob = diffeeAvailableBlobs.value.find((b: SymbolBlob) => b.blobPath === path)
      if (baseBlob && diffeeBlob) {
        selectComparisonBlobs(baseBlob, diffeeBlob)
      }
    } else {
      const blob = availableBlobs.value.find((b: SymbolBlob) => b.blobPath === path)
      if (blob) selectBlob(blob)
    }
  }
})

// ============================================
// Symbol Filter
// ============================================

const {
  searchQuery: symbolSearchQuery,
  filteredEntries: filteredSymbols,
  filterInputRef: symbolFilterInputRef,
  clearFilter: clearSymbolFilter
} = useTableFilter({
  entries: symbols as any,
  filterKey: 'name',
  clearOnChange: activeSubTab
})

// Initialize filter with targetSymbolName when navigating from search
watch(
  () => props.targetSymbolName,
  (name) => {
    if (name) {
      symbolSearchQuery.value = name
    }
  },
  { immediate: true }
)

// ============================================
// Struct Filter
// ============================================

const {
  searchQuery: structSearchQuery,
  filteredEntries: filteredStructs,
  filterInputRef: structFilterInputRef,
  clearFilter: clearStructFilter
} = useTableFilter({
  entries: structs as any,
  filterKey: 'name',
  clearOnChange: activeSubTab
})

// Initialize filter with targetStructName when navigating from search
watch(
  () => props.targetStructName,
  (name) => {
    if (name) {
      structSearchQuery.value = name
    }
  },
  { immediate: true }
)

// ============================================
// Symbol Columns
// ============================================

function calculateAddressDelta(baseAddr: string | undefined, diffeeAddr: string | undefined) {
  if (!baseAddr || !diffeeAddr) return null

  // Parse hex addresses (format: "0x...")
  const base = parseInt(baseAddr, 16)
  const diffee = parseInt(diffeeAddr, 16)
  const delta = diffee - base

  if (delta === 0) return { value: 0, formatted: '-', color: '#666' }

  const sign = delta > 0 ? '' : '-'
  const hexDelta = Math.abs(delta).toString(16).toUpperCase()

  return {
    value: delta,
    formatted: `${sign}0x${hexDelta}`,
    color: delta > 0 ? '#16a34a' : '#dc2626' // green-600 : red-600
  }
}

const symbolColumnsSingle = computed<DataTableColumns<SymbolEntry>>(() => [
  {
    key: 'name',
    title: 'Name',
    ellipsis: { tooltip: true },
    minWidth: 200
  },
  {
    key: 'address',
    title: 'Address',
    width: 180
  }
])

const symbolColumnsComparison = computed<DataTableColumns<SymbolDiffEntry>>(() => [
  {
    key: 'name',
    title: 'Name',
    ellipsis: { tooltip: true },
    minWidth: 200
  },
  {
    key: 'baseAddress',
    title: 'Base Address',
    width: 180,
    render: (row) => {
      return row.baseAddress || '-'
    }
  },
  {
    key: 'diffeeAddress',
    title: 'New Address',
    width: 180,
    render: (row) => {
      return row.diffeeAddress || '-'
    }
  },
  {
    key: 'delta',
    title: 'Δ Address',
    width: 140,
    render: (row) => {
      const delta = calculateAddressDelta(row.baseAddress, row.diffeeAddress)
      if (!delta) return '-'

      return h(
        'span',
        {
          style: { color: delta.color, fontWeight: '600' }
        },
        delta.formatted
      )
    }
  }
])

const symbolColumns = computed(() => {
  return props.mode === 'single' ? symbolColumnsSingle.value : symbolColumnsComparison.value
})

// ============================================
// Row styling for diff status
// ============================================

function getSymbolRowProps(row: SymbolEntry | SymbolDiffEntry) {
  // Add diff status class in comparison mode
  if (props.mode === 'comparison') {
    const diffRow = row as SymbolDiffEntry
    return { class: `diff-row-${diffRow.status.toLowerCase()}` }
  }
  return {}
}

function getStructRowProps(row: StructEntry | StructDiffEntry | any) {
  // Add diff status class in comparison mode
  if (props.mode === 'comparison' && row.status) {
    return { class: `diff-row-${row.status.toLowerCase()}` }
  }
  return {}
}

// ============================================
// Struct Table Data (Single Mode)
// ============================================

// Struct rows for single mode (no field rows - Monaco shows struct details)
const structsTableDataSingle = computed(() => {
  if (props.mode !== 'single') return []

  return (filteredStructs.value as StructEntry[]).map((struct) => ({
    key: struct.name,
    type: 'struct',
    offset: '',
    name: struct.name,
    dataType: struct.kind,
    size: formatSize(struct.size),
    isExpanded: expandedStructNames.value.has(struct.name),
    struct: struct
  }))
})

// Struct table data for comparison mode (with expandable fields)
const structsTableDataComparison = computed(() => {
  if (props.mode !== 'comparison') return []

  const rows: any[] = []

  ;(filteredStructs.value as StructDiffEntry[]).forEach((struct) => {
    // Add struct row
    rows.push({
      key: struct.name,
      type: 'struct',
      name: struct.name,
      status: struct.status,
      kind: struct.kind,
      baseSize: struct.baseSize,
      diffeeSize: struct.diffeeSize,
      isExpanded: expandedStructNames.value.has(struct.name),
      struct: struct
    })

    // Field-level details are shown in the Monaco diff editor below the table
  })

  return rows
})

// Get expanded structs for Monaco diff display (only those with fields loaded)
const expandedStructsForDiff = computed(() => {
  if (props.mode !== 'comparison') return []
  return (structs.value as StructDiffEntry[]).filter(
    (struct) =>
      expandedStructNames.value.has(struct.name) && struct.fields && struct.fields.length > 0
  )
})

// Get expanded structs for Monaco view display in single mode (only those with fields loaded)
const expandedStructsForView = computed(() => {
  if (props.mode !== 'single') return []
  return (structs.value as StructEntry[]).filter(
    (struct) =>
      expandedStructNames.value.has(struct.name) && struct.fields && struct.fields.length > 0
  )
})

// Combined struct table data
const structsTableData = computed(() => {
  return props.mode === 'single' ? structsTableDataSingle.value : structsTableDataComparison.value
})

// ============================================
// Struct Columns
// ============================================

const structColumnsSingle = computed<DataTableColumns<any>>(() => [
  {
    key: 'offset',
    title: 'Offset',
    width: 100,
    render: (row) => row.offset
  },
  {
    key: 'name',
    title: 'Name',
    minWidth: 200,
    render: (row) => {
      if (row.type === 'struct') {
        return h(
          'div',
          {
            class: 'struct-name-row',
            onClick: () => toggleStructExpansion(row.key, row.struct?.hash)
          },
          [h('span', { class: 'expand-icon' }, row.isExpanded ? '▼ ' : '▶ '), h('span', row.name)]
        )
      } else {
        return h('div', { class: 'field-name-row' }, [
          h('span', { class: 'field-indent' }, '└─ '),
          h('span', row.name)
        ])
      }
    }
  },
  {
    key: 'dataType',
    title: 'Type',
    minWidth: 200,
    ellipsis: { tooltip: true }
  },
  {
    key: 'size',
    title: 'Size',
    width: 100
  }
])

const structColumnsComparison = computed<DataTableColumns<any>>(() => [
  {
    key: 'name',
    title: 'Name',
    ellipsis: { tooltip: true },
    minWidth: 200,
    render: (row) => {
      return h(
        'div',
        {
          class: 'struct-name-row',
          onClick: () => toggleStructExpansion(row.key)
        },
        [h('span', { class: 'expand-icon' }, row.isExpanded ? '▼ ' : '▶ '), h('span', row.name)]
      )
    }
  },
  {
    key: 'type',
    title: 'Type',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: (row) => row.kind
  },
  {
    key: 'baseSize',
    title: 'Base Size',
    width: 120,
    render: (row) => {
      if (row.baseSize !== undefined) {
        return formatSize(row.baseSize)
      }
      return '-'
    }
  },
  {
    key: 'diffeeSize',
    title: 'New Size',
    width: 120,
    render: (row) => {
      if (row.diffeeSize !== undefined) {
        return formatSize(row.diffeeSize)
      }
      return '-'
    }
  }
])

const structColumns = computed(() => {
  return props.mode === 'single' ? structColumnsSingle.value : structColumnsComparison.value
})
</script>

<template>
  <div class="pdb-inspector">
    <!-- Loading Context State -->
    <div v-if="isLoadingContext" class="loading-container">
      <NSpin size="large" />
      <p class="loading-text">Loading available symbols...</p>
    </div>

    <!-- No PDB Data -->
    <NAlert v-else-if="allBlobsUnchanged" type="info" title="No Symbol Changes">
      All binaries with symbols are identical between the two commits. No differences to display.
    </NAlert>

    <NAlert v-else-if="!hasPDBData" type="warning" title="No Debug Info">
      This commit does not contain any symbol or struct data.
    </NAlert>

    <!-- Error State -->
    <NAlert v-else-if="error" type="error" title="Error Loading Debug Info">
      {{ error.message }}
    </NAlert>

    <!-- Main Content -->
    <div v-else class="pdb-content">
      <!-- Header with blob selector -->
      <div class="pdb-header">
        <template v-if="mode === 'comparison' || availableBlobs.length > 1">
          <span class="pdb-header-label">Binary:</span>
          <NSelect
            :value="selectedBlobPath"
            :options="mode === 'comparison' ? comparisonBlobSelectOptions : baseBlobSelectOptions"
            size="small"
            style="min-width: 300px; flex: 1"
            @update:value="selectedBlobPath = $event"
          />
        </template>
        <!-- Single mode: selected blob -->
        <template v-else-if="mode === 'single' && selectedBlob">
          <span class="pdb-file-name">{{ selectedBlob.displayName }}</span>
          <span class="pdb-file-path">{{ selectedBlob.blobPath }}</span>
        </template>
        <!-- No selection yet -->
        <template v-else>
          <span class="pdb-header-label">Select a binary to inspect</span>
        </template>
      </div>

      <!-- Sub-tabs: Symbols and Structs (only when a blob is selected) -->
      <NTabs
        v-if="mode === 'single' ? !!selectedBlob : !!selectedBlob && !!selectedDiffeeBlob"
        v-model:value="activeSubTab"
        type="line"
        animated
      >
        <NTabPane name="symbols" tab="Symbols">
          <!-- Filter row with text filter and diff status filter -->
          <div class="filter-row">
            <!-- Symbol name filter input -->
            <div class="symbol-filter">
              <NInput
                ref="symbolFilterInputRef"
                v-model:value="symbolSearchQuery"
                placeholder="Filter symbols... (press / to focus, Esc to clear)"
                clearable
                size="small"
              >
                <template v-if="symbolSearchQuery" #suffix>
                  <NButton text size="tiny" @click="clearSymbolFilter">
                    <template #icon>
                      <NIcon><CloseOutline /></NIcon>
                    </template>
                  </NButton>
                </template>
              </NInput>
            </div>
            <!-- Diff status filter buttons (comparison mode only) -->
            <DiffStatusFilter
              v-if="mode === 'comparison'"
              v-model="symbolsStatusFilter"
              @update:model-value="setSymbolsStatusFilter"
            />
          </div>

          <!-- Searching indicator for target symbol -->
          <div v-if="isSearchingForTargetSymbol" class="searching-indicator">
            <NSpin size="small" />
            <span>Fetching "{{ props.targetSymbolName }}"...</span>
          </div>

          <!-- Target symbol not found alert -->
          <NAlert v-if="targetSymbolNotFound" type="warning" closable style="margin-bottom: 12px">
            Symbol "{{ props.targetSymbolName }}" not found in
            {{ selectedBlob?.displayName || 'this binary' }}.
          </NAlert>

          <!-- Top pagination (comparison mode only) -->
          <div v-if="mode === 'comparison'" class="pagination-top">
            <NPagination
              :page="symbolsCurrentPage"
              :page-count="totalSymbolPages"
              :page-size="symbolsPageSize"
              :on-update:page="handleSymbolsPageChange"
            />
          </div>

          <!-- Symbols Table -->
          <div class="table-container">
            <NDataTable
              :columns="symbolColumns"
              :data="filteredSymbols"
              :row-props="getSymbolRowProps"
              :loading="isLoading"
              striped
              virtual-scroll
              :max-height="600"
              :row-key="(row: SymbolEntry | SymbolDiffEntry) => row.name"
              @scroll="handleSymbolsScroll"
            />

            <!-- Loading indicator for progressive batching (single mode only) -->
            <div v-if="mode === 'single' && isLoadingMoreSymbols" class="loading-more-indicator">
              <NSpin size="small" />
              <span>Loading more symbols...</span>
            </div>
          </div>

          <!-- Summary info -->
          <div class="pagination-container">
            <span class="total-count">
              <template v-if="mode === 'comparison'">
                Page {{ symbolsCurrentPage }} of {{ totalSymbolPages }} ({{
                  filteredSymbols.length
                }}
                symbols<template v-if="symbolSearchQuery"> matching filter</template>,
                {{ totalSymbols }} total)
              </template>
              <template v-else>
                {{ filteredSymbols.length
                }}<template v-if="symbolSearchQuery"> matching</template> /
                {{ symbols.length }} loaded / {{ totalSymbols }} total symbols
                <template v-if="hasMoreSymbols && !symbolSearchQuery">(scroll for more)</template>
              </template>
            </span>
          </div>

          <!-- Bottom pagination (comparison mode only) -->
          <div v-if="mode === 'comparison'" class="pagination-bottom">
            <NPagination
              :page="symbolsCurrentPage"
              :page-count="totalSymbolPages"
              :page-size="symbolsPageSize"
              :on-update:page="handleSymbolsPageChange"
            />
          </div>
        </NTabPane>

        <NTabPane name="structs" tab="Structs">
          <!-- Filter row with text filter and diff status filter -->
          <div class="filter-row">
            <!-- Struct name filter input -->
            <div class="struct-filter">
              <NInput
                ref="structFilterInputRef"
                v-model:value="structSearchQuery"
                placeholder="Filter structs... (press / to focus, Esc to clear)"
                clearable
                size="small"
              >
                <template v-if="structSearchQuery" #suffix>
                  <NButton text size="tiny" @click="clearStructFilter">
                    <template #icon>
                      <NIcon><CloseOutline /></NIcon>
                    </template>
                  </NButton>
                </template>
              </NInput>
            </div>
            <!-- Diff status filter buttons (comparison mode only) -->
            <DiffStatusFilter
              v-if="mode === 'comparison'"
              v-model="structsStatusFilter"
              @update:model-value="setStructsStatusFilter"
            />
          </div>

          <!-- Searching indicator for target struct -->
          <div v-if="isSearchingForTargetStruct" class="searching-indicator">
            <NSpin size="small" />
            <span>Fetching "{{ props.targetStructName }}"...</span>
          </div>

          <!-- Target struct not found alert -->
          <NAlert v-if="targetStructNotFound" type="warning" closable style="margin-bottom: 12px">
            Struct "{{ props.targetStructName }}" not found in
            {{ selectedBlob?.displayName || 'this binary' }}.
          </NAlert>

          <!-- Structs Table -->
          <div class="table-container">
            <NDataTable
              :columns="structColumns"
              :data="structsTableData"
              :row-props="getStructRowProps"
              :loading="isLoading"
              :row-key="(row: any) => row.key || row.name"
              striped
              virtual-scroll
              :max-height="600"
              @scroll="handleStructsScroll"
            />

            <!-- Loading indicator for progressive batching (single mode only) -->
            <div v-if="mode === 'single' && isLoadingMoreStructs" class="loading-more-indicator">
              <NSpin size="small" />
              <span>Loading more structs...</span>
            </div>
          </div>

          <!-- Total count display (no pagination) -->
          <div class="pagination-container">
            <span class="total-count">
              <template v-if="structSearchQuery">
                {{ filteredStructs.length }} matching / {{ structs.length }} loaded /
                {{ totalStructs }} total structs
              </template>
              <template v-else>
                {{ structs.length }} / {{ totalStructs }} structs
                <template v-if="mode === 'single' && hasMoreStructs"> (scroll for more) </template>
              </template>
            </span>
          </div>

          <!-- Monaco View Panels (single mode only) -->
          <div
            v-if="mode === 'single' && expandedStructsForView.length > 0"
            class="monaco-diff-panels"
          >
            <div
              v-for="struct in expandedStructsForView"
              :key="`monaco-${struct.name}`"
              class="monaco-panel"
            >
              <div class="monaco-panel-header">
                <h4>{{ struct.name }}</h4>
              </div>
              <MonacoStructView :struct="struct" />
            </div>
          </div>

          <!-- Monaco Diff Panels (comparison mode only) -->
          <div
            v-if="mode === 'comparison' && expandedStructsForDiff.length > 0"
            class="monaco-diff-panels"
          >
            <div
              v-for="struct in expandedStructsForDiff"
              :key="`monaco-${struct.name}`"
              class="monaco-panel"
            >
              <div class="monaco-panel-header">
                <h4>{{ struct.name }} - Diff View</h4>
              </div>
              <MonacoStructDiff :struct="struct" />
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.pdb-inspector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pdb-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.pdb-header-label {
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.pdb-file-name {
  font-weight: 600;
  font-family: monospace;
  color: #374151;
}

.pdb-file-path {
  font-family: monospace;
  color: #6b7280;
  font-size: 13px;
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

.table-container {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.filter-container {
  display: flex;
  justify-content: flex-start;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.symbol-filter,
.struct-filter {
  flex: 1;
  max-width: 400px;
}

.pagination-top {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.pagination-bottom {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px 0;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.total-count {
  font-size: 14px;
  color: #6b7280;
}

.placeholder-container {
  padding: 60px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Diff row styling */
:deep(.n-data-table-tr.diff-row-new),
:deep(.n-data-table-tr.diff-row-new .n-data-table-td) {
  background-color: #dcfce7 !important; /* light green */
}

:deep(.n-data-table-tr.diff-row-mod),
:deep(.n-data-table-tr.diff-row-mod .n-data-table-td) {
  background-color: #fef3c7 !important; /* light amber */
}

:deep(.n-data-table-tr.diff-row-del),
:deep(.n-data-table-tr.diff-row-del .n-data-table-td) {
  background-color: #fee2e2 !important; /* light red */
  opacity: 0.9 !important;
}

:deep(.n-data-table-tr.diff-row-unchanged),
:deep(.n-data-table-tr.diff-row-unchanged .n-data-table-td) {
  background-color: #f9fafb !important; /* light gray */
  opacity: 0.7 !important;
  color: #9ca3af !important; /* muted text */
}

/* Struct tree table styling */
.struct-name-row {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  color: #374151;
}

.struct-name-row:hover {
  color: #18a058;
}

.expand-icon {
  display: inline-block;
  width: 20px;
  font-family: monospace;
  color: #6b7280;
}

.field-name-row {
  padding-left: 20px;
  color: #666;
}

.field-indent {
  color: #9ca3af;
  margin-right: 8px;
  font-family: monospace;
}

.loading-more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  color: #6b7280;
  font-size: 14px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

/* Monaco diff panels styling */
.monaco-diff-panels {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.monaco-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.monaco-panel-header {
  background: #f9fafb;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.monaco-panel-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  font-family: monospace;
}

/* Searching indicator for target items from search navigation */
.searching-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  color: #0369a1;
  margin-bottom: 12px;
}
</style>

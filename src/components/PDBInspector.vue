<script setup lang="ts">
import { computed, h, type PropType } from 'vue'
import {
  NTabs,
  NTabPane,
  NDataTable,
  NSpin,
  NAlert,
  NPagination,
  type DataTableColumns
} from 'naive-ui'
import { usePDBInspector } from '@/composables/usePDBInspector'
import type { InspectorMode, CommitContext } from '@/types/inspector'
import type { SymbolEntry, SymbolDiffEntry, StructEntry, StructDiffEntry } from '@/types/pdb'
import { formatOffset, formatSize } from '@/utils/pdb'
import DiffStatusFilter from './DiffStatusFilter.vue'
import MonacoStructDiff from './MonacoStructDiff.vue'

const props = defineProps({
  mode: { type: String as PropType<InspectorMode>, required: true },
  commit: { type: Object as PropType<CommitContext>, default: undefined },
  baseCommit: { type: Object as PropType<CommitContext>, default: undefined },
  diffeeCommit: { type: Object as PropType<CommitContext>, default: undefined }
})

const {
  isLoading,
  isLoadingContext,
  error,
  hasPDBData,
  pdbContext: _pdbContext,
  pdbContextDiff: _pdbContextDiff,
  activeSubTab,
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
  setStructsStatusFilter
} = usePDBInspector(props.mode, props.commit, props.baseCommit, props.diffeeCommit)

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
  if (props.mode === 'comparison') {
    const diffRow = row as SymbolDiffEntry
    return { class: `diff-row-${diffRow.status.toLowerCase()}` }
  }
  return {}
}

function getStructRowProps(row: StructEntry | StructDiffEntry | any) {
  if (props.mode === 'comparison' && row.status) {
    // Apply diff row styling based on status (works for both struct and field rows)
    return { class: `diff-row-${row.status.toLowerCase()}` }
  }
  return {}
}

// ============================================
// Struct Table Data (Single Mode)
// ============================================

// Flatten structs and their expanded fields into table rows (single mode only)
const structsTableDataSingle = computed(() => {
  if (props.mode !== 'single') return []

  const rows: any[] = []

  ;(structs.value as StructEntry[]).forEach((struct) => {
    // Add struct row
    rows.push({
      key: struct.name,
      type: 'struct',
      offset: '',
      name: struct.name,
      dataType: struct.kind,
      size: formatSize(struct.size),
      isExpanded: expandedStructNames.value.has(struct.name),
      struct: struct
    })

    // Add field rows if expanded
    if (expandedStructNames.value.has(struct.name)) {
      struct.fields?.forEach((field) => {
        rows.push({
          key: `${struct.name}-${field.name}`,
          type: 'field',
          offset: formatOffset(field.offset),
          name: field.name,
          dataType: field.dataType,
          size: '',
          parentStruct: struct.name
        })
      })
    }
  })

  return rows
})

// Struct table data for comparison mode (with expandable fields)
const structsTableDataComparison = computed(() => {
  if (props.mode !== 'comparison') return []

  const rows: any[] = []

  ;(structs.value as StructDiffEntry[]).forEach((struct) => {
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

    // Add field rows if expanded
    if (expandedStructNames.value.has(struct.name) && struct.fields) {
      struct.fields.forEach((field) => {
        rows.push({
          key: `${struct.name}-${field.name}`,
          type: 'field',
          name: field.name,
          status: field.status,
          offset: field.offset,
          dataType: field.dataType,
          baseOffset: field.baseOffset,
          diffeeOffset: field.diffeeOffset,
          baseDataType: field.baseDataType,
          diffeeDataType: field.diffeeDataType,
          parentStruct: struct.name
        })
      })
    }
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
            onClick: () => toggleStructExpansion(row.key)
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
    key: 'offset',
    title: 'Offset',
    width: 100,
    render: (row) => {
      if (row.type === 'field') {
        return formatOffset(row.offset)
      }
      return ''
    }
  },
  {
    key: 'name',
    title: 'Name',
    ellipsis: { tooltip: true },
    minWidth: 200,
    render: (row) => {
      if (row.type === 'struct') {
        return h(
          'div',
          {
            class: 'struct-name-row',
            onClick: () => toggleStructExpansion(row.key)
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
    key: 'type',
    title: 'Type',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: (row) => {
      if (row.type === 'field') {
        return row.dataType
      } else {
        return row.kind
      }
    }
  },
  {
    key: 'baseSize',
    title: 'Base Size',
    width: 120,
    render: (row) => {
      if (row.type === 'struct' && row.baseSize !== undefined) {
        return formatSize(row.baseSize)
      }
      return row.type === 'struct' ? '-' : ''
    }
  },
  {
    key: 'diffeeSize',
    title: 'New Size',
    width: 120,
    render: (row) => {
      if (row.type === 'struct' && row.diffeeSize !== undefined) {
        return formatSize(row.diffeeSize)
      }
      return row.type === 'struct' ? '-' : ''
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
      <p class="loading-text">Resolving ntoskrnl.exe...</p>
    </div>

    <!-- No PDB Data -->
    <NAlert v-else-if="!hasPDBData" type="warning" title="No PDB Data">
      This commit does not contain PDB symbol data for ntoskrnl.exe.
    </NAlert>

    <!-- Error State -->
    <NAlert v-else-if="error" type="error" title="Error Loading PDB Data">
      {{ error.message }}
    </NAlert>

    <!-- Main Content -->
    <div v-else class="pdb-content">
      <!-- Header showing ntoskrnl.exe -->
      <div class="pdb-header">
        <span class="pdb-file-name">ntoskrnl.exe</span>
      </div>

      <!-- Sub-tabs: Symbols and Structs -->
      <NTabs v-model:value="activeSubTab" type="line" animated>
        <NTabPane name="symbols" tab="Symbols">
          <!-- Filter buttons (comparison mode only) -->
          <div v-if="mode === 'comparison'" class="filter-container">
            <DiffStatusFilter
              v-model="symbolsStatusFilter"
              @update:model-value="setSymbolsStatusFilter"
            />
          </div>

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
              :data="symbols"
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
                  symbols.length
                }}
                symbols, {{ totalSymbols }} total)
              </template>
              <template v-else>
                {{ symbols.length }} / {{ totalSymbols }} symbols
                <template v-if="hasMoreSymbols">(scroll for more)</template>
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
          <!-- Filter buttons (comparison mode only) -->
          <div v-if="mode === 'comparison'" class="filter-container">
            <DiffStatusFilter
              v-model="structsStatusFilter"
              @update:model-value="setStructsStatusFilter"
            />
          </div>

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
              {{ structs.length }} / {{ totalStructs }} structs
              <template v-if="mode === 'single' && hasMoreStructs"> (scroll for more) </template>
            </span>
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
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.pdb-file-name {
  font-weight: 600;
  font-family: monospace;
  color: #374151;
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
</style>

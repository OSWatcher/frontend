<script setup lang="ts">
import { computed, h, type PropType } from 'vue'
import {
  NTabs,
  NTabPane,
  NDataTable,
  NTag,
  NPagination,
  NSpin,
  NAlert,
  type DataTableColumns
} from 'naive-ui'
import { usePDBInspector } from '@/composables/usePDBInspector'
import type { InspectorMode, CommitContext } from '@/types/inspector'
import type { SymbolEntry, SymbolDiffEntry } from '@/types/pdb'
import { getStatusTagType, formatOffset, formatSize } from '@/utils/pdb'

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
  symbolPage,
  symbolPageSize,
  symbolPageCount,
  setSymbolPage,
  structs,
  totalStructs,
  structPage,
  structPageSize,
  structPageCount,
  expandedStructHashes,
  setStructPage,
  toggleStructExpansion
} = usePDBInspector(props.mode, props.commit, props.baseCommit, props.diffeeCommit)

// ============================================
// Symbol Columns
// ============================================

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
    key: 'status',
    title: 'Status',
    width: 100,
    render: (row) =>
      h(NTag, { type: getStatusTagType(row.status), size: 'small' }, () => row.status)
  },
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

// ============================================
// Struct Table Data
// ============================================

// Flatten structs and their expanded fields into table rows
const structsTableData = computed(() => {
  const rows: any[] = []

  structs.value.forEach((struct) => {
    // Add struct row
    rows.push({
      key: struct.name,
      type: 'struct',
      offset: '',
      name: struct.name,
      dataType: struct.kind,
      size: formatSize(struct.size),
      isExpanded: expandedStructHashes.value.has(struct.name),
      struct: struct
    })

    // Add field rows if expanded
    if (expandedStructHashes.value.has(struct.name)) {
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

// ============================================
// Struct Columns
// ============================================

const structColumns = computed<DataTableColumns<any>>(() => [
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
          [
            h('span', { class: 'expand-icon' }, row.isExpanded ? '▼ ' : '▶ '),
            h('span', row.name)
          ]
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
            />
          </div>

          <!-- Pagination -->
          <div class="pagination-container">
            <NPagination
              v-model:page="symbolPage"
              :page-count="symbolPageCount"
              :page-size="symbolPageSize"
              show-quick-jumper
              @update:page="setSymbolPage"
            />
            <span class="total-count">{{ totalSymbols }} symbols</span>
          </div>
        </NTabPane>

        <NTabPane name="structs" tab="Structs">
          <!-- Structs Table -->
          <div class="table-container">
            <NDataTable
              :columns="structColumns"
              :data="structsTableData"
              :loading="isLoading"
              :row-key="(row: any) => row.key"
              striped
              :max-height="600"
            />
          </div>

          <!-- Pagination -->
          <div class="pagination-container">
            <NPagination
              v-model:page="structPage"
              :page-count="structPageCount"
              :page-size="structPageSize"
              show-quick-jumper
              @update:page="setStructPage"
            />
            <span class="total-count">{{ totalStructs }} structs</span>
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
</style>

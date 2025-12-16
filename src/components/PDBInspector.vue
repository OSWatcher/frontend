<script setup lang="ts">
import { computed, type PropType } from 'vue'
import {
  NTabs,
  NTabPane,
  NDataTable,
  NPagination,
  NSpin,
  NAlert,
  NEmpty,
  type DataTableColumns
} from 'naive-ui'
import { usePDBInspector } from '@/composables/usePDBInspector'
import type { CommitContext } from '@/types/inspector'
import type { SymbolEntry } from '@/types/pdb'

const props = defineProps({
  commit: { type: Object as PropType<CommitContext>, required: true }
})

const {
  isLoading,
  isLoadingContext,
  error,
  hasPDBData,
  pdbContext: _pdbContext,
  activeSubTab,
  symbols,
  totalSymbols,
  symbolPage,
  symbolPageSize,
  symbolPageCount,
  setSymbolPage
} = usePDBInspector(props.commit)

// ============================================
// Symbol Columns
// ============================================

const symbolColumns = computed<DataTableColumns<SymbolEntry>>(() => [
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
              :loading="isLoading"
              striped
              virtual-scroll
              :max-height="600"
              :row-key="(row: SymbolEntry) => row.name"
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
          <!-- Placeholder for Structs -->
          <div class="placeholder-container">
            <NEmpty description="Struct explorer coming soon" />
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
</style>

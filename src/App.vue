<script setup lang="ts">
import { ref, h } from 'vue'
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NSpace,
  NButton,
  NInput,
  NModal,
  NDataTable,
  NPagination,
  NGradientText,
  NIcon,
  type DataTableColumns
} from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import { useRouter, RouterLink } from 'vue-router'
import gqlClient from '@/graphql-client'
import { SEARCH_FS } from '@/queries'

interface SearchResult {
  commit_name: string
  commit_hash: string
  path: string
}

const showSearchModal = ref(false)
const searchTerm = ref('')
const searchResults = ref<SearchResult[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const isLoading = ref(false)

const router = useRouter()

// Search columns for data table
const searchColumns: DataTableColumns<SearchResult> = [
  {
    title: 'Commit',
    key: 'commit_name',
    sorter: 'default',
    width: 200,
  },
  {
    title: 'Path',
    key: 'path',
    sorter: 'default',
    ellipsis: {
      tooltip: true
    }
  }
]

// Keyboard shortcut handler
const handleShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    showSearchModal.value = true
  }
}

const performSearch = async () => {
  if (!searchTerm.value.trim()) return

  isLoading.value = true
  try {
    const response = await gqlClient.query({
      query: SEARCH_FS,
      variables: { searchTerm: searchTerm.value }
    })
    searchResults.value = response.data.search || []
    currentPage.value = 1
  } catch (error) {
    console.error('Error searching:', error)
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

const handleRowClick = (row: SearchResult) => {
  showSearchModal.value = false
  router.push({
    path: `/os/${row.commit_hash}`,
    query: { os_title: row.commit_name, filesystem: row.path }
  })
}

const clearSearch = () => {
  searchResults.value = []
  searchTerm.value = ''
}

// Mount keyboard listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleShortcut)
}
</script>

<template>
  <NLayout class="app-layout">
    <!-- Header -->
    <NLayoutHeader bordered class="app-header">
      <div class="header-content">
        <div class="header-left">
          <RouterLink to="/" class="brand-title">
            OSWatcher
          </RouterLink>
        </div>

        <div class="header-right">
          <!-- Search Button -->
          <NButton
            secondary
            @click="showSearchModal = true"
            class="search-trigger"
          >
            <template #icon>
              <NIcon><SearchOutline /></NIcon>
            </template>
            Search
            <kbd class="kbd">⌘K</kbd>
          </NButton>
        </div>
      </div>
    </NLayoutHeader>

    <!-- Main Content -->
    <NLayoutContent class="app-content">
      <RouterView />
    </NLayoutContent>

    <!-- Footer -->
    <NLayoutFooter bordered class="app-footer">
      <div class="footer-content-simple">
        <div>
          <NGradientText type="info" :size="18">
            OSWatcher
          </NGradientText>
          <p class="footer-tagline">Operating System Analysis & Tracking</p>
        </div>
        <div class="footer-copyright-simple">
          <p>© 2024 OSWatcher</p>
        </div>
      </div>
    </NLayoutFooter>

    <!-- Search Modal -->
    <NModal
      v-model:show="showSearchModal"
      preset="card"
      title="Search Filesystem"
      class="search-modal"
      :style="{ width: '800px', maxWidth: '90vw' }"
      @after-leave="clearSearch"
    >
      <NSpace vertical :size="16">
        <NInput
          v-model:value="searchTerm"
          placeholder="Search for files and directories..."
          size="large"
          clearable
          autofocus
          @keyup.enter="performSearch"
        >
          <template #prefix>
            <NIcon><SearchOutline /></NIcon>
          </template>
        </NInput>

        <NDataTable
          v-if="searchResults.length > 0 || isLoading"
          :columns="searchColumns"
          :data="searchResults"
          :loading="isLoading"
          :pagination="{
            page: currentPage,
            pageSize: pageSize,
            showSizePicker: true,
            pageSizes: [10, 20, 50],
            onChange: (page: number) => { currentPage = page },
            onUpdatePageSize: (size: number) => { pageSize = size }
          }"
          :row-props="(row: SearchResult) => ({
            style: 'cursor: pointer;',
            onClick: () => handleRowClick(row)
          })"
          striped
        />

        <div v-else-if="searchTerm && !isLoading" class="empty-search">
          <p>No results found for "{{ searchTerm }}"</p>
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showSearchModal = false">Close</NButton>
          <NButton type="primary" @click="performSearch" :loading="isLoading">
            Search
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </NLayout>
</template>

<style>
/* Global styles */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f9fafb;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ============================================================================
   HEADER
   ============================================================================ */
.app-header {
  background: #ffffff;
  border-bottom: 2px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  text-decoration: none;
  letter-spacing: -0.5px;
  transition: color 0.2s;
}

.brand-title:hover {
  color: #4f46e5;
}

.header-right {
  display: flex;
  align-items: center;
}

.search-trigger {
  min-width: 200px;
  justify-content: space-between;
  border: 1px solid #d1d5db;
}

.kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  margin-left: 8px;
  color: #6b7280;
}

.icon-button {
  font-size: 20px;
  color: #374151;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.icon-button:hover {
  background: #f3f4f6;
  color: #111827;
}

/* ============================================================================
   CONTENT
   ============================================================================ */
.app-content {
  flex: 1;
  background: #f9fafb;
  min-height: calc(100vh - 180px);
}

/* ============================================================================
   FOOTER
   ============================================================================ */
.app-footer {
  background: #2d3748;
  color: #e2e8f0;
  padding: 40px 24px 24px;
  margin-top: auto;
}

.footer-content-simple {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-tagline {
  font-size: 13px;
  color: #a0aec0;
  margin: 8px 0 0 0;
}

.footer-copyright-simple p {
  margin: 0;
  font-size: 14px;
  color: #e2e8f0;
}

/* ============================================================================
   SEARCH MODAL
   ============================================================================ */
.empty-search {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-search p {
  margin: 0;
  font-size: 14px;
}

/* ============================================================================
   RESPONSIVE
   ============================================================================ */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
  }

  .search-trigger {
    min-width: 150px;
  }

  .footer-content-simple {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}
</style>

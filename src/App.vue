<script setup lang="ts">
import { ref, h, onMounted, computed, watch } from 'vue'
import {
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NSpace,
  NButton,
  NInput,
  NModal,
  NDataTable,
  NGradientText,
  NIcon,
  NSpin,
  NDropdown,
  NAvatar,
  NSwitch,
  NTabs,
  NTabPane,
  NCheckbox,
  type DataTableColumns,
  type DropdownOption
} from 'naive-ui'
import { SearchOutline, PersonCircleOutline, LogOutOutline } from '@vicons/ionicons5'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { onUnmounted } from 'vue'
import { useAuth0 } from '@auth0/auth0-vue'
import gqlClient, { setAuthTokenGetter } from '@/graphql-client'
import { SEARCH_FS_STREAM, fetchCommitDetails } from '@/queries'
import { CommitScope, SearchEntityType } from '@/graphql-types'
import { useBranchSelectionStore } from '@/stores/branchSelection'
import { useSearchContextStore } from '@/stores/searchContext'
import { parseRegistryEntityPath } from '@/utils/registry'

interface SearchResult {
  type: string
  commit_name: string
  commit_hash: string
  blob_path: string
  blob_hash: string
  entity_path?: string
  node_hash: string
}

const showSearchModal = ref(false)
const searchTerm = ref('')
const caseSensitive = ref(false)
const selectedEntityTypes = ref<SearchEntityType[]>([SearchEntityType.Filesystem])
const activeResultTab = ref<'filesystem' | 'registry'>('filesystem')
const searchResults = ref<SearchResult[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const isLoading = ref(false)
const isStreaming = ref(false)
const streamingResultCount = ref(0)
const hasSearched = ref(false)

const router = useRouter()
const route = useRoute()
const branchSelection = useBranchSelectionStore()
const searchContext = useSearchContextStore()

// Inspector context detection
const isInspectorSingleMode = computed(() => {
  return route.name === 'InspectorSingle' && route.params.commitHash
})

const inspectorCommitHash = computed(() => {
  return isInspectorSingleMode.value ? (route.params.commitHash as string) : null
})

const inspectorCommitName = ref<string>('')

// Fetch commit name when in inspector mode
watch(
  inspectorCommitHash,
  async (hash) => {
    if (hash) {
      try {
        const response = await gqlClient.query({
          query: fetchCommitDetails,
          variables: { where: { hash } }
        })
        const commit = response.data?.commits?.[0]
        inspectorCommitName.value = commit?.name || hash.slice(0, 7)
      } catch {
        inspectorCommitName.value = hash.slice(0, 7)
      }
    } else {
      inspectorCommitName.value = ''
    }
  },
  { immediate: true }
)

// Computed results by entity type
const filesystemResults = computed(() =>
  searchResults.value.filter((r) => r.type === SearchEntityType.Filesystem)
)

const registryResults = computed(() =>
  searchResults.value.filter((r) => r.type === SearchEntityType.Registry)
)

// Helper to toggle entity type
const toggleEntityType = (type: SearchEntityType, checked: boolean) => {
  if (checked) {
    // Add if not already included
    if (!selectedEntityTypes.value.includes(type)) {
      selectedEntityTypes.value = [...selectedEntityTypes.value, type]
    }
  } else {
    // Remove if exists (but keep at least one selected)
    if (selectedEntityTypes.value.length > 1) {
      selectedEntityTypes.value = selectedEntityTypes.value.filter((t) => t !== type)
    }
  }
}

// Set entity types based on context when modal opens
watch(showSearchModal, (show) => {
  if (show) {
    if (searchContext.isInspectorMode) {
      // Inspector mode: search current tab only
      const tab = searchContext.activeInspectorTab
      if (tab === 'filesystem') {
        selectedEntityTypes.value = [SearchEntityType.Filesystem]
        activeResultTab.value = 'filesystem'
      } else if (tab === 'registry') {
        selectedEntityTypes.value = [SearchEntityType.Registry]
        activeResultTab.value = 'registry'
      }
    } else {
      // HomeView: omnisearch all entities
      selectedEntityTypes.value = [SearchEntityType.Filesystem, SearchEntityType.Registry]
      activeResultTab.value = 'filesystem'
    }
  }
})

// Auth0
const {
  isAuthenticated,
  isLoading: isAuthLoading,
  user,
  loginWithRedirect,
  logout,
  getAccessTokenSilently
} = useAuth0()

// Set up auth token getter for Apollo Client
onMounted(() => {
  setAuthTokenGetter(
    () => getAccessTokenSilently(),
    () => isAuthenticated.value
  )
})

// User dropdown options
const userDropdownOptions: DropdownOption[] = [
  {
    label: 'Logout',
    key: 'logout',
    icon: () => h(NIcon, null, { default: () => h(LogOutOutline) })
  }
]

const handleUserDropdownSelect = (key: string) => {
  if (key === 'logout') {
    logout({ logoutParams: { returnTo: window.location.origin + import.meta.env.BASE_URL } })
  }
}

// Store subscription to clean up on unmount
let searchSubscription: any = null

// Helper function to highlight search term in text
const highlightSearchTerm = (text: string, searchTerm: string) => {
  if (!searchTerm) return text

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return h(
    'span',
    parts.map((part) => (regex.test(part) ? h('mark', { class: 'search-highlight' }, part) : part))
  )
}

// Search columns for filesystem data table
const filesystemColumns: DataTableColumns<SearchResult> = [
  {
    title: 'Commit',
    key: 'commit_name',
    sorter: 'default',
    width: 200
  },
  {
    title: 'Path',
    key: 'blob_path',
    sorter: 'default',
    ellipsis: {
      tooltip: true
    },
    render: (row) => highlightSearchTerm(row.blob_path, searchTerm.value)
  }
]

// Search columns for registry data table
const registryColumns: DataTableColumns<SearchResult> = [
  {
    title: 'Commit',
    key: 'commit_name',
    sorter: 'default',
    width: 200
  },
  {
    title: 'Registry Path',
    key: 'entity_path',
    sorter: 'default',
    ellipsis: {
      tooltip: true
    },
    render: (row) => highlightSearchTerm(row.entity_path || '', searchTerm.value)
  }
]

// Keyboard shortcut handler
const handleShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    showSearchModal.value = true
  }
}

const performSearch = () => {
  if (!searchTerm.value.trim()) return

  // Cancel any existing subscription
  if (searchSubscription) {
    searchSubscription.unsubscribe()
  }

  // Reset state
  searchResults.value = []
  streamingResultCount.value = 0
  isLoading.value = true
  isStreaming.value = true
  hasSearched.value = true
  currentPage.value = 1

  // Start streaming subscription
  try {
    let startCommit: string
    let scope: CommitScope

    if (isInspectorSingleMode.value && inspectorCommitHash.value) {
      // Inspector mode: search within current commit only
      startCommit = inspectorCommitHash.value
      scope = CommitScope.Single
    } else {
      // Global mode: search commit history
      if (!branchSelection.selectedBranchHash) {
        console.error('No branch selected for search')
        isLoading.value = false
        isStreaming.value = false
        return
      }
      startCommit = branchSelection.selectedBranchHash
      scope = isAuthenticated.value ? CommitScope.HistoryWithUpdates : CommitScope.History
    }

    const variables = {
      input: {
        search_term: searchTerm.value,
        commit_range: {
          startCommit,
          scope
        },
        entity_types: selectedEntityTypes.value,
        case_sensitive: caseSensitive.value
      }
    }

    const observable = gqlClient.subscribe({
      query: SEARCH_FS_STREAM,
      variables
    })

    searchSubscription = observable.subscribe({
      next: (result) => {
        // Progressive rendering: append each result as it arrives
        if (result.data?.searchStream) {
          searchResults.value.push(result.data.searchStream)
          streamingResultCount.value++
          isLoading.value = false // Show first results immediately
        }
      },
      error: (error) => {
        console.error('Search streaming error:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        isLoading.value = false
        isStreaming.value = false
      },
      complete: () => {
        isStreaming.value = false
        isLoading.value = false
      }
    })
  } catch (error) {
    console.error('Error starting search stream:', error)
    isLoading.value = false
    isStreaming.value = false
  }
}

const handleRowClick = (row: SearchResult) => {
  showSearchModal.value = false

  if (row.type === SearchEntityType.Filesystem) {
    // Navigate to filesystem with directory and highlight
    const pathParts = row.blob_path.split('/')
    const filename = pathParts.pop() || ''
    const directory = pathParts.join('/') || '/'

    router.push({
      path: `/inspect/${row.commit_hash}`,
      query: {
        directory: directory,
        highlight: filename
      }
    })
  } else if (row.type === SearchEntityType.Registry) {
    // Navigate to registry with deep-linking
    const parsed = parseRegistryEntityPath(row.entity_path || '')

    if (parsed) {
      router.push({
        path: `/inspect/${row.commit_hash}`,
        query: {
          tab: 'registry',
          regHive: parsed.hiveName,
          regPath: parsed.parentPath,
          regHighlight: parsed.targetName
        }
      })
    } else {
      // Fallback: navigate to registry tab at root
      router.push({
        path: `/inspect/${row.commit_hash}`,
        query: {
          tab: 'registry'
        }
      })
    }
  }
}

const clearSearch = () => {
  // Cancel subscription if active
  if (searchSubscription) {
    searchSubscription.unsubscribe()
    searchSubscription = null
  }
  searchResults.value = []
  searchTerm.value = ''
  caseSensitive.value = false
  isStreaming.value = false
  streamingResultCount.value = 0
  hasSearched.value = false
}

// Mount keyboard listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleShortcut)
}

// Clean up subscription on unmount
onUnmounted(() => {
  if (searchSubscription) {
    searchSubscription.unsubscribe()
  }
})
</script>

<template>
  <NConfigProvider>
    <NLayout class="app-layout">
      <!-- Header -->
      <NLayoutHeader bordered class="app-header">
        <div class="header-content">
          <div class="header-left">
            <RouterLink to="/" class="brand-title"> OSWatcher </RouterLink>
          </div>

          <div class="header-right">
            <!-- Search Button -->
            <NButton secondary @click="showSearchModal = true" class="search-trigger">
              <template #icon>
                <NIcon>
                  <SearchOutline />
                </NIcon>
              </template>
              {{ isInspectorSingleMode ? `Search in ${inspectorCommitName}` : 'Search' }}
              <kbd class="kbd">⌘K</kbd>
            </NButton>

            <!-- Auth: Login/User Dropdown -->
            <div v-if="!isAuthLoading">
              <!-- Login Button -->
              <NButton
                v-if="!isAuthenticated"
                type="info"
                @click="loginWithRedirect"
                class="login-button"
              >
                <template #icon>
                  <NIcon>
                    <PersonCircleOutline />
                  </NIcon>
                </template>
                Login
              </NButton>

              <!-- User Dropdown -->
              <NDropdown
                v-else
                :options="userDropdownOptions"
                @select="handleUserDropdownSelect"
                trigger="click"
              >
                <div class="user-profile">
                  <NAvatar
                    v-if="user?.picture"
                    round
                    :size="32"
                    :src="user.picture"
                    :fallback-src="`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email || 'User')}`"
                  />
                  <NAvatar v-else round :size="32">
                    <NIcon>
                      <PersonCircleOutline />
                    </NIcon>
                  </NAvatar>
                  <span class="user-name">{{ user?.name || user?.email || 'User' }}</span>
                </div>
              </NDropdown>
            </div>
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
            <NGradientText type="info" :size="18"> OSWatcher </NGradientText>
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
        :style="{ width: '1200px', maxWidth: '95vw' }"
        @after-leave="clearSearch"
      >
        <NSpace vertical :size="16">
          <NInput
            v-model:value="searchTerm"
            :placeholder="
              isInspectorSingleMode
                ? `Search in ${inspectorCommitName}...`
                : 'Search for files and directories...'
            "
            size="large"
            clearable
            autofocus
            @keyup.enter="performSearch"
          >
            <template #prefix>
              <NIcon>
                <SearchOutline />
              </NIcon>
            </template>
          </NInput>

          <!-- Search options -->
          <div class="search-options">
            <div class="entity-type-selectors">
              <span class="search-section-label">Search in:</span>
              <NCheckbox
                :checked="selectedEntityTypes.includes(SearchEntityType.Filesystem)"
                @update:checked="
                  (checked) => toggleEntityType(SearchEntityType.Filesystem, checked)
                "
              >
                Filesystem
              </NCheckbox>
              <NCheckbox
                :checked="selectedEntityTypes.includes(SearchEntityType.Registry)"
                @update:checked="(checked) => toggleEntityType(SearchEntityType.Registry, checked)"
              >
                Registry
              </NCheckbox>
            </div>
            <div class="case-sensitive-option">
              <NSwitch v-model:value="caseSensitive" size="small" />
              <span class="search-option-label" @click="caseSensitive = !caseSensitive"
                >Case sensitive</span
              >
            </div>
          </div>

          <!-- Streaming status indicator -->
          <div v-if="isStreaming" class="streaming-status">
            <NSpin size="small" />
            <span class="streaming-badge">● Live</span>
            <span>Streaming results... ({{ streamingResultCount }} found)</span>
          </div>

          <!-- Results Tabs -->
          <NTabs
            v-if="searchResults.length > 0 || isLoading"
            v-model:value="activeResultTab"
            type="line"
            animated
          >
            <NTabPane name="filesystem" :tab="`Filesystem (${filesystemResults.length})`">
              <NDataTable
                :columns="filesystemColumns"
                :data="filesystemResults"
                :loading="isLoading && filesystemResults.length === 0"
                :max-height="500"
                :pagination="{
                  page: currentPage,
                  pageSize: pageSize,
                  showSizePicker: true,
                  pageSizes: [10, 20, 50, 100],
                  onChange: (page: number) => {
                    currentPage = page
                  },
                  onUpdatePageSize: (size: number) => {
                    pageSize = size
                  }
                }"
                :row-props="
                  (row: SearchResult) => ({
                    style: 'cursor: pointer;',
                    onClick: () => handleRowClick(row)
                  })
                "
                striped
              />
            </NTabPane>
            <NTabPane name="registry" :tab="`Registry (${registryResults.length})`">
              <NDataTable
                :columns="registryColumns"
                :data="registryResults"
                :loading="isLoading && registryResults.length === 0"
                :max-height="500"
                :pagination="{
                  page: currentPage,
                  pageSize: pageSize,
                  showSizePicker: true,
                  pageSizes: [10, 20, 50, 100],
                  onChange: (page: number) => {
                    currentPage = page
                  },
                  onUpdatePageSize: (size: number) => {
                    pageSize = size
                  }
                }"
                :row-props="
                  (row: SearchResult) => ({
                    style: 'cursor: pointer;',
                    onClick: () => handleRowClick(row)
                  })
                "
                striped
              />
            </NTabPane>
          </NTabs>

          <div
            v-else-if="
              hasSearched && searchTerm && !isLoading && !isStreaming && searchResults.length === 0
            "
            class="empty-search"
          >
            <p>No results found for "{{ searchTerm }}"</p>
          </div>
        </NSpace>

        <template #footer>
          <NSpace justify="space-between">
            <span v-if="searchResults.length > 0" class="result-summary">
              {{ searchResults.length }} result(s)
            </span>
            <span v-else></span>
            <NSpace>
              <NButton @click="showSearchModal = false">Close</NButton>
              <NButton
                type="primary"
                @click="performSearch"
                :loading="isLoading && searchResults.length === 0"
                :disabled="isStreaming"
              >
                {{ isStreaming ? 'Streaming...' : 'Search' }}
              </NButton>
            </NSpace>
          </NSpace>
        </template>
      </NModal>
    </NLayout>
  </NConfigProvider>
</template>

<style>
/* Global styles */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
    sans-serif;
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
  background: #1f2937;
  border-bottom: 1px solid #374151;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
  color: #ffffff;
  text-decoration: none;
  letter-spacing: -0.5px;
  transition: color 0.2s;
}

.brand-title:hover {
  color: #60a5fa;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-trigger {
  min-width: 200px;
  max-width: 400px;
  justify-content: space-between;
  border: 1px solid #6b7280;
  background: #ffffff;
  color: #374151;
}

.search-trigger:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s;
}

.user-profile:hover {
  background: rgba(255, 255, 255, 0.15);
}

.user-name {
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1;
  background: #1f2937;
  border: 1px solid #4b5563;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  margin-left: 8px;
  color: #9ca3af;
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
.streaming-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  font-size: 13px;
  color: #0369a1;
}

.result-summary {
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
}

.streaming-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #d1fae5;
  color: #065f46;
  font-weight: 600;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  margin: 0 6px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.search-options {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.entity-type-selectors {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-section-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.case-sensitive-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.search-option-label {
  font-size: 14px;
  color: #4b5563;
  user-select: none;
  cursor: pointer;
}

.search-highlight {
  background: #fef08a;
  color: #854d0e;
  padding: 2px 0;
  border-radius: 2px;
  font-weight: 600;
}

/* Monospace font for file paths in search results */
:deep(.n-data-table-td) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', 'Courier New', monospace;
  font-size: 13px;
}

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

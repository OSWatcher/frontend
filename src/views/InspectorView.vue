<script setup lang="ts">
/**
 * Inspector View
 *
 * Main view for the unified Inspector architecture. Handles routing,
 * mode detection, and orchestrates the header and content components.
 *
 * Routes:
 * - /inspect/:commitHash - Single mode (view one commit)
 * - /inspect/:baseHash/vs/:diffeeHash - Comparison mode (diff two commits)
 *
 * Query Parameters:
 * - path: Initial filesystem path to navigate to (e.g., ?path=/etc/systemd)
 * - layout: Layout mode for comparison (unified or side-by-side)
 * - branch: Branch name for breadcrumbs
 *
 * Features:
 * - Automatic mode detection from route
 * - Fetch commit details for display names
 * - Mode and layout switching
 * - Navigation between modes
 *
 * @component
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NAlert, NTabs, NTabPane } from 'naive-ui'
import InspectorHeader from '@/components/InspectorHeader.vue'
import FilesystemInspector from '@/components/FilesystemInspector.vue'
import RegistryInspector from '@/components/RegistryInspector.vue'
import gqlClient from '@/graphql-client'
import type { InspectorMode, InspectorLayout, CommitContext } from '@/types/inspector'
import type { FetchCommitDetailsQuery, GetCommitCapabilitiesQuery } from '@/graphql-types'
import { FetchCommitDetailsDocument, GetCommitCapabilitiesDocument } from '@/graphql-types'

// ===================================================================
// ROUTING
// ===================================================================

const route = useRoute()
const router = useRouter()

// ===================================================================
// STATE
// ===================================================================

/**
 * Loading state
 * True while fetching commit details
 */
const isLoading = ref<boolean>(true)

/**
 * Error state
 * Stores any errors that occur during initialization
 */
const error = ref<Error | null>(null)

/**
 * Single commit context (for single mode)
 */
const singleCommit = ref<CommitContext | undefined>(undefined)

/**
 * Base commit context (for comparison mode)
 */
const baseCommit = ref<CommitContext | undefined>(undefined)

/**
 * Diffee commit context (for comparison mode)
 */
const diffeeCommit = ref<CommitContext | undefined>(undefined)

/**
 * Branch name (from query params, for breadcrumbs)
 */
const branchName = ref<string>('')

/**
 * Inspector layout (unified or side-by-side)
 * Read from query params or defaults to unified
 */
const inspectorLayout = ref<InspectorLayout>('unified')

/**
 * Active tab name
 */
const activeTab = ref<string>('filesystem')

/**
 * Available capabilities (filesystem, registry, pdb)
 */
const hasRegistry = ref<boolean>(false)

/**
 * Loading state for capabilities check
 */
const isLoadingCapabilities = ref<boolean>(false)

// ===================================================================
// COMPUTED
// ===================================================================

/**
 * Inspector Mode
 *
 * Determines mode based on route params:
 * - Single mode: /inspect/:commitHash
 * - Comparison mode: /inspect/:baseHash/vs/:diffeeHash
 */
const inspectorMode = computed<InspectorMode>(() => {
  if (route.params.diffeeHash) {
    return 'comparison'
  }
  return 'single'
})

/**
 * Initial Path
 *
 * Gets initial filesystem path from query params (e.g., ?path=/etc/systemd)
 * Defaults to root '/' if not specified
 */
const initialPath = computed<string>(() => {
  return (route.query.path as string) || '/'
})

// ===================================================================
// METHODS
// ===================================================================

/**
 * Fetch Commit Details
 *
 * Queries GraphQL to get commit name and description.
 * Used to populate CommitContext objects for display.
 *
 * @param commitHash - Commit hash to fetch details for
 * @returns CommitContext object with hash and name
 */
async function fetchCommitInfo(commitHash: string): Promise<CommitContext> {
  try {
    const response = await gqlClient.query<FetchCommitDetailsQuery>({
      query: FetchCommitDetailsDocument,
      variables: { where: { hash: commitHash } }
    })

    const commit = response.data?.commits?.[0]
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found`)
    }

    return {
      hash: commitHash,
      name: commit.name || commitHash.slice(0, 7)
    }
  } catch (err) {
    console.error('Error fetching commit details:', err)
    // Return hash as name if fetch fails
    return {
      hash: commitHash,
      name: commitHash.slice(0, 7)
    }
  }
}

/**
 * Check Commit Capabilities
 *
 * Asynchronously checks what data is available (registry, pdb, etc.)
 * without blocking the main UI.
 */
async function checkCapabilities(commitHash: string) {
  isLoadingCapabilities.value = true
  try {
    const capabilitiesResponse = await gqlClient.query<GetCommitCapabilitiesQuery>({
      query: GetCommitCapabilitiesDocument,
      variables: { commitHash }
    })
    const labels = capabilitiesResponse.data.getCommitExtractedDataLabels || []
    hasRegistry.value = labels.includes('WinRegKey') || labels.includes('WinRegValue')
  } catch (err) {
    console.warn('Error checking commit capabilities:', err)
    // Capabilities check failure doesn't block the UI - just hide optional tabs
    hasRegistry.value = false
  } finally {
    isLoadingCapabilities.value = false
  }
}

/**
 * Initialize Inspector
 *
 * Loads commit details based on route params.
 * Determines mode and fetches appropriate commit info.
 * Shows UI immediately after commit details are loaded, then loads capabilities asynchronously.
 */
async function initializeInspector() {
  isLoading.value = true
  error.value = null

  try {
    // Get branch name from query params
    branchName.value = (route.query.branch as string) || ''

    // Get layout from query params
    const layoutParam = route.query.layout as string
    if (layoutParam === 'side-by-side') {
      inspectorLayout.value = 'side-by-side'
    } else {
      inspectorLayout.value = 'unified'
    }

    if (inspectorMode.value === 'single') {
      // Single mode: fetch one commit
      const commitHash = route.params.commitHash as string
      if (!commitHash) {
        throw new Error('Commit hash is required for single mode')
      }

      singleCommit.value = await fetchCommitInfo(commitHash)
      baseCommit.value = undefined
      diffeeCommit.value = undefined
    } else {
      // Comparison mode: fetch two commits
      const baseHash = route.params.baseHash as string
      const diffeeHash = route.params.diffeeHash as string

      if (!baseHash || !diffeeHash) {
        throw new Error('Both base and diffee hashes are required for comparison mode')
      }

      // Fetch both commits in parallel
      const [base, diffee] = await Promise.all([
        fetchCommitInfo(baseHash),
        fetchCommitInfo(diffeeHash)
      ])

      baseCommit.value = base
      diffeeCommit.value = diffee
      singleCommit.value = undefined
    }

    // Show UI immediately - filesystem is always available
    isLoading.value = false

    // Reset capabilities state
    hasRegistry.value = false

    // Check capabilities asynchronously (doesn't block UI)
    const commitToCheck = singleCommit.value || baseCommit.value
    if (commitToCheck) {
      checkCapabilities(commitToCheck.hash)
    }
  } catch (err) {
    console.error('Error initializing inspector:', err)
    error.value = err instanceof Error ? err : new Error(String(err))
    isLoading.value = false
  }
}

/**
 * Handle Add Comparison
 *
 * User clicked "+ vs" button to add a comparison target.
 * For PoC, we'll show a message. In production, this would open a commit picker.
 */
function handleAddComparison() {
  // TODO: Open commit picker modal to select second commit
  console.log('Add comparison - TODO: implement commit picker')

  // For PoC demonstration, navigate to a comparison with a mock second commit
  // In production, this would be selected by the user
  if (singleCommit.value) {
    // This is just for demonstration - you would actually pick a commit
    alert(
      'Add comparison feature: Would open a commit picker to select second commit for comparison'
    )
  }
}

/**
 * Handle Remove Comparison
 *
 * User clicked X button to remove comparison target.
 * Navigates back to single mode, keeping the base commit.
 */
function handleRemoveComparison() {
  if (baseCommit.value) {
    router.push({
      path: `/inspect/${baseCommit.value.hash}`,
      query: {
        branch: branchName.value,
        path: initialPath.value
      }
    })
  }
}

/**
 * Handle Layout Change
 *
 * User toggled between unified and side-by-side layouts.
 * Updates query params to persist layout choice.
 *
 * @param newLayout - New layout mode
 */
function handleLayoutChange(newLayout: InspectorLayout) {
  inspectorLayout.value = newLayout

  // Update query params to persist layout
  router.push({
    ...route,
    query: {
      ...route.query,
      layout: newLayout
    }
  })
}

// ===================================================================
// LIFECYCLE
// ===================================================================

/**
 * Initialize on mount
 */
onMounted(() => {
  initializeInspector()
})

/**
 * Re-initialize when route changes
 * (e.g., navigating between different commits)
 */
watch(
  () => route.fullPath,
  () => {
    initializeInspector()
  }
)
</script>

<template>
  <div class="inspector-view">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <NSpin size="large" />
      <p class="loading-text">Loading inspector...</p>
    </div>

    <!-- Error State -->
    <NAlert v-else-if="error" type="error" title="Error Loading Inspector" class="error-alert">
      {{ error.message }}
    </NAlert>

    <!-- Main Inspector Content -->
    <div v-else class="inspector-content">
      <!-- Header -->
      <InspectorHeader
        :mode="inspectorMode"
        :layout="inspectorLayout"
        :commit="singleCommit"
        :base-commit="baseCommit"
        :diffee-commit="diffeeCommit"
        :branch-name="branchName"
        :active-tab="activeTab === 'filesystem' ? 'Filesystem' : 'Registry'"
        @add-comparison="handleAddComparison"
        @remove-comparison="handleRemoveComparison"
        @layout-change="handleLayoutChange"
      />

      <!-- Tabs -->
      <div class="inspector-body">
        <NTabs v-model:value="activeTab" type="line" animated>
          <template #suffix>
            <!-- Loading indicator for additional tabs -->
            <div v-if="isLoadingCapabilities" class="capabilities-loading">
              <NSpin size="small" />
              <span>Checking for additional tabs...</span>
            </div>
          </template>
          <!-- Filesystem Tab -->
          <NTabPane name="filesystem" tab="Filesystem">
            <FilesystemInspector
              v-if="inspectorMode === 'single' && singleCommit"
              :mode="inspectorMode"
              :layout="inspectorLayout"
              :commit="singleCommit"
              :initial-path="initialPath"
            />
            <FilesystemInspector
              v-else-if="inspectorMode === 'comparison' && baseCommit && diffeeCommit"
              :mode="inspectorMode"
              :layout="inspectorLayout"
              :base-commit="baseCommit"
              :diffee-commit="diffeeCommit"
              :initial-path="initialPath"
            />
          </NTabPane>

          <!-- Registry Tab (only if available) -->
          <NTabPane v-if="hasRegistry" name="registry" tab="Registry">
            <RegistryInspector
              v-if="inspectorMode === 'single' && singleCommit"
              :mode="inspectorMode"
              :layout="inspectorLayout"
              :commit="singleCommit"
            />
            <RegistryInspector
              v-else-if="inspectorMode === 'comparison' && baseCommit && diffeeCommit"
              :mode="inspectorMode"
              :layout="inspectorLayout"
              :base-commit="baseCommit"
              :diffee-commit="diffeeCommit"
            />
          </NTabPane>
        </NTabs>
      </div>
    </div>
  </div>
</template>

<style scoped>
/**
 * Component Styles
 *
 * Layout styles for the Inspector View.
 */

.inspector-view {
  min-height: 100vh;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.loading-text {
  margin: 0;
  color: #666;
  font-size: 14px;
}

/* Error State */
.error-alert {
  margin: 24px;
}

/* Inspector Content */
.inspector-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* Inspector Body */
.inspector-body {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

/* Capabilities Loading */
.capabilities-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 4px;
  font-size: 12px;
  color: #0369a1;
  margin-left: 16px;
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 768px) {
  .inspector-body {
    padding: 16px;
  }
}
</style>

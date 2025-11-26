# Frontend Architecture

This document describes the architectural patterns and design decisions for the OSWatcher frontend.

## Technology Stack

### Core Framework
- **Vue 3.5+** - Composition API with `<script setup>`
- **TypeScript 5.4+** - Strict mode enabled
- **Vite 5.2+** - Build tool and dev server
- **Vue Router 4.4+** - Client-side routing

### UI Components
- **Naive UI 2.x** - Modern Vue 3 component library
  - TypeScript-first design
  - Built-in dark mode support
  - Lightweight and tree-shakeable
  - Comprehensive component set
  - Excellent documentation

### State Management
- **Pinia 2.x** - Official Vue state management
  - Used for global state (branch selection, commit selection)
  - TypeScript-friendly with excellent type inference
  - DevTools support with time-travel debugging

### Data Layer
- **Apollo Client 3.11+** - GraphQL client
- **GraphQL Code Generator** - Auto-generates TypeScript types from schema
- **@vue/apollo-composable** - Vue integration for Apollo

### Development Tools
- **ESLint 8.57** - Code linting
- **Prettier 3.2** - Code formatting
- **VitePress 1.0** - Documentation site generator

## Unified Inspector Architecture

### Design Philosophy

The unified Inspector architecture replaces the old separate OSView/DiffView pattern with a single, cohesive system that handles both single commit viewing and comparison mode.

**Key Principles:**
1. **Single Responsibility**: One view orchestrates everything (InspectorView)
2. **Mode-Aware Components**: Components adapt based on mode (single vs comparison)
3. **Layout Flexibility**: Support both unified and side-by-side layouts
4. **Type Safety**: Full TypeScript coverage with discriminated unions
5. **Async Loading**: Don't block UI while checking capabilities

### Architecture Overview

```
InspectorView (Orchestrator)
├── InspectorHeader (Commit info, breadcrumbs, controls)
├── NTabs (Dynamic tab bar)
│   ├── FilesystemInspector (Always available)
│   └── RegistryInspector (Windows only, loaded async)
└── Capabilities Loading Indicator (Inline with tabs)
```

## Core Components

### InspectorView.vue

**Location**: `src/views/InspectorView.vue`

**Responsibility**: Main orchestrator that handles routing, mode detection, commit loading, and capability checking.

**Routes**:
- `/inspect/:commitHash` - Single mode (view one commit)
- `/inspect/:baseHash/vs/:diffeeHash` - Comparison mode (diff two commits)

**Query Parameters**:
- `path` - Initial filesystem path to navigate to
- `layout` - Layout mode for comparison ('unified' | 'side-by-side')
- `branch` - Branch name for display in breadcrumbs

**Key Features**:
```typescript
// Mode detection
const inspectorMode = computed<InspectorMode>(() => {
  return route.params.diffeeHash ? 'comparison' : 'single'
})

// Async capability checking (non-blocking)
async function checkCapabilities(commitHash: string) {
  const labels = await fetchExtractedDataLabels(commitHash)
  hasRegistry.value = labels.includes('WinRegKey')
  // UI already visible, this just adds Registry tab when ready
}

// Load filesystem immediately, check capabilities in background
async function initializeInspector() {
  await fetchCommitInfo() // Load commit details
  isLoading.value = false // Show UI immediately
  checkCapabilities()     // Load additional tabs async
}
```

**State Management**:
- `isLoading` - Main loading state (commit details only)
- `isLoadingCapabilities` - Background loading for additional tabs
- `singleCommit` / `baseCommit` / `diffeeCommit` - Commit contexts
- `hasRegistry` - Whether Registry tab should be shown

### InspectorHeader.vue

**Location**: `src/components/InspectorHeader.vue`

**Responsibility**: Displays commit information, breadcrumbs, and controls (layout toggle, comparison management).

**Props**:
```typescript
interface Props {
  mode: InspectorMode           // 'single' | 'comparison'
  layout: InspectorLayout       // 'unified' | 'side-by-side'
  commit?: CommitContext        // For single mode
  baseCommit?: CommitContext    // For comparison mode
  diffeeCommit?: CommitContext  // For comparison mode
  branchName?: string           // Display in breadcrumbs
  activeTab?: string            // Current active tab
}
```

**Features**:
- Shows commit name/hash with tooltip
- Breadcrumb navigation (Home → Branch → Commit)
- "Add vs" button in single mode
- "Remove comparison" button in comparison mode
- Layout toggle (unified ↔ side-by-side) in comparison mode

### FilesystemInspector.vue

**Location**: `src/components/FilesystemInspector.vue`

**Responsibility**: Unified component for filesystem viewing in both single and comparison modes.

**Key Features**:
- **Mode-Aware Rendering**: Switches between single/comparison columns
- **Breadcrumb Navigation**: Clickable path segments
- **Pagination**: 50/100/200 items per page
- **Download Links**: For files in single mode
- **Diff Visualization**: Status tags and row colors in comparison mode

**Column Definitions**:
```typescript
// Single Mode
const singleModeColumns = [
  { icon, name, type, size, actions (download) }
]

// Comparison Mode (Unified)
const comparisonModeColumns = [
  { icon, name, status, size }
]

// Side-by-Side
const sideBySideColumns = [
  { icon, name, type, size }
]
```

**Diff Row Styling**:
```css
.diff-row-new { background-color: #f0fdf4 }      /* Green */
.diff-row-modified { background-color: #fffbeb } /* Yellow */
.diff-row-deleted { background-color: #fef2f2 }  /* Red */
```

### RegistryInspector.vue

**Location**: `src/components/RegistryInspector.vue`

**Responsibility**: Unified component for Windows Registry viewing in both single and comparison modes.

**Key Features**:
- **Hive Selection**: Dropdown to choose registry hive (HKLM, HKU, etc.)
- **Dynamic Hive Loading**: Fetches available hives from commit data
- **Breadcrumb Navigation**: Shows current registry path
- **Value Display**: Shows registry value types and data
- **Diff Support**: Same status indicators as filesystem

**Hive Structure**:
```typescript
interface RegistryHive {
  mountPath: string  // e.g., "HKEY_LOCAL_MACHINE/SAM"
  hash: string       // WinRegKey root hash
  diffeeHash?: string // For comparison mode
}
```

**Registry Path Handling**:
- Uses forward slash `/` as path separator (unified with backend)
- Displays with spacing: "HKEY_LOCAL_MACHINE / SAM" for readability
- Breadcrumbs support navigation to parent keys

## Composables

### useFilesystemInspector.ts

**Location**: `src/composables/useFilesystemInspector.ts`

**Responsibility**: Reactive state management and data fetching for filesystem.

**Key Functions**:
```typescript
export function useFilesystemInspector(
  mode: InspectorMode,
  layout: InspectorLayout,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext,
  initialPath?: string
) {
  // Returns:
  return {
    currentPath,      // Current filesystem path
    entries,          // Parsed and sorted entries
    breadcrumbs,      // Navigation breadcrumbs
    isLoading,        // Loading state
    error,            // Error state
    navigateToPath,   // Navigate to new path
    refresh           // Reload current path
  }
}
```

**Mode Handling**:
- **Single Mode**: Fetches entries at path from single commit
- **Comparison Mode**: Fetches diff entries comparing base vs diffee

**GraphQL Queries**:
- `TRAVERSE_PATH` - Get hash of node at path
- `LIST_ENTRIES_FOR_TREE` - Get child blobs and trees
- `DIFF_NODES` - Get diff between two tree nodes

### useRegistryInspector.ts

**Location**: `src/composables/useRegistryInspector.ts`

**Responsibility**: Reactive state management and data fetching for Windows Registry.

**Key Functions**:
```typescript
export function useRegistryInspector(
  mode: InspectorMode,
  layout: InspectorLayout,
  commit?: CommitContext,
  baseCommit?: CommitContext,
  diffeeCommit?: CommitContext
) {
  // Returns:
  return {
    currentPath,       // Current registry path
    entries,           // Parsed and sorted entries
    breadcrumbs,       // Navigation breadcrumbs
    isLoading,         // Loading state
    isLoadingHives,    // Hive loading state
    error,             // Error state
    availableHives,    // Available registry hives
    selectedHive,      // Currently selected hive
    navigateToPath,    // Navigate to new path
    selectHive,        // Change selected hive
    refresh            // Reload current path
  }
}
```

**Hive Discovery**:
```typescript
// Single mode
const hives = await GetSystemHives(commit.hash)

// Comparison mode
const baseHives = await GetSystemHives(baseCommit.hash)
const diffeeHives = await GetSystemHives(diffeeCommit.hash)
// Match hives by mount path
```

## Utility Modules

### filesystem.ts

**Location**: `src/utils/filesystem.ts`

**Purpose**: Pure functions for filesystem data transformation.

**Key Functions**:
```typescript
// Parse GraphQL response into FilesystemEntry[]
export function parseFilesystemEntries(rawEntries, currentPath): FilesystemEntry[]

// Parse GraphQL diff response into FilesystemDiffEntry[]
export function parseFilesystemDiffEntries(rawDiffEntries, currentPath): FilesystemDiffEntry[]

// Path manipulation
export function joinPath(base: string, segment: string): string
export function splitPath(path: string): string[]
export function getParentPath(path: string): string

// Display helpers
export function formatFileSize(bytes?: number): string
export function getStatusTagType(status: DiffStatus): 'success' | 'warning' | 'error'
export function getDownloadUrl(hash: string): string

// Breadcrumbs
export function generateBreadcrumbs(path: string, includeHome = true): BreadcrumbItem[]

// Sorting
export function sortFilesystemEntries<T extends FilesystemEntry>(entries: T[]): T[]
```

### registry.ts

**Location**: `src/utils/registry.ts`

**Purpose**: Pure functions for registry data transformation.

**Key Functions**:
```typescript
// Parse GraphQL response into RegistryEntry[]
export function parseRegistryEntries(rawEntries, currentPath): RegistryEntry[]

// Parse GraphQL diff response into RegistryDiffEntry[]
export function parseRegistryDiffEntries(rawDiffEntries, currentPath): RegistryDiffEntry[]

// Path manipulation (uses '/' like filesystem)
export function joinRegistryPath(base: string, segment: string): string
export function splitRegistryPath(path: string): string[]
export function getParentRegistryPath(path: string): string

// Display helpers
export function formatRegistryValue(value?: string, maxLength = 100): string
export function getRegistryStatusTagType(status: DiffStatus): TagType

// Breadcrumbs
export function generateRegistryBreadcrumbs(
  hiveName: string,
  path: string,
  includeHome = true
): RegistryBreadcrumbItem[]

// Sorting
export function sortRegistryEntries<T extends RegistryEntry>(entries: T[]): T[]
```

## Type System

### inspector.ts

**Location**: `src/types/inspector.ts`

**Purpose**: Core type definitions for the unified Inspector architecture.

**Key Types**:
```typescript
// Mode discrimination
export type InspectorMode = 'single' | 'comparison'
export type InspectorLayout = 'unified' | 'side-by-side'

// Commit context
export interface CommitContext {
  hash: string
  name: string
}

// Filesystem types
export interface FilesystemEntry {
  name: string
  type: 'blob' | 'tree'
  hash: string
  size?: number
  path: string
}

export interface FilesystemDiffEntry extends FilesystemEntry {
  status: DiffStatus
  baseHash?: string
  diffeeHash?: string
  baseSize?: number
  diffeeSize?: number
}

// Breadcrumb navigation
export interface BreadcrumbItem {
  label: string
  path?: string
  icon?: string
}
```

### registry.ts

**Location**: `src/types/registry.ts`

**Purpose**: Type definitions for Windows Registry structures.

**Key Types**:
```typescript
// Registry entry types
export interface RegistryEntry {
  name: string
  type: 'key' | 'value'
  path: string
  value?: string
  valueType?: string
}

export interface RegistryDiffEntry extends RegistryEntry {
  status: DiffStatus
  baseValue?: string
  diffeeValue?: string
  baseValueType?: string
  diffeeValueType?: string
}

// Registry hive
export interface RegistryHive {
  mountPath: string
  hash: string
  diffeeHash?: string  // For comparison mode
}

// Breadcrumb
export interface RegistryBreadcrumbItem {
  label: string
  path?: string
  icon?: string
}
```

## Routing Structure

```
/                              → HomeView (commit history browser)
/inspect/:commitHash           → InspectorView (single mode)
  - Query params: ?path=<path>&branch=<name>
/inspect/:baseHash/vs/:diffeeHash → InspectorView (comparison mode)
  - Query params: ?path=<path>&layout=<layout>&branch=<name>
```

### Route Evolution

**Old Routes** (removed):
- `/os/:commitHash` - Old OS view
- `/diff/:baseHash/:diffeeHash` - Old diff view

**New Routes** (current):
- `/inspect/:commitHash` - Unified single view
- `/inspect/:baseHash/vs/:diffeeHash` - Unified comparison view

**Benefits**:
- Clearer URL structure
- Single code path for both modes
- Easier to add new tabs
- Consistent UX

## Pinia Stores

### commitSelection.ts

**Location**: `src/stores/commitSelection.ts`

**Purpose**: Manages selected commits for diff comparison.

**State**:
```typescript
{
  selectedCommits: string[]  // Max 2 commit hashes
}
```

**Computed**:
```typescript
{
  canDiff: boolean          // True when 2 commits selected
  diffLink: string | null   // URL for diff view
}
```

**Actions**:
```typescript
{
  toggle(hash: string)      // Toggle commit selection
  clear()                   // Clear all selections
  isSelected(hash: string)  // Check if hash is selected
}
```

### branchSelection.ts

**Location**: `src/stores/branchSelection.ts`

**Purpose**: Manages currently selected branch in HomeView.

**State**:
```typescript
{
  selectedBranchName: string | null
  selectedBranchHash: string | null
}
```

**Actions**:
```typescript
{
  selectBranch(name: string, hash: string)
  clearSelection()
}
```

## Naive UI Component Usage

### Core Components

| Component | Usage | Location |
|-----------|-------|----------|
| NDataTable | Tables with sorting, pagination | All inspectors |
| NTabs/NTabPane | Multi-tab interfaces | InspectorView |
| NButton | Actions and navigation | Throughout |
| NBreadcrumb | Path navigation | All inspectors |
| NTag | Status indicators (NEW/MOD/DEL) | Diff views |
| NIcon | Icons throughout | Throughout |
| NSpin | Loading states | Loading screens |
| NAlert | Error messages | Error states |
| NSpace | Consistent spacing | Layouts |
| NSelect | Dropdown selections | Registry hive picker |
| NModal | Search dialog | App.vue |
| NConfigProvider | Theme and config | App.vue wrapper |

### Theme Configuration

NConfigProvider wraps the entire app to provide consistent theming:

```vue
<template>
  <NConfigProvider>
    <NLayout class="app-layout">
      <!-- App content -->
    </NLayout>
  </NConfigProvider>
</template>
```

## Design Patterns

### 1. Mode-Aware Components

Components adapt their behavior and UI based on `InspectorMode`:

```typescript
// Columns change based on mode
const tableColumns = computed(() => {
  if (props.mode === 'single') {
    return singleModeColumns.value
  } else {
    return comparisonModeColumns.value
  }
})

// Different queries based on mode
if (mode === 'single') {
  await fetchEntriesForSingleMode()
} else {
  await fetchEntriesForComparisonMode()
}
```

### 2. Pure Utility Functions

All data transformation happens in pure functions (no side effects):

```typescript
// ✅ Good - Pure function
export function parseFilesystemEntries(rawEntries, currentPath) {
  return rawEntries.map(entry => ({
    name: entry.name,
    type: entry.type,
    path: joinPath(currentPath, entry.name)
  }))
}

// ❌ Bad - Side effects
function parseEntries(rawEntries) {
  currentPath.value = '/' // Don't mutate external state
  return entries
}
```

### 3. Composables for State Management

Composables encapsulate reactive state and side effects:

```typescript
export function useFilesystemInspector(...props) {
  const currentPath = ref('/')
  const entries = ref<FilesystemEntry[]>([])
  const isLoading = ref(false)

  async function navigateToPath(path: string) {
    isLoading.value = true
    entries.value = await fetchEntries(path)
    isLoading.value = false
    currentPath.value = path
  }

  return { currentPath, entries, isLoading, navigateToPath }
}
```

### 4. Type-Safe GraphQL

Always use generated types with GraphQL queries:

```typescript
// ✅ Good
const response = await gqlClient.query<TraversePathQuery>({
  query: TRAVERSE_PATH,
  variables: { ... }
})
const hash = response.data.traversePath.hash

// ❌ Bad
const response = await gqlClient.query({
  query: TRAVERSE_PATH,
  variables: { ... }
})
const hash = response.data['traversePath']['hash']  // No type safety!
```

### 5. Async Capability Loading

Don't block the main UI while checking for optional features:

```typescript
async function initialize() {
  await loadCommitDetails()    // Required - block on this
  isLoading.value = false       // Show UI immediately

  checkCapabilities()           // Optional - don't await
  // Registry tab appears when ready, user can use filesystem meanwhile
}
```

## Performance Considerations

### Bundle Size
- Naive UI is tree-shakeable - only imported components are bundled
- Target: <500kb initial bundle (currently achieved)
- Lazy-load non-critical routes if needed

### Data Fetching
- Apollo Client cache reduces redundant queries
- Pagination limits data transfer (50/100/200 items)
- Background capability checking doesn't block UI

### Rendering
- Virtual scrolling via NDataTable's `virtual-scroll` prop
- Computed properties are memoized automatically
- Use `v-show` for frequently toggled elements (tabs)

## Testing Strategy (Future)

### Unit Tests
- Utility functions (`filesystem.ts`, `registry.ts`)
- Composables (`useFilesystemInspector`, `useRegistryInspector`)
- Pinia stores

### Component Tests
- Inspector components with mock data
- Test both single and comparison modes
- Test layout switching

### E2E Tests
- Full navigation flows
- Search functionality
- Diff comparison

## Future Enhancements

### Short Term
- Add unit tests for utils and composables
- Add component tests
- Implement error boundaries

### Medium Term
- Add PDB Inspector (symbols and structures)
- Support more than 2-way diffs
- Advanced search with filters

### Long Term
- Timeline view for tracking changes across many commits
- Export diff reports (PDF, CSV)
- Collaborative annotations

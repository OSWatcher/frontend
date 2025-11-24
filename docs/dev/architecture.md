# Frontend Architecture

This document describes the architectural patterns and design decisions for the OSWatcher frontend.

## Technology Stack

### Core Framework
- **Vue 3.5+** - Composition API with `<script setup>`
- **TypeScript 5.4+** - Strict mode enabled
- **Vite 5.2+** - Build tool and dev server
- **Vue Router 4.4+** - Client-side routing

### UI Components
- **Naive UI 2.x** - Component library
  - TypeScript-first design
  - Built-in dark mode support
  - Lightweight (~150kb)
  - Tree-shakeable

### State Management
- **Pinia 2.x** - Official Vue state management
  - Used for global state (commit selection, UI preferences)
  - TypeScript-friendly with excellent type inference
  - DevTools support with time-travel debugging

### Data Layer
- **Apollo Client 3.11+** - GraphQL client
- **GraphQL Code Generator** - Auto-generates TypeScript types
- **@vue/apollo-composable** - Vue integration

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Unit testing (optional)
- **Playwright** - E2E testing (optional)

## Component Patterns

### Base Component Pattern

The frontend uses a **Generic + Specialized** pattern to eliminate code duplication:

```
BaseExplorer (generic)          BaseDiffExplorer (generic)
├── FilesystemExplorer          ├── FilesystemDiff
├── RegistryExplorer            ├── RegistryDiff
└── PDBExplorer                 └── PDBDiff
```

#### BaseExplorer

Generic tree/table navigator for hierarchical data exploration.

**Features**:
- Breadcrumb navigation
- Pagination support
- Export to JSON
- Customizable columns
- Click handling

**Props**:
```typescript
interface Props<T> {
  fetchEntries: (path: string, page: number, pageSize: number) => Promise<{
    items: T[]
    total_count: number
  }>
  columns: DataTableColumn[]
  onItemClick?: (item: T) => void
  initialPath?: string
  paginate?: boolean
  exportable?: boolean
}
```

**Usage Pattern**:
```vue
<!-- FilesystemExplorer.vue -->
<BaseExplorer
  :fetch-entries="fetchFilesystemEntries"
  :columns="filesystemColumns"
  :on-item-click="handleFileClick"
/>
```

#### BaseDiffExplorer

Generic diff viewer with color-coded status indicators.

**Features**:
- NEW/MOD/DEL status with color coding
- Breadcrumb navigation for diff paths
- Filter by diff status
- Recursive depth control
- Export local or global changes

**Props**:
```typescript
interface Props<T> {
  fetchDiff: (path: string, page: number, pageSize: number) => Promise<{
    items: T[]
    total_count: number
  }>
  columns: DataTableColumn[]
  filterStatus?: DiffStatus[]
  maxDepth?: number
}
```

**Color Scheme**:
- **NEW** - Green (`#d4edda`)
- **MOD** - Yellow (`#fff3cd`)
- **DEL** - Red (`#f8d7da`)

### View Components

#### HomeView
- Displays branch selection
- Shows commit history table
- Manages commit selection for diff comparison
- Uses Pinia store for selection state

#### OSView
- Single OS snapshot explorer
- Dynamic tabs based on commit capabilities
- Tabs: Filesystem (always), Registry (Windows), PDB (Windows, if extracted)

#### DiffView
- Two-commit comparison
- Dynamic tabs matching OSView structure
- Shows NEW/MOD/DEL changes

## Composables

Reusable logic extracted into composables to eliminate duplication:

### useTreeNavigation

Manages breadcrumb navigation and path traversal.

```typescript
export function useTreeNavigation(initialPath = '/') {
  const currentPath = ref(initialPath)
  const breadcrumbs = computed(() =>
    currentPath.value.split('/').filter(Boolean).map((segment, idx, arr) => ({
      label: segment,
      path: '/' + arr.slice(0, idx + 1).join('/')
    }))
  )

  function navigateTo(path: string) {
    currentPath.value = path
  }

  return { currentPath, breadcrumbs, navigateTo }
}
```

### usePagination

Shared pagination logic for tables.

```typescript
export function usePagination(initialPageSize = 50) {
  const currentPage = ref(1)
  const pageSize = ref(initialPageSize)
  const totalCount = ref(0)
  const pageCount = computed(() => Math.ceil(totalCount.value / pageSize.value))

  function setPage(page: number) {
    currentPage.value = page
  }

  return { currentPage, pageSize, totalCount, pageCount, setPage }
}
```

### useGraphQLConnection

Parses GraphQL connection pattern responses.

```typescript
export function useGraphQLConnection() {
  function parseTreeConnection(data: {
    child_blobsConnection: { edges: any[]; totalCount: number }
    child_treesConnection: { edges: any[]; totalCount: number }
  }) {
    const files = data.child_blobsConnection.edges.map(edge => ({
      name: edge.properties.name,
      type: NodeType.Blob,
      hash: edge.node.hash
    }))

    const dirs = data.child_treesConnection.edges.map(edge => ({
      name: edge.properties.name,
      type: NodeType.Tree,
      hash: edge.node.hash
    }))

    return {
      items: [...dirs, ...files],
      total_count: data.child_blobsConnection.totalCount + data.child_treesConnection.totalCount
    }
  }

  function parseRegistryConnection(data: {
    child_keysConnection: { edges: any[]; totalCount: number }
    child_valuesConnection: { edges: any[]; totalCount: number }
  }) {
    // Similar pattern for registry
  }

  return { parseTreeConnection, parseRegistryConnection }
}
```

## Pinia Stores

### Commit Selection Store

Manages selected commits for diff comparison.

**File**: `src/stores/commitSelection.ts`

```typescript
export const useCommitSelectionStore = defineStore('commitSelection', () => {
  const selectedCommits = ref<string[]>([])
  const maxSelection = 2

  const canDiff = computed(() => selectedCommits.value.length === maxSelection)

  const diffLink = computed(() => {
    if (canDiff.value) {
      const [base, diffee] = selectedCommits.value
      return `/diff/${base}/${diffee}`
    }
    return null
  })

  function toggle(hash: string) {
    const index = selectedCommits.value.indexOf(hash)
    if (index >= 0) {
      selectedCommits.value.splice(index, 1)
    } else if (selectedCommits.value.length < maxSelection) {
      selectedCommits.value.push(hash)
    }
  }

  function clear() {
    selectedCommits.value = []
  }

  function isSelected(hash: string): boolean {
    return selectedCommits.value.includes(hash)
  }

  return {
    selectedCommits,
    canDiff,
    diffLink,
    toggle,
    clear,
    isSelected
  }
})
```

### UI Preferences Store

Manages user interface preferences with localStorage persistence.

**File**: `src/stores/preferences.ts`

```typescript
export const usePreferencesStore = defineStore('preferences', () => {
  const darkMode = ref(loadFromStorage('darkMode', false))
  const pageSize = ref(loadFromStorage('pageSize', 50))
  const defaultBranch = ref<string | null>(loadFromStorage('defaultBranch', null))

  // Watch and persist changes
  watch(darkMode, (value) => saveToStorage('darkMode', value))
  watch(pageSize, (value) => saveToStorage('pageSize', value))
  watch(defaultBranch, (value) => saveToStorage('defaultBranch', value))

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
  }

  function setPageSize(size: number) {
    if (size > 0 && size <= 100) {
      pageSize.value = size
    }
  }

  return {
    darkMode,
    pageSize,
    defaultBranch,
    toggleDarkMode,
    setPageSize
  }
})
```

## Naive UI Component Mapping

Mapping from old Bootstrap-Vue-Next components to Naive UI:

| Old Component | New Component | Usage |
|---------------|---------------|-------|
| BTable | NDataTable | Tables with sorting, pagination |
| BTabs/BTab | NTabs/NTabPane | Multi-tab interfaces |
| BButton | NButton | Actions and navigation |
| BDropdown | NDropdown | Branch/hive selection |
| BPagination | NPagination | Table pagination |
| BFormCheckbox | NCheckbox | Commit selection |
| BModal | NModal | Search dialog |
| BNavbar | NLayout/NLayoutHeader | App header |
| BSpinner | NSpin | Loading states |
| - | NBreadcrumb | Path navigation (new) |
| - | NTag | Diff status badges (new) |
| - | NAlert | Error messages (new) |
| - | NSpace | Consistent spacing (new) |

## Theme Customization

**File**: `src/naive-theme.ts`

```typescript
import { GlobalThemeOverrides } from 'naive-ui'

export const naiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3b4a6b',        // Brand color
    primaryColorHover: '#4a5d87',
    primaryColorPressed: '#2c3a52',
    borderRadius: '4px',
  },
  DataTable: {
    thColor: '#f5f5f5',             // Table header background
    thTextColor: '#333',
    tdColorHover: '#fafafa',
  },
  Tag: {
    colorSuccess: '#d4edda',        // NEW (green)
    colorWarning: '#fff3cd',        // MOD (yellow)
    colorError: '#f8d7da',          // DEL (red)
  }
}
```

**Usage in App.vue**:

```vue
<template>
  <n-config-provider :theme="isDark ? darkTheme : undefined" :theme-overrides="naiveThemeOverrides">
    <RouterView />
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme } from 'naive-ui'
import { naiveThemeOverrides } from '@/naive-theme'
import { usePreferencesStore } from '@/stores/preferences'

const preferences = usePreferencesStore()
const isDark = computed(() => preferences.darkMode)
</script>
```

## Project Structure

```
src/
├── views/                      # Route-based views
│   ├── HomeView.vue           # Commit history browser
│   ├── OSView.vue             # OS snapshot explorer
│   └── DiffView.vue           # Commit comparison
├── components/
│   ├── base/                  # Generic base components
│   │   ├── BaseExplorer.vue
│   │   ├── BaseDiffExplorer.vue
│   │   └── DiffStatusTag.vue
│   └── explorers/             # Specialized explorers
│       ├── FilesystemExplorer.vue
│       ├── RegistryExplorer.vue
│       └── PDBExplorer.vue
├── composables/               # Reusable logic
│   ├── usePagination.ts
│   ├── useTreeNavigation.ts
│   └── useGraphQLConnection.ts
├── stores/                    # Pinia stores
│   ├── commitSelection.ts
│   └── preferences.ts
├── router/                    # Vue Router config
├── graphql-client.ts          # Apollo Client setup
├── queries.ts                 # GraphQL queries
├── graphql-types.ts           # Generated types (auto)
├── naive-theme.ts             # Naive UI theme
└── main.ts                    # App initialization
```

## Design Principles

### 1. Generic + Specialized Pattern

Create generic base components that handle common functionality, then specialize for specific data types.

**Benefits**:
- Single source of truth for navigation/diff logic
- Easy to add new data types
- Consistent UX across features
- Reduced code duplication (~150 lines eliminated)

### 2. Composables for Shared Logic

Extract reusable logic into composables instead of duplicating code.

**Benefits**:
- Testable in isolation
- Reusable across components
- Type-safe
- Better separation of concerns

### 3. Pinia for Global State

Use Pinia stores for state that needs to be shared across multiple components or persisted.

**When to use stores**:
- Commit selection (shared between HomeView and commit table)
- UI preferences (dark mode, page size)
- Current branch selection

**When to use local state**:
- Component-specific UI state (modals, dropdowns)
- Temporary form data
- Loading states

### 4. Type Safety First

Leverage TypeScript and auto-generated GraphQL types for compile-time safety.

**Avoid**:
- `any` types - use generated GraphQL types instead
- Untyped GraphQL queries - use typed queries or composables
- Manual type definitions - use code generation

## Performance Considerations

### Bundle Size
- Use tree-shaking with component-level imports
- Lazy-load non-critical routes
- Target: <500kb initial bundle

### Data Fetching
- Use Apollo Client cache for repeated queries
- Implement pagination for large datasets
- Consider background refetching for stale data

### Rendering
- Use `v-show` vs `v-if` for frequently toggled elements
- Implement virtual scrolling for long lists (if needed)
- Memoize expensive computed properties

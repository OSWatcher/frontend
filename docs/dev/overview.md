# OSWatcher Frontend - High-Level Overview

## Project Purpose

**OSWatcher** is a system introspection and forensics tool that captures snapshots of operating system state over time and provides powerful comparison capabilities. Think of it as "Git for Operating Systems" - it tracks changes to:

- **Filesystem** - Files, directories, metadata
- **Windows Registry** - Keys, values, hives
- **Debug Symbols (PDB)** - Binary symbols, structures, types

The frontend provides a web-based interface to explore these snapshots and understand how a system evolves over time.

The goal of OSWatcher is to provide a platform that can provide:

1. On-demand snapshot access: Retrieve any file from any historical snapshot without maintaining full VM copies
2. Advanced diff capabilities: Compare snapshots at any granularity (file, registry key, PE symbol, kernel structure, syscall, etc.)
3. Artifact tracking: Query where a specific artifact (registry key, file, PE export, syscall) has been seen across snapshots, and track when it was first inserted, modified, or deleted (similar to git log and git diff-filter)
4. Continuous dataset maintenance: Automated installation of OS updates and snapshot capture
5. GraphQL API: Build automation and integrate with existing toolchains

To this day, Artifact tracking is not implemented yet.

## Core Features

### 1. Commit History Browser (HomeView)

**Purpose**: Browse OS snapshots organized as branches and commits

The HomeView displays a hierarchical structure of OS snapshots:

1. **Branches** - Top-level operating systems (e.g., `Windows`, `ubuntu-server`)
2. **Commits** - Each branch is a linked-list of commits representing specific OS releases (e.g., `Windows11-24h2`)
3. **Update History** - Each commit can have its own history branch tracking OS updates over time

**Actions**:
- **Explore**: Click any commit to view that OS snapshot in detail (→ InspectorView)
- **Compare**: Select 2 commits (base + diffee) to see what changed between them (→ InspectorView comparison mode)

### 2. Unified Inspector (InspectorView)

**Purpose**: Single, unified interface for exploring OS snapshots in both single and comparison modes

The InspectorView replaces the old separate OSView/DiffView pattern with a single, cohesive system:

**Modes**:
- **Single Mode** (`/inspect/:commitHash`) - Explore a single OS snapshot
- **Comparison Mode** (`/inspect/:baseHash/vs/:diffeeHash`) - Compare two OS snapshots

**Layouts** (Comparison Mode Only):
- **Unified** - Show diff in a single table with status indicators (NEW/MOD/DEL)
- **Side-by-Side** - Show two tables side-by-side for direct comparison

**Dynamic Tabs**:
- **Filesystem** (always available) - Browse file/directory hierarchy with breadcrumb navigation, view metadata (name, hash, type, size), download file contents
- **Registry** (Windows only) - Navigate Windows Registry hives (HKLM, HKU, etc.), view keys and values
- **PDB Symbols** (Windows only, if extracted) - Browse debug symbols, structures, and types from binaries
  - Cursor-based pagination (1000 symbols, 400 structs per batch)
  - Monaco Editor C struct visualization
  - Filter inputs (`/` to focus, `Esc` to clear)
  - Diff status filtering (NEW/MOD/DEL) in comparison mode
  - Row expansion for struct fields (lazy-loaded)

**Async Tab Loading**:
- Filesystem tab displays immediately
- Additional tabs (Registry, PDB) appear after capability check completes
- Inline loading indicator shows when capabilities are being checked
- No blocking spinners - users can start exploring immediately

### 3. Global Search

**Purpose**: Search across all commits for files, registry keys, symbols, or structs

**Features**:
- Ctrl+K / Cmd+K keyboard shortcut
- Multi-entity search: Filesystem, Registry, Symbol, Struct
- Context-aware entity type selection (pre-selects based on active inspector tab)
- Streaming results via GraphQL subscription (progressive loading)
- Click-to-navigate for all entity types:
  - Filesystem/Registry: Navigate to path in tree view
  - Symbol/Struct: Navigate to PDB tab with item highlighted

## Data Model

### Hash-Based Content Addressing

Every piece of data (file, directory, registry key) is identified by its SHA hash:
- Enables efficient storage: identical content stored once
- Powers diff algorithm: compare hashes to detect changes instantly
- Content-addressable: same content always has same hash

### Graph Database Structure

```
Commit → Tree (filesystem root)
       → WinRegKey (registry root)
       → Binary → Symbols/Structs

Tree → child_trees (subdirectories)
     → child_blobs (files)

WinRegKey → child_keys (subkeys)
          → child_values (registry values)
```

### GraphQL API

#### Configuration Files
- **Schema**: `schema.graphql` - Complete GraphQL schema
- **Code Generation**: `codegen.yml` - GraphQL Code Generator config
- **Queries**: `src/queries.ts` - All GraphQL queries used by the frontend
- **Generated Types**: `src/graphql-types.ts` - Auto-generated TypeScript types (run `npm run generate`)
- **Client Setup**: `src/graphql-client.ts` - Apollo Client configuration

#### Apollo Client Setup
- Endpoint from `VITE_GRAPHEOS_API_URI` environment variable
- Default fetch policy: `cache-and-network`
- Global error handling for GraphQL and network errors
- InMemoryCache with TypedTypePolicies support

#### Core Concepts

**Hashable Interface**: All content nodes (Tree, Blob, WinRegKey, etc.) implement `Hashable { hash: String! }`

**Enums**:
- `NodeType`: Blob, Tree, WinRegValue, WinRegKey, Symbol, WinStruct, WinStructField, WinDataType
- `DiffStatus`: NEW, MOD, DEL

**Neo4j GraphQL Connection Pattern**: All relationship queries return:
```typescript
{
  edges: [{ node: { hash, ...fields }, properties: { name, ...relProps } }],
  totalCount: number
}
```

#### Available Queries (see `src/queries.ts`)

**Branches & Commits**:
- `fetchBranches` - Get all branches with their tracked commits
- `fetchCommitHistory` - Get commit history (forward/backward direction)
- `fetchCommitDetails` - Get commit metadata
- `getCommitCapabilities` - Get extracted data labels for dynamic tabs

**Filesystem**:
- `GET_FS_ROOT` - Get filesystem root hash for a commit
- `LIST_ENTRIES_FOR_TREE` - List child trees and blobs (with pagination via connections)
- `TRAVERSE_PATH` - Traverse path to get target node hash

**Registry (Windows)**:
- `GetSystemHives` - Get available registry hives for a commit
- `DIFF_NODES` - Compare two registry keys (works for both filesystem and registry)

**PDB Symbols (Windows)**:
- `LIST_SYMBOLS_CONNECTION` - Fetch symbols with cursor-based pagination
- `LIST_WINSTRUCT` - Fetch structures with cursor-based pagination

**Search**:
- `SEARCH_FS_STREAM` - Search across all commits by term (streaming subscription)

**Diff**:
- `DIFF_NODES` - Compare two nodes at path with filters (NEW/MOD/DEL), max depth, pagination

### Blob Downloads

Raw file contents are stored by hash and can be downloaded via the backend REST API endpoint `/blob/:hash` using the base URL configured in `VITE_GRAPHEOS_API_URI`.

## Technology Stack

### Frontend Framework
- **Vue 3.5+** - Composition API with `<script setup>`
- **TypeScript 5.4+** - Strict mode enabled
- **Vite 5.2+** - Fast build tool and dev server
- **Vue Router 4.4+** - Client-side routing

### UI Framework
- **Naive UI 2.x** - Modern Vue 3 component library
  - TypeScript-first design
  - Built-in dark mode support (not yet implemented)
  - Lightweight and tree-shakeable (~150kb)
  - Comprehensive component set
  - Excellent documentation

### Data Layer
- **Apollo Client 3.11+** - GraphQL client
- **@vue/apollo-composable 4.2+** - Vue integration for Apollo
- **GraphQL Codegen** - Auto-generates TypeScript types from schema

### State Management
- **Pinia 2.x** - Official Vue state management
  - Used for commit selection (diff comparison)
  - Used for branch selection (HomeView)

### Development Tools
- **ESLint 8.57** - Code linting
- **Prettier 3.2** - Code formatting
- **VitePress 1.0** - Documentation site generator

## Component Architecture

### Views (Route-based)
- `HomeView.vue` - Commit history browser with branch selection
- `InspectorView.vue` - Unified OS snapshot explorer and diff viewer

### Core Inspector Components
- `InspectorView.vue` - Main orchestrator (routing, mode detection, capability checking)
- `InspectorHeader.vue` - Commit info, breadcrumbs, controls
- `FilesystemInspector.vue` - Unified filesystem viewer (single & comparison)
- `RegistryInspector.vue` - Unified registry viewer (single & comparison)
- `PDBInspector.vue` - Unified PDB symbol/struct viewer with cursor pagination
- `MonacoStructView.vue` - C struct code display (single mode)
- `MonacoStructDiff.vue` - Side-by-side struct diff (comparison mode)

### Supporting Components
- `CommitsTable.vue` - Displays commit history in a table
- `CommitExpansion.vue` - Expandable row content for divergent commits
- `CommitGraph.vue` - Visual git-style commit graph

### Old Components (Legacy, to be removed)
- `FilesystemTree.vue` - Old filesystem browser
- `RegistryTree.vue` - Old registry browser
- `TreeExplorer.vue` - Old base pattern
- `OSView.vue` - Old single snapshot view
- `DiffView.vue` - Old diff comparison view
- Components in `components/diff/` - Old diff viewers

### Composables
- `useFilesystemInspector.ts` - Filesystem state management
- `useRegistryInspector.ts` - Registry state management
- `useFetchHomeData.ts` - Branch and commit loading for HomeView
- `usePDBInspector.ts` - PDB state management with cursor-based pagination
- `useTableFilter.ts` - Local text filtering with keyboard shortcuts (`/` to focus, `Esc` to clear)

### Utility Modules
- `src/utils/filesystem.ts` - Pure functions for filesystem data transformation
- `src/utils/registry.ts` - Pure functions for registry data transformation

### Type Definitions
- `src/types/inspector.ts` - Core Inspector types (InspectorMode, CommitContext, etc.)
- `src/types/registry.ts` - Registry-specific types (RegistryHive, RegistryEntry, etc.)
- `src/graphql-types.ts` - Auto-generated from GraphQL schema

### State Management (Pinia Stores)
- `commitSelection.ts` - Manages selected commits for diff comparison
- `branchSelection.ts` - Manages currently selected branch in HomeView

## Routing Structure

```
/                              → HomeView (commit history browser)
/inspect/:commitHash           → InspectorView (single mode)
  - Query params: ?path=<path>&branch=<name>
/inspect/:baseHash/vs/:diffeeHash → InspectorView (comparison mode)
  - Query params: ?path=<path>&layout=<layout>&branch=<name>
```

## Design Philosophy

1. **Content-Addressable**: Everything identified by hash (Git-like)
2. **Snapshot-Based**: Capture complete system state at a point in time
3. **Comparison-Driven**: Primary value is in seeing what changed
4. **Non-Destructive**: Read-only exploration, never modifies snapshots
5. **Forensics-Ready**: Designed for security analysis and incident response
6. **Type-Safe**: Full TypeScript coverage with auto-generated GraphQL types
7. **Mode-Aware**: Components adapt to single vs comparison mode
8. **Async First**: Don't block UI while loading optional features

## Unified Inspector Benefits

### Before (Old Architecture)
- **Separate Views**: OSView (single) and DiffView (comparison) were separate components
- **Code Duplication**: Filesystem and Registry had separate single/diff implementations
- **Inconsistent UX**: Different navigation patterns between single and diff modes
- **Hard to Maintain**: Bug fixes needed in multiple places

### After (Unified Architecture)
- **Single View**: InspectorView handles both single and comparison modes
- **Shared Components**: FilesystemInspector and RegistryInspector work in both modes
- **Consistent UX**: Same navigation, breadcrumbs, and controls across modes
- **Easy to Maintain**: Single source of truth for each feature
- **Easy to Extend**: Adding new tabs (e.g., PDB) only requires one component

## Key Patterns

### 1. Mode-Aware Components
Components adapt based on `InspectorMode`:
```typescript
if (props.mode === 'single') {
  // Show single commit data
} else {
  // Show diff between two commits
}
```

### 2. Pure Utility Functions
All data transformation in pure functions with zero side effects:
- `src/utils/filesystem.ts` - Path manipulation, parsing, formatting
- `src/utils/registry.ts` - Registry-specific transformations

### 3. Composables for State
Reactive state management separated from UI:
- `useFilesystemInspector` - Manages filesystem navigation and loading
- `useRegistryInspector` - Manages registry navigation and loading

### 4. Type Safety First
- Generated GraphQL types provide compile-time safety
- Discriminated unions for mode handling
- No `any` types in new code

### 5. Async Capability Loading
- Show filesystem immediately (always available)
- Load Registry/PDB tabs in background
- Inline loading indicator (no blocking spinners)
- Better perceived performance

## Project Structure

```
src/
├── views/                         # Route-based views
│   ├── HomeView.vue              # Commit history browser
│   └── InspectorView.vue         # Unified Inspector (single & comparison)
├── components/
│   ├── InspectorHeader.vue       # Commit info, breadcrumbs, controls
│   ├── FilesystemInspector.vue   # Unified filesystem viewer
│   ├── RegistryInspector.vue     # Unified registry viewer
│   ├── CommitsTable.vue          # Commit history table
│   ├── CommitGraph.vue           # Visual commit graph
│   └── [legacy components]       # To be removed
├── composables/                   # Reusable reactive logic
│   ├── useFilesystemInspector.ts
│   ├── useRegistryInspector.ts
│   └── useFetchHomeData.ts
├── stores/                        # Pinia stores
│   ├── commitSelection.ts
│   └── branchSelection.ts
├── utils/                         # Pure functions
│   ├── filesystem.ts
│   └── registry.ts
├── types/                         # Type definitions
│   ├── inspector.ts
│   └── registry.ts
├── router/                        # Vue Router config
├── graphql-client.ts              # Apollo Client setup
├── queries.ts                     # GraphQL queries
├── graphql-types.ts               # Generated types (auto)
└── main.ts                        # App initialization
```

## Known Issues & Future Work

### Short Term
- Remove legacy components (OSView, DiffView, old tree components)
- Add unit tests for utils and composables
- Add component tests for Inspectors
- Implement error boundaries

### Medium Term
- Implement dark mode toggle
- Advanced search with filters (file type, size, date)
- Export diff reports (PDF, CSV)

### Long Term
- Timeline view for tracking artifacts across many commits
- Multi-way diff (compare 3+ commits)
- Collaborative annotations and notes
- Performance monitoring and alerting

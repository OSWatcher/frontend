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
- **Explore**: Click any commit to view that OS snapshot in detail (→ OSView)
- **Compare**: Select 2 commits (base + diffee) to see what changed between them (→ DiffView)

### 2. OS Snapshot Explorer (OSView)

**Purpose**: Explore a single OS snapshot's state

The OSView provides tabbed exploration of indexed data:

- **Filesystem** (always available) - Browse file/directory hierarchy with breadcrumb navigation, view metadata (name, hash, type), download file contents
- **Registry** (Windows only) - Navigate Windows Registry hives (HKLM, HKU, etc.), view keys and values
- **PDB Symbols** (Windows only, if extracted) - Browse debug symbols, structures, and types from binaries

**Dynamic Tabs**: Additional tabs appear based on what data was extracted for the snapshot (e.g., Linux snapshots show only Filesystem)

### 3. Diff Comparison Viewer (DiffView)

**Purpose**: Compare two OS snapshots to see what changed

The DiffView shows differences between base and diffee commits:

- **Filesystem Diff** (always available) - Shows NEW (green), MOD (yellow), DEL (red) files with directory-by-directory navigation
- **Registry Diff** (Windows only) - Shows NEW/MOD/DEL registry keys and values
- **Symbol Diff** (Windows only, if extracted) - Shows differences in debug symbols between versions

**Dynamic Tabs**: Additional diff tabs appear based on extracted data (same as OSView)

**Export**: Export button allows exporting local changes (current directory) or global recursive changes (entire diff tree)

### 4. Global Search

**Purpose**: Search across all commits for specific files, registry keys, or symbols

**Features**:
- Ctrl+K keyboard shortcut
- Fuzzy search across all indexed data
- Jump directly to results in any commit

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
- **Schema**: `schema.graphql` - Complete GraphQL schema (197 lines)
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
- `HAS_WINREG` - Check if blob has registry data
- `LIST_ENTRIES_FOR_KEY` - List child keys and values (with pagination via connections)

**PDB Symbols (Windows)**:
- `LIST_SYMBOLS` - Fetch symbols with pagination (limit, offset, sort)
- `LIST_WINSTRUCT` - Fetch structures with fields (limit, offset, sort)

**Search**:
- `SEARCH_FS` - Search across all commits by term

**Diff**:
- `DIFF_NODES` - Compare two nodes at path with filters (NEW/MOD/DEL), max depth, pagination

### Object Storage

Raw file contents are stored by hash and can be downloaded via object storage endpoints.

## Technology Stack

### Frontend Framework
- **Vue 3.5.12** - Composition API with `<script setup>`
- **TypeScript 5.4.0** - Strict mode enabled
- **Vite 5.2.8** - Fast build tool and dev server
- **Vue Router 4.4.5** - Client-side routing

### UI Framework
- **Bootstrap 5.3.3** - CSS framework (~200kb)
- **Bootstrap-Vue-Next 0.24.11** - Vue 3 Bootstrap components (pre-release, not stable)
- **Bootstrap-Icons 1.11.3** - Icon library

### Data Layer
- **Apollo Client 3.11.10** - GraphQL client
- **@vue/apollo-composable 4.2.1** - Vue integration for Apollo
- **GraphQL Codegen** - Auto-generates TypeScript types from schema

### Development Tools
- **ESLint 8.57.0** - Code linting
- **Prettier 3.2.5** - Code formatting
- **VitePress 1.0.0** - Documentation site generator

### Analytics
- **PostHog** - Product analytics (production only)

## Component Architecture

### Views (Route-based)
- `HomeView.vue` - Commit history browser with branch selection
- `OSView.vue` - OS snapshot explorer with dynamic tabs
- `DiffView.vue` - Diff comparison viewer

### Shared Components
- `CommitsTable.vue` - Displays commit history in a table
- `CommitExpansion.vue` - Expandable row content for divergent commits
- `TreeExplorer.vue` - Base pattern for tree navigation (not a real component, pattern duplicated)
- `FilesystemTree.vue` - Filesystem browser with breadcrumbs and pagination
- `RegistryTree.vue` - Registry browser with breadcrumbs and pagination
- `PDBExplorer.vue` - PDB symbols and structures browser

### Diff Components (in `components/diff/`)
- Filesystem, Registry, and Symbol diff viewers

### State Management
- **No centralized state management** - Uses local component refs
- Props drilling for shared state (e.g., `selectedCommits` passed through 3 component levels)

### Key Patterns
- **Bootstrap-Vue components**: BTable, BModal, BNavbar, BForm, BPagination
- **GraphQL connections**: Paginated data using `edges` and `totalCount`
- **Hash-based navigation**: All routes and downloads use content hashes
- **Breadcrumb navigation**: Manual implementation in FilesystemTree and RegistryTree (duplicated code)

## Routing Structure

```
/                           → HomeView (commit history browser)
/os/:commitHash             → OSView (snapshot explorer)
  - Query params: ?os_title=<name>&filesystem=<path>
/diff/:baseHash/:diffeeHash → DiffView (diff comparison)
```

## Design Philosophy

1. **Content-Addressable**: Everything identified by hash (Git-like)
2. **Snapshot-Based**: Capture complete system state at a point in time
3. **Comparison-Driven**: Primary value is in seeing what changed
4. **Non-Destructive**: Read-only exploration, never modifies snapshots
5. **Forensics-Ready**: Designed for security analysis and incident response

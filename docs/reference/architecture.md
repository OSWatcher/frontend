# Architecture Reference

This document provides a complete technical reference for the OSWatcher Frontend architecture, including project structure, data flow patterns, and core concepts.

## Project Structure

### Root Directory

```
/
├── docs/reference/          # Reference documentation
├── src/                     # Application source code
├── public/                  # Static assets
├── CLAUDE.md               # AI assistant instructions
├── README.md               # Project overview
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── codegen.yml             # GraphQL code generation config
├── schema.graphql          # GraphQL schema definition
├── env.d.ts                # Environment variable types
└── vue.config.js           # Vue configuration
```

### Source Code Structure (`src/`)

```
src/
├── views/                   # Main application views
│   ├── HomeView.vue        # Commit history view
│   ├── OSView.vue          # OS exploration view (multi-tab)
│   └── DiffView.vue        # Commit comparison view
├── components/             # Reusable components
│   ├── CommitsTable.vue    # Commit history table
│   ├── FilesystemTree.vue  # Filesystem tree explorer
│   ├── RegistryTree.vue    # Windows Registry explorer
│   ├── PDBExplorer.vue     # PDB symbol explorer
│   ├── TreeExplorer.vue    # Generic tree component
│   ├── diff/               # Diff-specific components
│   │   ├── FilesystemTreeDiff.vue
│   │   ├── RegistryTreeDiff.vue
│   │   ├── PDBExplorerDiff.vue
│   │   ├── TreeDiffExplorer.vue
│   │   ├── PropertyDiffDisplay.vue
│   │   └── pdb/
│   │       └── SymbolDiffView.vue
│   └── pdb/                # PDB-specific components
│       ├── StructView.vue
│       └── SymbolView.vue
├── router/                 # Vue Router configuration
│   └── index.ts
├── plugins/                # Vue plugins
│   └── posthog.ts          # Analytics configuration
├── windows/                # Windows-specific utilities
│   └── registry.ts         # Registry helper functions
├── main.ts                 # Application entry point
├── App.vue                 # Root component
├── queries.ts              # GraphQL queries
├── graphql-client.ts       # Apollo Client configuration
├── graphql-types.ts        # Generated GraphQL types
├── types.ts                # Custom TypeScript types
├── utils.ts                # Utility functions
├── download.ts             # File download utilities
└── shims-vue.d.ts          # Vue type declarations
```

## Core Application Architecture

### Technology Stack

- **Frontend Framework**: Vue 3 with Composition API
- **Language**: TypeScript for type safety
- **Build Tool**: Vite for fast development and building
- **UI Framework**: Bootstrap Vue Next with Bootstrap 5
- **GraphQL Client**: Apollo Client for API communication
- **Router**: Vue Router 4 for navigation
- **Analytics**: PostHog for user tracking (production only)

### Design Patterns

#### 1. Component-Based Architecture
- **Reusable Components**: Tree explorers, tables, diff viewers
- **View Components**: High-level page components
- **Composition API**: Modern Vue 3 reactive programming

#### 2. Hash-Based Navigation
- All data access through cryptographic hashes
- Immutable data structures
- Content-addressed storage model

#### 3. GraphQL-First API Design
- Single API endpoint for all data
- Type-safe queries with code generation
- Efficient data fetching with Apollo Client caching

## Data Flow Architecture

### 1. Query Execution Flow

```
User Action
    ↓
Vue Component (Composition API)
    ↓
Apollo Client Query
    ↓
GraphQL API Endpoint
    ↓
Neo4j Database
    ↓
GraphQL Response
    ↓
Apollo Client Cache
    ↓
Vue Reactive Data
    ↓
Component Re-render
```

### 2. Navigation Flow

```
Route Change (Vue Router)
    ↓
Extract Hash Parameters
    ↓
Query GraphQL for Node Data
    ↓
Determine Available Data Types
    ↓
Render Appropriate Tabs/Components
    ↓
Load Tab-Specific Data on Demand
```

### 3. Tree Exploration Flow

```
User Clicks Tree Node
    ↓
Extract Node Hash
    ↓
Query Child Nodes (TRAVERSE_PATH or LIST_ENTRIES_FOR_TREE)
    ↓
Update Tree Component State
    ↓
Render Expanded Node with Children
```

### 4. Diff Operation Flow

```
Select Base and Target Commits
    ↓
Extract Filesystem/Registry Root Hashes
    ↓
Execute DIFF_NODES Query
    ↓
Process Diff Results (NEW/MOD/DEL)
    ↓
Render Side-by-Side Diff View
    ↓
Handle User Navigation within Diff
```

## Core Concepts

### 1. Hash-Based Data Model

Every piece of data in the system is identified by a cryptographic hash:

- **Commits**: SHA-256 hash of commit metadata
- **Trees**: Hash of directory structure and contents
- **Blobs**: Hash of file contents
- **Registry Keys/Values**: Hash of registry data
- **Symbols/Structs**: Hash of PDB data

**Benefits:**
- Content deduplication
- Immutable data structures
- Efficient comparison operations
- Tamper detection

### 2. Three-View Architecture

#### HomeView - Commit History
- **Purpose**: Browse commit timeline
- **Data Source**: `fetchCommitHistory` query
- **Navigation**: Click commit → OSView
- **Features**: Branch selection, commit metadata display

#### OSView - Operating System Exploration
- **Purpose**: Explore individual commit contents
- **Data Sources**: Multiple queries based on available data types
- **Navigation**: Multi-tab interface (Filesystem, Registry, PDB)
- **Features**: Tree navigation, search, content viewing

#### DiffView - Commit Comparison
- **Purpose**: Compare two commits
- **Data Source**: `DIFF_NODES` query
- **Navigation**: Side-by-side diff display
- **Features**: Hierarchical diff, status filtering (NEW/MOD/DEL)

### 3. Tree Exploration Pattern

All hierarchical data (filesystem, registry, PDB structures) follows the same exploration pattern:

```typescript
interface TreeExplorationPattern {
  rootHash: string           // Starting point hash
  traversePath: (path: string) => string  // Navigate to specific path
  listEntries: (nodeHash: string) => NodeEntry[]  // Get children
  loadContent: (hash: string) => Content  // Load node content
}
```

### 4. Diff Algorithm

The diff system operates on any two hashable nodes:

1. **Input**: Base hash, target hash, node type
2. **Process**: Recursive comparison at specified depth
3. **Output**: List of changes with status (NEW/MOD/DEL)
4. **Display**: Hierarchical diff tree with change indicators

## Component Architecture

### 1. Tree Components Hierarchy

```
TreeExplorer (Generic)
├── FilesystemTree (Specialized)
├── RegistryTree (Specialized)
└── PDBExplorer (Specialized)
```

### 2. Diff Components Hierarchy

```
TreeDiffExplorer (Generic)
├── FilesystemTreeDiff (Specialized)
├── RegistryTreeDiff (Specialized)
└── PDBExplorerDiff (Specialized)
    └── SymbolDiffView (Specialized)
```

### 3. Component Communication

- **Props**: Parent to child data flow
- **Events**: Child to parent communication
- **Vue Router**: Cross-component navigation
- **Apollo Cache**: Shared state management

## State Management

### 1. Apollo Client Cache
- **Primary State Store**: GraphQL query results
- **Cache Policies**: Cache-and-network for fresh data
- **Type Policies**: Custom caching behavior per GraphQL type

### 2. Vue Component State
- **Local State**: Component-specific reactive data
- **Computed Properties**: Derived state from props/queries
- **Watch Effects**: Side effects from state changes

### 3. Router State
- **URL Parameters**: Current hashes and view state
- **Route Guards**: Navigation control
- **History Management**: Browser back/forward support

## Build Architecture

### 1. Development Build
- **Base Path**: `/` (root)
- **Hot Reload**: Vite development server
- **Source Maps**: Full debugging support
- **Environment**: Local API endpoints

### 2. Production Build
- **Base Path**: `/frontend/` (sub-path deployment)
- **Optimization**: Code splitting, minification
- **Assets**: Hashed filenames for caching
- **Environment**: Production API endpoints

### 3. Code Generation
- **GraphQL Types**: Auto-generated from schema
- **Vue Composables**: Type-safe query hooks
- **Build Integration**: Runs before TypeScript compilation

## Performance Architecture

### 1. Query Optimization
- **Apollo Caching**: Avoid redundant network requests
- **Lazy Loading**: Load data only when needed
- **Pagination**: Handle large datasets efficiently

### 2. Component Optimization
- **Tree Virtualization**: Render only visible nodes
- **Memoization**: Cache expensive computations
- **Conditional Rendering**: Show components based on data availability

### 3. Network Optimization
- **GraphQL**: Single endpoint, precise data fetching
- **HTTP/2**: Multiplexed connections
- **CDN**: Static asset distribution

## Security Architecture

### 1. Frontend Security
- **Environment Variables**: Secure configuration management
- **HTTPS**: Encrypted communication (production)
- **Content Security Policy**: XSS protection

### 2. API Security
- **Authentication**: Token-based authentication (if required)
- **Authorization**: Query-level permissions
- **Rate Limiting**: Prevent abuse

### 3. Data Security
- **Hash Validation**: Verify data integrity
- **Input Sanitization**: Prevent injection attacks
- **Audit Trail**: Track data access patterns

## Deployment Architecture

### 1. Development Deployment
- **Local Server**: Vite development server
- **Hot Module Replacement**: Instant updates
- **Debug Tools**: Vue DevTools, Apollo DevTools

### 2. Production Deployment
- **Static Files**: Pre-built JavaScript/CSS bundles
- **Web Server**: Nginx, Apache, or CDN
- **Environment Variables**: Injected at build time
- **Monitoring**: Error tracking, performance metrics

### 3. CI/CD Integration
- **Build Pipeline**: Automated builds on code changes
- **Testing**: Unit tests, integration tests
- **Deployment**: Automated deployment to staging/production
- **Rollback**: Quick rollback capability

## Integration Points

### 1. GraphQL API
- **Endpoint**: Configurable via environment variables
- **Schema**: Shared between frontend and backend
- **Authentication**: Token-based (if required)

### 2. Object Storage
- **File Downloads**: Direct access to binary data
- **Hash-Based URLs**: Content-addressed file access
- **CDN Integration**: Fast global distribution

### 3. Analytics
- **PostHog**: User behavior tracking
- **Custom Events**: Application-specific metrics
- **Privacy**: GDPR-compliant data collection

## Error Handling Architecture

### 1. GraphQL Errors
- **Query Errors**: Displayed in UI with retry options
- **Network Errors**: Connection status indicators
- **Schema Errors**: Development-time validation

### 2. Application Errors
- **Vue Error Boundaries**: Component-level error isolation
- **Global Error Handler**: Centralized error logging
- **User Feedback**: Meaningful error messages

### 3. Data Validation
- **Type Safety**: TypeScript compile-time checks
- **Runtime Validation**: GraphQL schema validation
- **User Input**: Form validation and sanitization
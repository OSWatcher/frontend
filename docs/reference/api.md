# API Reference

This document provides a complete reference for the OSWatcher Frontend GraphQL API, including all queries, types, and Apollo Client configuration.

## GraphQL Queries

### Commit Operations

#### `fetchCommitHistory`
Retrieves commit history for a specific branch.

**Parameters:**
- `branchName: String!` - The name of the branch to fetch history for

**Returns:**
```typescript
{
  fetchCommitHistory: Array<{
    hash: string
    name: string
    description: string
    date: string
  }>
}
```

**Usage:**
```typescript
import { fetchCommitHistory } from '@/queries'

const { data } = await apolloClient.query({
  query: fetchCommitHistory,
  variables: { branchName: 'main' }
})
```

#### `fetchCommitDetails`
Fetches detailed information about specific commits.

**Parameters:**
- `where: CommitWhere` - Filter criteria for commits

**Returns:**
```typescript
{
  commits: Array<{
    hash: string
    name: string
    description: string
    date: string
  }>
}
```

#### `getCommitCapabilities`
Retrieves available data types for a specific commit.

**Parameters:**
- `commitHash: String!` - The hash of the commit to check

**Returns:**
```typescript
{
  getCommitExtractedDataLabels: Array<string>
}
```

### Filesystem Operations

#### `GET_FS_ROOT`
Retrieves the filesystem root hash for a commit.

**Parameters:**
- `where: CommitWhere` - Filter criteria to identify the commit

**Returns:**
```typescript
{
  commits: Array<{
    hash: string
    filesystemConnection: {
      edges: Array<{
        node: {
          hash: string
        }
      }>
    }
  }>
}
```

#### `TRAVERSE_PATH`
Navigates through filesystem paths.

**Parameters:**
- `parent_label: String!` - The label of the parent node type
- `tree_hash: String!` - The hash of the tree to traverse
- `path: String!` - The path to traverse to

**Returns:**
```typescript
{
  traversePath: string // Returns the hash of the target node
}
```

#### `LIST_ENTRIES_FOR_TREE`
Lists all entries (files and subdirectories) within a filesystem tree.

**Parameters:**
- `where: TreeWhere` - Filter criteria to identify the tree

**Returns:**
```typescript
{
  trees: Array<{
    child_blobsConnection: {
      edges: Array<{
        properties: { name: string }
        node: { hash: string }
      }>
    }
    child_treesConnection: {
      edges: Array<{
        properties: { name: string }
        node: { hash: string }
      }>
    }
  }>
}
```

### Windows Registry Operations

#### `HAS_WINREG`
Checks if a blob contains Windows Registry data.

**Parameters:**
- `where: BlobWhere` - Filter criteria to identify the blob

**Returns:**
```typescript
{
  blobs: Array<{
    has_winreg: {
      hash: string
    }
  }>
}
```

#### `LIST_ENTRIES_FOR_KEY`
Lists registry keys and values under a specific registry key.

**Parameters:**
- `where: WinRegKeyWhere` - Filter criteria to identify the registry key

**Returns:**
```typescript
{
  winRegKeys: Array<{
    child_keysConnection: {
      edges: Array<{
        node: { hash: string }
        properties: { name: string }
      }>
    }
    child_valuesConnection: {
      edges: Array<{
        node: {
          hash: string
          type: string
          value: string
        }
        properties: { name: string }
      }>
    }
  }>
}
```

### PDB Symbol Operations

#### `LIST_SYMBOLS_CONNECTION`
Retrieves symbols from a PDB file with cursor-based pagination.

**Parameters:**
- `blobHash: String!` - The hash of the blob containing PDB data
- `first: Int` - Number of items to fetch (default: 1000)
- `after: String` - Cursor for pagination (optional)

**Returns:**
```typescript
{
  blobs: Array<{
    has_symbolConnection: {
      totalCount: number
      edges: Array<{
        properties: { name: string }
        node: { address: string }
      }>
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
    }
  }>
}
```

#### `LIST_WINSTRUCT`
Retrieves Windows structure definitions from a PDB file with cursor-based pagination.

**Parameters:**
- `blobHash: String!` - The hash of the blob containing PDB data
- `first: Int` - Number of items to fetch (default: 400)
- `after: String` - Cursor for pagination (optional)

**Returns:**
```typescript
{
  blobs: Array<{
    has_structConnection: {
      totalCount: number
      edges: Array<{
        properties: { name: string }
        node: {
          hash: string
          size: number
          kind: string
        }
      }>
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
    }
  }>
}
```

#### `FETCH_STRUCT_FIELDS`
Retrieves fields for a specific struct (lazy-loaded on row expansion).

**Parameters:**
- `structHash: String!` - The hash of the struct

**Returns:**
```typescript
{
  structs: Array<{
    fieldsConnection: {
      edges: Array<{
        properties: { name: string }
        node: {
          offset: number
          data_type: string
        }
      }>
    }
  }>
}
```

#### `FETCH_SYMBOL_BY_NAME`
Retrieves a specific symbol by name (used for search result navigation).

**Parameters:**
- `blobHash: String!` - The hash of the blob containing PDB data
- `symbolName: String!` - The name of the symbol to find

**Returns:**
```typescript
{
  blobs: Array<{
    has_symbolConnection: {
      edges: Array<{
        properties: { name: string }
        node: {
          hash: string
          address: string
        }
      }>
    }
  }>
}
```

#### `FETCH_STRUCT_BY_NAME`
Retrieves a specific struct by name (used for search result navigation).

**Parameters:**
- `blobHash: String!` - The hash of the blob containing PDB data
- `structName: String!` - The name of the struct to find

**Returns:**
```typescript
{
  blobs: Array<{
    has_structConnection: {
      edges: Array<{
        properties: { name: string }
        node: {
          hash: string
          size: number
          kind: string
        }
      }>
    }
  }>
}
```

### Search Operations

#### `SEARCH_FS`
Performs search across commits (non-streaming).

**Parameters:**
- `input: SearchInput!` - Search input object

**SearchInput:**
```typescript
{
  search_term: string        // The search term
  entity_types?: EntityType[] // Filter by entity types (optional)
  commit_range: CommitRange   // Range of commits to search
  case_sensitive?: boolean    // Case-sensitive search (optional)
}

enum EntityType {
  FILESYSTEM
  REGISTRY
  SYMBOL
  STRUCT
}
```

**Returns:**
```typescript
{
  search: Array<{
    type: EntityType      // Type of result (Filesystem, Registry, Symbol, Struct)
    commit_name: string   // Name of the commit containing the result
    commit_hash: string   // Hash of the commit
    blob_path: string     // Path to the containing blob
    blob_hash: string     // Hash of the blob
    entity_path: string   // Path within the entity (e.g., symbol name)
    node_hash: string     // Hash of the matched node
  }>
}
```

#### `SEARCH_FS_STREAM` (Subscription)
Performs search across commits with streaming results.

**Parameters:**
- `input: SearchInput!` - Same as SEARCH_FS

**Returns (streamed):**
```typescript
{
  searchStream: {
    type: EntityType
    commit_name: string
    commit_hash: string
    blob_path: string
    blob_hash: string
    entity_path: string
    node_hash: string
  }
}
```

**Usage:**
```typescript
import { SEARCH_FS_STREAM } from '@/queries'
import { useSubscription } from '@vue/apollo-composable'

const { result, onResult } = useSubscription(SEARCH_FS_STREAM, {
  input: {
    search_term: 'kernel32',
    entity_types: ['FILESYSTEM', 'SYMBOL'],
    commit_range: { /* ... */ }
  }
})

onResult(({ data }) => {
  // Handle each streamed result
  console.log(data.searchStream)
})
```

### Diff Operations

#### `DIFF_NODES`
Compares two nodes and returns their differences.

**Parameters:**
- `parentLabel: String!` - The type of the parent nodes ('Tree', 'WinRegKey', etc.)
- `baseNodeHash: String!` - Hash of the base node for comparison
- `diffeeNodeHash: String!` - Hash of the node to compare against
- `atPath: String!` - Path within the nodes to compare
- `maxDepth: Int` - Maximum depth for recursive comparison (optional)
- `filter: [String!]` - Filter criteria for diff results (optional)
- `options: DiffNodesOptions` - Additional diff options (optional)

**Returns:**
```typescript
{
  diffNodesAt: {
    total_count: number
    items: Array<{
      status: 'NEW' | 'MOD' | 'DEL'
      path: string
      type: string
      old_props: {
        hash: string
        properties: any
      } | null
      new_props: {
        hash: string
        properties: any
      } | null
    }>
  }
}
```

## GraphQL Schema Types

### Core Types

#### `Blob`
Represents a file or binary data object.
```graphql
type Blob implements Hashable {
  hash: String!
  has_winreg: WinRegKey
  has_symbol: [Symbol!]!
  has_struct: [WinStruct!]!
}
```

#### `Tree`
Represents a directory or tree structure.
```graphql
type Tree implements Hashable {
  hash: String!
  child_blobs: [Blob!]!
  child_trees: [Tree!]!
}
```

#### `Commit`
Represents a commit in the version control system.
```graphql
type Commit implements Hashable {
  hash: String!
  name: String
  description: String
  date: DateTime
  filesystemConnection: TreeFilesystemConnectionConnection
}
```

#### `WinRegKey`
Represents a Windows Registry key.
```graphql
type WinRegKey implements Hashable {
  hash: String!
  child_keys: [WinRegKey!]!
  child_values: [WinRegValue!]!
}
```

#### `WinRegValue`
Represents a Windows Registry value.
```graphql
type WinRegValue implements Hashable {
  hash: String!
  type: String!
  value: String!
}
```

#### `Symbol`
Represents a symbol from a PDB file.
```graphql
type Symbol implements Hashable {
  hash: String!
  name: String!
  address: String!
}
```

#### `WinStruct`
Represents a Windows structure from a PDB file.
```graphql
type WinStruct implements Hashable {
  hash: String!
  name: String!
  size: Int!
  kind: String!
  fields: [WinStructField!]!
}
```

### Enums

#### `NodeType`
```graphql
enum NodeType {
  Blob
  Tree
  WinRegValue
  WinRegKey
  Symbol
  WinStruct
  WinStructField
  WinDataType
}
```

#### `DiffStatus`
```graphql
enum DiffStatus {
  NEW    # Item exists only in the new version
  MOD    # Item exists in both versions but is modified
  DEL    # Item exists only in the old version
}
```

### Relationship Properties

#### `HasFilenameRel`
```graphql
type HasFilenameRel {
  name: String!
}
```

#### `HasNameRel`
```graphql
type HasNameRel {
  name: String!
}
```

## Apollo Client Configuration

### Client Setup
The Apollo Client is configured in `src/graphql-client.ts` with the following features:

- **HTTP Link**: Connects to GraphQL API endpoint
- **Error Handling**: Logs GraphQL and network errors
- **Caching**: In-memory cache with type policies
- **Default Options**: Cache-and-network fetch policy

### Environment Variables
- `VITE_OSWATCHER_API_URI`: Required GraphQL API endpoint URL

### Error Handling
The client includes comprehensive error handling for:
- GraphQL query errors
- Network connectivity issues
- Missing environment variables

### Caching Policies
Implements Apollo Client's InMemoryCache with configurable type policies for optimal data management and cache invalidation.

### Usage Example
```typescript
import gqlClient from '@/graphql-client'
import { fetchCommitHistory } from '@/queries'

const response = await gqlClient.query({
  query: fetchCommitHistory,
  variables: { branchName: 'main' }
})
```
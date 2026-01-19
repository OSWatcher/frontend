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

#### `LIST_WINSTRUCT`
Retrieves Windows structure definitions from a PDB file.

**Parameters:**
- `blobHash: String!` - The hash of the blob containing PDB data
- `options: WinStructOptions` - Pagination and filtering options (optional)
- `where: WinStructWhere` - Additional filter criteria (optional)

**Returns:**
```typescript
{
  winStructsAggregate: {
    count: number
  }
  fetchStructs: Array<{
    name: string
    size: number
    kind: string
    fields: Array<{
      name: string
      offset: number
      data_type: string
    }>
  }>
}
```

### Search Operations

#### `SEARCH_FS`
Performs filesystem search across commits.

**Parameters:**
- `searchTerm: String!` - The search term to look for

**Returns:**
```typescript
{
  search: Array<{
    commit_name: string
    commit_hash: string
    path: string
  }>
}
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
- `VITE_GRAPHEOS_API_URI`: Required GraphQL API endpoint URL

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
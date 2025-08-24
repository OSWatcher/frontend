# Types Reference

This document provides a complete reference for all TypeScript types used in the OSWatcher Frontend application, including custom types, GraphQL-generated types, and utility types.

## Custom Types

### Core Application Types

#### `TreeNodeType`
**File:** `src/types.ts:1-4`

Enum representing different types of tree nodes in the filesystem.

```typescript
export enum TreeNodeType {
  Blob,  // Represents files
  Tree   // Represents directories
}
```

**Usage:**
```typescript
import TreeNodeType from '@/types'

const nodeType = TreeNodeType.Blob
if (nodeType === TreeNodeType.Tree) {
  // Handle directory
}
```

#### `treeNodeTypeToString()`
**File:** `src/types.ts:6-8`

Utility function to convert TreeNodeType enum to string representation.

```typescript
export function treeNodeTypeToString(type: TreeNodeType): string {
  return TreeNodeType[type]
}
```

**Parameters:**
- `type: TreeNodeType` - The enum value to convert

**Returns:** `string` - String representation ("Blob" or "Tree")

**Usage:**
```typescript
const nodeTypeString = treeNodeTypeToString(TreeNodeType.Blob) // "Blob"
```

#### `HashDiff`
**File:** `src/types.ts:11-15`

Interface for representing hash differences in diff operations.

```typescript
export interface HashDiff {
  base_hash: string | null      // Hash of the base node for comparison
  diffee_hash: string | null    // Hash of the node being compared against
  label: string                 // Type label ('Commit', 'Tree', 'WinRegKey', etc.)
}
```

**Usage:**
```typescript
const commitDiff: HashDiff = {
  base_hash: 'abc123...',
  diffee_hash: 'def456...',
  label: 'Commit'
}
```

## GraphQL Generated Types

The application uses GraphQL Code Generator to create TypeScript types from the GraphQL schema. These types are located in `src/graphql-types.ts`.

### Core Schema Types

#### `Scalars`
Basic scalar types used throughout the GraphQL schema.

```typescript
export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  JSON: { input: any; output: any }
}
```

#### `Hashable` Interface
Common interface implemented by all hashable nodes in the system.

```typescript
export type Hashable = {
  hash: Scalars['String']['output']
}
```

#### `Blob`
Represents files and binary data objects.

```typescript
export type Blob = Hashable & {
  __typename?: 'Blob'
  hash: Scalars['String']['output']
  has_winreg?: Maybe<WinRegKey>
  has_symbol: Array<Symbol>
  has_struct: Array<WinStruct>
  // ... connection and aggregation fields
}
```

#### `Tree`
Represents directories and tree structures.

```typescript
export type Tree = Hashable & {
  __typename?: 'Tree'
  hash: Scalars['String']['output']
  child_blobs: Array<Blob>
  child_trees: Array<Tree>
  // ... connection and aggregation fields
}
```

#### `Commit`
Represents version control commits.

```typescript
export type Commit = Hashable & {
  __typename?: 'Commit'
  hash: Scalars['String']['output']
  name?: Maybe<Scalars['String']['output']>
  description?: Maybe<Scalars['String']['output']>
  date?: Maybe<Scalars['String']['output']>
  filesystemConnection: CommitFilesystemConnection
  // ... other connection fields
}
```

#### `WinRegKey`
Represents Windows Registry keys.

```typescript
export type WinRegKey = Hashable & {
  __typename?: 'WinRegKey'
  hash: Scalars['String']['output']
  child_keys: Array<WinRegKey>
  child_values: Array<WinRegValue>
  // ... connection and aggregation fields
}
```

#### `WinRegValue`
Represents Windows Registry values.

```typescript
export type WinRegValue = Hashable & {
  __typename?: 'WinRegValue'
  hash: Scalars['String']['output']
  type: Scalars['String']['output']
  value: Scalars['String']['output']
  // ... parent relationship fields
}
```

#### `Symbol`
Represents symbols from PDB files.

```typescript
export type Symbol = Hashable & {
  __typename?: 'Symbol'
  hash: Scalars['String']['output']
  name: Scalars['String']['output']
  address: Scalars['String']['output']
  // ... parent relationship fields
}
```

#### `WinStruct`
Represents Windows structures from PDB files.

```typescript
export type WinStruct = Hashable & {
  __typename?: 'WinStruct'
  hash: Scalars['String']['output']
  name: Scalars['String']['output']
  size: Scalars['Int']['output']
  kind: Scalars['String']['output']
  fields: Array<WinStructField>
  // ... connection and aggregation fields
}
```

#### `WinStructField`
Represents fields within Windows structures.

```typescript
export type WinStructField = {
  __typename?: 'WinStructField'
  name: Scalars['String']['output']
  offset: Scalars['Int']['output']
  data_type: Scalars['String']['output']
  // ... parent relationship fields
}
```

### Enums

#### `NodeType`
Enum for different types of nodes in the system.

```typescript
export enum NodeType {
  Blob = 'Blob',
  Tree = 'Tree',
  WinRegValue = 'WinRegValue',
  WinRegKey = 'WinRegKey',
  Symbol = 'Symbol',
  WinStruct = 'WinStruct',
  WinStructField = 'WinStructField',
  WinDataType = 'WinDataType'
}
```

#### `DiffStatus`
Enum for diff operation status.

```typescript
export enum DiffStatus {
  New = 'NEW',    // Item exists only in new version
  Mod = 'MOD',    // Item exists in both versions but modified
  Del = 'DEL'     // Item exists only in old version
}
```

### Query Types

All GraphQL queries have corresponding TypeScript types for variables and results:

#### `FetchCommitHistoryQuery`
```typescript
export type FetchCommitHistoryQuery = {
  __typename?: 'Query'
  fetchCommitHistory: Array<{
    __typename?: 'Commit'
    hash: string
    name: string
    description: string
    date: string
  }>
}

export type FetchCommitHistoryQueryVariables = Exact<{
  branchName: Scalars['String']['input']
}>
```

#### `FetchCommitDetailsQuery`
```typescript
export type FetchCommitDetailsQuery = {
  __typename?: 'Query'
  commits: Array<{
    __typename?: 'Commit'
    hash: string
    name: string
    description: string
    date: string
  }>
}

export type FetchCommitDetailsQueryVariables = Exact<{
  where?: InputMaybe<CommitWhere>
}>
```

#### `DiffNodesQuery`
```typescript
export type DiffNodesQuery = {
  __typename?: 'Query'
  diffNodesAt: {
    __typename?: 'DiffNodesResult'
    total_count: number
    items: Array<{
      __typename?: 'DiffNode'
      status: DiffStatus
      path: string
      type: string
      old_props?: Maybe<{
        __typename?: 'NodeProperties'
        hash: string
        properties: any
      }>
      new_props?: Maybe<{
        __typename?: 'NodeProperties'
        hash: string
        properties: any
      }>
    }>
  }
}
```

### Options Types

#### `SymbolOptions`
Pagination and filtering options for symbol queries.

```typescript
export type SymbolOptions = {
  limit?: InputMaybe<Scalars['Int']['input']>
  offset?: InputMaybe<Scalars['Int']['input']>
  sort?: InputMaybe<Array<SymbolSort>>
}
```

#### `WinStructOptions`
Pagination and filtering options for Windows structure queries.

```typescript
export type WinStructOptions = {
  limit?: InputMaybe<Scalars['Int']['input']>
  offset?: InputMaybe<Scalars['Int']['input']>
  sort?: InputMaybe<Array<WinStructSort>>
}
```

#### `DiffNodesOptions`
Options for diff operations.

```typescript
export type DiffNodesOptions = {
  include_unchanged?: InputMaybe<Scalars['Boolean']['input']>
  recursive?: InputMaybe<Scalars['Boolean']['input']>
}
```

### Where Types

GraphQL where clauses for filtering:

#### `CommitWhere`
```typescript
export type CommitWhere = {
  hash?: InputMaybe<Scalars['String']['input']>
  hash_IN?: InputMaybe<Array<Scalars['String']['input']>>
  name?: InputMaybe<Scalars['String']['input']>
  name_CONTAINS?: InputMaybe<Scalars['String']['input']>
  // ... additional filter operators
}
```

#### `TreeWhere`
```typescript
export type TreeWhere = {
  hash?: InputMaybe<Scalars['String']['input']>
  hash_IN?: InputMaybe<Array<Scalars['String']['input']>>
  // ... additional filter operators
}
```

## Utility Types

### GraphQL Utility Types

#### `Maybe<T>`
Represents nullable types.

```typescript
export type Maybe<T> = T | null
```

#### `InputMaybe<T>`
Represents optional input types.

```typescript
export type InputMaybe<T> = Maybe<T>
```

#### `Exact<T>`
Ensures exact type matching for input objects.

```typescript
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K]
}
```

### Vue Apollo Types

The application uses Vue Apollo Composable, which provides additional type utilities:

#### `ReactiveFunction<T>`
Type for reactive function parameters.

```typescript
export type ReactiveFunction<TParam> = () => TParam
```

## Type Generation

Types are automatically generated using GraphQL Code Generator with the following configuration (`codegen.yml`):

```yaml
schema: schema.graphql
generates:
  src/graphql-types.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-vue-apollo
    config:
      withCompositionFunctions: true
      vueCompositionApiImportFrom: vue
```

### Regenerating Types

To update types after schema changes:

```bash
npm run generate
```

This command reads the GraphQL schema and generates fresh TypeScript types, query hooks, and Vue composables.

## Type Safety Best Practices

1. **Use generated types**: Always use the generated GraphQL types rather than `any`
2. **Null checking**: Handle `Maybe<T>` types with proper null checks
3. **Type guards**: Use TypeScript type guards for runtime type checking
4. **Generic constraints**: Use `Exact<>` for precise input type matching
5. **Apollo composables**: Use generated Vue composables for type-safe queries

## Common Type Patterns

### Handling Optional Fields
```typescript
// GraphQL returns Maybe<string>
const commitName: Maybe<string> = commit.name

// Safe access with null checking
const displayName = commitName ?? 'Unnamed Commit'
```

### Working with Arrays
```typescript
// GraphQL arrays are never null but can be empty
const symbols: Array<Symbol> = blob.has_symbol

// Safe iteration
symbols.forEach(symbol => {
  console.log(symbol.name) // symbol.name is guaranteed to exist
})
```

### Type-safe Query Variables
```typescript
const variables: FetchCommitHistoryQueryVariables = {
  branchName: 'main' // TypeScript ensures this matches the schema
}
```
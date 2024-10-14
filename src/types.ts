import type { Commit } from '@/graphql-types'

export enum TreeNodeType {
  Blob,
  Tree
}

// simple type for diff hashes
export interface HashDiff {
  base_hash: string | null
  diffee_hash: string | null
  label: string
}

export interface BranchesWithCommits {
  [key: string]: Commit[]
}

export default TreeNodeType

export enum DiffType {
  NEW,
  MOD,
  DEL
}

export interface HashProps {
  hash: string
  properties: {
    [key: string]: string
  }
}

export interface DiffObj {
  name: string
  type: TreeNodeType
  diffType: DiffType
  old_props: HashProps | null
  new_props: HashProps | null
  _rowVariant: string
}

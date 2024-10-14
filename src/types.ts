import type { DiffStatus } from '@/graphql-types'

export enum TreeNodeType {
  Blob,
  Tree
}

export function treeNodeTypeToString(type: TreeNodeType): string {
  return TreeNodeType[type]
}

// simple type for diff hashes
export interface HashDiff {
  base_hash: string | null
  diffee_hash: string | null
  label: string
}

export default TreeNodeType

export interface HashProps {
  hash: string
  properties: {
    [key: string]: string
  }
}

export interface DiffObj {
  name: string
  type: TreeNodeType
  diffType: DiffStatus
  old_props: HashProps | null
  new_props: HashProps | null
  _rowVariant: string
}

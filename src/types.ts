export enum TreeNodeType {
  Blob,
  Tree
}

// Alias for backward compatibility with components expecting "NodeType"
export const NodeType = TreeNodeType

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

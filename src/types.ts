enum TreeNodeType {
  Blob,
  Tree
}

interface Commit {
  hash: string
  name: string
  description: string
  date: string
  selected?: boolean
}

// simple type for diff hashes
export interface HashDiff {
  base_hash: string | null
  diffee_hash: string | null
}

interface BranchesWithCommits {
  [key: string]: Commit[]
}

export default TreeNodeType
export type { Commit, BranchesWithCommits }

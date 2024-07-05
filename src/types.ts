enum TreeNodeType {
  Blob,
  Tree
}

interface Commit {
  hash: string
  name: string
  date: string
  selected?: boolean
}

interface BranchesWithCommits {
  [key: string]: Commit[]
}

export default TreeNodeType
export type { Commit, BranchesWithCommits }

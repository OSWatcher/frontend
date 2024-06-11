import { gql } from '@apollo/client/core'

// home
const fetchAllBranches = gql`
  query {
    branches {
      name
    }
  }
`

const fetchCommitHistory = gql`
  query ($branchName: String!) {
    fetchCommitHistory(branch_name: $branchName) {
      hash
      name
      date
    }
  }
`

// osview
const getCommitCapabilities = gql`
  query Query($commitHash: String!) {
    getCommitExtractedDataLabels(commit_hash: $commitHash)
  }
`

// registry
const GET_FS_ROOT = gql`
  query Commits($where: CommitWhere) {
    commits(where: $where) {
      hash
      filesystemConnection {
        edges {
          node {
            hash
          }
        }
      }
    }
  }
`

const HAS_WINREG = gql`
  query ($where: BlobWhere) {
    blobs(where: $where) {
      has_winreg {
        hash
      }
    }
  }
`

const TRAVERSE_PATH = gql`
  query Query($tree_hash: String!, $path: String!) {
    traversePath(tree_hash: $tree_hash, path: $path)
  }
`

const LIST_ENTRIES_FOR_KEY = gql`
  query WinRegKeys($where: WinRegKeyWhere) {
    winRegKeys(where: $where) {
      child_keysConnection {
        edges {
          node {
            hash
          }
        }
        edges {
          properties {
            name
          }
        }
      }
      child_valuesConnection {
        edges {
          node {
            hash
          }
          properties {
            name
          }
        }
      }
    }
  }
`

const LIST_ENTRIES_FOR_TREE = gql`
  query Query($where: TreeWhere) {
    trees(where: $where) {
      child_blobsConnection {
        edges {
          properties {
            name
          }
          node {
            hash
          }
        }
      }
      child_treesConnection {
        edges {
          properties {
            name
          }
          node {
            hash
          }
        }
      }
    }
  }
`

const LIST_SYMBOLS = gql`
  query ListSymbols(
    $options: SymbolOptions
    $where: SymbolWhere
    $blobConnectionWhere2: SymbolBlobConnectionWhere
  ) {
    symbolsAggregate(where: $where) {
      count
    }
    symbols(where: $where, options: $options) {
      name
      blobConnection(where: $blobConnectionWhere2) {
        edges {
          properties {
            address
          }
        }
      }
    }
  }
`

const LIST_WINSTRUCT = gql`
  query ListWinStruct($where: WinStructWhere, $options: WinStructOptions) {
    winStructsAggregate(where: $where) {
      count
    }
    winStructs(where: $where, options: $options) {
      name
      kind
      size
      fields {
        name
        offset
        type {
          name
          type
        }
      }
    }
  }
`

const SEARCH_FS = gql`
  query Search($searchTerm: String!) {
    search(search_term: $searchTerm) {
      commit_name
      commit_hash
      path
    }
  }
`

const DIFF_COMMITS = gql`
  query DiffCommits(
    $baseCommitHash: String!
    $diffeeCommitHash: String!
    $path: String!
    $maxDepth: Int
  ) {
    diffCommitsAt(
      base_commit_hash: $baseCommitHash
      diffee_commit_hash: $diffeeCommitHash
      at_path: $path
      max_depth: $maxDepth
    ) {
      newitems {
        path
        type
        new_hash
      }
      moditems {
        path
        type
        old_hash
        new_hash
      }
      delitems {
        path
        type
        old_hash
      }
    }
  }
`

export {
  fetchAllBranches,
  fetchCommitHistory,
  getCommitCapabilities,
  GET_FS_ROOT,
  HAS_WINREG,
  TRAVERSE_PATH,
  LIST_ENTRIES_FOR_KEY,
  LIST_ENTRIES_FOR_TREE,
  LIST_SYMBOLS,
  LIST_WINSTRUCT,
  SEARCH_FS,
  DIFF_COMMITS
}

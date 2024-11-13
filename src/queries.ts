import { gql } from '@apollo/client/core'

// home
const fetchCommitHistory = gql`
  query fetchCommitHistory($branchName: String!) {
    fetchCommitHistory(branch_name: $branchName) {
      hash
      name
      description
      date
    }
  }
`

// osview
const fetchCommitDetails = gql`
  query fetchCommitDetails($where: CommitWhere) {
    commits(where: $where) {
      hash
      name
      description
      date
    }
  }
`

const getCommitCapabilities = gql`
  query getCommitCapabilities($commitHash: String!) {
    getCommitExtractedDataLabels(commit_hash: $commitHash)
  }
`

// registry
const GET_FS_ROOT = gql`
  query GetFsRoot($where: CommitWhere) {
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
  query HasWinReg($where: BlobWhere) {
    blobs(where: $where) {
      has_winreg {
        hash
      }
    }
  }
`

const TRAVERSE_PATH = gql`
  query TraversePath($parent_label: String!, $tree_hash: String!, $path: String!) {
    traversePath(parent_label: $parent_label, tree_hash: $tree_hash, path: $path)
  }
`

const LIST_ENTRIES_FOR_KEY = gql`
  query ListEntriesForKey($where: WinRegKeyWhere) {
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
            type
            value
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
  query ListEntriesForTree($where: TreeWhere) {
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
  query FetchSymbols($blobHash: String!, $options: SymbolOptions, $where: SymbolWhere) {
    symbolsAggregate(where: $where) {
      count
    }
    fetchSymbols(blob_hash: $blobHash, options: $options) {
      name
      address
    }
  }
`

const LIST_WINSTRUCT = gql`
  query FetchStructs($blobHash: String!, $options: WinStructOptions, $where: WinStructWhere) {
    winStructsAggregate(where: $where) {
      count
    }
    fetchStructs(blob_hash: $blobHash, options: $options) {
      name
      size
      kind
      fields {
        name
        offset
        data_type
      }
    }
  }
`

const SEARCH_FS = gql`
  query SearchFs($searchTerm: String!) {
    search(search_term: $searchTerm) {
      commit_name
      commit_hash
      path
    }
  }
`

const DIFF_NODES = gql`
  query DiffNodes(
    $parentLabel: String!
    $baseNodeHash: String!
    $diffeeNodeHash: String!
    $atPath: String!
    $maxDepth: Int
    $filter: [String!]
    $options: DiffNodesOptions
  ) {
    diffNodesAt(
      parent_label: $parentLabel
      base_node_hash: $baseNodeHash
      diffee_node_hash: $diffeeNodeHash
      at_path: $atPath
      max_depth: $maxDepth
      filter: $filter
      options: $options
    ) {
      total_count
      items {
        status
        path
        type
        old_props {
          hash
          properties
        }
        new_props {
          hash
          properties
        }
      }
    }
  }
`

export {
  fetchCommitHistory,
  fetchCommitDetails,
  getCommitCapabilities,
  GET_FS_ROOT,
  HAS_WINREG,
  TRAVERSE_PATH,
  LIST_ENTRIES_FOR_KEY,
  LIST_ENTRIES_FOR_TREE,
  LIST_SYMBOLS,
  LIST_WINSTRUCT,
  SEARCH_FS,
  DIFF_NODES
}

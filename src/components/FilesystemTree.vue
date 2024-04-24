<script setup lang="ts">
import { ref } from 'vue'
import gqlClient from '@/graphql-client'
import { gql } from '@apollo/client/core'
import TreeExplorer from '@/components/TreeExplorer.vue'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

const fsPath = ref('/')

const GET_TREE_AT_PATH = gql`
  query Query($commitHash: String!, $path: String!) {
    getTreeAtPath(commit_hash: $commitHash, path: $path)
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

// Fetch filesystem at the given path
async function listFsAt(path: string) {
  // Here you would use the useQuery hook from Apollo Client Vue to fetch data
  const response = await gqlClient.query({
    query: GET_TREE_AT_PATH,
    variables: { commitHash: props.os_hash, path }
  })
  const tree_hash = response.data['getTreeAtPath']
  // get children
  const children = await gqlClient.query({
    query: LIST_ENTRIES_FOR_TREE,
    variables: { where: { hash: tree_hash } }
  })
  return parseFSEntries(children.data.trees[0])
}

function parseFSEntries(new_data) {
  // update fsFolderEntries and fsFileEntries
  // both should be arrays of Objects like
  // [{ name: 'folder1', hash: 'hash1' }, ...]
  let files = new_data.child_blobsConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  let folders = new_data.child_treesConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  // Then, sort the files and folders by name
  files = files.sort((a, b) => a.name.localeCompare(b.name))
  folders = folders.sort((a, b) => a.name.localeCompare(b.name))
  return { files, folders }
}
</script>

<template>
  <TreeExplorer :initialPath="fsPath" :getEntries="listFsAt">
    <template #default="{ entries, onEntryClick }">
      <a
        href="#"
        class="list-group-item"
        v-for="entry in entries"
        :key="entry.id"
        @click="onEntryClick(entry)"
      >
        <i class="bi-folder-fill"></i>
        {{ entry.name }}
      </a>
    </template>
    <template #file="{ entries }">
      <div class="list-group-item" v-for="entry in entries" :key="entry.id">
        <i class="bi-file-earmark"></i>
        {{ entry.name }}
      </div>
    </template>
  </TreeExplorer>
</template>

<style scoped>
.list-group {
  padding-top: 1rem;
  padding-bottom: 1rem;
}
#filesystem {
  height: 30rem;
  overflow: auto;
}

.breadcrumb {
  margin-bottom: 0; /* Bootstrap's breadcrumb has bottom margin, reset it if needed */
  background-color: #f5f5f5; /* Or any gray color you prefer */
  padding: 1rem; /* Adjust padding to match your design */
  border-radius: 0.25rem; /* Optional: if you want rounded corners */
}
</style>

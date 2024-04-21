<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { gql } from '@apollo/client/core'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

const fsPath = ref('/')
// breadcrumb parts
const fsPathItems = ref([])
const fsFolderEntries = ref([])
const fsFileEntries = ref([])

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
// // Function to parse path into breadcrumb parts
function buildFsParts(newFsPath: string) {
  let parts = newFsPath === '/' ? [''] : newFsPath.split('/')
  return parts.map((part, index) => ({
    part: index === 0 ? 'Root' : part,
    active: index === parts.length - 1,
    disabled: index === parts.length - 1
  }))
}

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
  updateFSEntries(children.data.trees[0])

  fsPathItems.value = buildFsParts(fsPath.value)
}

function updateFSEntries(new_data) {
  // update fsFolderEntries and fsFileEntries
  // both should be arrays of Objects like
  // [{ name: 'folder1', hash: 'hash1' }, ...]
  let files = new_data.child_blobsConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }));

  let folders = new_data.child_treesConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }));

  // Then, sort the files and folders by name
  fsFileEntries.value = files.sort((a, b) => a.name.localeCompare(b.name));
  fsFolderEntries.value = folders.sort((a, b) => a.name.localeCompare(b.name));
}

// Initial fetch for the filesystem
onMounted(() => {
  listFsAt(fsPath.value)
})

// Event handlers
const onItemClicked = (entryName) => {
  if (fsPath.value === '/') fsPath.value += entryName.name
  else fsPath.value += '/' + entryName.name
  listFsAt(fsPath.value)
}

const onBreadcrumbClicked = (index) => {
  if (index === 0) {
    fsPath.value = '/'
  } else {
    let newPathParts = fsPathItems.value.slice(1, index + 1).map((item) => item.part)
    fsPath.value = `/${newPathParts.join('/')}`
  }
  listFsAt(fsPath.value)
}
</script>

<template>
  <div>
    <h2>Filesystem</h2>
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li
          v-for="(entry, index) in fsPathItems"
          :key="entry.id"
          :class="['breadcrumb-item', { 'active': entry.active }]"
          class="breadcrumb-item"
          v-bind:aria-current="entry.active ? 'page' : false"
        >
          <a
            href="#"
            v-if="!entry.active"
            @click.prevent="onBreadcrumbClicked(entry, index)"
          >
            {{ entry.part }}
          </a>
          <span v-else>{{ entry.part }}</span>
        </li>
      </ol>
    </nav>


    <div id="filesystem">
      <!-- Display Filesystem using 2 lists: folders and files, sorted -->
      <div class="list-group">
        <a
          href="#"
          class="list-group-item list-group-item-action"
          v-for="entry in fsFolderEntries"
          :key="entry.id"
          @click="onItemClicked(entry)"
        >
          <i class="bi-folder-fill"></i>
          {{ entry.name }}
        </a>
        <div class="list-group-item" v-for="entry in fsFileEntries" :key="entry.id">
          <i class="bi-file-earmark"></i>
            {{ entry.name }}
        </div>
      </div>
    </div>
  </div>
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
  border-radius: .25rem; /* Optional: if you want rounded corners */
}
</style>

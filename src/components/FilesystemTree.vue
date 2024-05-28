<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import gqlClient from '@/graphql-client'
import TreeExplorer from '@/components/TreeExplorer.vue'
import { TRAVERSE_PATH, LIST_ENTRIES_FOR_TREE, GET_FS_ROOT } from '@/queries'

const VITE_OBJECT_STORAGE_URL = import.meta.env.VITE_GRAPHEORS_OBJECT_STORAGE_URI

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  },
  path: {
    type: String,
    default: '/'
  }
})

// define a computed property to hold both the parent directory and the filename of the path
// if path is '/', then the filename can be null
const pathParts = computed(() => {
  let filename = null
  let parentDir = '/' // Set parentDir to '/' when props.initialPath is '/'

  if (props.path !== '/') {
    const parts = props.path.split('/')
    filename = parts.pop()
    parentDir = parts.join('/')
    if (parentDir === '') {
      parentDir = '/'
    }
  }

  return { parentDir, filename }
})

// the root hash of the filesystem
const fs_root = ref(null)

// Fetch filesystem at the given path
async function listFsAt(path: string) {
  // Here you would use the useQuery hook from Apollo Client Vue to fetch data
  const response = await gqlClient.query({
    query: TRAVERSE_PATH,
    variables: { tree_hash: fs_root.value, path }
  })
  const tree_hash = response.data['traversePath']
  // get children
  const children = await gqlClient.query({
    query: LIST_ENTRIES_FOR_TREE,
    variables: { where: { hash: tree_hash } }
  })
  return parseFSEntries(children.data.trees[0])
}

function parseFSEntries(new_data: {
  child_blobsConnection: { edges: any[] }
  child_treesConnection: { edges: any[] }
}) {
  // update fsFolderEntries and fsFileEntries
  // both should be arrays of Objects like
  // [{ name: 'folder1', hash: 'hash1' }, ...]
  let files = new_data.child_blobsConnection.edges.map((edge: any) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  let folders = new_data.child_treesConnection.edges.map((edge: any) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  // Then, sort the files and folders by name
  files = files.sort((a, b) => a.name.localeCompare(b.name))
  folders = folders.sort((a, b) => a.name.localeCompare(b.name))
  return { files, folders }
}

// Generate the download URL for a given hash
function getDownloadUrl(hash: string): string {
  return `${VITE_OBJECT_STORAGE_URL}/objects/${hash}`
}

// onMounted, use GET_FS_ROOT to get the root of the filesystem
onMounted(async () => {
  const response = await gqlClient.query({
    query: GET_FS_ROOT,
    variables: { where: { hash: props.os_hash } }
  })
  const tree_hash = response.data['commits'][0]['filesystemConnection']['edges'][0]['node']['hash']
  fs_root.value = tree_hash
})
</script>

<template>
  <TreeExplorer
    v-if="fs_root"
    :path_dir="pathParts.parentDir"
    :filename_highlight="pathParts.filename"
    :getEntries="listFsAt"
  >
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
      <div
        class="list-group-item d-flex justify-content-between align-items-center"
        v-for="entry in entries"
        :key="entry.id"
      >
        <div>
          <i class="bi-file-earmark"></i>
          {{ entry.name }}
        </div>
        <a
          :href="getDownloadUrl(entry.hash)"
          :download="`${entry.hash}_${entry.name}`"
          class="btn btn-primary"
        >
          Download
        </a>
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

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import gqlClient from '@/graphql-client'
import TreeExplorer from '@/components/TreeExplorer.vue'
import { TRAVERSE_PATH, LIST_ENTRIES_FOR_TREE, GET_FS_ROOT } from '@/queries'
import TreeNodeType from '@/types'
import { getDownloadUrl } from '@/download'

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

const fields = [{ key: 'name', sortable: true }]

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
async function listFsAt(path: string, max_depth: number | null = 0, to_export: boolean = false) {
  const response = await gqlClient.query({
    query: TRAVERSE_PATH,
    variables: { parent_label: 'Tree', tree_hash: fs_root.value, path }
  })
  const tree_hash = response.data['traversePath']
  // get children
  const children = await gqlClient.query({
    query: LIST_ENTRIES_FOR_TREE,
    variables: { where: { hash: tree_hash } }
  })
  const data = children.data.trees[0]
  return parseFSEntries(data, to_export)
}

function parseFSEntries(
  new_data: {
    child_blobsConnection: { edges: any[] }
    child_treesConnection: { edges: any[] }
  },
  to_export: boolean = false
) {
  // output should be an array of items like
  // [{ name: 'file1', type: TreeNodeType.Blob }, { name: 'dir1', type: TreeNodeType.Tree }]
  const files = new_data.child_blobsConnection.edges.map((edge: any) => ({
    name: edge.properties.name,
    type: to_export ? 'Blob' : TreeNodeType.Blob,
    hash: edge.node.hash
  }))
  const dirs = new_data.child_treesConnection.edges.map((edge: any) => ({
    name: edge.properties.name,
    type: to_export ? 'Tree' : TreeNodeType.Tree,
    hash: edge.node.hash
  }))
  return [...dirs, ...files]
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
    :fields="fields"
  >
    <template #cell(name)="props">
      <div class="row-container">
        <div>
          <div v-if="props.data.item.type === TreeNodeType.Blob">
            <i class="bi-file-earmark"></i>
            {{ props.data.item.name }}
          </div>
          <div v-else>
            <i class="bi-folder-fill"></i>
            {{ props.data.item.name }}
          </div>
        </div>
        <div v-if="props.data.item.type === TreeNodeType.Blob">
          <a
            :href="getDownloadUrl(props.data.item.hash)"
            :download="`${props.data.item.hash}_${props.data.item.name}`"
            class="btn btn-primary"
          >
            Download
          </a>
        </div>
      </div>
    </template>
  </TreeExplorer>
</template>

<style scoped>
.breadcrumb {
  margin-bottom: 0;
  /* Bootstrap's breadcrumb has bottom margin, reset it if needed */
  background-color: #f5f5f5;
  /* Or any gray color you prefer */
  padding: 1rem;
  /* Adjust padding to match your design */
  border-radius: 0.25rem;
  /* Optional: if you want rounded corners */
}

.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onMounted, ref } from 'vue'
import { BCard, BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import gqlClient from '@/graphql-client'
import TreeNodeType from '@/types'
import { GET_FS_ROOT, DIFF_NODES } from '@/queries'
import TreeExplorer from '@/components/TreeExplorer.vue'
import { getDownloadUrl } from '@/download'

enum DiffType {
  NEW,
  MOD,
  DEL
}

interface DiffObj {
  name: string
  type: TreeNodeType
  diffType: DiffType
  old_hash: string | null
  new_hash: string | null
  _rowVariant: string
}

// get route params
const route = useRoute()
const base_commit = ref({
  hash: route.params.base_hash,
  name: route.query.base_name,
  fs_root_hash: ''
})
const diffee_commit = ref({
  hash: route.params.diffee_hash,
  name: route.query.diffee_name,
  fs_root_hash: ''
})
// tree explorer
const fields = [{ key: 'name', sortable: true }]
// our current path
const at_path = ref('/')

// Function to fetch filesystem diff at a given path
async function diffFsAt(new_path: string) {
  try {
    const response = await gqlClient.query({
      query: DIFF_NODES, // Use the updated DIFF_NODES query
      variables: {
        parentLabel: 'Tree', // Set the parent label
        baseNodeHash: base_commit.value.fs_root_hash, // Use fs_root_hash instead of commit hash
        diffeeNodeHash: diffee_commit.value.fs_root_hash, // Use fs_root_hash instead of commit hash
        atPath: new_path, // Path to diff
        maxDepth: 0, // Max depth for the diff
        filter: ['Blob'] // Filter criteria (empty for now)
      },
      // disable caching for this query
      // Apollo Client cache is very slow
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    })
    return parse_diff_reponse(response) // Parse the response
  } catch (error) {
    console.error('Error fetching filesystem diff at path: ', error)
  }
}

// Function to parse the diff response
function parse_diff_reponse(response: any): DiffObj[] {
  const diffNodesAt = response.data['diffNodesAt'] // Get the diffNodesAt data

  // Helper function to map API response to DiffObj
  const mapItem = (item, diffType, rowVariant) => ({
    name: item.path, // File or directory path
    type: item.type === 'BLOB' ? TreeNodeType.Blob : TreeNodeType.Tree, // Determine type
    diffType, // Diff type (NEW, MOD, DEL)
    old_hash: item.old_props?.hash || null, // Old hash (if available)
    new_hash: item.new_props?.hash || null, // New hash (if available)
    _rowVariant: rowVariant // Row variant for styling
  })

  // Filter and map new items
  const newItems = diffNodesAt
    .filter((item) => item.status === 'NEW')
    .map((item) => mapItem(item, DiffType.NEW, 'success'))
  // Filter and map modified items
  const modItems = diffNodesAt
    .filter((item) => item.status === 'MOD')
    .map((item) => mapItem(item, DiffType.MOD, 'warning'))
  // Filter and map deleted items
  const delItems = diffNodesAt
    .filter((item) => item.status === 'DEL')
    .map((item) => mapItem(item, DiffType.DEL, 'danger'))

  // Combine all items into a single array
  return [...newItems, ...modItems, ...delItems]
}

// onMounted, use GET_FS_ROOT to get the root of the filesystem
onMounted(async () => {
  const response = await gqlClient.query({
    query: GET_FS_ROOT,
    variables: { where: { hash_IN: [base_commit.value.hash, diffee_commit.value.hash] } }
  })
  // assign fs_root_hash to the corresponding commit
  response.data['commits'].forEach((commit) => {
    if (commit.hash === base_commit.value.hash) {
      base_commit.value.fs_root_hash = commit.filesystemConnection.edges[0].node.hash
    } else if (commit.hash === diffee_commit.value.hash) {
      diffee_commit.value.fs_root_hash = commit.filesystemConnection.edges[0].node.hash
    }
  })
})
</script>

<template>
  <div class="container">
    <BCard class="diff-card">
      <div class="diff-header">
        <h2><i class="bi bi-file-earmark-diff"></i> Diff</h2>
      </div>
      <div class="diff-details">
        <h4>
          <span class="commit-name">{{ base_commit.name }}</span>
          <i class="bi bi-arrow-left-right"></i>
          <span class="commit-name">{{ diffee_commit.name }}</span>
        </h4>
      </div>
    </BCard>
    <div v-if="base_commit.fs_root_hash && diffee_commit.fs_root_hash">
      <TreeExplorer :path_dir="at_path" :getEntries="diffFsAt" :fields="fields">
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
            <div>
              <div v-if="props.data.item.type === TreeNodeType.Blob">
                <div v-if="props.data.item.diffType === DiffType.NEW">
                  <a :href="getDownloadUrl(props.data.item.new_hash)"
                    :download="`${props.data.item.new_hash}_${props.data.item.name}`" class="btn btn-primary">
                    Download
                  </a>
                </div>
                <div v-else-if="props.data.item.diffType === DiffType.DEL">
                  <a :href="getDownloadUrl(props.data.item.old_hash)"
                    :download="`${props.data.item.old_hash}_${props.data.item.name}`" class="btn btn-primary">
                    Download
                  </a>
                </div>
                <div v-else>
                  <BDropdown text="Download" variant="primary">
                    <BDropdownItem :href="getDownloadUrl(props.data.item.old_hash)">Old</BDropdownItem>
                    <BDropdownItem :href="getDownloadUrl(props.data.item.new_hash)">New</BDropdownItem>
                  </BDropdown>
                </div>
              </div>
            </div>
          </div>
        </template>
      </TreeExplorer>
    </div>
  </div>
</template>

<style scoped>
.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.diff-card {
  padding: 20px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.diff-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.diff-header h2 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
}

.diff-header i {
  margin-right: 10px;
  font-size: 1.5em;
}

.diff-details h4 {
  font-size: 1.25em;
  font-weight: normal;
  display: flex;
  align-items: center;
  margin: 0;
}

.diff-details i {
  margin: 0 10px;
  font-size: 1.25em;
}

.commit-name {
  font-weight: bold;
}
</style>

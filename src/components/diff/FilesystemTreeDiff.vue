<script setup lang="ts">
import { defineProps, ref, onMounted } from 'vue'
import TreeExplorer from '@/components/TreeExplorer.vue'
import TreeNodeType, { DiffObj, DiffType } from '@/types'
import { getDownloadUrl } from '@/download'
import gqlClient from '@/graphql-client'
import { DIFF_NODES, GET_FS_ROOT } from '@/queries'
import { BDropdown, BDropdownItem } from 'bootstrap-vue-next'

const props = defineProps({
  base_commit: {
    type: String,
    required: true
  },
  diffee_commit: {
    type: String,
    required: true
  }
})

const base_commit = ref({
  hash: props.base_commit,
  fs_root_hash: undefined
})
const diffee_commit = ref({
  hash: props.diffee_commit,
  fs_root_hash: undefined
})

// our current path
const at_path = ref('/')
// tree explorer
const fields = [{ key: 'name', sortable: true }]

// Function to fetch filesystem diff at a given path
async function diffFsAt(
  new_path: string,
  max_depth: number | null = 0,
  to_export: boolean = false
) {
  try {
    const response = await gqlClient.query({
      query: DIFF_NODES, // Use the updated DIFF_NODES query
      variables: {
        parentLabel: 'Tree', // Set the parent label
        baseNodeHash: base_commit.value.fs_root_hash, // Use fs_root_hash instead of commit hash
        diffeeNodeHash: diffee_commit.value.fs_root_hash, // Use fs_root_hash instead of commit hash
        atPath: new_path, // Path to diff
        maxDepth: max_depth, // Max depth for the diff
        filter: ['Blob'] // Filter criteria (empty for now)
      },
      // disable caching for this query
      // Apollo Client cache is very slow
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    })
    return parse_diff_reponse(response, to_export) // Parse the response
  } catch (error) {
    console.error('Error fetching filesystem diff at path: ', error)
  }
}

// Function to parse the diff response
function parse_diff_reponse(response: any, to_export: boolean): DiffObj[] {
  const diffNodesAt = response.data['diffNodesAt'] // Get the diffNodesAt data

  if (to_export) {
    return diffNodesAt.map((item) => ({
      name: item.path,
      type: item.type,
      diffType: item.status,
      old_props: {
        hash: item.old_props?.hash,
        properties: item.old_props?.properties
      },
      new_props: {
        hash: item.new_props?.hash,
        properties: item.new_props?.properties
      }
    }))
  }

  // Helper function to map API response to DiffObj
  const mapItem = (item, diffType, rowVariant) => ({
    name: item.path, // File or directory path
    type: item.type === 'Blob' ? TreeNodeType.Blob : TreeNodeType.Tree, // Determine type
    diffType, // Diff type (NEW, MOD, DEL)
    old_props: item.old_props,
    new_props: item.new_props,
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

onMounted(async () => {
  try {
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
  } catch (error) {
    console.error('Error fetching commit details', error)
  }
})
</script>

<template>
  <div v-if="base_commit.fs_root_hash && diffee_commit.fs_root_hash">
    <TreeExplorer
      :path_dir="at_path"
      :getEntries="diffFsAt"
      :fields="fields"
      :export_max_depth_available="true"
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
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <div v-if="props.data.item.diffType === DiffType.NEW">
                <a
                  :href="getDownloadUrl(props.data.item.new_hash)"
                  :download="`${props.data.item.new_props.hash}_${props.data.item.name}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else-if="props.data.item.diffType === DiffType.DEL">
                <a
                  :href="getDownloadUrl(props.data.item.old_props.hash)"
                  :download="`${props.data.item.old_props.hash}_${props.data.item.name}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else>
                <BDropdown text="Download" variant="primary">
                  <BDropdownItem :href="getDownloadUrl(props.data.item.old_props.hash)"
                    >Old</BDropdownItem
                  >
                  <BDropdownItem :href="getDownloadUrl(props.data.item.new_props.hash)"
                    >New</BDropdownItem
                  >
                </BDropdown>
              </div>
            </div>
          </div>
        </div>
      </template>
    </TreeExplorer>
  </div>
</template>

<style scoped>
.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

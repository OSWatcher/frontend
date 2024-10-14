<script setup lang="ts">
import { defineProps, ref, onMounted, PropType } from 'vue'
import TreeExplorer from '@/components/TreeExplorer.vue'
import TreeNodeType, { DiffObj } from '@/types'
import { getDownloadUrl } from '@/download'
import gqlClient from '@/graphql-client'
import { DiffNodesDocument, DiffNodesQuery, DiffNodesQueryVariables } from '@/graphql-types'
import { BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import type { HashDiff } from '@/types'
import { fetchFSRootCommitDiff } from '@/utils'
import { DiffStatus } from '@/graphql-types'

const props = defineProps({
  commitHashDiff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

const rootFsHashDiff = ref<HashDiff | null>(null)

// our current path
const at_path = ref('/')
// tree explorer
const fields = [{ key: 'name', sortable: true }]

// Function to fetch filesystem diff at a given path
async function diffFsAt(new_path: string, max_depth: number | null = 0) {
  try {
    const response = await gqlClient.query<DiffNodesQuery, DiffNodesQueryVariables>({
      query: DiffNodesDocument,
      variables: {
        parentLabel: 'Tree',
        baseNodeHash: rootFsHashDiff.value?.base_hash!,
        diffeeNodeHash: rootFsHashDiff.value?.diffee_hash!,
        atPath: new_path,
        maxDepth: max_depth,
        filter: ['Blob']
      },
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    })
    return parse_diff_reponse(response.data)
  } catch (error) {
    console.error('Error fetching filesystem diff at path: ', error)
  }
}

// Function to parse the diff response
function parse_diff_reponse(response: DiffNodesQuery): DiffObj[] {
  const diffNodesAt = response.diffNodesAt

  // Helper function to map API response to DiffObj
  const mapItem = (item: any, diffType: DiffStatus, rowVariant: string) => ({
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
    .map((item) => mapItem(item, DiffStatus.New, 'success'))
  // Filter and map modified items
  const modItems = diffNodesAt
    .filter((item) => item.status === 'MOD')
    .map((item) => mapItem(item, DiffStatus.Mod, 'warning'))
  // Filter and map deleted items
  const delItems = diffNodesAt
    .filter((item) => item.status === 'DEL')
    .map((item) => mapItem(item, DiffStatus.Del, 'danger'))

  // Combine all items into a single array
  return [...newItems, ...modItems, ...delItems]
}

onMounted(async () => {
  rootFsHashDiff.value = await fetchFSRootCommitDiff(props.commitHashDiff)
})
</script>

<template>
  <div v-if="rootFsHashDiff">
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
              <div v-if="props.data.item.diffType === DiffStatus.New">
                <a
                  :href="getDownloadUrl(props.data.item.new_hash)"
                  :download="`${props.data.item.new_props.hash}_${props.data.item.name}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else-if="props.data.item.diffType === DiffStatus.Del">
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

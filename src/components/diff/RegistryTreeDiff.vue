<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { BDropdown, BDropdownItem, BCard, BCardBody } from 'bootstrap-vue-next'
import { GetSystemHives } from '@/windows/registry'
import { TreeNodeType, HashDiff, DiffObj, DiffType } from '@/types'
import TreeExplorer from '@/components/TreeExplorer.vue'
import gqlClient from '@/graphql-client'
import { DIFF_NODES } from '@/queries'

const props = defineProps({
  base_commit: { type: String, required: true },
  diffee_commit: { type: String, required: true }
})

interface HiveOption {
  value: HashDiff
  text: string
}

const selectedHive = ref<HiveOption | null>(null)
const possibleHives = ref<HiveOption[]>([])

// Dumb counter just to force a re-render of the TreeExplorer when the hive changes
const hiveChangeCounter = ref(0)

// our current path
const at_path = ref('/')
// tree explorer
const fields = [
  { key: 'name', sortable: true },
  { key: 'value', sortable: true },
  { key: 'type', sortable: true }
]

async function diffRegAt(
  new_path: string,
  max_depth: number | null = 0,
  to_export: boolean = false
) {
  if (!selectedHive.value) {
    console.error('No hive selected')
    return []
  }

  try {
    const response = await gqlClient.query({
      query: DIFF_NODES, // Use the updated DIFF_NODES query
      variables: {
        parentLabel: 'WinRegKey', // Set the parent label
        baseNodeHash: selectedHive.value?.value.base_hash,
        diffeeNodeHash: selectedHive.value?.value.diffee_hash, // Use fs_root_hash instead of commit hash
        atPath: new_path, // Path to diff
        maxDepth: max_depth, // Max depth for the diff
        filter: ['WinRegValue']
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

function parse_diff_reponse(response: any, to_export: boolean): DiffObj[] {
  if (!response || !response.data || !response.data['diffNodesAt']) {
    console.error('Invalid response structure:', response)
    return []
  }

  const diffNodesAt = response.data['diffNodesAt']

  if (!Array.isArray(diffNodesAt)) {
    console.error('diffNodesAt is not an array:', diffNodesAt)
    return []
  }

  if (to_export) {
    return diffNodesAt.map((item: any) => ({
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
  const mapItem = (item: any, diffType: DiffType, rowVariant: string): DiffObj => ({
    name: item.path,
    type: item.type === 'WinRegValue' ? TreeNodeType.Blob : TreeNodeType.Tree, // Determine type
    diffType,
    old_props: item.old_props,
    new_props: item.new_props,
    _rowVariant: rowVariant // Row variant for styling
  })

  try {
    // Filter and map new items
    const newItems = diffNodesAt
      .filter((item: any) => item.status === 'NEW')
      .map((item: any) => mapItem(item, DiffType.NEW, 'success'))
    // Filter and map modified items
    const modItems = diffNodesAt
      .filter((item: any) => item.status === 'MOD')
      .map((item: any) => mapItem(item, DiffType.MOD, 'warning'))
    // Filter and map deleted items
    const delItems = diffNodesAt
      .filter((item: any) => item.status === 'DEL')
      .map((item: any) => mapItem(item, DiffType.DEL, 'danger'))

    // Combine all items into a single array
    return [...newItems, ...modItems, ...delItems]
  } catch (error) {
    console.error('Error processing diff response:', error)
    return []
  }
}

onMounted(async () => {
  try {
    const baseSystemHives = await GetSystemHives(props.base_commit)
    const diffeeSystemHives = await GetSystemHives(props.diffee_commit)

    possibleHives.value = baseSystemHives
      .filter((baseHive, index) => baseHive.winreg_hash && diffeeSystemHives[index].winreg_hash)
      .map((baseHive, index) => ({
        value: {
          base_hash: baseHive.winreg_hash!,
          diffee_hash: diffeeSystemHives[index].winreg_hash!
        },
        text: baseHive.mount_path
      }))

    if (possibleHives.value.length > 0) {
      selectedHive.value = possibleHives.value[0]
    }
  } catch (error) {
    console.error('Error loading hives:', error)
  }
})

const selectHive = (hive: HiveOption) => {
  selectedHive.value = hive
  // Increment the counter to trigger a re-render of TreeExplorer
  hiveChangeCounter.value++
}
</script>

<template>
  <div v-if="possibleHives.length > 0">
    <div class="d-flex align-items-center">
      <BDropdown right class="mr-2" variant="primary">
        <template #button-content> Select Hive </template>
        <BDropdownItem
          v-for="hive in possibleHives"
          :key="hive.value.base_hash"
          @click="selectHive(hive)"
        >
          {{ hive.text }}
        </BDropdownItem>
      </BDropdown>
      <BCard
        no-body
        class="selected-hive-card flex-grow-1"
        :bg-variant="selectedHive ? 'light' : 'secondary'"
        :text-variant="selectedHive ? 'dark' : 'white'"
      >
        <BCard-body>
          {{ selectedHive ? selectedHive.text : 'No hive selected' }}
        </BCard-body>
      </BCard>
    </div>
    <TreeExplorer
      :path_dir="at_path"
      :getEntries="diffRegAt"
      :fields="fields"
      :export_max_depth_available="true"
      :key="hiveChangeCounter"
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
        </div>
      </template>
      <template #cell(value)="props">
        <div v-if="props.data.item.type === TreeNodeType.Blob" class="value-container">
          <div v-if="props.data.item.diffType === DiffType.NEW" class="value-content new-value">
            {{ props.data.item.new_props.properties.value }}
          </div>
          <div
            v-else-if="props.data.item.diffType === DiffType.DEL"
            class="value-content old-value"
          >
            {{ props.data.item.old_props.properties.value }}
          </div>
          <div v-else-if="props.data.item.diffType === DiffType.MOD">
            <div
              v-if="
                props.data.item.old_props.properties.value !==
                props.data.item.new_props.properties.value
              "
            >
              <div class="value-content old-value">
                <span class="value-label">Old:</span>
                {{ props.data.item.old_props.properties.value }}
              </div>
              <div class="value-content new-value">
                <span class="value-label">New:</span>
                {{ props.data.item.new_props.properties.value }}
              </div>
            </div>
            <div v-else>
              <div class="value-content">
                {{ props.data.item.new_props.properties.value }}
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #cell(type)="props">
        <div v-if="props.data.item.type === TreeNodeType.Blob">
          <div v-if="props.data.item.diffType === DiffType.NEW" class="value-content new-value">
            {{ props.data.item.new_props.properties.type }}
          </div>
          <div
            v-else-if="props.data.item.diffType === DiffType.DEL"
            class="value-content old-value"
          >
            {{ props.data.item.old_props.properties.type }}
          </div>
          <div v-else-if="props.data.item.diffType === DiffType.MOD">
            <div
              v-if="
                props.data.item.old_props.properties.type !==
                props.data.item.new_props.properties.type
              "
            >
              <div class="value-content old-value">
                <span class="value-label">Old:</span>
                {{ props.data.item.old_props.properties.type }}
              </div>
              <div class="value-content new-value">
                <span class="value-label">New:</span>
                {{ props.data.item.new_props.properties.type }}
              </div>
            </div>
            <div v-else>
              <div class="value-content">
                {{ props.data.item.new_props.properties.type }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </TreeExplorer>
  </div>
</template>

<style scoped>
.selected-hive-card {
  min-height: 38px;
  display: flex;
  align-items: center;
}

.selected-hive-card .card-body {
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  white-space: normal;
}

.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.old-value {
  color: #dc3545;
}

.new-value {
  color: #28a745;
}

.value-container {
  max-width: 300px;
  /* Adjust this value as needed */
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
}

.value-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9em;
  padding: 2px 4px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.05);
}

.value-label {
  font-weight: bold;
  margin-right: 5px;
}
</style>

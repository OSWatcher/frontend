<script setup lang="ts">
import { ref, onMounted, PropType, computed } from 'vue'
import { BDropdown, BDropdownItem, BCard, BCardBody } from 'bootstrap-vue-next'
import { GetSystemHives } from '@/windows/registry'
import { TreeNodeType, HashDiff } from '@/types'
import { NodeType, DiffStatus } from '@/graphql-types'
import TreeDiffExplorer from '@/components/diff/TreeDiffExplorer.vue'

const props = defineProps({
  commitHashDiff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

interface HiveOption {
  value: HashDiff
  text: string
}

const selectedHive = ref<HiveOption | null>(null)
const possibleHives = ref<HiveOption[]>([])
const fields = [
  { key: 'path', sortable: true, label: 'Name' },
  { key: 'value', sortable: true },
  { key: 'type', sortable: true }
]
// Dumb counter just to force a re-render of the TreeExplorer when the hive changes
const hiveChangeCounter = ref(0)

// Computed property for node_diff
const node_diff = computed(() => {
  if (!selectedHive.value) return null
  return {
    base_hash: selectedHive.value.value.base_hash,
    diffee_hash: selectedHive.value.value.diffee_hash,
    label: 'WinRegKey'
  }
})

onMounted(async () => {
  try {
    const baseSystemHives = await GetSystemHives(props.commitHashDiff.base_hash!)
    const diffeeSystemHives = await GetSystemHives(props.commitHashDiff.diffee_hash!)

    possibleHives.value = baseSystemHives
      .filter((baseHive, index) => baseHive.winreg_hash && diffeeSystemHives[index].winreg_hash)
      .map((baseHive, index) => ({
        value: {
          base_hash: baseHive.winreg_hash!,
          diffee_hash: diffeeSystemHives[index].winreg_hash!,
          label: 'WinRegKey'
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
    <TreeDiffExplorer
      v-if="node_diff"
      :node_diff="node_diff"
      :fields="fields"
      :treeNodeType="NodeType.WinRegKey"
      :diff_filter="['WinRegValue']"
      :key="hiveChangeCounter"
    >
      <template #cell(path)="props">
        <div class="row-container">
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <i class="bi-file-earmark"></i>
              {{ props.data.item.path }}
            </div>
            <div v-else>
              <i class="bi-folder-fill"></i>
              {{ props.data.item.path }}
            </div>
          </div>
        </div>
      </template>
      <template #cell(value)="props">
        <div v-if="props.data.item.type === TreeNodeType.Blob" class="value-container">
          <div v-if="props.data.item.status === DiffStatus.New" class="value-content new-value">
            {{ props.data.item.new_props.properties.value }}
          </div>
          <div
            v-else-if="props.data.item.status === DiffStatus.Del"
            class="value-content old-value"
          >
            {{ props.data.item.old_props.properties.value }}
          </div>
          <div v-else-if="props.data.item.status === DiffStatus.Mod">
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
          <div v-if="props.data.item.status === DiffStatus.New" class="value-content new-value">
            {{ props.data.item.new_props.properties.type }}
          </div>
          <div
            v-else-if="props.data.item.status === DiffStatus.Del"
            class="value-content old-value"
          >
            {{ props.data.item.old_props.properties.type }}
          </div>
          <div v-else-if="props.data.item.status === DiffStatus.Mod">
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
    </TreeDiffExplorer>
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

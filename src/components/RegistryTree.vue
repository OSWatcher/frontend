<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import TreeExplorer from '@/components/TreeExplorer.vue'
import TreeNodeType from '@/types'
import {
  TraversePathDocument,
  ListEntriesForKeyDocument,
  TraversePathQuery,
  TraversePathQueryVariables,
  ListEntriesForKeyQuery,
  ListEntriesForKeyQueryVariables
} from '@/graphql-types'
import { GetSystemHives, WinRegHive, HKLM, HKU } from '@/windows/registry'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

const systemHives = ref<WinRegHive[]>([])

// constants
const root = '/'

const fields = [
  { key: 'name', sortable: true },
  { key: 'value', sortable: true },
  { key: 'value_type', sortable: true, label: 'Type' }
]

async function listFsAt(path: string, _max_depth: number | null = 0) {
  if (path === '/') {
    return {
      items: [
        { name: HKLM, type: TreeNodeType.Tree },
        { name: HKU, type: TreeNodeType.Tree }
      ],
      total_count: 2
    }
  }
  if (path === `/${HKLM}`) {
    // iterate over systemHives
    // use mount_path and return the filename
    // except DEFAULT which should be ignored
    const hives = systemHives.value
      .filter((hive) => !hive.mount_path.startsWith('HKEY_USERS'))
      .map((hive) => ({ name: hive.mount_path.split('/').pop(), type: TreeNodeType.Tree }))
    return { items: hives, total_count: hives.length }
  }

  if (path === `/${HKU}`) {
    const hives = systemHives.value
      .filter((hive) => hive.mount_path.startsWith('HKEY_USERS'))
      .map((hive) => ({ name: hive.mount_path.split('/').pop(), type: TreeNodeType.Tree }))
    return { items: hives, total_count: hives.length }
  }
  const path_parts = path.split('/').filter(Boolean)
  switch (path_parts[0]) {
    case HKLM:
    case HKU: {
      const hive_key = path_parts.slice(0, 2).join('/')
      const rest_path = path_parts.slice(2).join('/')
      const hive_hash = systemHives.value.find((hive) => hive.mount_path === hive_key)?.winreg_hash
      if (!hive_hash) {
        throw new Error(`Hive not found: ${hive_key}`)
      }
      return await listRegistryEntries(hive_hash, `/${rest_path}`)
    }
    default:
      // throw error
      throw new Error(`Invalid path: ${path}`)
  }
}

async function listRegistryEntries(hive_hash: string, path: string) {
  const response = await gqlClient.query<TraversePathQuery, TraversePathQueryVariables>({
    query: TraversePathDocument,
    variables: { parent_label: 'WinRegKey', tree_hash: hive_hash, path }
  })
  const node_hash = response.data.traversePath

  const children = await gqlClient.query<ListEntriesForKeyQuery, ListEntriesForKeyQueryVariables>({
    query: ListEntriesForKeyDocument,
    variables: { where: { hash: node_hash } }
  })
  return parseFSEntries(children.data.winRegKeys[0])
}

function parseFSEntries(new_data: any) {
  let entries = [
    ...new_data.child_valuesConnection.edges.map((edge: any) => ({
      name: edge.properties.name,
      hash: edge.node.hash,
      type: TreeNodeType.Blob,
      value: edge.node.value,
      value_type: edge.node.type
    })),
    ...new_data.child_keysConnection.edges.map((edge: any) => ({
      name: edge.properties.name,
      hash: edge.node.hash,
      type: TreeNodeType.Tree
    }))
  ]

  return { items: entries, total_count: entries.length }
}

onMounted(async () => {
  try {
    systemHives.value = await GetSystemHives(props.os_hash)
  } catch (error) {
    console.error(error)
  }
})
</script>

<template>
  <TreeExplorer v-if="systemHives" :initialPath="root" :getEntries="listFsAt" :fields="fields">
    <template #cell(name)="props">
      <div class="list-group-item">
        <div v-if="props.data.item.type === TreeNodeType.Blob">
          <i class="bi-file-earmark"></i>
          {{ props.data.item.name }}
        </div>
        <div v-else>
          <i class="bi-folder-fill"></i>
          {{ props.data.item.name }}
        </div>
      </div>
    </template>
    <template #cell(value)="props">
      <div v-if="props.data.item.type === TreeNodeType.Blob">
        {{ props.data.item.value }}
      </div>
    </template>
    <template #cell(value_type)="props">
      <div v-if="props.data.item.type === TreeNodeType.Blob">
        {{ props.data.item.value_type }}
      </div>
    </template>
  </TreeExplorer>
</template>

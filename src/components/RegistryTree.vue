<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import TreeExplorer from '@/components/TreeExplorer.vue'
import TreeNodeType from '@/types'
import { TRAVERSE_PATH, LIST_ENTRIES_FOR_KEY, GET_FS_ROOT, HAS_WINREG } from '@/queries'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

// constants
const S32_CONFIG = '/Windows/System32/config'
const HKLM = 'HKEY_LOCAL_MACHINE'
const HKU = 'HKEY_USERS'
const root = '/'

// ref
interface RegistryHiveHashes {
  [key: string]: string // Replace 'any' with the actual type of winRegHash if known
}
const registryHiveHashes = ref<RegistryHiveHashes>({})
const fields = [{ key: 'name', sortable: true }]

// declare mapping of S32_CONFIG + '/SAM' to HKLM/SAM
const HIVE_MAPPING = {
  [`${S32_CONFIG}/SAM`]: 'HKEY_LOCAL_MACHINE/SAM',
  [`${S32_CONFIG}/SECURITY`]: 'HKEY_LOCAL_MACHINE/SECURITY',
  [`${S32_CONFIG}/SOFTWARE`]: 'HKEY_LOCAL_MACHINE/SOFTWARE',
  [`${S32_CONFIG}/SYSTEM`]: 'HKEY_LOCAL_MACHINE/SYSTEM',
  [`${S32_CONFIG}/DEFAULT`]: 'HKEY_USERS/.Default'
}

const fs_root = ref(null)

async function listFsAt(path: string) {
  if (path === '/') {
    return [
      { name: HKLM, type: TreeNodeType.Tree },
      { name: HKU, type: TreeNodeType.Tree }
    ]
  }
  if (path === `/${HKLM}`) {
    // return SAM, SECURITY, SOFTWARE, SYSTEM
    // without HKLM prefix
    return Object.values(HIVE_MAPPING)
      .filter((hive) => hive.startsWith('HKEY_LOCAL_MACHINE'))
      .map((hive) => ({ name: hive.split('/')[1], type: TreeNodeType.Tree }))
  }
  if (path === `/${HKU}`) {
    return Object.values(HIVE_MAPPING)
      .filter((hive) => hive.startsWith('HKEY_USERS'))
      .map((hive) => ({ name: hive.split('/')[1], type: TreeNodeType.Tree }))
  }
  const path_parts = path.split('/').filter(Boolean)
  switch (path_parts[0]) {
    case HKLM:
    case HKU: {
      const hive_key = path_parts.slice(0, 2).join('/')
      const rest_path = path_parts.slice(2).join('/')
      return await listRegistryEntries(registryHiveHashes.value[hive_key], `/${rest_path}`)
    }
    default:
      // throw error
      throw new Error(`Invalid path: ${path}`)
  }
}

async function listRegistryEntries(hive_hash: string, path: string) {
  const response = await gqlClient.query({
    query: TRAVERSE_PATH,
    variables: { parent_label: 'WinRegKey', tree_hash: hive_hash, path }
  })
  const node_hash = response.data['traversePath']

  const children = await gqlClient.query({
    query: LIST_ENTRIES_FOR_KEY,
    variables: { where: { hash: node_hash } }
  })
  return parseFSEntries(children.data.winRegKeys[0])
}

function parseFSEntries(new_data: any) {
  let entries = [
    ...new_data.child_valuesConnection.edges.map((edge: any) => ({
      name: edge.properties.name,
      hash: edge.node.hash,
      type: TreeNodeType.Blob
    })),
    ...new_data.child_keysConnection.edges.map((edge: any) => ({
      name: edge.properties.name,
      hash: edge.node.hash,
      type: TreeNodeType.Tree
    }))
  ]

  return entries
}

onMounted(async () => {
  // get fs_root_hash
  const response = await gqlClient.query({
    query: GET_FS_ROOT,
    variables: { where: { hash: props.os_hash } }
  })
  const tree_hash = response.data['commits'][0]['filesystemConnection']['edges'][0]['node']['hash']
  fs_root.value = tree_hash
  // use Promise.all to fetch all registry blob at once
  // return mapping of registry hive name to blob hash
  const registryBlobs = await Promise.all(
    Object.keys(HIVE_MAPPING).map(async (path) => {
      const response = await gqlClient.query({
        query: TRAVERSE_PATH,
        variables: { parent_label: 'Tree', tree_hash: fs_root.value, path }
      })
      return response.data['traversePath']
    })
  )
  // Fetch the WinRegKey hashes for each blob and map to registry hive names
  const registryKeys = await Promise.all(
    registryBlobs.map(async (blobHash, index) => {
      const response = await gqlClient.query({
        query: HAS_WINREG,
        variables: { where: { hash: blobHash } }
      })
      const hiveName = Object.values(HIVE_MAPPING)[index]
      const winRegHash = response.data.blobs[0].has_winreg.hash
      return { hiveName, winRegHash }
    })
  )

  // Build the final mapping of hive names to WinRegKey hashes
  registryKeys.forEach(({ hiveName, winRegHash }) => {
    registryHiveHashes.value[hiveName] = winRegHash
  })
})
</script>

<template>
  <TreeExplorer
    v-if="registryHiveHashes"
    :initialPath="root"
    :getEntries="listFsAt"
    :fields="fields"
  >
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
  </TreeExplorer>
</template>

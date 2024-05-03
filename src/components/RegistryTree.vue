<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { gql } from '@apollo/client/core'
import TreeExplorer from '@/components/TreeExplorer.vue'

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
const registryHiveHashes = ref({})

// declare mapping of S32_CONFIG + '/SAM' to HKLM/SAM
const HIVE_MAPPING = {
  [`${S32_CONFIG}/SAM`]: 'HKEY_LOCAL_MACHINE/SAM',
  [`${S32_CONFIG}/SECURITY`]: 'HKEY_LOCAL_MACHINE/SECURITY',
  [`${S32_CONFIG}/SOFTWARE`]: 'HKEY_LOCAL_MACHINE/SOFTWARE',
  [`${S32_CONFIG}/SYSTEM`]: 'HKEY_LOCAL_MACHINE/SYSTEM',
  [`${S32_CONFIG}/DEFAULT`]: 'HKEY_USERS/.Default'
}

const fs_root = ref(null)

const GET_FS_ROOT = gql`
  query Commits($where: CommitWhere) {
    commits(where: $where) {
      filesystemConnection {
        edges {
          node {
            hash
          }
        }
      }
    }
  }
`

const HAS_WINREG = gql`
  query ($where: BlobWhere) {
    blobs(where: $where) {
      has_winreg {
        hash
      }
    }
  }
`

const TRAVERSE_PATH = gql`
  query Query($tree_hash: String!, $path: String!) {
    traversePath(tree_hash: $tree_hash, path: $path)
  }
`

const LIST_ENTRIES_FOR_KEY = gql`
  query WinRegKeys($where: WinRegKeyWhere) {
    winRegKeys(where: $where) {
      child_keysConnection {
        edges {
          node {
            hash
          }
        }
        edges {
          properties {
            name
          }
        }
      }
      child_valuesConnection {
        edges {
          node {
            hash
          }
          properties {
            name
          }
        }
      }
    }
  }
`

async function listFsAt(path: string) {
  if (path === '/') {
    return {
      folders: [{ name: HKLM }, { name: HKU }],
      files: []
    }
  }
  if (path === `/${HKLM}`) {
    // return SAM, SECURITY, SOFTWARE, SYSTEM
    // without HKLM prefix
    // return {folders: [{ name: 'SAM' }, { name: 'SECURITY' }, { name: 'SOFTWARE' }, { name: 'SYSTEM' }]}
    return {
      folders: Object.values(HIVE_MAPPING)
        .filter((hive) => hive.startsWith('HKEY_LOCAL_MACHINE'))
        .map((hive) => ({ name: hive.split('/')[1] })),
      files: []
    }
  }
  if (path === `/${HKU}`) {
    return {
      folders: Object.values(HIVE_MAPPING)
        .filter((hive) => hive.startsWith('HKEY_USERS'))
        .map((hive) => ({ name: hive.split('/')[1] })),
      files: []
    }
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
    variables: { tree_hash: hive_hash, path }
  })
  const node_hash = response.data['traversePath']

  const children = await gqlClient.query({
    query: LIST_ENTRIES_FOR_KEY,
    variables: { where: { hash: node_hash } }
  })
  return parseFSEntries(children.data.winRegKeys[0])
}

function parseFSEntries(new_data) {
  let files = new_data.child_valuesConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  let folders = new_data.child_keysConnection.edges.map((edge) => ({
    name: edge.properties.name,
    hash: edge.node.hash
  }))

  // Then, sort the files and folders by name
  files = files.sort((a, b) => a.name.localeCompare(b.name))
  folders = folders.sort((a, b) => a.name.localeCompare(b.name))
  return { files, folders }
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
        variables: { tree_hash: fs_root.value, path }
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
  <TreeExplorer v-if="registryHiveHashes" :initialPath="root" :getEntries="listFsAt">
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
      <div class="list-group-item" v-for="entry in entries" :key="entry.id">
        <i class="bi-file-earmark"></i>
        {{ entry.name }}
      </div>
    </template>
  </TreeExplorer>
</template>

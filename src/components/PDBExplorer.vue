This component is used to display the PDB Explorer. The PDBExplorer component is inialized with the
following props - the commit hash It can also received a blob_hash prop, which will have been
clicked from the filesystem view By default, it should explore the commit hash filesystem, and try
to locate /Windows/System32/ntoskrnl.exe and display its symbols.

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH, LIST_ENTRIES_FOR_TREE, GET_FS_ROOT } from '@/queries'

const NTOSKRNL_PATH = '/Windows/System32/ntoskrnl.exe'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

const blob_hash = ref(null)

onMounted(async () => {
  // get the root of the filesystem
  let response = await gqlClient.query({
    query: GET_FS_ROOT,
    variables: { where: { hash: props.os_hash } }
  })
  const fs_root = response.data['commits'][0]['filesystemConnection']['edges'][0]['node']['hash']
  // traverse fs root to locate /Windows/System32/ntoskrnl.exe
  response = await gqlClient.query({
    query: TRAVERSE_PATH,
    variables: { tree_hash: fs_root, path: NTOSKRNL_PATH }
  })
  const ntos_hash = response.data['traversePath']
  blob_hash.value = ntos_hash
  console.log('ntos_hash', ntos_hash)
})
</script>

<template>
  <div>
    <h1>PDB Explorer for {{ blob_hash }}</h1>
  </div>
</template>

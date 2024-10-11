This component is used to display the PDB Explorer. The PDBExplorer component is inialized with the
following props - the commit hash It can also received a blob_hash prop, which will have been
clicked from the filesystem view By default, it should explore the commit hash filesystem, and try
to locate /Windows/System32/ntoskrnl.exe and display its symbols.

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH, GET_FS_ROOT } from '@/queries'
import { BTabs, BTab, BCard, BRow, BCol } from 'bootstrap-vue-next'
import SymbolView from '@/components/pdb/SymbolView.vue'
import StructView from '@/components/pdb/StructView.vue'

const NTOSKRNL_PATH = '/Windows/System32/ntoskrnl.exe'

const props = defineProps({
  os_hash: {
    type: String,
    required: true
  }
})

const blob_name = ref('ntoskrnl.exe')
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
    variables: { parent_label: 'Tree', tree_hash: fs_root, path: NTOSKRNL_PATH }
  })
  const ntos_hash = response.data['traversePath']
  blob_hash.value = ntos_hash
})
</script>

<template>
  <div class="container">
    <BRow>
      <BCol cols="4">
        <BCard :title="blob_name"></BCard>
      </BCol>
    </BRow>
    <BTabs content-class="mt-3" v-if="blob_hash">
      <BTab title="Structs">
        <StructView :blob_hash="blob_hash" />
      </BTab>
      <BTab title="Symbols">
        <SymbolView :blob_hash="blob_hash" />
      </BTab>
    </BTabs>
  </div>
</template>

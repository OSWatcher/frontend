This component is used to display the PDB Explorer. The PDBExplorer component is inialized with the
following props - the commit hash It can also received a blob_hash prop, which will have been
clicked from the filesystem view By default, it should explore the commit hash filesystem, and try
to locate /Windows/System32/ntoskrnl.exe and display its symbols.

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { PropType } from 'vue'
import gqlClient from '@/graphql-client'
import { BTabs, BTab, BCard, BRow, BCol } from 'bootstrap-vue-next'
import SymbolDiffView from '@/components/diff/pdb/SymbolDiffView.vue'
import type { HashDiff } from '@/types'
import { fetchFSRootCommitDiff } from '@/utils'
import { TraversePathDocument } from '@/graphql-types'
import type { TraversePathQuery, TraversePathQueryVariables } from '@/graphql-types'

const NTOSKRNL_PATH = '/Windows/System32/ntoskrnl.exe'

const props = defineProps({
  commitHashDiff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

const ntos_hashdiff = ref<HashDiff | null>(null)

const blob_name = ref('ntoskrnl.exe')

onMounted(async () => {
  try {
    const fs_root_diff = await fetchFSRootCommitDiff(props.commitHashDiff)
    // Traverse fs root to locate /Windows/System32/ntoskrnl.exe for both commits
    const [baseNtosResponse, diffeeNtosResponse] = await Promise.all([
      gqlClient.query<TraversePathQuery, TraversePathQueryVariables>({
        query: TraversePathDocument,
        variables: {
          parent_label: 'Tree',
          tree_hash: fs_root_diff.base_hash!,
          path: NTOSKRNL_PATH
        }
      }),
      gqlClient.query<TraversePathQuery, TraversePathQueryVariables>({
        query: TraversePathDocument,
        variables: {
          parent_label: 'Tree',
          tree_hash: fs_root_diff.diffee_hash!,
          path: NTOSKRNL_PATH
        }
      })
    ])

    ntos_hashdiff.value = {
      base_hash: baseNtosResponse.data.traversePath!,
      diffee_hash: diffeeNtosResponse.data.traversePath!,
      label: 'Blob'
    }
  } catch (error) {
    console.error('Error fetching commit details', error)
  }
})
</script>

<template>
  <div class="container">
    <BRow>
      <BCol cols="4">
        <BCard :title="blob_name"></BCard>
      </BCol>
    </BRow>
    <BTabs content-class="mt-3" v-if="ntos_hashdiff">
      <BTab title="Symbols">
        <SymbolDiffView :blob_hash_diff="ntos_hashdiff" />
      </BTab>
    </BTabs>
  </div>
</template>

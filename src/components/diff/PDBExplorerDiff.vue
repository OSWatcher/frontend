This component is used to display the PDB Explorer. The PDBExplorer component is inialized with the
following props - the commit hash It can also received a blob_hash prop, which will have been
clicked from the filesystem view By default, it should explore the commit hash filesystem, and try
to locate /Windows/System32/ntoskrnl.exe and display its symbols.

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH, GET_FS_ROOT } from '@/queries'
import { BTabs, BTab, BCard, BRow, BCol } from 'bootstrap-vue-next'
import SymbolDiffView from '@/components/diff/pdb/SymbolDiffView.vue'

const NTOSKRNL_PATH = '/Windows/System32/ntoskrnl.exe'

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
    fs_root_hash: undefined,
    ntos_hash: undefined
})
const diffee_commit = ref({
    hash: props.diffee_commit,
    fs_root_hash: undefined,
    ntos_hash: undefined
})

const blob_name = ref('ntoskrnl.exe')
const blob_hash = ref(null)

onMounted(async () => {
    try {
        let response = await gqlClient.query({
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

        // Traverse fs root to locate /Windows/System32/ntoskrnl.exe for both commits
        const baseNtosResponse = await gqlClient.query({
            query: TRAVERSE_PATH,
            variables: { parent_label: 'Tree', tree_hash: base_commit.value.fs_root_hash, path: NTOSKRNL_PATH }
        })
        const diffeeNtosResponse = await gqlClient.query({
            query: TRAVERSE_PATH,
            variables: { parent_label: 'Tree', tree_hash: diffee_commit.value.fs_root_hash, path: NTOSKRNL_PATH }
        })

        base_commit.value.ntos_hash = baseNtosResponse.data['traversePath']
        diffee_commit.value.ntos_hash = diffeeNtosResponse.data['traversePath']

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
        <BTabs content-class="mt-3" v-if="base_commit.ntos_hash && diffee_commit.ntos_hash">
            <BTab title="Symbols">
                <SymbolDiffView :base_blob_hash="base_commit.ntos_hash" :diffee_blob_hash="diffee_commit.ntos_hash" />
            </BTab>
        </BTabs>
    </div>
</template>

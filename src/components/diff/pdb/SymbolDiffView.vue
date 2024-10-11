<script setup lang="ts">
import { defineProps, ref, watch, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { DIFF_NODES } from '@/queries'
import { BTable, BPagination } from 'bootstrap-vue-next'
import type { TableFieldRaw, TableItem } from 'bootstrap-vue-next'

const props = defineProps({
    base_blob_hash: {
        type: String,
        required: true
    },
    diffee_blob_hash: {
        type: String,
        required: true
    }
})

onMounted(async () => {
    try {
        const response = await gqlClient.query({
            query: DIFF_NODES, // Use the updated DIFF_NODES query
            variables: {
                parentLabel: 'Blob', // Set the parent label
                baseNodeHash: props.base_blob_hash, // Use fs_root_hash instead of commit hash
                diffeeNodeHash: props.diffee_blob_hash, // Use fs_root_hash instead of commit hash
                atPath: '/', // Path to diff
                maxDepth: 0, // Max depth for the diff
                filter: ['Symbol'] // Filter criteria (empty for now)
            },
            // disable caching for this query
            // Apollo Client cache is very slow
            fetchPolicy: 'no-cache',
            errorPolicy: 'all'
        })
        console.log(response)
    } catch (error) {
        console.error('Error fetching commit details', error)
    }
})
</script>


<template>
    <div>Hello</div>
</template>
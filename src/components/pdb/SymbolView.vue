<script setup lang="ts">
import { defineProps, ref, onMounted } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_SYMBOLS } from '@/queries'
import { BTable, BPagination, BSpinner } from 'bootstrap-vue-next'

const props = defineProps({
  blob_hash: {
    type: String,
    required: true
  }
})
const isLoading = ref(false)
const symbols = ref([])
const fields = ref([
  { key: 'name', sortable: true },
  { key: 'address', sortable: true }
])
const perPage = ref(20)
const currentPage = ref(1)
const sortDesc = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const response = await gqlClient.query({
      query: LIST_SYMBOLS,
      variables: { where: { hash: props.blob_hash } }
    })
    if (response.data && response.data.blobs.length > 0) {
      // Assuming blobs is an array and has_symbolConnection contains the needed data
      symbols.value = response.data.blobs[0].has_symbolConnection.edges.map((edge) => ({
        name: edge.node.name,
        address: edge.properties.address
      }))
      // Sort by name or address as needed
      symbols.value.sort((a, b) => a.name.localeCompare(b.name))
    }
  } catch (error) {
    console.error('Error fetching symbols:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="container mt-3">
    <BSpinner v-if="isLoading"></BSpinner>
    <BTable
      v-if="symbols && symbols.length"
      :items="symbols"
      :fields="fields"
      :per-page="perPage"
      :current-page="currentPage"
      v-model:sort-desc="sortDesc"
      responsive="sm"
    >
    </BTable>
    <BPagination
      v-model="currentPage"
      :total-rows="symbols.length"
      :per-page="perPage"
      aria-controls="my-table"
    ></BPagination>
  </div>
</template>

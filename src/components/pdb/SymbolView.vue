<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_SYMBOLS } from '@/queries'
import { BTable, BPagination } from 'bootstrap-vue-next'

const props = defineProps({
  blob_hash: {
    type: String,
    required: true
  }
})
const symbols = ref([])
// BTable fields
const fields = ref([
  { key: 'name', sortable: true },
  { key: 'address', sortable: false }
])
// BTable pagination
const isLoading = ref(false)
const perPage = ref(50)
const currentPage = ref(1)
const totalSymbols = ref(0)

// Fetch symbols based on current page
async function fetchSymbols() {
  isLoading.value = true
  const offset = (currentPage.value - 1) * perPage.value
  try {
    const response = await gqlClient.query({
      query: LIST_SYMBOLS,
      variables: {
        options: {
          limit: perPage.value,
          offset: offset,
          sort: { name: 'ASC' }
        },
        where: {
          blob: {
            hash: props.blob_hash
          }
        },
        blobConnectionWhere2: {
          node: {
            hash: props.blob_hash
          }
        },
        symbolsAggregateWhere2: {
          blob: {
            hash: props.blob_hash
          }
        }
      }
    })
    if (response.data) {
      totalSymbols.value = response.data.symbolsAggregate.count
      symbols.value = response.data.symbols.map((symbol) => ({
        name: symbol.name,
        address: symbol.blobConnection.edges[0]?.properties.address || 'No address found'
      }))
    }
  } catch (error) {
    console.error('Error fetching symbols:', error)
  } finally {
    isLoading.value = false
  }
}

// React to page changes
watch(currentPage, fetchSymbols, { immediate: true })
</script>

<template>
  <div class="container mt-3 position-relative">
    <BTable
      :items="symbols"
      :fields="fields"
      responsive="sm"
      class="mb-3"
      :busy="isLoading"
    ></BTable>
    <BPagination v-model="currentPage" :total-rows="totalSymbols" :per-page="perPage"></BPagination>
  </div>
</template>

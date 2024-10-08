<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_SYMBOLS } from '@/queries'
import { BTable, BPagination } from 'bootstrap-vue-next'
import type { TableFieldRaw, TableItem } from 'bootstrap-vue-next'

const props = defineProps({
  blob_hash: {
    type: String,
    required: true
  }
})

// Define the data structure for symbols
interface Symbol {
  name: string
  address: string
}

const symbols = ref<TableItem<Symbol>[]>([])
// BTable fields
const fields = ref<Exclude<TableFieldRaw<Symbol>, string>[]>([
  { key: 'name', sortable: false },
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
          offset: offset
        },
        blobHash: props.blob_hash,
        where: {
          blob: {
            hash: props.blob_hash
          }
        }
      }
    })
    if (response.data) {
      totalSymbols.value = response.data.symbolsAggregate.count
      symbols.value = response.data.fetchSymbols.map((symbol: any) => ({
        name: symbol.name,
        address: `0x${parseInt(symbol.address).toString(16).toUpperCase()}`
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
    <BPagination v-model="currentPage" :total-rows="totalSymbols" :per-page="perPage"></BPagination>
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

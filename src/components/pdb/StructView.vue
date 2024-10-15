<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { BTable, BPagination, BButton, BCard } from 'bootstrap-vue-next'
import type { TableFieldRaw, TableItem } from 'bootstrap-vue-next'
import {
  FetchStructsDocument,
  FetchStructsQuery,
  FetchStructsQueryVariables,
  WinStructFetchResult
} from '@/graphql-types'

const props = defineProps({
  blob_hash: {
    type: String,
    required: true
  }
})

const structs = ref<TableItem<WinStructFetchResult>[]>([])
// BTable fields
const fields = ref<Exclude<TableFieldRaw<WinStructFetchResult>, string>[]>([
  { key: 'name', sortable: false },
  { key: 'kind', sortable: false },
  { key: 'size', sortable: false }
])

// BTable pagination
const isLoading = ref(false)
const perPage = ref(50)
const currentPage = ref(1)
const totalStructs = ref(0)

// Fetch symbols based on current page
async function fetchStructs() {
  isLoading.value = true
  const offset = (currentPage.value - 1) * perPage.value
  try {
    const response = await gqlClient.query<FetchStructsQuery, FetchStructsQueryVariables>({
      query: FetchStructsDocument,
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
      totalStructs.value = response.data.winStructsAggregate?.count ?? 0
      structs.value = (response.data.fetchStructs ?? []).map((struct) => ({
        ...struct,
        fields:
          struct.fields?.map((field) => ({
            name: field.name,
            offset: field.offset,
            data_type: field.data_type ?? {}
          })) ?? []
      }))
    }
  } catch (error) {
    console.error('Error fetching structs:', error)
  } finally {
    isLoading.value = false
  }
}

// React to page changes
watch(currentPage, fetchStructs, { immediate: true })

// Add this method in the <script setup> section
function formatOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase()}`
}
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-3">
    <BPagination
      v-model="currentPage"
      :total-rows="totalStructs"
      :per-page="perPage"
      aria-controls="my-table"
    >
    </BPagination>
    <h3>
      {{ totalStructs }}
    </h3>
  </div>
  <div class="container mt-3">
    <BTable :items="structs" :fields="fields" responsive :busy="isLoading">
      <!-- Scoped slot for the 'name' field including the toggle button -->
      <template #cell(name)="row">
        <b-button
          @click="row.toggleDetails"
          class="me-2"
          :variant="row.detailsShowing ? 'outline-secondary' : 'outline-success'"
          size="sm"
        >
          <i :class="row.detailsShowing ? 'bi-three-dots' : 'bi-plus-lg'"></i>
        </b-button>
        {{ row.item.name }}
      </template>

      <template #row-details="data">
        <BCard>
          <!-- If the struct is an enum -->
          <BT
            }
            able
            v-if="data.item.kind === 'Enum'"
            :items="data.item.fields"
            :fields="[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'offset', label: 'Value', sortable: true }
            ]"
            :sort-by="[{ key: 'offset', order: 'asc' }]"
            small
          />

          <!-- If the struct is not an enum -->
          <BTable
            v-else
            :items="data.item.fields"
            :fields="[
              {
                key: 'offset',
                label: 'Offset',
                sortable: true,
                formatter: (value) => formatOffset(value)
              },
              { key: 'name', label: 'Name', sortable: true },
              { key: 'type', label: 'Type', sortable: false }
            ]"
            :sort-by="[{ key: 'offset', order: 'asc' }]"
            small
          />
        </BCard>
      </template>
    </BTable>
    <BPagination
      v-model="currentPage"
      :total-rows="totalStructs"
      :per-page="perPage"
      aria-controls="my-table"
    >
    </BPagination>
  </div>
</template>

<style>
.b-button {
  padding: 0;
  border: none;
  background: none;
}
</style>

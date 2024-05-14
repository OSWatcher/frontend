<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'
import gqlClient from '@/graphql-client'
import { LIST_WINSTRUCT } from '@/queries'
import { BTable, BPagination, BButton, BCard } from 'bootstrap-vue-next'

const props = defineProps({
  blob_hash: {
    type: String,
    required: true
  }
})
const structs = ref([])
// BTable fields
const fields = ref([
  { key: 'name', sortable: true },
  { key: 'kind', sortable: true },
  { key: 'size', sortable: true }
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
    const response = await gqlClient.query({
      query: LIST_WINSTRUCT,
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
        }
      }
    })
    if (response.data) {
      totalStructs.value = response.data.winStructsAggregate.count
      structs.value = response.data.winStructs.map((struct) => ({
        ...struct,
        fields: struct.fields.map((field) => ({
          name: field.name,
          offset: field.offset,
          type: field.type.name || 'Unknown'
        }))
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
</script>

<template>
  <div class="container mt-3">
    <b-table :items="structs" :fields="fields" responsive :busy="isLoading">
      <!-- Scoped slot for the 'name' field including the toggle button -->
      <template #cell(name)="row">
        <b-button @click="row.toggleDetails" class="me-2" :variant="row.detailsShowing ? 'outline-secondary' : 'outline-success'" size="sm">
          <i :class="row.detailsShowing ? 'bi-three-dots' : 'bi-plus-lg'"></i>
        </b-button>
        {{ row.item.name }}
      </template>

      <template #row-details="data">
        <BCard>
          <!-- If the struct is an enum -->
          <BTable v-if="data.item.kind === 'Enum'"
            :items="data.item.fields"
            :fields="[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'offset', label: 'Value', sortable: true }
            ]"
            :sort-by="[{ key: 'name', order: 'asc' }]"
            small
          />

          <!-- If the struct is not an enum -->
          <BTable v-else
            :items="data.item.fields"
            :fields="[
              { key: 'offset', label: 'Offset', sortable: true },
              { key: 'name', label: 'Name', sortable: true },
              { key: 'type', label: 'Type', sortable: false }
            ]"
            :sort-by="[{ key: 'offset', order: 'asc' }]"
            small
          />
        </BCard>
      </template>
    </b-table>
    <b-pagination
      v-model="currentPage"
      :total-rows="totalStructs"
      :per-page="perPage"
      aria-controls="my-table"
    ></b-pagination>
  </div>
</template>

<style>
.b-button {
  padding: 0;
  border: none;
  background: none;
}
</style>

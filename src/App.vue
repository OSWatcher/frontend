<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import {
  BNavbar,
  BNavbarBrand,
  vBColorMode,
  BNavForm,
  BFormInput,
  BButton,
  BModal,
  BForm,
  BTable,
  BPagination,
  type TableFieldRaw
} from 'bootstrap-vue-next'
import gqlClient from '@/graphql-client'
import { SEARCH_FS } from '@/queries'

interface SearchResult {
  commit_name: string
  path: string
}

const fields = ref<Exclude<TableFieldRaw<SearchResult>, string>[]>([
  { key: 'commit_name', sortable: true },
  { key: 'path', sortable: true }
])

const showModal = ref(false)
const search_term = ref('')
const search_results = ref([])
const currentPage = ref(1)
const perPage = ref(20)
const isLoading = ref(false)

const handleShortcut = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'k') {
    event.preventDefault()
    showModal.value = true
  }
}

const performSearch = async () => {
  isLoading.value = true
  try {
    const response = await gqlClient.query({
      query: SEARCH_FS,
      variables: { searchTerm: search_term.value }
    })
    search_results.value = response.data.search
    currentPage.value = 1 // Reset to first page on new search
    console.log('Search results:', search_results.value)
  } catch (error) {
    console.error('Error searching the database:', error)
  } finally {
    console.log('Search complete')
    isLoading.value = false
  }
}

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  const end = start + perPage.value
  return search_results.value.slice(start, end)
})

const clearSearchResults = () => {
  search_results.value = []
  search_term.value = ''
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)
})

const openModal = () => {
  showModal.value = true
}
</script>

<template>
  <BNavbar toggleable="lg" v-b-color-mode="'dark'">
    <div class="container">
      <BNavbarBrand to="/">
        <img src="@/assets/logo.png" alt="OSWatcher logo" />
      </BNavbarBrand>
      <BNavForm class="d-flex">
        <BButton @click="openModal" variant="outline-light">
          Search
          <kbd class="ms-2">Ctrl K</kbd>
        </BButton>
      </BNavForm>
    </div>
  </BNavbar>
  <BModal v-model="showModal" @hidden="clearSearchResults" size="xl">
    <template #modal-title>
      <span>Search</span>
    </template>
    <BForm @submit="performSearch">
      <BFormInput v-model="search_term" placeholder="Search and press ENTER" autofocus></BFormInput>
    </BForm>
    <BPagination
      v-if="search_results.length"
      v-model="currentPage"
      :total-rows="search_results.length"
      :per-page="perPage"
      aria-controls="search-results-table"
      class="my-2"
    />
    <BTable
      v-if="search_results.length"
      :items="paginatedResults"
      :fields="fields"
      :busy="isLoading"
      striped
      hover
    />
    <BPagination
      v-if="search_results.length"
      v-model="currentPage"
      :total-rows="search_results.length"
      :per-page="perPage"
      aria-controls="search-results-table"
      class="my-2"
    />
  </BModal>
  <RouterView />
</template>

<style scoped>
.navbar {
  background-color: #3b4a6b;
}

.navbar-brand img {
  width: 13.3rem;
}
</style>

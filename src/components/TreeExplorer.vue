<script setup lang="ts">
import { ref, watch, defineProps } from 'vue'
import { BTable, BPagination } from 'bootstrap-vue-next'
import TreeNodeType from '@/types'
import path from 'path'

const props = defineProps({
  getEntries: {
    type: Function, // Function to fetch entries from an API
    required: true
  },
  fields: {
    type: Array,
    required: true
  },
  // which field to use as the name of the entry
  // to handle how to enter into a directory
  field_path: {
    type: String,
    default: 'name'
  },
  // which field defines the type of the entry (Blob or Tree)
  field_type: {
    type: String,
    default: 'type'
  },
  path_dir: {
    type: String,
    default: '/'
  },
  filename_highlight: {
    type: String,
    default: null
  }
})

// we need to keep a local copy of the path_dir prop for own our navigation
const path_dir = ref(props.path_dir)
// table entries
const items = ref([])
// breacrumb items
const pathItems = ref([])
// busy state
const isLoading = ref(false)
// pagination
const perPage = ref(50)
const currentPage = ref(1)

// add a watcher to the path_dir prop
watch(
  () => props.path_dir,
  (newValue) => {
    path_dir.value = newValue
  },
  { immediate: true }
)

// Watch for pathParts changes
watch(
  path_dir,
  async (new_path_dir) => {
    isLoading.value = true // Set loading to true when data fetch starts
    try {
      items.value = await props.getEntries(new_path_dir)
      pathItems.value = buildBreadcrumb(new_path_dir)
      // TODO: if filename_highlight is not null, we should highlight it in the UI
    } finally {
      isLoading.value = false // Set loading to false when data fetch completes
    }
  },
  { immediate: true }
)

function buildBreadcrumb(newFsPath: string) {
  const normalizedPath = path.normalize(newFsPath)

  // Split the normalized path into parts
  const parts = normalizedPath.split(path.sep)

  return parts.map((part: string, index: number) => ({
    part: index === 0 && part === '' ? 'Root' : part,
    active: index === parts.length - 1,
    disabled: index === parts.length - 1
  }))
}

function enterDirectory(item) {
  if (item[props.field_type] === TreeNodeType.Tree)
    path_dir.value = path.join(path_dir.value, item[props.field_path])
}

function handleBreadcrumbClick(index: number) {
  // If the clicked index is 0, set the path to the root directory
  if (index === 0) {
    path_dir.value = '/'
  } else {
    // Slice the pathItems array to get the parts up to the clicked index (excluding the root)
    let newPathParts = pathItems.value.slice(1, index + 1).map((item) => item.part)

    // Join the parts with '/' and set the path, ensuring a leading slash
    path_dir.value = `/${newPathParts.join('/')}`
  }
}
</script>

<template>
  <div>
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li
          v-for="(entry, index) in pathItems"
          :key="index"
          :class="['breadcrumb-item', { active: entry.active }]"
        >
          <a href="#" v-if="!entry.active" @click.prevent="handleBreadcrumbClick(index)">
            {{ entry.part }}
          </a>
          <span v-else>{{ entry.part }}</span>
        </li>
      </ol>
    </nav>

    <BPagination
      v-if="items.length > perPage"
      v-model="currentPage"
      :total-rows="items.length"
      :per-page="perPage"
      align="center"
      class="mb-3"
    />
    <BTable
      :busy="isLoading"
      :items="items"
      :fields="props.fields"
      :current-page="currentPage"
      :per-page="perPage"
      :selectable="true"
      :noSelectOnClick="true"
      @row-clicked="enterDirectory"
    >
      <template v-for="field in props.fields" #[`cell(${field.key})`]="data">
        <!-- Define a scoped slot for each field's key -->
        <slot :name="`cell(${field.key})`" :data="data"> </slot>
      </template>
    </BTable>
  </div>
</template>

<style>
.nav-tabs {
  margin-bottom: 1rem;
}
</style>

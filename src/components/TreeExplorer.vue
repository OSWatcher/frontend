<script setup lang="ts">
import { ref, watch, defineProps, PropType } from 'vue'
import {
  BTable,
  BDropdown,
  BDropdownItem,
  BSpinner,
  TableItem,
  TableField
} from 'bootstrap-vue-next'
import TreeNodeType, { treeNodeTypeToString } from '@/types'
import path from 'path'

const props = defineProps({
  getEntries: {
    type: Function as PropType<
      (
        path: string,
        maxDepth?: number | null,
        pagination?: Pagination
      ) => Promise<{ items: TableItem[]; total_count: number }>
    >,
    required: true
  },
  fields: {
    type: Array as PropType<TableField[]>,
    required: true
  },
  // which field to use as the name of the entry
  // to handle how to enter into a directory
  field_path: {
    type: String as PropType<string>,
    default: 'name'
  },
  // which field defines the type of the entry (Blob or Tree)
  field_type: {
    type: String as PropType<string>,
    default: 'type'
  },
  path_dir: {
    type: String as PropType<string>,
    default: '/'
  },
  filename_highlight: {
    type: String as PropType<string | null>,
    default: null
  },
  export_max_depth_available: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  paginate: {
    type: Boolean as PropType<boolean>,
    default: false
  }
})

export interface Pagination {
  currentPage: number
  totalItems: number
  limit: number
}

// we need to keep a local copy of the path_dir prop for own our navigation
const path_dir = ref(props.path_dir)
// table entries
const items = ref<TableItem[]>([])
// breacrumb items
const pathItems = ref([])
// busy state
const isLoading = ref(false)
// isExporting
const isExporting = ref(false)
// pagination
const pagination = ref<Pagination>({
  currentPage: 1,
  totalItems: 0,
  limit: props.paginate ? 100 : 0
})

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
      const resp = await props.getEntries(new_path_dir, 0, pagination.value)
      pagination.value.totalItems = resp.total_count
      items.value = resp.items
      // sort
      items.value = sortTreeThenName(items.value)
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

function sortTreeThenName(entries) {
  return entries.sort((a, b) => {
    // First compare by type
    if (a[props.field_type] !== b[props.field_type]) {
      return a[props.field_type] === TreeNodeType.Tree ? -1 : 1
    }
    // Then compare by name
    return a[props.field_path].localeCompare(b[props.field_path])
  })
}

async function prepareExport(max_depth: number | null = 0) {
  isExporting.value = true
  try {
    const resp = await props.getEntries(path_dir.value, max_depth)
    const entries = resp.items
    const keysToRemove = ['__typename', '_rowVariant', '_cellVariants', '_showDetails']

    // Custom replacer function
    const replacer = (key: string, value: any): any => {
      if (keysToRemove.includes(key)) {
        return undefined
      }
      if (value in TreeNodeType) {
        return treeNodeTypeToString(value)
      }
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map((item) =>
            typeof item === 'object'
              ? Object.fromEntries(Object.entries(item).filter(([k]) => !keysToRemove.includes(k)))
              : item
          )
        }
        return Object.fromEntries(Object.entries(value).filter(([k]) => !keysToRemove.includes(k)))
      }
      return value
    }

    const jsonData = JSON.stringify(entries, replacer, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })

    // Create a temporary URL for the Blob
    const url = window.URL.createObjectURL(blob)

    // Create a temporary anchor element
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `entries_json`)

    // Append to the document, trigger click, and clean up
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Release the object URL
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error preparing export:', error)
    // Add user-facing error handling here if needed
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
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
      <BDropdown right text="Export" variant="primary" :disabled="isExporting">
        <template #button-content>
          <BSpinner small v-if="isExporting" class="me-2"></BSpinner>
          Export
        </template>
        <BDropdownItem @click="prepareExport(0)">Current Level</BDropdownItem>
        <BDropdownItem v-if="export_max_depth_available" @click="prepareExport(null)"
          >Full Export</BDropdownItem
        >
      </BDropdown>
    </div>

    <BTable
      :busy="isLoading"
      :items="items"
      :fields="props.fields"
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

.breadcrumb {
  margin-bottom: 0;
}
</style>

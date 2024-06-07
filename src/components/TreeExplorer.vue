<script setup lang="ts">
import { ref, watch, defineProps } from 'vue'
import { BSpinner } from 'bootstrap-vue-next'
import path from 'path'

const props = defineProps({
  getEntries: {
    type: Function, // Function to fetch entries from an API
    required: true
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
const pathItems = ref([])
const folderEntries = ref([])
const fileEntries = ref([])
const isLoading = ref(false) // Loading state to control spinner visibility

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
      const { folders, files } = await props.getEntries(new_path_dir)
      folderEntries.value = folders
      fileEntries.value = files
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

function handleEntryClick(entry) {
  path_dir.value = path.join(path_dir.value, entry.name)
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

    <div id="tree-explorer" class="list-group">
      <!-- Show spinner when data is loading -->
      <BSpinner
        v-if="isLoading"
        type="border"
        small
        class="position-absolute"
        style="top: 50%; left: 50%; transform: translate(-50%, -50%)"
      >
      </BSpinner>
      <!-- Conditional rendering based on loading state -->
      <template v-if="!isLoading">
        <slot :entries="folderEntries" :onEntryClick="handleEntryClick"></slot>
        <slot name="file" :entries="fileEntries"></slot>
      </template>
    </div>
  </div>
</template>

<style>
.tree-explorer {
  position: relative;
}

.spinner-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.nav-tabs {
  margin-bottom: 1rem;
}
</style>

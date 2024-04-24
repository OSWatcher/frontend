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
      <slot :entries="folderEntries" :onEntryClick="handleEntryClick"></slot>
      <slot name="file" :entries="fileEntries"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, defineProps } from 'vue'

const props = defineProps({
  initialPath: String,
  getEntries: Function // Function to fetch entries from an API
})

const path = ref(props.initialPath)
const pathItems = ref([])
const folderEntries = ref([])
const fileEntries = ref([])

// Watch for path changes and fetch new data
watch(
  path,
  async (newPath) => {
    const { folders, files } = await props.getEntries(newPath)
    folderEntries.value = folders
    fileEntries.value = files
    pathItems.value = buildBreadcrumb(newPath)
  },
  { immediate: true }
)

function buildBreadcrumb(newFsPath) {
  let parts = newFsPath === '/' ? [''] : newFsPath.split('/')
  return parts.map((part, index) => ({
    part: index === 0 ? 'Root' : part,
    active: index === parts.length - 1,
    disabled: index === parts.length - 1
  }))
}

function handleEntryClick(entry) {
  if (path.value === '/') path.value += entry.name
  else path.value += '/' + entry.name
}

function handleBreadcrumbClick(index) {
  if (index === 0) {
    path.value = '/'
  } else {
    let newPathParts = pathItems.value.slice(1, index + 1).map((item) => item.part)
    path.value = `/${newPathParts.join('/')}`
  }
}
</script>

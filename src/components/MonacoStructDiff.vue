<script setup lang="ts">
import { computed } from 'vue'
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor'
import type { editor } from 'monaco-editor'

import type { StructDiffEntry } from '@/types/pdb'
import { generateStructText } from '@/utils/structFormatter'

const props = defineProps<{
  struct: StructDiffEntry
}>()

// Monaco editor height calculation constants
const MIN_EDITOR_HEIGHT = 100 // Minimum height in pixels
const MAX_EDITOR_HEIGHT = 500 // Maximum height in pixels
const LINE_HEIGHT = 20 // Approximate height per line in pixels
const EDITOR_PADDING = 40 // Top/bottom padding in pixels

// Handle Monaco mount
function onMount(editorInstance: editor.IStandaloneDiffEditor) {
  // Force layout refresh after mount to ensure proper rendering
  setTimeout(() => {
    editorInstance.layout()
  }, 100)
}

// Generate the "before" version (base commit)
const originalCode = computed(() => {
  if (!props.struct.fields) {
    return `/* Struct ${props.struct.name}: fields not loaded */`
  }
  // For NEW structs, show placeholder comment
  if (props.struct.status === 'NEW') {
    return `/* Struct ${props.struct.name} did not exist in base commit */`
  }
  return generateStructText(
    props.struct.name,
    props.struct.baseSize ?? 0,
    props.struct.fields,
    'base'
  )
})

// Generate the "after" version (diffee commit)
const modifiedCode = computed(() => {
  if (!props.struct.fields) {
    return `/* Struct ${props.struct.name}: fields not loaded */`
  }
  // For DEL structs, show placeholder comment
  if (props.struct.status === 'DEL') {
    return `/* Struct ${props.struct.name} was deleted in diffee commit */`
  }
  return generateStructText(
    props.struct.name,
    props.struct.diffeeSize ?? 0,
    props.struct.fields,
    'diffee'
  )
})

// Memoize line counts to avoid repeated string splitting
const lineCountOriginal = computed(() => originalCode.value.split('\n').length)
const lineCountModified = computed(() => modifiedCode.value.split('\n').length)

// Calculate dynamic height based on number of lines
const editorHeight = computed(() => {
  const lineCount = Math.max(lineCountOriginal.value, lineCountModified.value)
  const calculatedHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING
  return Math.max(MIN_EDITOR_HEIGHT, Math.min(MAX_EDITOR_HEIGHT, calculatedHeight))
})

// Monaco editor options for side-by-side diff view
const editorOptions = {
  readOnly: true,
  renderSideBySide: true, // Side-by-side diff (easier to see)
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 13,
  fontFamily: 'Fira Code, Consolas, monospace',
  padding: { top: 8, bottom: 8 },
  renderOverviewRuler: false,
  enableSplitViewResizing: false
}
</script>

<template>
  <div class="monaco-struct-diff">
    <div v-if="!struct.fields" class="monaco-loading">Loading struct fields...</div>
    <div v-else-if="struct.fields.length === 0" class="monaco-empty">No fields in this struct</div>
    <div v-else>
      <div class="monaco-editor-container" :style="{ height: editorHeight + 'px' }">
        <VueMonacoDiffEditor
          :original="originalCode"
          :modified="modifiedCode"
          language="c"
          :options="editorOptions"
          theme="vs-dark"
          height="100%"
          width="100%"
          @mount="onMount"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.monaco-struct-diff {
  width: 100%;
  min-height: 100px;
}

.monaco-editor-container {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  min-height: 150px;
  background: white;
}

.monaco-loading,
.monaco-empty {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}
</style>

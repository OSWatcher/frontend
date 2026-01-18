<script setup lang="ts">
import { computed } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import type { editor } from 'monaco-editor'

import type { StructEntry } from '@/types/pdb'
import { generateStructTextSingle } from '@/utils/structFormatter'

const props = defineProps<{
  struct: StructEntry
}>()

// Monaco editor height calculation constants
const MIN_EDITOR_HEIGHT = 100 // Minimum height in pixels
const MAX_EDITOR_HEIGHT = 500 // Maximum height in pixels
const LINE_HEIGHT = 20 // Approximate height per line in pixels
const EDITOR_PADDING = 40 // Top/bottom padding in pixels

// Handle Monaco mount
function onMount(editorInstance: editor.IStandaloneCodeEditor) {
  // Force layout refresh after mount to ensure proper rendering
  setTimeout(() => {
    editorInstance.layout()
  }, 100)
}

// Generate C struct code
const structCode = computed(() => {
  if (!props.struct.fields) {
    return `/* Struct ${props.struct.name}: fields not loaded */`
  }
  return generateStructTextSingle(props.struct.name, props.struct.size, props.struct.fields)
})

// Memoize line count to avoid repeated string splitting
const lineCount = computed(() => structCode.value.split('\n').length)

// Calculate dynamic height based on number of lines
const editorHeight = computed(() => {
  const calculatedHeight = lineCount.value * LINE_HEIGHT + EDITOR_PADDING
  return Math.max(MIN_EDITOR_HEIGHT, Math.min(MAX_EDITOR_HEIGHT, calculatedHeight))
})

// Monaco editor options for single view
const editorOptions = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 13,
  fontFamily: 'Fira Code, Consolas, monospace',
  padding: { top: 8, bottom: 8 },
  renderOverviewRuler: false
}
</script>

<template>
  <div class="monaco-struct-view">
    <div v-if="!struct.fields" class="monaco-loading">Loading struct fields...</div>
    <div v-else-if="struct.fields.length === 0" class="monaco-empty">No fields in this struct</div>
    <div v-else>
      <div class="monaco-editor-container" :style="{ height: editorHeight + 'px' }">
        <VueMonacoEditor
          :value="structCode"
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
.monaco-struct-view {
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

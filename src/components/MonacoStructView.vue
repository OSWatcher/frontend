<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import type { editor } from 'monaco-editor'

import type { StructEntry } from '@/types/pdb'
import { generateStructRenderModelSingle } from '@/utils/structFormatter'

const props = defineProps<{
  struct: StructEntry
}>()

const emit = defineEmits<{
  openFieldHistory: [payload: { structName: string; fieldPath: string }]
}>()

// Monaco editor height calculation constants
const MIN_EDITOR_HEIGHT = 100 // Minimum height in pixels
const MAX_EDITOR_HEIGHT = 500 // Maximum height in pixels
const LINE_HEIGHT = 20 // Approximate height per line in pixels
const EDITOR_PADDING = 40 // Top/bottom padding in pixels

const editorInstance = shallowRef<editor.IStandaloneCodeEditor | null>(null)
let decorationIds: string[] = []
let mouseDownDisposable: { dispose(): void } | null = null

// Handle Monaco mount
function onMount(editorApi: editor.IStandaloneCodeEditor) {
  editorApi.updateOptions({ glyphMargin: true })
  editorInstance.value = editorApi

  // Force layout refresh after mount to ensure proper rendering
  setTimeout(() => {
    editorApi.layout()
  }, 100)

  applyFieldDecorations()
  mouseDownDisposable = editorApi.onMouseDown((event) => {
    if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      return
    }

    const lineNumber = event.target.position?.lineNumber
    if (!lineNumber) {
      return
    }

    const target = fieldTargetsByLine.value.get(lineNumber)
    if (!target) {
      return
    }

    event.event.preventDefault()
    event.event.stopPropagation()
    emit('openFieldHistory', {
      structName: props.struct.name,
      fieldPath: target.fieldPath
    })
  })
}

const renderModel = computed(() => {
  if (!props.struct.fields) {
    return {
      code: `/* Struct ${props.struct.name}: fields not loaded */`,
      fieldTargets: []
    }
  }
  return generateStructRenderModelSingle(props.struct.name, props.struct.size, props.struct.fields)
})

const fieldTargetsByLine = computed(
  () => new Map(renderModel.value.fieldTargets.map((target) => [target.lineNumber, target]))
)

function applyFieldDecorations() {
  const instance = editorInstance.value
  const model = instance?.getModel()
  if (!instance || !model) {
    return
  }

  decorationIds = instance.deltaDecorations(
    decorationIds,
    renderModel.value.fieldTargets.map((target) => ({
      range: new monaco.Range(target.lineNumber, 1, target.lineNumber, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'git-log-field-glyph',
        glyphMarginHoverMessage: {
          value: `Show history for \`${target.fieldName}\``
        }
      }
    }))
  )
}

watch(renderModel, () => {
  applyFieldDecorations()
})

onBeforeUnmount(() => {
  mouseDownDisposable?.dispose()
  if (editorInstance.value) {
    decorationIds = editorInstance.value.deltaDecorations(decorationIds, [])
  }
})

// Memoize line count to avoid repeated string splitting
const lineCount = computed(() => renderModel.value.code.split('\n').length)

// Calculate dynamic height based on number of lines
const editorHeight = computed(() => {
  const calculatedHeight = lineCount.value * LINE_HEIGHT + EDITOR_PADDING
  return Math.max(MIN_EDITOR_HEIGHT, Math.min(MAX_EDITOR_HEIGHT, calculatedHeight))
})

// Monaco editor options for single view
const editorOptions = {
  readOnly: true,
  glyphMargin: true,
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
          :value="renderModel.code"
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

:deep(.git-log-field-glyph) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10a7 7 0 1 0 2-4.9'/%3E%3Cpath d='M3 3v4h4'/%3E%3Cpath d='M10 6v4l2.5 1.5'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
  background-size: 14px 14px;
  cursor: pointer;
}
</style>

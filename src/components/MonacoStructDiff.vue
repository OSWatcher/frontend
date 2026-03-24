<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import type { editor } from 'monaco-editor'

import type { StructDiffEntry } from '@/types/pdb'
import { generateStructRenderModel } from '@/utils/structFormatter'

const props = defineProps<{
  struct: StructDiffEntry
}>()

const emit = defineEmits<{
  openFieldHistory: [payload: { structName: string; fieldPath: string }]
}>()

// Monaco editor height calculation constants
const MIN_EDITOR_HEIGHT = 100 // Minimum height in pixels
const MAX_EDITOR_HEIGHT = 500 // Maximum height in pixels
const LINE_HEIGHT = 20 // Approximate height per line in pixels
const EDITOR_PADDING = 40 // Top/bottom padding in pixels

const originalEditor = shallowRef<editor.IStandaloneCodeEditor | null>(null)
const modifiedEditor = shallowRef<editor.IStandaloneCodeEditor | null>(null)
let originalDecorationIds: string[] = []
let modifiedDecorationIds: string[] = []
let originalMouseDownDisposable: { dispose(): void } | null = null
let modifiedMouseDownDisposable: { dispose(): void } | null = null

// Handle Monaco mount
function onMount(editorInstance: editor.IStandaloneDiffEditor) {
  originalEditor.value = editorInstance.getOriginalEditor()
  modifiedEditor.value = editorInstance.getModifiedEditor()

  originalEditor.value.updateOptions({ glyphMargin: true })
  modifiedEditor.value.updateOptions({ glyphMargin: true })

  // Force layout refresh after mount to ensure proper rendering
  setTimeout(() => {
    editorInstance.layout()
  }, 100)

  applyOriginalDecorations()
  applyModifiedDecorations()

  originalMouseDownDisposable = originalEditor.value.onMouseDown((event) => {
    handleFieldHistoryClick(event, originalFieldTargetsByLine.value)
  })
  modifiedMouseDownDisposable = modifiedEditor.value.onMouseDown((event) => {
    handleFieldHistoryClick(event, modifiedFieldTargetsByLine.value)
  })
}

// Generate the "before" version (base commit)
const originalRenderModel = computed(() => {
  if (!props.struct.fields) {
    return {
      code: `/* Struct ${props.struct.name}: fields not loaded */`,
      fieldTargets: []
    }
  }
  // For NEW structs, show placeholder comment
  if (props.struct.status === 'NEW') {
    return {
      code: `/* Struct ${props.struct.name} did not exist in base commit */`,
      fieldTargets: []
    }
  }
  return generateStructRenderModel(
    props.struct.name,
    props.struct.baseSize ?? 0,
    props.struct.fields,
    'base'
  )
})

// Generate the "after" version (diffee commit)
const modifiedRenderModel = computed(() => {
  if (!props.struct.fields) {
    return {
      code: `/* Struct ${props.struct.name}: fields not loaded */`,
      fieldTargets: []
    }
  }
  // For DEL structs, show placeholder comment
  if (props.struct.status === 'DEL') {
    return {
      code: `/* Struct ${props.struct.name} was deleted in diffee commit */`,
      fieldTargets: []
    }
  }
  return generateStructRenderModel(
    props.struct.name,
    props.struct.diffeeSize ?? 0,
    props.struct.fields,
    'diffee'
  )
})

const originalFieldTargetsByLine = computed(
  () => new Map(originalRenderModel.value.fieldTargets.map((target) => [target.lineNumber, target]))
)
const modifiedFieldTargetsByLine = computed(
  () => new Map(modifiedRenderModel.value.fieldTargets.map((target) => [target.lineNumber, target]))
)

function handleFieldHistoryClick(
  event: editor.IEditorMouseEvent,
  targetsByLine: Map<number, { fieldPath: string }>
) {
  if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
    return
  }

  const lineNumber = event.target.position?.lineNumber
  if (!lineNumber) {
    return
  }

  const target = targetsByLine.get(lineNumber)
  if (!target) {
    return
  }

  event.event.preventDefault()
  event.event.stopPropagation()
  emit('openFieldHistory', {
    structName: props.struct.name,
    fieldPath: target.fieldPath
  })
}

function applyDecorationsToEditor(
  instance: editor.IStandaloneCodeEditor | null,
  decorationIds: string[],
  fieldTargets: Array<{ lineNumber: number; fieldName: string }>
) {
  const model = instance?.getModel()
  if (!instance || !model) {
    return decorationIds
  }

  return instance.deltaDecorations(
    decorationIds,
    fieldTargets.map((target) => ({
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

function applyOriginalDecorations() {
  originalDecorationIds = applyDecorationsToEditor(
    originalEditor.value,
    originalDecorationIds,
    originalRenderModel.value.fieldTargets
  )
}

function applyModifiedDecorations() {
  modifiedDecorationIds = applyDecorationsToEditor(
    modifiedEditor.value,
    modifiedDecorationIds,
    modifiedRenderModel.value.fieldTargets
  )
}

watch(originalRenderModel, () => {
  applyOriginalDecorations()
})

watch(modifiedRenderModel, () => {
  applyModifiedDecorations()
})

onBeforeUnmount(() => {
  originalMouseDownDisposable?.dispose()
  modifiedMouseDownDisposable?.dispose()
  if (originalEditor.value) {
    originalDecorationIds = originalEditor.value.deltaDecorations(originalDecorationIds, [])
  }
  if (modifiedEditor.value) {
    modifiedDecorationIds = modifiedEditor.value.deltaDecorations(modifiedDecorationIds, [])
  }
})

// Memoize line counts to avoid repeated string splitting
const lineCountOriginal = computed(() => originalRenderModel.value.code.split('\n').length)
const lineCountModified = computed(() => modifiedRenderModel.value.code.split('\n').length)

// Calculate dynamic height based on number of lines
const editorHeight = computed(() => {
  const lineCount = Math.max(lineCountOriginal.value, lineCountModified.value)
  const calculatedHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING
  return Math.max(MIN_EDITOR_HEIGHT, Math.min(MAX_EDITOR_HEIGHT, calculatedHeight))
})

// Monaco editor options for side-by-side diff view
const editorOptions = {
  readOnly: true,
  glyphMargin: true,
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
          :original="originalRenderModel.code"
          :modified="modifiedRenderModel.code"
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

:deep(.git-log-field-glyph) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10a7 7 0 1 0 2-4.9'/%3E%3Cpath d='M3 3v4h4'/%3E%3Cpath d='M10 6v4l2.5 1.5'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
  background-size: 14px 14px;
  cursor: pointer;
}
</style>

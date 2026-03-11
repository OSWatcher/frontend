/**
 * Monaco Editor Setup
 *
 * Configure Monaco to bundle locally via Vite's native worker support.
 * The editor worker is required for diff computation in the diff editor.
 */

import * as monaco from 'monaco-editor'
import { loader } from '@guolao/vue-monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// Configure the editor worker (handles diff computation, word highlighting, etc.)
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

// Use the locally bundled Monaco instance.
loader.config({ monaco })

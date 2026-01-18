/**
 * Monaco Editor Setup
 *
 * Configure Monaco to bundle locally via Vite workers.
 */

import { loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'

// Use the locally bundled Monaco instance.
loader.config({ monaco })

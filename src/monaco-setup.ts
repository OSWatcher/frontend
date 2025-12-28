/**
 * Monaco Editor Setup
 *
 * Configure Monaco to load from CDN (avoids Vite worker bundling issues)
 */

import { loader } from '@guolao/vue-monaco-editor'

// Use CDN - this is the most reliable approach
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
})

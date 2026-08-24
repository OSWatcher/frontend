/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OSWATCHER_API_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

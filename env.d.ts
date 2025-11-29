/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHEOS_API_URI: string
  readonly VITE_GRAPHEORS_OBJECT_STORAGE_URI: string
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string
  readonly VITE_AUTH0_AUDIENCE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

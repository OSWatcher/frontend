const VITE_OBJECT_STORAGE_URL = import.meta.env.VITE_GRAPHEORS_OBJECT_STORAGE_URI

// Generate the download URL for a given hash
function getDownloadUrl(hash: string): string {
  return `${VITE_OBJECT_STORAGE_URL}/objects/${hash}`
}

export { getDownloadUrl }

const VITE_API_URL = import.meta.env.VITE_GRAPHEOS_API_URI

// Generate the download URL for a given hash using the REST API
function getDownloadUrl(hash: string): string {
  return `${VITE_API_URL}/blob/${hash}`
}

export { getDownloadUrl }

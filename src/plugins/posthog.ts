import posthog from 'posthog-js'
import type { App } from 'vue'

export default {
  install: (_app: App) => {
    const apiKey = import.meta.env.VITE_POSTHOG_API_KEY
    const apiUri = import.meta.env.VITE_GRAPHEOS_API_URI
    
    if (!apiKey) {
      throw new Error('VITE_POSTHOG_API_KEY environment variable is not defined')
    }
    if (!apiUri) {
      throw new Error('VITE_GRAPHEOS_API_URI environment variable is not defined')
    }
    
    posthog.init(apiKey, {
      api_host: new URL('events', apiUri).toString()
    })
  }
}

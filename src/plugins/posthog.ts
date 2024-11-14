import posthog from 'posthog-js'
import type { App } from 'vue'

export default {
  install: (_app: App) => {
    posthog.init('REDACTED_POSTHOG_KEY', {
      api_host: new URL('events', import.meta.env.VITE_GRAPHEOS_API_URI).toString()
    })
  }
}

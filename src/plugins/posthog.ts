import posthog from 'posthog-js'
import type { App } from 'vue'

export default {
  install: (_app: App) => {
    posthog.init('phc_LVf2RSEzYw7WlDJJFiUeEW4KxX2ncOFLn2k3WCTof5G', {
      api_host: new URL('events', import.meta.env.VITE_GRAPHEOS_API_URI).toString()
    })
  }
}

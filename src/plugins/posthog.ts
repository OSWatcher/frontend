import posthog from 'posthog-js'
import type { App } from 'vue'

export default {
  install: (_app: App) => {
    posthog.init('REDACTED_POSTHOG_KEY', {
      api_host: 'https://us.i.posthog.com' // or your self-hosted URL
    })
  }
}

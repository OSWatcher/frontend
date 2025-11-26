import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Naive UI
import naive from 'naive-ui'

import App from './App.vue'
import router from './router'
import posthogPlugin from './plugins/posthog'
import { provideApolloClient } from '@vue/apollo-composable'
import gqlClient from './graphql-client'

const app = createApp(App)
const pinia = createPinia()

// Provide Apollo client to the entire app
provideApolloClient(gqlClient)

app.use(pinia)
app.use(naive)
app.use(router)

if (import.meta.env.PROD) {
  app.use(posthogPlugin)
}

app.mount('#app')

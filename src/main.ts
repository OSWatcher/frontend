// Monaco editor setup - MUST be first import before any Monaco components
import './monaco-setup'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Naive UI
import naive from 'naive-ui'

// Auth0
import { createAuth0 } from '@auth0/auth0-vue'

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

// Configure Auth0
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
    authorizationParams: {
      redirect_uri: window.location.origin + import.meta.env.BASE_URL + 'callback',
      audience: import.meta.env.VITE_AUTH0_AUDIENCE || ''
    },
    useRefreshTokens: false,
    cacheLocation: 'localstorage'
  })
)

if (import.meta.env.PROD) {
  app.use(posthogPlugin)
}

app.mount('#app')

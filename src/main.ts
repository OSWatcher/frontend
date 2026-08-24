// Monaco editor setup - MUST be first import before any Monaco components
import './monaco-setup'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Naive UI
import naive from 'naive-ui'

import App from './App.vue'
import router from './router'
import { provideApolloClient } from '@vue/apollo-composable'
import gqlClient from './graphql-client'

const app = createApp(App)
const pinia = createPinia()

// Provide Apollo client to the entire app
provideApolloClient(gqlClient)

app.use(pinia)
app.use(naive)
app.use(router)

app.mount('#app')

import { createApp } from 'vue'
import { createBootstrap } from 'bootstrap-vue-next'
// bootstrap
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'
// bootstrap-icons
import 'bootstrap-icons/font/bootstrap-icons.css'

import App from './App.vue'
import router from './router'
import posthogPlugin from './plugins/posthog'
import { provideApolloClient } from '@vue/apollo-composable'
import gqlClient from './graphql-client'

const app = createApp(App)

// Provide Apollo client to the entire app
provideApolloClient(gqlClient)

app.use(createBootstrap())
app.use(router)

if (import.meta.env.PROD) {
  app.use(posthogPlugin)
}

app.mount('#app')

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

const app = createApp(App)
app.use(createBootstrap())
app.use(router)
app.use(posthogPlugin)

app.mount('#app')

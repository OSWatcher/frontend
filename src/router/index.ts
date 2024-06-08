import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import OSView from '@/views/OSView.vue'
import DiffView from '@/views/DiffView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/os/:os_hash',
      name: 'OSView',
      component: OSView
    },
    {
      path: '/diff/:base_hash/:diffee_hash',
      name: 'DiffView',
      component: DiffView
    }
  ]
})

export default router

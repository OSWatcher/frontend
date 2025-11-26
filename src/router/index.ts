import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import OSView from '@/views/OSView.vue'
import DiffView from '@/views/DiffView.vue'
import InspectorView from '@/views/InspectorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    // New unified Inspector routes
    {
      path: '/inspect/:commitHash',
      name: 'InspectorSingle',
      component: InspectorView
    },
    {
      path: '/inspect/:baseHash/vs/:diffeeHash',
      name: 'InspectorComparison',
      component: InspectorView
    },
    // Legacy routes (kept for backward compatibility)
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

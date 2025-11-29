import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import InspectorView from '@/views/InspectorView.vue'
import CallbackView from '@/views/CallbackView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/callback',
      name: 'callback',
      component: CallbackView
    },
    {
      path: '/inspect/:commitHash',
      name: 'InspectorSingle',
      component: InspectorView
    },
    {
      path: '/inspect/:baseHash/vs/:diffeeHash',
      name: 'InspectorComparison',
      component: InspectorView
    }
  ]
})

export default router

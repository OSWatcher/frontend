<script setup lang="ts">
/**
 * Auth0 Callback View
 *
 * This view handles the redirect from Auth0 after authentication.
 * The Auth0 SDK automatically processes the callback and extracts tokens.
 * We show a loading state while this happens, then redirect to home.
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NSpin } from 'naive-ui'
import { useAuth0 } from '@auth0/auth0-vue'

const router = useRouter()
const { isLoading, error } = useAuth0()

onMounted(() => {
  // Wait for Auth0 to process the callback
  const checkAuth = setInterval(() => {
    if (!isLoading.value) {
      clearInterval(checkAuth)
      if (!error.value) {
        // Successful authentication - redirect to home
        router.push('/')
      }
    }
  }, 100)
})
</script>

<template>
  <div class="callback-view">
    <NSpin size="large" />
    <p class="callback-text">Completing authentication...</p>
  </div>
</template>

<style scoped>
.callback-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
  background: #f3f4f6;
}

.callback-text {
  margin: 0;
  color: #666;
  font-size: 16px;
}
</style>

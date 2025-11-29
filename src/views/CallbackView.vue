<script setup lang="ts">
/**
 * Auth0 Callback View
 *
 * This view handles the redirect from Auth0 after authentication.
 * The Auth0 SDK automatically processes the callback and extracts tokens.
 * We show a loading state while this happens, then redirect to home.
 */
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { NSpin } from 'naive-ui'
import { useAuth0 } from '@auth0/auth0-vue'

const router = useRouter()
const { isLoading, error } = useAuth0()

// Watch for Auth0 to finish processing
watch(isLoading, (loading) => {
  if (!loading) {
    if (error.value) {
      // Authentication failed - log and redirect
      console.error('Authentication failed:', error.value)
    }
    // Redirect to home (whether success or failure)
    router.replace('/')
  }
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

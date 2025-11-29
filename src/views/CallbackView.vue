<script setup lang="ts">
/**
 * Auth0 Callback View
 *
 * This view handles the redirect from Auth0 after authentication.
 * The Auth0 SDK automatically processes the callback and extracts tokens.
 * We show a loading state while this happens, then redirect to home.
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NSpin, useMessage } from 'naive-ui'
import { useAuth0 } from '@auth0/auth0-vue'

const router = useRouter()
const message = useMessage()
const { isLoading, error } = useAuth0()
const intervalId = ref<NodeJS.Timeout | null>(null)

onMounted(() => {
  // Wait for Auth0 to process the callback
  intervalId.value = setInterval(() => {
    if (!isLoading.value) {
      if (intervalId.value) {
        clearInterval(intervalId.value)
        intervalId.value = null
      }

      if (error.value) {
        // Authentication failed - show error and redirect
        message.error('Authentication failed. Please try again.')
        router.push('/')
      } else {
        // Successful authentication - redirect to home
        router.push('/')
      }
    }
  }, 100)
})

onUnmounted(() => {
  // Clean up interval if component unmounts before auth completes
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
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

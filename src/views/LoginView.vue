<script setup lang="ts">
/**
 * Auth0 Login View
 *
 * Initiates login and forwards organization invitation parameters when present.
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin } from 'naive-ui'
import { useAuth0 } from '@auth0/auth0-vue'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, loginWithRedirect } = useAuth0()

const pickStringQuery = (value: unknown) => (typeof value === 'string' ? value : undefined)

onMounted(async () => {
  if (isAuthenticated.value) {
    router.replace('/')
    return
  }

  const authorizationParams: Record<string, string> = {}
  const invitation = pickStringQuery(route.query.invitation)
  const organization = pickStringQuery(route.query.organization)
  const organizationName = pickStringQuery(route.query.organization_name)

  if (invitation) {
    authorizationParams.invitation = invitation
  }
  if (organization) {
    authorizationParams.organization = organization
  }
  if (organizationName) {
    authorizationParams.organization_name = organizationName
  }

  if (Object.keys(authorizationParams).length > 0) {
    await loginWithRedirect({ authorizationParams })
  } else {
    await loginWithRedirect()
  }
})
</script>

<template>
  <div class="login-view">
    <NSpin size="large" />
    <p class="login-text">Redirecting to login...</p>
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
  background: #f3f4f6;
}

.login-text {
  margin: 0;
  color: #666;
  font-size: 16px;
}
</style>

<script setup lang="ts">
import { BNavbar, BNavbarBrand, vBColorMode } from 'bootstrap-vue-next'
</script>

<template>
  <BNavbar v-b-color-mode="'dark'">
    <div class="container">
      <BNavbarBrand to="/">
        <img
          src="@/assets/logo.png"
          alt="OSWatcher logo">
      </BNavbarBrand>
    </div>
  </BNavbar>
  <RouterView />
</template>

<style scoped>
.navbar {
  background-color: #3b4a6b;
}

.navbar-brand img {
  width: 13.3rem;
}
</style>

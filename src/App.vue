<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="bg-light py-3">
    <div class="container">
      <nav>
        <RouterLink to="/" class="navbar-brand">Home</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

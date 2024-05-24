<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="navbar py-3">
    <div class="container">
      <nav>
        <RouterLink to="/" class="navbar-brand">Home</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

<style>
.navbar {
  background-color: #3B5998; /* Example blue color */
  color: white; /* Text color */
}

.navbar-brand {
  color: white; /* Text color for the brand */
}

.navbar-brand:hover {
  color: #FFD700; /* Hover color for the brand */
}
</style>
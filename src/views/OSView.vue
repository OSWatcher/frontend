<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const osHash = ref(route.params.os_hash)

// Fetch the OS details using osHash when the component is mounted or when osHash changes
onMounted(() => {
  // Fetch OS details logic here
  console.log('Fetching OS details for hash:', osHash.value)
})
</script>

<template>
  <div class="container">
    <h1 class="mt-5">Operating System</h1>
    <p class="lead">This is the operating system page.</p>
  </div>
</template>

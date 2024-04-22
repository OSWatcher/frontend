<script setup>
import { useRoute } from 'vue-router'
import FilesystemTree from '@/components/FilesystemTree.vue'

const route = useRoute()
const os_hash = route.params.os_hash
</script>

<template>
  <div class="container">
    <h1 class="mt-5">Operating System</h1>
    <p class="lead">This is the operating system page.</p>
    <FilesystemTree :os_hash="os_hash" />
  </div>
</template>

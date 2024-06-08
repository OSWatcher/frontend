<script setup lang="ts">
import { useRoute } from 'vue-router'
import { BCard } from 'bootstrap-vue-next'

interface Commit {
  hash: string
  name: string
}

// get route params
const route = useRoute()
const base_commit = {
  hash: route.params.base_hash,
  name: route.query.base_name
}
const diffee_commit = {
  hash: route.params.diffee_hash,
  name: route.query.diffee_name
}
</script>

<template>
  <BCard title="Diff View">
    <p>Base Commit: {{ base_commit.name }}</p>
    <p>Diffee Commit: {{ diffee_commit.name }}</p>
  </BCard>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { onMounted, ref } from 'vue'
import FilesystemTree from '@/components/FilesystemTree.vue'
import gqlClient from '@/graphql-client'
import { gql } from '@apollo/client/core'

const route = useRoute()
const os_hash = route.params.os_hash
// current tab
const currentTab = ref('filesystem')
// tabs visibility
const tabVisibility = ref({
  filesystem: true, // Filesystem is always visible
  registry: false,
})

getCommitCapabilities = gql`
  query Query($commitHash: String!) {
    getCommitExtractedDataLabels(commit_hash: $commitHash)
  }
`

onMounted(async () => {
  try {
    const response = await gqlClient.query({ query: getCommitCapabilities })
    const labels = response.data.getCommitExtractedDataLabels;
    // registry ?
    if (labels.includes('WinRegKey') || labels.includes('WinRegValue')) {
      tabVisibility.value.registry = true;
    }
  } catch (error) {
    console.error('Error fetching OS capabilities', error)
  }
})
</script>

<template>
  <div class="container">
    <!-- tabs -->
    <ul class="nav nav-tabs">
      <li class="nav-item" :class="{ 'active': currentTab === 'filesystem' }">
        <a href="#" class="nav-link" @click="currentTab = 'filesystem'">Filesystem</a>
      </li>
    </ul>
    <!-- tab content -->
    <div class="tab-pane" :class="{ 'active': currentTab === 'filesystem' }" id="filesystem">
      <FilesystemTree :os_hash="os_hash" />
    </div>
  </div>
</template>

<style>
.nav-tabs {
  margin-bottom: 1rem;
}
</style>

<script setup>
import { useRoute } from 'vue-router'
import { onMounted, markRaw, reactive } from 'vue'
import FilesystemTree from '@/components/FilesystemTree.vue'
import RegistryTree from '@/components/RegistryTree.vue'
import gqlClient from '@/graphql-client'
import { gql } from '@apollo/client/core'
import { BTabs, BTab } from 'bootstrap-vue-next'

const route = useRoute()
const os_hash = route.params.os_hash
// v-if isn't supported, we need to build the tabs variable and insert entries instead
const tabs = reactive({
  filesystem: { title: 'Filesystem', component: markRaw(FilesystemTree) }
})

const getCommitCapabilities = gql`
  query Query($commitHash: String!) {
    getCommitExtractedDataLabels(commit_hash: $commitHash)
  }
`

onMounted(async () => {
  try {
    const response = await gqlClient.query({
      query: getCommitCapabilities,
      variables: { commitHash: os_hash }
    })
    const labels = response.data.getCommitExtractedDataLabels
    // registry ?
    if (labels.includes('WinRegKey') || labels.includes('WinRegValue')) {
      tabs.registry = { title: 'Registry', component: markRaw(RegistryTree) }
    }
  } catch (error) {
    console.error('Error fetching OS capabilities', error)
  }
})
</script>

<template>
  <div class="container">
    <b-tabs content-class="mt-3">
      <b-tab v-for="(tab, key) in tabs" :key="key" :title="tab.title">
        <component :is="tab.component" :os_hash="os_hash" />
      </b-tab>
    </b-tabs>
  </div>
</template>

<style>
.nav-tabs {
  margin-bottom: 1rem;
}
</style>

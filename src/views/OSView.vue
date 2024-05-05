<script setup>
import { useRoute } from 'vue-router'
import { onMounted, markRaw, reactive, ref } from 'vue'
import FilesystemTree from '@/components/FilesystemTree.vue'
import RegistryTree from '@/components/RegistryTree.vue'
import PDBExplorer from '@/components/PDBExplorer.vue'
import gqlClient from '@/graphql-client'
import { BTabs, BTab, BSpinner, BCard, BRow, BCol } from 'bootstrap-vue-next'
import { getCommitCapabilities } from '@/queries'

const route = useRoute()
const os_hash = route.params.os_hash
const os_title = route.query.os_title
// v-if isn't supported, we need to build the tabs variable and insert entries instead
const tabs = reactive({
  filesystem: { title: 'Filesystem', component: markRaw(FilesystemTree) }
})
const isLoading = ref(false)

onMounted(async () => {
  isLoading.value = true
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
    // symbols ?
    if (labels.includes('Symbol') || labels.includes('Enum') || labels.includes('WinStruct')) {
      tabs.symbols = { title: 'Symbols', component: markRaw(PDBExplorer) }
    }
  } catch (error) {
    console.error('Error fetching OS capabilities', error)
  }
  isLoading.value = false
})
</script>

<template>
  <div class="container">
    <BRow>
      <BCol cols="4">
        <BCard :title="os_title" class="mb-3 p-3"></BCard>
      </BCol>
      <BCol>
        <BSpinner v-if="isLoading"></BSpinner>
      </BCol>
    </BRow>
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

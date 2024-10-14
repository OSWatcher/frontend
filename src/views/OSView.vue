<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onMounted, markRaw, reactive, ref, watch } from 'vue'
import FilesystemTree from '@/components/FilesystemTree.vue'
import RegistryTree from '@/components/RegistryTree.vue'
import PDBExplorer from '@/components/PDBExplorer.vue'
import gqlClient from '@/graphql-client'
import { BTabs, BTab, BSpinner, BCard, BRow, BCol, BCardText } from 'bootstrap-vue-next'
import { FetchCommitDetailsDocument, GetCommitCapabilitiesDocument } from '@/graphql-types'
import type { Commit, FetchCommitDetailsQuery, GetCommitCapabilitiesQuery } from '@/graphql-types'

const route = useRoute()
const os_hash = ref(route.params.os_hash as string)
const os_title = ref(route.query.os_title as string)
const filesystem = ref(route.query.filesystem as string)
// v-if isn't supported, we need to build the tabs variable and insert entries instead
const tabs = reactive({
  filesystem: { title: 'Filesystem', component: markRaw(FilesystemTree) }
})
const isLoading = ref(false)
const commit = ref({} as Commit)

onMounted(async () => {
  isLoading.value = true
  try {
    // load commit details
    const response_commit = await gqlClient.query<FetchCommitDetailsQuery>({
      query: FetchCommitDetailsDocument,
      variables: { where: { hash: os_hash.value } }
    })
    commit.value = response_commit.data.commits[0] as Commit

    const response = await gqlClient.query<GetCommitCapabilitiesQuery>({
      query: GetCommitCapabilitiesDocument,
      variables: { commitHash: os_hash.value }
    })
    const labels = response.data.getCommitExtractedDataLabels
    // registry ?
    if (labels.includes('WinRegKey') || labels.includes('WinRegValue')) {
      tabs.registry = { title: 'Registry', component: markRaw(RegistryTree) }
    }
    // symbols ?
    if (labels.includes('Symbol') || labels.includes('Enum') || labels.includes('WinStruct')) {
      tabs.symbols = { title: 'PDB', component: markRaw(PDBExplorer) }
    }
  } catch (error) {
    console.error('Error fetching OS capabilities', error)
  }
  isLoading.value = false
})

watch(
  () => route.fullPath,
  () => {
    os_hash.value = route.params.os_hash as string
    os_title.value = route.query.os_title as string
    filesystem.value = route.query.filesystem as string
    console.log('update route params', os_hash, os_title, filesystem)
  }
)
</script>

<template>
  <div class="container">
    <BRow>
      <BCol cols="4">
        <BCard :title="os_title" class="mb-3 p-3">
          <BCardText>
            {{ commit.description }}
          </BCardText>
        </BCard>
      </BCol>
      <BCol>
        <BSpinner v-if="isLoading"></BSpinner>
      </BCol>
    </BRow>
    <b-tabs content-class="mt-3">
      <b-tab v-for="(tab, key) in tabs" :key="key" :title="tab.title">
        <component
          :is="tab.component"
          :os_hash="os_hash"
          v-bind="tab.component === FilesystemTree && filesystem ? { path: filesystem } : {}"
        />
      </b-tab>
    </b-tabs>
  </div>
</template>

<style>
.nav-tabs {
  margin-bottom: 1rem;
}
</style>

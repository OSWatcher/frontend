<script setup lang="ts">
import { useRoute } from 'vue-router'
import { markRaw, onMounted, reactive, ref } from 'vue'
import { BCard, BTabs, BTab, BSpinner } from 'bootstrap-vue-next'
import gqlClient from '@/graphql-client'
import { GetCommitCapabilitiesDocument } from '@/graphql-types'
import type { GetCommitCapabilitiesQuery } from '@/graphql-types'
import FilesystemTreeDiff from '@/components/diff/FilesystemTreeDiff.vue'
import RegistryTreeDiff from '@/components/diff/RegistryTreeDiff.vue'
import PDBExplorerDiff from '@/components/diff/PDBExplorerDiff.vue'

// get route params
const route = useRoute()
const base_commit = ref({
  hash: route.params.base_hash as string,
  name: route.query.base_name as string,
  fs_root_hash: ''
})
const diffee_commit = ref({
  hash: route.params.diffee_hash as string,
  name: route.query.diffee_name as string,
  fs_root_hash: ''
})

// v-if isn't supported, we need to build the tabs variable and insert entries instead
const tabs = reactive({
  filesystem: { title: 'Filesystem', component: markRaw(FilesystemTreeDiff) }
})
const isLoading = ref(false)

// onMounted, use GET_FS_ROOT to get the root of the filesystem
// and load commit details to know which tab to show
onMounted(async () => {
  isLoading.value = true
  try {
    // fetch commit details
    // just fetch first commit details
    const response_details = await gqlClient.query<GetCommitCapabilitiesQuery>({
      query: GetCommitCapabilitiesDocument,
      variables: { commitHash: base_commit.value.hash }
    })
    const labels = response_details.data.getCommitExtractedDataLabels
    // registry ?
    if (labels.includes('WinRegKey') || labels.includes('WinRegValue')) {
      tabs.registry = { title: 'Registry', component: markRaw(RegistryTreeDiff) }
    }
    // symbols ?
    if (labels.includes('Symbol') || labels.includes('WinStruct')) {
      tabs.symbols = { title: 'PDB', component: markRaw(PDBExplorerDiff) }
    }
  } catch (error) {
    console.error('Error fetching commit details', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="container">
    <BCard class="diff-card position-relative">
      <div v-if="isLoading" class="spinner-container">
        <BSpinner></BSpinner>
      </div>
      <div class="diff-header">
        <h2><i class="bi bi-file-earmark-diff"></i> Diff</h2>
      </div>
      <div class="diff-details">
        <h4>
          <span class="commit-name">{{ base_commit.name }}</span>
          <i class="bi bi-arrow-left-right"></i>
          <span class="commit-name">{{ diffee_commit.name }}</span>
        </h4>
      </div>
    </BCard>
    <b-tabs content-class="mt-3">
      <b-tab v-for="(tab, key) in tabs" :key="key" :title="tab.title">
        <component
          :is="tab.component"
          :commitHashDiff="{
            base_hash: base_commit.hash,
            diffee_hash: diffee_commit.hash,
            label: 'Commit'
          }"
        />
      </b-tab>
    </b-tabs>
  </div>
</template>

<style scoped>
.diff-card {
  padding: 20px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.diff-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.diff-header h2 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
}

.diff-header i {
  margin-right: 10px;
  font-size: 1.5em;
}

.diff-details h4 {
  font-size: 1.25em;
  font-weight: normal;
  display: flex;
  align-items: center;
  margin: 0;
}

.diff-details i {
  margin: 0 10px;
  font-size: 1.25em;
}

.commit-name {
  font-weight: bold;
}

.text-center {
  text-align: center;
}

.my-3 {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.position-relative {
  position: relative;
}

.spinner-container {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
}
</style>

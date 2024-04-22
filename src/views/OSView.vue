<script setup>
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import FilesystemTree from '@/components/FilesystemTree.vue'

const route = useRoute()
const os_hash = route.params.os_hash
// current tab
const currentTab = ref('filesystem')
</script>

<template>
  <div class="container">
    <ul class="nav nav-tabs">
      <li class="nav-item" :class="{ 'active': currentTab === 'filesystem' }">
        <a href="#" class="nav-link" @click="currentTab = 'filesystem'">Filesystem</a>
      </li>
      <!-- Other tabs can be added here -->
    </ul>
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

<script setup lang="ts">
import { defineProps, ref, onMounted, PropType } from 'vue'
import TreeDiffExplorer from '@/components/diff/TreeDiffExplorer.vue'
import TreeNodeType from '@/types'
import { getDownloadUrl } from '@/download'
import { BDropdown, BDropdownItem } from 'bootstrap-vue-next'
import type { HashDiff } from '@/types'
import { fetchFSRootCommitDiff } from '@/utils'
import { DiffStatus } from '@/graphql-types'

const props = defineProps({
  commitHashDiff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

const rootFsHashDiff = ref<HashDiff | null>(null)

// tree explorer
const fields = [{ key: 'path', sortable: true, label: 'Name' }]

onMounted(async () => {
  rootFsHashDiff.value = await fetchFSRootCommitDiff(props.commitHashDiff)
})
</script>

<template>
  <div v-if="rootFsHashDiff">
    <TreeDiffExplorer :fields="fields" :node_diff="rootFsHashDiff" :diff_filter="['Blob']">
      <template #cell(path)="props">
        <div class="row-container">
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <i class="bi-file-earmark"></i>
              {{ props.data.item.path }}
            </div>
            <div v-else>
              <i class="bi-folder-fill"></i>
              {{ props.data.item.path }}
            </div>
          </div>
          <div>
            <div v-if="props.data.item.type === TreeNodeType.Blob">
              <div v-if="props.data.item.status === DiffStatus.New">
                <a
                  :href="getDownloadUrl(props.data.item.new_hash)"
                  :download="`${props.data.item.new_props.hash}_${props.data.item.path}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else-if="props.data.item.status === DiffStatus.Del">
                <a
                  :href="getDownloadUrl(props.data.item.old_props.hash)"
                  :download="`${props.data.item.old_props.hash}_${props.data.item.path}`"
                  class="btn btn-primary"
                >
                  Download
                </a>
              </div>
              <div v-else>
                <BDropdown text="Download" variant="primary">
                  <BDropdownItem :href="getDownloadUrl(props.data.item.old_props.hash)"
                    >Old</BDropdownItem
                  >
                  <BDropdownItem :href="getDownloadUrl(props.data.item.new_props.hash)"
                    >New</BDropdownItem
                  >
                </BDropdown>
              </div>
            </div>
          </div>
        </div>
      </template>
    </TreeDiffExplorer>
  </div>
</template>

<style scoped>
.row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

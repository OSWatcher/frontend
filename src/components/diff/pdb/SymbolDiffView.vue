<script setup lang="ts">
import { defineProps, PropType } from 'vue'
import TreeDiffExplorer from '@/components/diff/TreeDiffExplorer.vue'
import type { HashDiff } from '@/types'

const props = defineProps({
  blob_hash_diff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

const fields = [{ key: 'path', label: 'Name' }, { key: 'address'}]
</script>

<template>
  <TreeDiffExplorer
    :fields="fields"
    :node_diff="blob_hash_diff"
    :diff_filter="['Symbol']"
    :paginate="true"
  >
    <template #cell(path)="props">
      {{ props.data.item.path }}
    </template>
  </TreeDiffExplorer>
</template>

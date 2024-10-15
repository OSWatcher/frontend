<script setup lang="ts">
import { defineProps, ref, watch, onMounted, PropType } from 'vue'
import gqlClient from '@/graphql-client'
import { DIFF_NODES } from '@/queries'
import { BTable, BPagination } from 'bootstrap-vue-next'
import type { TableFieldRaw, TableItem } from 'bootstrap-vue-next'
import { HashDiff } from '@/types'

const props = defineProps({
  blob_hash_diff: {
    type: Object as PropType<HashDiff>,
    required: true
  }
})

onMounted(async () => {})
</script>

<template>
  <div>Hello</div>
</template>

<script setup lang="ts">
import { defineProps, withDefaults } from 'vue'
import gqlClient from '@/graphql-client'
import {
  DiffItem,
  DiffNodesDocument,
  DiffNodesQuery,
  DiffNodesQueryVariables,
  DiffStatus,
  NodeType
} from '@/graphql-types'
import { HashDiff, TreeNodeType } from '@/types'
import TreeExplorer from '@/components/TreeExplorer.vue'
import { TableItem, TableFieldRaw } from 'bootstrap-vue-next'

// Props
interface Props {
  node_diff: HashDiff
  fields: Exclude<TableFieldRaw<DiffItem>, string>[]
  diff_filter: string[]
  treeNodeType?: NodeType
}

const props = withDefaults(defineProps<Props>(), {
  treeNodeType: NodeType.Tree
})

async function diffNodesAt(
  new_path: string,
  max_depth?: number | null | undefined
): Promise<TableItem<DiffItem>[]> {
  try {
    const response = await gqlClient.query<DiffNodesQuery, DiffNodesQueryVariables>({
      query: DiffNodesDocument,
      variables: {
        parentLabel: props.node_diff.label,
        baseNodeHash: props.node_diff.base_hash!,
        diffeeNodeHash: props.node_diff.diffee_hash!,
        atPath: new_path,
        maxDepth: max_depth,
        filter: props.diff_filter
      },
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    })

    return parse_diff_response(response.data)
  } catch (error) {
    console.error('Error fetching diff data:', error)
  }
  return []
}

// Function to parse diff response
function parse_diff_response(data: DiffNodesQuery): TableItem<DiffItem>[] {
  return data.diffNodesAt.map((item) => ({
    ...item,
    type: item.type === props.treeNodeType ? TreeNodeType.Tree : TreeNodeType.Blob,
    _rowVariant: (() => {
      switch (item.status) {
        case DiffStatus.New:
          return 'success'
        case DiffStatus.Mod:
          return 'warning'
        case DiffStatus.Del:
          return 'danger'
        default:
          throw new Error(`Unexpected diff status: ${item.status}`)
      }
    })()
  }))
}
</script>

<template>
  <TreeExplorer
    :getEntries="diffNodesAt"
    :fields="fields"
    field_path="path"
    :export_max_depth_available="true"
  >
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData" />
    </template>
  </TreeExplorer>
</template>

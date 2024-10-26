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
import TreeExplorer, { Pagination } from '@/components/TreeExplorer.vue'
import { TableItem, TableFieldRaw } from 'bootstrap-vue-next'

// Props
interface Props {
  node_diff: HashDiff
  fields: Exclude<TableFieldRaw<DiffItem>, string>[]
  diff_filter: string[]
  treeNodeType?: NodeType
  paginate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  treeNodeType: NodeType.Tree,
  paginate: false
})

async function diffNodesAt(
  new_path: string,
  max_depth?: number | null | undefined,
  pagination?: Pagination
): Promise<{
  total_count: number
  items: TableItem<DiffItem>[]
}> {
  const options =
    props.paginate && pagination
      ? {
          offset: (pagination?.currentPage - 1) * pagination?.limit,
          limit: pagination?.limit
        }
      : undefined
  try {
    const response = await gqlClient.query<DiffNodesQuery, DiffNodesQueryVariables>({
      query: DiffNodesDocument,
      variables: {
        parentLabel: props.node_diff.label,
        baseNodeHash: props.node_diff.base_hash!,
        diffeeNodeHash: props.node_diff.diffee_hash!,
        atPath: new_path,
        maxDepth: max_depth,
        filter: props.diff_filter,
        options: options
      },
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    })

    return parse_diff_response(response.data)
  } catch (error) {
    console.error('Error fetching diff data:', error)
  }
  return { total_count: 0, items: [] }
}

// Function to parse diff response
function parse_diff_response(data: DiffNodesQuery): {
  total_count: number
  items: TableItem<DiffItem>[]
} {
  console.log(data)
  return {
    total_count: data.diffNodesAt.total_count,
    items: data.diffNodesAt.items.map((item) => ({
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
}
</script>

<template>
  <TreeExplorer
    :getEntries="diffNodesAt"
    :fields="fields"
    field_path="path"
    :export_max_depth_available="true"
    :paginate="paginate"
  >
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData" />
    </template>
  </TreeExplorer>
</template>

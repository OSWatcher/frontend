<script setup lang="ts">
import { DiffStatus } from '@/graphql-types'
import { TreeNodeType } from '@/types'

const _props = defineProps<{
  item: any
  propertyName: string
}>()

const getPropertyValue = (props: any, propertyName: string) => props?.properties?.[propertyName]
</script>

<template>
  <div v-if="item.type === TreeNodeType.Blob" class="value-container">
    <div v-if="item.status === DiffStatus.New" class="value-content new-value">
      {{ getPropertyValue(item.new_props, propertyName) }}
    </div>

    <div v-else-if="item.status === DiffStatus.Del" class="value-content old-value">
      {{ getPropertyValue(item.old_props, propertyName) }}
    </div>

    <div v-else-if="item.status === DiffStatus.Mod">
      <div
        v-if="
          getPropertyValue(item.old_props, propertyName) !==
          getPropertyValue(item.new_props, propertyName)
        "
      >
        <div class="value-content old-value">
          <span class="value-label">Old:</span>
          {{ getPropertyValue(item.old_props, propertyName) }}
        </div>
        <div class="value-content new-value">
          <span class="value-label">New:</span>
          {{ getPropertyValue(item.new_props, propertyName) }}
        </div>
      </div>
      <div v-else class="value-content">
        {{ getPropertyValue(item.new_props, propertyName) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.old-value {
  color: #dc3545;
}

.new-value {
  color: #28a745;
}

.value-container {
  max-width: 300px;
  /* Adjust this value as needed */
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
}

.value-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9em;
  padding: 2px 4px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.05);
}

.value-label {
  font-weight: bold;
  margin-right: 5px;
}
</style>

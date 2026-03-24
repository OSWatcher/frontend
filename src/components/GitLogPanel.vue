<script setup lang="ts">
import { watch, computed } from 'vue'
import { NModal, NTag, NSpin, NEmpty, NSpace } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useGitLog } from '@/composables/useGitLog'
import { formatPropertyChange, statusColor, statusBadgeStyle } from '@/utils/gitlog'
import type { EntityType } from '@/graphql-types'

const props = defineProps<{
  show: boolean
  path: string
  entityType: EntityType
  branch: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const router = useRouter()
const { entries, isStreaming, error, start, stop, clear } = useGitLog()

const showModal = computed({
  get: () => props.show,
  set: (val: boolean) => emit('update:show', val)
})

// Start streaming when modal opens
watch(
  () => props.show,
  (show) => {
    if (show && props.path && props.entityType && props.branch) {
      start(props.path, props.entityType, props.branch)
    }
  },
  { immediate: true }
)

function handleAfterLeave() {
  stop()
  clear()
}

function navigateToDiff(baseHash: string, diffeeHash: string) {
  emit('update:show', false)
  router.push({
    path: `/inspect/${baseHash}/vs/${diffeeHash}`,
    query: { branch: props.branch }
  })
}

const entityLabel = computed(() => {
  switch (props.entityType) {
    case 'FILESYSTEM':
      return 'Filesystem'
    case 'REGISTRY':
      return 'Registry'
    case 'STRUCT':
      return 'Struct'
    case 'SYMBOL':
      return 'Symbol'
    default:
      return props.entityType
  }
})

const title = computed(() => `History: ${props.path}`)

// Display newest at top, oldest at bottom (visual timeline grows upward)
const displayEntries = computed(() => [...entries.value].reverse())
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="title"
    class="git-log-modal"
    :style="{ width: '800px', maxWidth: '95vw' }"
    @after-leave="handleAfterLeave"
  >
    <template #header-extra>
      <NTag size="small" :bordered="false" type="info">
        {{ entityLabel }}
      </NTag>
    </template>

    <!-- Error state -->
    <div v-if="error" class="git-log-error">
      {{ error }}
    </div>

    <!-- Empty state (done streaming, no results) -->
    <NEmpty
      v-else-if="!isStreaming && entries.length === 0"
      description="No changes detected across versions"
    />

    <!-- Timeline -->
    <div v-else class="git-log-timeline">
      <div
        v-for="(entry, index) in displayEntries"
        :key="index"
        class="timeline-entry"
        @click="
          entry.base_commit
            ? navigateToDiff(entry.base_commit.hash, entry.diffee_commit.hash)
            : undefined
        "
        :class="{ clickable: entry.base_commit !== null }"
      >
        <!-- Timeline dot -->
        <div class="timeline-dot" :style="{ backgroundColor: statusColor(entry.diff.status) }" />

        <!-- Card -->
        <div class="timeline-card">
          <div class="card-header">
            <span class="commit-name">{{ entry.diffee_commit.name }}</span>
            <span class="status-badge" :style="statusBadgeStyle(entry.diff.status)">
              {{ entry.diff.status }}
            </span>
          </div>
          <div class="card-from" v-if="entry.base_commit">from {{ entry.base_commit.name }}</div>
          <div class="card-from" v-else>first appearance</div>
          <div class="card-details">
            {{ formatPropertyChange(entry.diff.type, entry.diff.old_props, entry.diff.new_props) }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <NSpace justify="space-between" align="center">
        <span v-if="isStreaming" class="streaming-indicator">
          <NSpin :size="14" />
          <span>Loading history...</span>
        </span>
        <span v-else class="result-count">
          {{ entries.length }} change{{ entries.length !== 1 ? 's' : '' }} found
        </span>
        <span class="branch-info"> branch: {{ branch }} </span>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.git-log-modal :deep(.n-card__content) {
  max-height: 70vh;
  overflow-y: auto;
}

.git-log-error {
  color: #dc3545;
  padding: 16px;
  text-align: center;
}

.git-log-timeline {
  position: relative;
  padding-left: 32px;
}

.git-log-timeline::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: #ddd;
}

.timeline-entry {
  position: relative;
  margin-bottom: 16px;
}

.timeline-entry.clickable {
  cursor: pointer;
}

.timeline-entry.clickable:hover .timeline-card {
  border-color: #4a6fa5;
  box-shadow: 0 1px 4px rgba(74, 111, 165, 0.15);
}

.timeline-dot {
  position: absolute;
  left: -27px;
  top: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #ddd;
}

.timeline-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 10px 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.commit-name {
  font-weight: 600;
  font-size: 13px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.card-from {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.card-details {
  font-family: monospace;
  font-size: 12px;
  margin-top: 6px;
  color: #333;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.result-count {
  font-size: 13px;
  color: #666;
}

.branch-info {
  font-size: 12px;
  color: #999;
}
</style>

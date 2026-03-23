import { ref, onUnmounted } from 'vue'
import gqlClient from '@/graphql-client'
import { GIT_LOG_STREAM } from '@/queries'
import type { GitLogEntryData } from '@/utils/gitlog'
import type { EntityType } from '@/graphql-types'

export function useGitLog() {
  const entries = ref<GitLogEntryData[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  let subscription: any = null

  function start(path: string, entityType: EntityType, branch: string) {
    stop()
    clear()
    isStreaming.value = true
    error.value = null

    const variables = {
      path,
      context: entityType,
      commitRange: {
        startRef: branch,
        direction: 'BACKWARD',
        include_updates: false
      }
    }

    const observable = gqlClient.subscribe({
      query: GIT_LOG_STREAM,
      variables
    })

    subscription = observable.subscribe({
      next: (result: any) => {
        if (result.data?.gitLogStream) {
          entries.value.push(result.data.gitLogStream as GitLogEntryData)
        }
      },
      error: (err: any) => {
        console.error('Git log stream error:', err)
        error.value = err.message || 'Failed to stream git log'
        isStreaming.value = false
      },
      complete: () => {
        isStreaming.value = false
      }
    })
  }

  function stop() {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
    isStreaming.value = false
  }

  function clear() {
    entries.value = []
    error.value = null
  }

  onUnmounted(() => {
    stop()
  })

  return {
    entries,
    isStreaming,
    error,
    start,
    stop,
    clear
  }
}

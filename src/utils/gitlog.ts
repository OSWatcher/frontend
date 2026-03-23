import type { GitLogStreamSubscription } from '@/graphql-types'

export type GitLogEntryData = GitLogStreamSubscription['gitLogStream']

/**
 * Format a property change for display in the git log timeline.
 * Returns a human-readable string like "size: 152 → 712" or "offset: 20 → 32".
 */
export function formatPropertyChange(
  nodeType: string,
  oldProps: { hash: string; properties: Record<string, unknown> } | null,
  newProps: { hash: string; properties: Record<string, unknown> } | null
): string {
  if (!oldProps && newProps) {
    return formatSingleProps(nodeType, newProps)
  }
  if (oldProps && !newProps) {
    return formatSingleProps(nodeType, oldProps)
  }
  if (!oldProps || !newProps) {
    return ''
  }

  switch (nodeType) {
    case 'Blob':
    case 'Tree':
      return `${truncateHash(oldProps.hash)} → ${truncateHash(newProps.hash)}`

    case 'WinRegValue': {
      const oldVal = String(oldProps.properties.value ?? '')
      const newVal = String(newProps.properties.value ?? '')
      const oldType = String(oldProps.properties.type ?? '')
      const newType = String(newProps.properties.type ?? '')
      if (oldType !== newType) {
        return `${oldVal} (${oldType}) → ${newVal} (${newType})`
      }
      return `${oldVal} → ${newVal}`
    }

    case 'WinRegKey':
      return `${truncateHash(oldProps.hash)} → ${truncateHash(newProps.hash)}`

    case 'Struct': {
      const oldSize = oldProps.properties.size
      const newSize = newProps.properties.size
      return `size: ${oldSize} → ${newSize}`
    }

    case 'StructField': {
      const parts: string[] = []
      const oldOffset = oldProps.properties.offset
      const newOffset = newProps.properties.offset
      if (oldOffset !== newOffset) {
        parts.push(`offset: ${oldOffset} → ${newOffset}`)
      }
      const oldType = parseDataType(oldProps.properties.data_type)
      const newType = parseDataType(newProps.properties.data_type)
      if (oldType !== newType) {
        parts.push(`type: ${oldType} → ${newType}`)
      }
      return parts.join(', ') || `${truncateHash(oldProps.hash)} → ${truncateHash(newProps.hash)}`
    }

    case 'Symbol': {
      const oldAddr = formatAddress(oldProps.properties.address)
      const newAddr = formatAddress(newProps.properties.address)
      return `${oldAddr} → ${newAddr}`
    }

    default:
      return `${truncateHash(oldProps.hash)} → ${truncateHash(newProps.hash)}`
  }
}

function formatSingleProps(
  nodeType: string,
  props: { hash: string; properties: Record<string, unknown> }
): string {
  switch (nodeType) {
    case 'Struct':
      return `size: ${props.properties.size}`
    case 'StructField':
      return `offset: ${props.properties.offset}`
    case 'Symbol':
      return formatAddress(props.properties.address)
    case 'WinRegValue':
      return `${props.properties.value} (${props.properties.type})`
    default:
      return truncateHash(props.hash)
  }
}

function truncateHash(hash: string): string {
  return hash.substring(0, 8)
}

function formatAddress(address: unknown): string {
  if (typeof address === 'string') {
    const num = parseInt(address, 10)
    if (!isNaN(num)) {
      return `0x${num.toString(16).toUpperCase()}`
    }
    return address
  }
  return String(address)
}

function parseDataType(dataType: unknown): string {
  if (typeof dataType !== 'string') return String(dataType)
  try {
    const parsed = JSON.parse(dataType)
    return parsed.name || dataType
  } catch {
    return dataType
  }
}

/**
 * Get a CSS color for a diff status.
 */
export function statusColor(status: string): string {
  switch (status) {
    case 'NEW':
      return '#28a745'
    case 'MOD':
      return '#f0ad4e'
    case 'DEL':
      return '#dc3545'
    default:
      return '#6c757d'
  }
}

/**
 * Get a background color for status badges.
 */
export function statusBadgeStyle(status: string): Record<string, string> {
  switch (status) {
    case 'NEW':
      return { background: '#d4edda', color: '#155724' }
    case 'MOD':
      return { background: '#fff3cd', color: '#856404' }
    case 'DEL':
      return { background: '#f8d7da', color: '#721c24' }
    default:
      return { background: '#e2e3e5', color: '#383d41' }
  }
}

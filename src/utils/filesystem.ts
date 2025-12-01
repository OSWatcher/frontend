import type {
  FilesystemEntry,
  FilesystemDiffEntry,
  DiffStatus,
  BreadcrumbItem
} from '@/types/inspector'

export function parseFilesystemEntries(
  rawEntries: Array<{ name: string; type: string; hash: string; size?: number }>,
  currentPath: string
): FilesystemEntry[] {
  return rawEntries.map((entry) => ({
    name: entry.name,
    type: entry.type === 'blob' ? 'blob' : 'tree',
    hash: entry.hash,
    size: entry.size,
    path: joinPath(currentPath, entry.name)
  }))
}

export function parseFilesystemDiffEntries(
  rawDiffEntries: Array<{
    name: string
    type: string
    old_props?: { hash: string; size?: number } | null
    new_props?: { hash: string; size?: number } | null
  }>,
  currentPath: string
): FilesystemDiffEntry[] {
  return rawDiffEntries.map((entry) => {
    const status = determineDiffStatus(entry.old_props, entry.new_props)
    const hash = entry.new_props?.hash || entry.old_props?.hash || ''
    const size = entry.new_props?.size || entry.old_props?.size

    return {
      name: entry.name,
      type: entry.type === 'blob' ? 'blob' : 'tree',
      hash,
      size,
      path: joinPath(currentPath, entry.name),
      status,
      baseHash: entry.old_props?.hash,
      diffeeHash: entry.new_props?.hash,
      baseSize: entry.old_props?.size,
      diffeeSize: entry.new_props?.size
    }
  })
}

function determineDiffStatus(
  oldProps?: { hash: string } | null,
  newProps?: { hash: string } | null
): DiffStatus {
  if (!oldProps && newProps) return 'NEW'
  if (oldProps && !newProps) return 'DELETED'
  if (oldProps && newProps && oldProps.hash !== newProps.hash) return 'MODIFIED'
  return 'UNCHANGED'
}

export function joinPath(base: string, segment: string): string {
  const normalizedBase = base.startsWith('/') ? base : `/${base}`
  const trimmedBase = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase
  const trimmedSegment = segment.startsWith('/') ? segment.slice(1) : segment
  if (trimmedBase === '' || trimmedBase === '/') {
    return `/${trimmedSegment}`
  }
  return `${trimmedBase}/${trimmedSegment}`
}

export function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

export function getParentPath(path: string): string {
  const segments = splitPath(path)
  if (segments.length <= 1) return '/'
  return '/' + segments.slice(0, -1).join('/')
}

export function generateBreadcrumbs(path: string, includeHome = true): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = []
  if (includeHome) {
    breadcrumbs.push({ label: 'Home', path: '/', icon: 'home' })
  }
  const segments = splitPath(path)
  segments.forEach((segment, index) => {
    const segmentPath = '/' + segments.slice(0, index + 1).join('/')
    breadcrumbs.push({ label: segment, path: segmentPath })
  })
  return breadcrumbs
}

export function getDownloadUrl(hash: string): string {
  const apiUri = import.meta.env.VITE_GRAPHEOS_API_URI
  if (!apiUri) {
    console.warn('VITE_GRAPHEOS_API_URI not configured')
    return ''
  }
  return `${apiUri}/blob/${hash}`
}

export function formatFileSize(bytes: number | undefined, decimals = 1): string {
  if (bytes === undefined || bytes === null) return '-'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

export function getStatusTagType(status: DiffStatus): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'NEW':
      return 'success'
    case 'MODIFIED':
      return 'warning'
    case 'DELETED':
      return 'error'
    case 'UNCHANGED':
      return 'default'
  }
}

export function getEntryIcon(type: 'blob' | 'tree'): string {
  return type === 'blob' ? 'document-outline' : 'folder-outline'
}

export function sortEntries<T extends FilesystemEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.type === 'tree' && b.type === 'blob') return -1
    if (a.type === 'blob' && b.type === 'tree') return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Registry Utility Functions
 *
 * Pure functions for registry data transformation and manipulation.
 * Following the same pattern as filesystem utilities.
 */

import type { RegistryEntry, RegistryDiffEntry, RegistryBreadcrumbItem } from '@/types/registry'
import { DiffStatus } from '@/graphql-types'

/**
 * Parse raw registry entries from GraphQL response
 */
export function parseRegistryEntries(
  rawEntries: Array<{ name: string; type: string; value?: string; value_type?: string }>,
  currentPath: string
): RegistryEntry[] {
  return rawEntries.map((entry) => ({
    name: entry.name,
    type: entry.type === 'WinRegValue' ? 'value' : 'key',
    path: joinRegistryPath(currentPath, entry.name),
    value: entry.value,
    valueType: entry.value_type
  }))
}

/**
 * Parse raw registry diff entries from GraphQL response
 */
export function parseRegistryDiffEntries(
  rawDiffEntries: Array<{
    name: string
    type: string
    status: string
    old_props?: { value?: string; type?: string } | null
    new_props?: { value?: string; type?: string } | null
  }>,
  currentPath: string
): RegistryDiffEntry[] {
  return rawDiffEntries.map((entry) => {
    const value = entry.new_props?.value || entry.old_props?.value
    const valueType = entry.new_props?.type || entry.old_props?.type

    return {
      name: entry.name,
      type: entry.type === 'WinRegValue' ? 'value' : 'key',
      path: joinRegistryPath(currentPath, entry.name),
      value,
      valueType,
      status: entry.status as DiffStatus,
      baseValue: entry.old_props?.value,
      diffeeValue: entry.new_props?.value,
      baseValueType: entry.old_props?.type,
      diffeeValueType: entry.new_props?.type
    }
  })
}

/**
 * Join registry path segments (uses forward slash like filesystem)
 */
export function joinRegistryPath(base: string, segment: string): string {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const trimmedSegment = segment.startsWith('/') ? segment.slice(1) : segment
  return `${trimmedBase}/${trimmedSegment}`
}

/**
 * Split registry path into segments
 */
export function splitRegistryPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

/**
 * Get parent path for registry
 */
export function getParentRegistryPath(path: string): string {
  const segments = splitRegistryPath(path)
  if (segments.length <= 1) return '/'
  return '/' + segments.slice(0, -1).join('/')
}

/**
 * Generate breadcrumbs for registry path
 */
export function generateRegistryBreadcrumbs(
  hiveName: string,
  path: string,
  includeHome = true
): RegistryBreadcrumbItem[] {
  const breadcrumbs: RegistryBreadcrumbItem[] = []

  if (includeHome) {
    breadcrumbs.push({ label: hiveName.replace(/\//g, ' / '), path: '/', icon: 'home' })
  }

  const segments = splitRegistryPath(path)
  segments.forEach((segment, index) => {
    const segmentPath = '/' + segments.slice(0, index + 1).join('/')
    breadcrumbs.push({ label: segment, path: segmentPath })
  })

  return breadcrumbs
}

/**
 * Get status tag type for NaiveUI
 * Maps backend DiffStatus (NEW, MOD, DEL) to NaiveUI tag types
 */
export function getRegistryStatusTagType(
  status: DiffStatus
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case DiffStatus.New:
      return 'success'
    case DiffStatus.Mod:
      return 'warning'
    case DiffStatus.Del:
      return 'error'
    default:
      return 'default'
  }
}

/**
 * Format registry value for display
 */
export function formatRegistryValue(value: string | undefined, maxLength = 100): string {
  if (!value) return '-'
  if (value.length > maxLength) {
    return value.substring(0, maxLength) + '...'
  }
  return value
}

/**
 * Sort registry entries (keys first, then values, alphabetically)
 */
export function sortRegistryEntries<T extends RegistryEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.type === 'key' && b.type === 'value') return -1
    if (a.type === 'value' && b.type === 'key') return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Parse entity_path from search results into hive, parent path, and target name
 * Format: /SOFTWARE/Microsoft/PolicyManager/... (first component is hive name)
 *
 * Example: "/SOFTWARE/Microsoft/Windows/CurrentVersion/ProductName"
 * Returns: { hiveName: "SOFTWARE", parentPath: "/Microsoft/Windows/CurrentVersion", targetName: "ProductName" }
 */
export function parseRegistryEntityPath(entityPath: string): {
  hiveName: string
  parentPath: string
  targetName: string
} | null {
  if (!entityPath || entityPath === '/') return null

  const segments = splitRegistryPath(entityPath)
  if (segments.length === 0) return null

  const hiveName = segments[0]
  const targetName = segments[segments.length - 1]

  // If only one segment, it's the hive itself
  if (segments.length === 1) {
    return {
      hiveName,
      parentPath: '/',
      targetName: ''
    }
  }

  // Parent path is everything between hive and target
  const parentSegments = segments.slice(1, -1)
  const parentPath = parentSegments.length > 0 ? '/' + parentSegments.join('/') : '/'

  return {
    hiveName,
    parentPath,
    targetName
  }
}

/**
 * Normalize hive names for comparison (handles /SOFTWARE, SOFTWARE/, etc.)
 */
export function normalizeHiveName(hiveName: string): string {
  return hiveName.replace(/^\/+|\/+$/g, '').toUpperCase()
}

/**
 * Match hive by mount path (handles /config/SOFTWARE vs SOFTWARE)
 * Returns true if the mount path contains the hive name
 */
export function matchesHive(mountPath: string, hiveName: string): boolean {
  const normalizedMount = normalizeHiveName(mountPath)
  const normalizedHive = normalizeHiveName(hiveName)
  return normalizedMount.includes(normalizedHive) || normalizedHive.includes(normalizedMount)
}

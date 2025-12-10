/**
 * Export Diff Utility
 *
 * Shared functions for exporting diff data from Filesystem and Registry inspectors
 */

import type { DiffStatus } from '@/types/inspector'

// Types for export data
export interface ExportedDiffEntry {
  path: string
  name: string
  type: string
  status: DiffStatus
  [key: string]: any // Allow additional fields based on component type
}

export interface DiffExportMetadata {
  exportedAt: string
  baseCommit: { name: string; hash: string }
  diffeeCommit: { name: string; hash: string }
  scope: 'local' | 'full'
  path: string // Current path for local, root for full
  totalEntries: number
  hive?: string // Only for registry exports
}

export interface DiffExportData {
  metadata: DiffExportMetadata
  entries: ExportedDiffEntry[]
}

/**
 * Download JSON file to user's browser
 */
export function downloadJsonFile(data: DiffExportData, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate export filename with timestamp
 */
export function generateExportFilename(
  type: 'filesystem' | 'registry',
  baseCommitName: string,
  diffeeCommitName: string,
  scope: 'local' | 'full'
): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${type}-diff-${baseCommitName}-vs-${diffeeCommitName}-${scope}-${timestamp}.json`
}

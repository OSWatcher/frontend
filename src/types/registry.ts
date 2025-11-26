/**
 * Registry Inspector Types
 *
 * Type definitions for the unified Registry Inspector architecture.
 * Follows the same pattern as filesystem types for consistency.
 */

import type { DiffStatus } from '@/graphql-types'

/**
 * Registry Entry Type
 * Represents either a registry key (tree) or value (blob)
 */
export type RegistryEntryType = 'key' | 'value'

/**
 * Registry Hive Information
 */
export interface RegistryHive {
  mountPath: string
  hash: string
}

/**
 * Registry Entry (Single Mode)
 */
export interface RegistryEntry {
  name: string
  type: RegistryEntryType
  path: string
  value?: string
  valueType?: string
}

/**
 * Registry Diff Entry (Comparison Mode)
 */
export interface RegistryDiffEntry extends RegistryEntry {
  status: DiffStatus
  baseValue?: string
  diffeeValue?: string
  baseValueType?: string
  diffeeValueType?: string
}

/**
 * Breadcrumb Item for Registry Navigation
 */
export interface RegistryBreadcrumbItem {
  label: string
  path: string
  icon?: string
}

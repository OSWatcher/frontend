/**
 * Inspector Types
 *
 * This module defines the core types for the unified Inspector architecture.
 * The Inspector provides a single interface for viewing OS snapshots in both
 * single mode (exploring one commit) and comparison mode (diffing two commits).
 *
 * Design Philosophy:
 * - Type-safe interfaces for all inspector modes and layouts
 * - Discriminated unions for clear mode handling
 * - Pure, composable type definitions
 * - LLM-readable documentation for automatic learning
 *
 * @module types/inspector
 */

import { TreeNodeType } from '@/types'

/**
 * Inspector Mode
 *
 * Determines whether the inspector is viewing a single commit
 * or comparing two commits.
 *
 * - 'single': View one commit's data (filesystem, registry, PDB)
 * - 'comparison': Compare two commits side-by-side or unified
 */
export type InspectorMode = 'single' | 'comparison'

/**
 * Inspector Layout
 *
 * Determines how comparison data is displayed.
 * Only applicable when mode is 'comparison'.
 *
 * - 'unified': Show diff in a single table with status indicators
 * - 'side-by-side': Show two tables side-by-side for direct comparison
 */
export type InspectorLayout = 'unified' | 'side-by-side'

/**
 * Commit Context
 *
 * Represents a commit being inspected. Contains both the hash
 * (used for GraphQL queries) and the name (used for display).
 *
 * @property hash - Git commit hash (e.g., "abc123...")
 * @property name - Human-readable commit name (e.g., "Ubuntu 24.04 LTS")
 */
export interface CommitContext {
  hash: string
  name: string
}

/**
 * Filesystem Entry
 *
 * Normalized representation of a filesystem entry (file or directory).
 * Used in both single and comparison modes.
 *
 * @property name - Entry name (e.g., "hosts", "systemd")
 * @property type - Entry type (TreeNodeType.Blob for files, TreeNodeType.Tree for directories)
 * @property hash - Content hash (for lookups and downloads)
 * @property size - Size in bytes (undefined for directories)
 * @property path - Full path from root (e.g., "/etc/systemd/system")
 */
export interface FilesystemEntry {
  name: string
  type: TreeNodeType
  hash: string
  size?: number
  path: string
}

/**
 * Diff Status
 *
 * Indicates how an entry changed between two commits.
 *
 * - 'NEW': Entry exists in diffee but not in base
 * - 'DELETED': Entry exists in base but not in diffee
 * - 'MODIFIED': Entry exists in both but content differs
 * - 'UNCHANGED': Entry exists in both with identical content
 */
export type DiffStatus = 'NEW' | 'DELETED' | 'MODIFIED' | 'UNCHANGED'

/**
 * Filesystem Diff Entry
 *
 * Extends FilesystemEntry with diff-specific information.
 * Used only in comparison mode.
 *
 * @property status - How this entry changed
 * @property baseHash - Hash in base commit (undefined if NEW)
 * @property diffeeHash - Hash in diffee commit (undefined if DELETED)
 * @property baseSize - Size in base commit (undefined if NEW or directory)
 * @property diffeeSize - Size in diffee commit (undefined if DELETED or directory)
 */
export interface FilesystemDiffEntry extends FilesystemEntry {
  status: DiffStatus
  baseHash?: string
  diffeeHash?: string
  baseSize?: number
  diffeeSize?: number
}

/**
 * Inspector Configuration
 *
 * Complete configuration for an inspector instance.
 * Uses discriminated union pattern for type-safe mode handling.
 *
 * Single Mode Example:
 * {
 *   mode: 'single',
 *   commit: { hash: 'abc123', name: 'Ubuntu 24.04' }
 * }
 *
 * Comparison Mode Example:
 * {
 *   mode: 'comparison',
 *   layout: 'unified',
 *   baseCommit: { hash: 'abc123', name: 'Ubuntu 22.04' },
 *   diffeeCommit: { hash: 'def456', name: 'Ubuntu 24.04' }
 * }
 */
export type InspectorConfig =
  | {
      mode: 'single'
      commit: CommitContext
    }
  | {
      mode: 'comparison'
      layout: InspectorLayout
      baseCommit: CommitContext
      diffeeCommit: CommitContext
    }

/**
 * Breadcrumb Item
 *
 * Represents a single segment in the breadcrumb navigation.
 *
 * @property label - Display text (e.g., "Home", "Filesystem", "etc")
 * @property path - Optional navigation path (undefined for non-clickable items)
 * @property icon - Optional icon name for visual enhancement
 */
export interface BreadcrumbItem {
  label: string
  path?: string
  icon?: string
}

/**
 * Inspector Tab
 *
 * Represents a tab in the inspector (Filesystem, Registry, PDB).
 *
 * @property key - Unique identifier (e.g., 'filesystem')
 * @property label - Display text (e.g., 'Filesystem')
 * @property icon - Icon name (e.g., 'folder')
 * @property component - Vue component to render for this tab
 */
export interface InspectorTab {
  key: string
  label: string
  icon: string
  component: any // Component type
}

/**
 * Navigation State
 *
 * Tracks the current navigation context within an inspector.
 *
 * @property currentPath - Current path being viewed (e.g., "/etc/systemd")
 * @property activeTab - Currently active tab key (e.g., 'filesystem')
 */
export interface NavigationState {
  currentPath: string
  activeTab: string
}

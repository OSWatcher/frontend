/**
 * PDB Inspector Types
 *
 * Type definitions for Symbols and Structs explorer.
 */

import type { DiffStatus } from '@/graphql-types'

// ============================================
// Symbol Types
// ============================================

export interface SymbolEntry {
  name: string
  address: string // Formatted as 0x... hex string
  hash?: string // For future diff tracking
}

export interface SymbolDiffEntry extends SymbolEntry {
  status: DiffStatus
  baseAddress?: string // Address in base commit (undefined if NEW)
  diffeeAddress?: string // Address in diffee commit (undefined if DELETED)
}

// ============================================
// Struct Types
// ============================================

/**
 * Represents a struct entry (top-level)
 */
export interface StructEntry {
  name: string
  size: number
  kind: string // "struct", "union", etc.
  hash?: string
  fields?: StructFieldEntry[] // Only populated when expanded
}

/**
 * Represents a struct field
 */
export interface StructFieldEntry {
  name: string
  offset: number
  dataType: string // Formatted C-style type string
  dataTypeRaw?: any // Original JSON for debugging/tooltips
}

/**
 * Internal representation of parsed data_type JSON
 */
export interface ParsedDataType {
  type: string // "base", "pointer", "array", "struct", "union", "enumeration", etc.
  name?: string
  hasDataType?: ParsedDataType // Recursive for pointers/arrays
  arrayCounter?: number
  bitPosition?: number
  bitLength?: number
}

// ============================================
// PDB Context (for ntoskrnl resolution)
// ============================================

export interface PDBContext {
  blobHash: string
  blobName: string // e.g., "ntoskrnl.exe"
}

export interface PDBContextDiff {
  baseBlobHash: string
  diffeeBlobHash: string
  blobName: string // e.g., "ntoskrnl.exe"
}

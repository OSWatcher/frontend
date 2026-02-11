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
 * Field diff status (extends DiffStatus with UNCHANGED)
 */
export type FieldDiffStatus = 'NEW' | 'MOD' | 'DEL' | 'UNCHANGED'

/**
 * Represents a struct field in comparison/diff mode
 */
export interface StructFieldDiffEntry {
  name: string
  status: FieldDiffStatus // Includes UNCHANGED for grayed-out fields
  offset: number // Display offset (diffee if exists, else base)
  dataType: string // Display type (diffee if exists, else base)
  baseOffset?: number // Offset in base (undefined if NEW)
  diffeeOffset?: number // Offset in diffee (undefined if DEL)
  baseDataType?: string // Type in base (undefined if NEW)
  diffeeDataType?: string // Type in diffee (undefined if DEL)
}

/**
 * Represents a struct entry in comparison/diff mode
 */
export interface StructDiffEntry {
  name: string
  status: DiffStatus
  kind: string
  baseSize?: number // Size in base commit (undefined if NEW)
  diffeeSize?: number // Size in diffee commit (undefined if DELETED)
  baseHash?: string
  diffeeHash?: string
  fields?: StructFieldDiffEntry[] // Computed field-level diffs (populated on expansion)
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
// Symbol Blob (for blob selector)
// ============================================

export interface SymbolBlob {
  blobHash: string
  blobPath: string // e.g., "/Windows/System32/ntoskrnl.exe"
  displayName: string // e.g., "ntoskrnl.exe"
}

// ============================================
// PDB Context (resolved blob for inspection)
// ============================================

export interface PDBContext {
  blobHash: string
  blobName: string // e.g., "ntoskrnl.exe"
  blobPath: string // e.g., "/Windows/System32/ntoskrnl.exe"
}

export interface PDBContextDiff {
  baseBlobHash: string
  diffeeBlobHash: string
  blobName: string // e.g., "ntoskrnl.exe"
  blobPath: string // e.g., "/Windows/System32/ntoskrnl.exe"
}

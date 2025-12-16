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

/**
 * PDB Inspector Types
 *
 * Type definitions for Symbols and Structs explorer.
 */

// ============================================
// Symbol Types
// ============================================

export interface SymbolEntry {
  name: string
  address: string // Formatted as 0x... hex string
  hash?: string // For future diff tracking
}

// ============================================
// PDB Context (for ntoskrnl resolution)
// ============================================

export interface PDBContext {
  blobHash: string
  blobName: string // e.g., "ntoskrnl.exe"
}

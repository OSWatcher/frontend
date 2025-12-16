/**
 * PDB Utility Functions
 *
 * Pure functions for PDB data transformation.
 * All functions are side-effect free and easily testable.
 */

import type { SymbolEntry, SymbolDiffEntry } from '@/types/pdb'
import { DiffStatus } from '@/graphql-types'

// ============================================
// Symbol Parsing
// ============================================

/**
 * Parse raw symbol data from GraphQL into normalized SymbolEntry objects
 * @param rawSymbols - Raw symbol data from fetchSymbols query
 * @returns Array of normalized SymbolEntry objects
 */
export function parseSymbolEntries(
  rawSymbols: Array<{ name: string; address: string }>
): SymbolEntry[] {
  return rawSymbols.map((sym) => ({
    name: sym.name,
    address: formatAddress(sym.address)
  }))
}

/**
 * Parse raw diff items from DIFF_NODES query into SymbolDiffEntry objects
 * @param rawDiffItems - Raw diff items from DIFF_NODES query
 * @returns Array of SymbolDiffEntry objects with status and addresses
 */
export function parseSymbolDiffEntries(
  rawDiffItems: Array<{
    path: string
    status: string
    old_props?: { properties?: { address?: string } } | null
    new_props?: { properties?: { address?: string } } | null
  }>
): SymbolDiffEntry[] {
  return rawDiffItems.map((item) => {
    const oldAddress = item.old_props?.properties?.address
    const newAddress = item.new_props?.properties?.address
    const displayAddress = newAddress || oldAddress || '0'

    return {
      name: item.path, // Symbol name is in path
      address: formatAddress(displayAddress),
      status: item.status as DiffStatus,
      baseAddress: oldAddress ? formatAddress(oldAddress) : undefined,
      diffeeAddress: newAddress ? formatAddress(newAddress) : undefined
    }
  })
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format address as hexadecimal string with 0x prefix
 * Handles both string and numeric inputs
 * @param address - Address as string or number
 * @returns Formatted hex string (e.g., "0x00007FF123456789")
 */
export function formatAddress(address: string | number): string {
  const num = typeof address === 'string' ? parseInt(address, 10) : address
  if (isNaN(num)) {
    return '0x0000000000000000'
  }
  return `0x${num.toString(16).toUpperCase().padStart(16, '0')}`
}

/**
 * Format offset as hexadecimal string with 0x prefix (4-digit)
 * Used for struct field offsets
 * @param offset - Offset value in bytes
 * @returns Formatted hex string (e.g., "0x0010")
 */
export function formatOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * Format size as hexadecimal string with 0x prefix
 * Used for struct sizes
 * @param size - Size value in bytes
 * @returns Formatted hex string (e.g., "0x438")
 */
export function formatSize(size: number): string {
  return `0x${size.toString(16).toUpperCase()}`
}

// ============================================
// Sorting
// ============================================

/**
 * Sort symbols alphabetically by name (case-insensitive)
 * Returns a new array without mutating the original
 * @param entries - Array of symbol entries
 * @returns New sorted array
 */
export function sortSymbols<T extends SymbolEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
}

// ============================================
// Status Helpers
// ============================================

/**
 * Map DiffStatus to Naive UI tag type for visual styling
 * @param status - DiffStatus from GraphQL
 * @returns Naive UI tag type (success, warning, error, default)
 */
export function getStatusTagType(
  status: DiffStatus
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case DiffStatus.New:
      return 'success' // Green
    case DiffStatus.Mod:
      return 'warning' // Yellow
    case DiffStatus.Del:
      return 'error' // Red
    default:
      return 'default' // Gray
  }
}

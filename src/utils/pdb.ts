/**
 * PDB Utility Functions
 *
 * Pure functions for PDB data transformation.
 * All functions are side-effect free and easily testable.
 */

import type {
  SymbolEntry,
  SymbolDiffEntry,
  StructEntry,
  StructFieldEntry as _StructFieldEntry,
  ParsedDataType
} from '@/types/pdb'
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
// Struct Parsing
// ============================================

/**
 * Parse data_type JSON field into structured representation
 * @param dataTypeJson - Raw JSON from data_type field
 * @returns Parsed data type structure
 */
export function parseDataType(dataTypeJson: any): ParsedDataType {
  if (!dataTypeJson || typeof dataTypeJson !== 'object') {
    return { type: 'unknown', name: 'unknown' }
  }

  const parsed: ParsedDataType = {
    type: dataTypeJson.type || 'unknown',
    name: dataTypeJson.name || undefined,
    arrayCounter: dataTypeJson.array_counter || undefined,
    bitPosition: dataTypeJson.bit_position || undefined,
    bitLength: dataTypeJson.bit_length || undefined
  }

  // Recursively parse nested data type (for pointers, arrays, etc.)
  if (dataTypeJson.has_data_type) {
    parsed.hasDataType = parseDataType(dataTypeJson.has_data_type)
  }

  return parsed
}

/**
 * Format parsed data type as C-style type string
 * @param dataType - Parsed data type structure
 * @returns C-style type string (e.g., "void*", "char[15]", "struct _FOO")
 */
export function formatDataType(dataType: ParsedDataType): string {
  if (!dataType || !dataType.type) {
    return 'unknown'
  }

  switch (dataType.type) {
    case 'base':
      // Base types: unsigned long, char, void, int, etc.
      return dataType.name || 'unknown'

    case 'pointer': {
      // Pointers: void*, struct _FOO*, etc.
      if (!dataType.hasDataType) {
        return 'void*'
      }
      const innerType = formatDataType(dataType.hasDataType)
      return `${innerType}*`
    }

    case 'array': {
      // Arrays: char[15], unsigned long[4], etc.
      if (!dataType.hasDataType) {
        return 'unknown[]'
      }
      const innerType = formatDataType(dataType.hasDataType)
      const count = dataType.arrayCounter !== undefined ? dataType.arrayCounter : ''
      return `${innerType}[${count}]`
    }

    case 'struct':
      // Structs: struct _EPROCESS, struct _LIST_ENTRY, etc.
      return dataType.name ? `struct ${dataType.name}` : 'struct'

    case 'union':
      // Unions: union _LARGE_INTEGER, etc.
      return dataType.name ? `union ${dataType.name}` : 'union'

    case 'enumeration':
      // Enumerations: enum _KWAIT_REASON, etc.
      return dataType.name ? `enum ${dataType.name}` : 'enum'

    case 'bitfield':
      // Bit fields: unsigned long : 3
      if (dataType.hasDataType && dataType.bitLength !== undefined) {
        const baseType = formatDataType(dataType.hasDataType)
        return `${baseType} : ${dataType.bitLength}`
      }
      return 'bitfield'

    default:
      // Unknown types - show type name
      return dataType.name || dataType.type
  }
}

/**
 * Check if data type is a struct or union (for future linking feature)
 * @param dataType - Parsed data type structure
 * @returns True if type is struct or union
 */
export function isStructType(dataType: ParsedDataType): boolean {
  return dataType.type === 'struct' || dataType.type === 'union'
}

/**
 * Parse raw struct data from GraphQL response
 * @param rawStructs - Raw struct data from fetchStructs query
 * @returns Array of normalized StructEntry objects
 */
export function parseStructEntries(
  rawStructs: Array<{
    name: string
    size: number
    kind: string
    fields: Array<{
      name: string
      offset: number
      data_type: any
    }>
  }>
): StructEntry[] {
  return rawStructs.map((struct) => ({
    name: struct.name,
    size: struct.size,
    kind: struct.kind,
    fields: struct.fields.map((field) => {
      const parsedDataType = parseDataType(field.data_type)
      return {
        name: field.name,
        offset: field.offset,
        dataType: formatDataType(parsedDataType),
        dataTypeRaw: field.data_type
      }
    })
  }))
}

/**
 * Sort structs alphabetically by name (case-insensitive)
 * Returns a new array without mutating the original
 * @param entries - Array of struct entries
 * @returns New sorted array
 */
export function sortStructs<T extends StructEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
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
export function getStatusTagType(status: DiffStatus): 'success' | 'warning' | 'error' | 'default' {
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

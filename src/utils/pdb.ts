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
  StructDiffEntry,
  StructFieldDiffEntry,
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
 * @param dataTypeJson - Raw JSON from data_type field (backend format)
 * @returns Parsed data type structure
 */
export function parseDataType(dataTypeJson: any): ParsedDataType {
  if (!dataTypeJson || typeof dataTypeJson !== 'object') {
    return { type: 'unknown', name: 'unknown' }
  }

  // Backend uses 'kind' field with case variations (Base, base, etc.)
  const rawKind = dataTypeJson.kind || 'unknown'
  const kind = rawKind.toLowerCase()

  const parsed: ParsedDataType = {
    type: kind,
    name: dataTypeJson.name || undefined,
    arrayCounter: dataTypeJson.count ?? undefined,
    bitPosition: dataTypeJson.bit_position ?? undefined,
    bitLength: dataTypeJson.bit_length ?? undefined
  }

  // Handle nested types:
  // - 'subtype' for pointers/arrays
  // - 'type' for bitfields (contains base type object)
  const nestedType = dataTypeJson.subtype || (kind === 'bitfield' ? dataTypeJson.type : null)

  if (nestedType && typeof nestedType === 'object') {
    parsed.hasDataType = parseDataType(nestedType)
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

    case 'enum':
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
 * Parse raw diff items from DIFF_NODES query into StructDiffEntry objects
 * @param rawDiffItems - Raw diff items from DIFF_NODES query
 * @returns Array of StructDiffEntry objects with status and sizes
 */
export function parseStructDiffEntries(
  rawDiffItems: Array<{
    path: string
    status: string
    old_props?: { hash?: string; properties?: { size?: number; kind?: string } } | null
    new_props?: { hash?: string; properties?: { size?: number; kind?: string } } | null
  }>
): StructDiffEntry[] {
  return rawDiffItems.map((item) => {
    const oldSize = item.old_props?.properties?.size
    const newSize = item.new_props?.properties?.size
    const kind = item.new_props?.properties?.kind || item.old_props?.properties?.kind || 'struct'

    return {
      name: item.path, // Struct name is in path
      status: item.status as DiffStatus,
      kind,
      baseSize: oldSize,
      diffeeSize: newSize,
      baseHash: item.old_props?.hash,
      diffeeHash: item.new_props?.hash
    }
  })
}

/**
 * Parse a JSON field that may be stringified (from diffNodesAt API)
 * @param value - Raw value that may be a string or object
 * @returns Parsed object or null if invalid
 */
function parseJsonField(value: any): any {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

/**
 * Parse field-level diff entries from DIFF_NODES response
 * @param rawDiffItems - Raw diff items from DIFF_NODES query on Struct node
 * @returns Array of StructFieldDiffEntry with status for each field
 */
export function parseFieldDiffEntries(
  rawDiffItems: Array<{
    path: string
    status: string
    old_props?: {
      properties?: {
        offset?: number
        data_type?: any
      }
    } | null
    new_props?: {
      properties?: {
        offset?: number
        data_type?: any
      }
    } | null
  }>
): StructFieldDiffEntry[] {
  const entries = rawDiffItems.map((item) => {
    const oldOffset = item.old_props?.properties?.offset
    const newOffset = item.new_props?.properties?.offset

    // Parse data_type - may be stringified JSON from diffNodesAt API
    const oldDataType = parseJsonField(item.old_props?.properties?.data_type)
    const newDataType = parseJsonField(item.new_props?.properties?.data_type)

    // Parse and format data types
    const baseDataType = oldDataType ? formatDataType(parseDataType(oldDataType)) : undefined
    const diffeeDataType = newDataType ? formatDataType(parseDataType(newDataType)) : undefined

    // Determine display offset and type (prefer diffee, fallback to base)
    const displayOffset = newOffset !== undefined ? newOffset : oldOffset || 0
    const displayDataType = diffeeDataType || baseDataType || 'unknown'

    return {
      name: item.path,
      status: item.status as 'NEW' | 'MOD' | 'DEL' | 'UNCHANGED',
      offset: displayOffset,
      dataType: displayDataType,
      baseOffset: oldOffset,
      diffeeOffset: newOffset,
      baseDataType,
      diffeeDataType
    }
  })

  // Sort by offset (smallest to highest)
  return entries.sort((a, b) => a.offset - b.offset)
}

/**
 * Sort structs alphabetically by name (case-insensitive)
 * Returns a new array without mutating the original
 * @param entries - Array of struct entries
 * @returns New sorted array
 */
export function sortStructs<T extends { name: string }>(entries: T[]): T[] {
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

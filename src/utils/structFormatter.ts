/**
 * Struct Formatter Utility
 *
 * Generates C struct definitions from field entries for Monaco diff display.
 */

import type { StructFieldDiffEntry } from '@/types/pdb'

/**
 * Generate C struct definition from field entries for diff display
 *
 * Converts struct field metadata into a formatted C typedef declaration suitable
 * for displaying in Monaco Editor diff view. Handles version-specific field filtering
 * (NEW fields excluded from base, DEL fields excluded from diffee) and uses
 * version-appropriate offsets and data types.
 *
 * @param structName - Name of the struct (e.g., "_EPROCESS" or "EPROCESS")
 *                     Leading underscore is handled automatically to avoid double underscores
 * @param structSize - Total size of the struct in bytes (must be non-negative)
 * @param fields - Array of struct field diff entries, sorted by offset
 * @param version - Which version to generate:
 *                  - 'base': Uses baseOffset/baseDataType, excludes NEW fields
 *                  - 'diffee': Uses diffeeOffset/diffeeDataType, excludes DEL fields
 * @returns Formatted C struct definition as a multi-line string
 *
 * @example
 * ```typescript
 * const fields = [
 *   { name: 'pid', status: 'UNCHANGED', offset: 0, baseOffset: 0, dataType: 'unsigned long' }
 * ]
 * const code = generateStructText('_EPROCESS', 16, fields, 'base')
 * // Returns:
 * // typedef struct _EPROCESS {
 * //     /* 0x0000 *\/ unsigned long pid;
 * // } EPROCESS; /* size: 0x10 *\/
 * ```
 *
 * @throws {Error} If structSize is negative
 */
export function generateStructText(
  structName: string,
  structSize: number,
  fields: StructFieldDiffEntry[],
  version: 'base' | 'diffee'
): string {
  // Validate inputs
  if (structSize < 0) {
    throw new Error(`Invalid struct size: ${structSize}. Size must be non-negative.`)
  }

  const lines: string[] = []

  // Struct header - avoid double underscore if name already starts with _
  const structTag = structName.startsWith('_') ? structName : `_${structName}`
  lines.push(`typedef struct ${structTag} {`)

  // Generate field lines
  for (const field of fields) {
    // Skip fields that don't exist in this version
    if (version === 'base' && field.status === 'NEW') continue
    if (version === 'diffee' && field.status === 'DEL') continue

    // Get version-specific offset and type
    const offset =
      version === 'base' ? field.baseOffset ?? field.offset : field.diffeeOffset ?? field.offset
    const dataType =
      version === 'base'
        ? field.baseDataType ?? field.dataType
        : field.diffeeDataType ?? field.dataType

    // Format: "    /* 0x0010 */ unsigned long FieldName;"
    const offsetHex = `0x${offset.toString(16).toUpperCase().padStart(4, '0')}`
    lines.push(`    /* ${offsetHex} */ ${dataType} ${field.name};`)
  }

  // Struct footer with size
  const sizeHex = `0x${structSize.toString(16).toUpperCase()}`
  const typedefName = structName.startsWith('_') ? structName.slice(1) : structName
  lines.push(`} ${typedefName}; /* size: ${sizeHex} */`)

  return lines.join('\n')
}

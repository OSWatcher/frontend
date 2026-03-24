/**
 * Struct Formatter Utility
 *
 * Generates C struct definitions from field entries for Monaco diff display.
 */

import type { StructFieldEntry, StructFieldDiffEntry } from '@/types/pdb'

export interface StructFieldHistoryTarget {
  lineNumber: number
  fieldName: string
  fieldPath: string
}

export interface StructRenderModel {
  code: string
  fieldTargets: StructFieldHistoryTarget[]
}

interface RenderableField {
  name: string
  offset: number
  dataType: string
  fieldPath: string
}

function getStructNames(structName: string) {
  return {
    structTag: structName.startsWith('_') ? structName : `_${structName}`,
    typedefName: structName.startsWith('_') ? structName.slice(1) : structName
  }
}

function buildStructRenderModel(
  structName: string,
  structSize: number,
  fields: RenderableField[]
): StructRenderModel {
  const { structTag, typedefName } = getStructNames(structName)
  const lines: string[] = [`typedef struct ${structTag} {`]
  const fieldTargets: StructFieldHistoryTarget[] = []

  for (const field of fields) {
    const offsetHex = `0x${field.offset.toString(16).toUpperCase().padStart(4, '0')}`
    const lineNumber = lines.length + 1
    lines.push(`    /* ${offsetHex} */ ${field.dataType} ${field.name};`)
    fieldTargets.push({
      lineNumber,
      fieldName: field.name,
      fieldPath: field.fieldPath
    })
  }

  const sizeHex = `0x${structSize.toString(16).toUpperCase()}`
  lines.push(`} ${typedefName}; /* size: ${sizeHex} */`)

  return {
    code: lines.join('\n'),
    fieldTargets
  }
}

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
  return generateStructRenderModel(structName, structSize, fields, version).code
}

export function generateStructRenderModel(
  structName: string,
  structSize: number,
  fields: StructFieldDiffEntry[],
  version: 'base' | 'diffee'
): StructRenderModel {
  // Validate inputs
  if (structSize < 0) {
    throw new Error(`Invalid struct size: ${structSize}. Size must be non-negative.`)
  }

  const renderableFields: RenderableField[] = []

  for (const field of fields) {
    if (version === 'base' && field.status === 'NEW') continue
    if (version === 'diffee' && field.status === 'DEL') continue

    const offset =
      version === 'base' ? field.baseOffset ?? field.offset : field.diffeeOffset ?? field.offset
    const dataType =
      version === 'base'
        ? field.baseDataType ?? field.dataType
        : field.diffeeDataType ?? field.dataType

    renderableFields.push({
      name: field.name,
      offset,
      dataType,
      fieldPath: field.name
    })
  }

  return buildStructRenderModel(structName, structSize, renderableFields)
}

/**
 * Generate C struct definition from field entries for single mode display
 *
 * Converts struct field metadata into a formatted C typedef declaration suitable
 * for displaying in Monaco Editor (single mode, not diff). Simpler than the diff
 * version as it doesn't need version-specific handling.
 *
 * @param structName - Name of the struct (e.g., "_EPROCESS" or "EPROCESS")
 *                     Leading underscore is handled automatically to avoid double underscores
 * @param structSize - Total size of the struct in bytes (must be non-negative)
 * @param fields - Array of struct field entries, sorted by offset
 * @returns Formatted C struct definition as a multi-line string
 *
 * @example
 * ```typescript
 * const fields = [
 *   { name: 'pid', offset: 0, dataType: 'unsigned long' }
 * ]
 * const code = generateStructTextSingle('_EPROCESS', 16, fields)
 * // Returns:
 * // typedef struct _EPROCESS {
 * //     /* 0x0000 *\/ unsigned long pid;
 * // } EPROCESS; /* size: 0x10 *\/
 * ```
 *
 * @throws {Error} If structSize is negative
 */
export function generateStructTextSingle(
  structName: string,
  structSize: number,
  fields: StructFieldEntry[]
): string {
  return generateStructRenderModelSingle(structName, structSize, fields).code
}

export function generateStructRenderModelSingle(
  structName: string,
  structSize: number,
  fields: StructFieldEntry[]
): StructRenderModel {
  // Validate inputs
  if (structSize < 0) {
    throw new Error(`Invalid struct size: ${structSize}. Size must be non-negative.`)
  }

  return buildStructRenderModel(
    structName,
    structSize,
    fields.map((field) => ({
      name: field.name,
      offset: field.offset,
      dataType: field.dataType,
      fieldPath: field.name
    }))
  )
}

import { describe, it, expect } from 'vitest'
import { generateStructText } from '../structFormatter'
import type { StructFieldDiffEntry } from '@/types/pdb'

describe('generateStructText', () => {
  it('should generate C struct text for base version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'field1',
        status: 'UNCHANGED',
        offset: 0,
        dataType: 'unsigned long',
        baseOffset: 0,
        diffeeOffset: 0,
        baseDataType: 'unsigned long',
        diffeeDataType: 'unsigned long'
      },
      {
        name: 'field2',
        status: 'UNCHANGED',
        offset: 8,
        dataType: 'void*',
        baseOffset: 8,
        diffeeOffset: 8,
        baseDataType: 'void*',
        diffeeDataType: 'void*'
      }
    ]

    const result = generateStructText('TEST_STRUCT', 16, fields, 'base')

    expect(result).toContain('typedef struct _TEST_STRUCT {')
    expect(result).toContain('/* 0x0000 */ unsigned long field1;')
    expect(result).toContain('/* 0x0008 */ void* field2;')
    expect(result).toContain('} TEST_STRUCT; /* size: 0x10 */')
  })

  it('should skip NEW fields in base version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'oldField',
        status: 'UNCHANGED',
        offset: 0,
        dataType: 'int',
        baseOffset: 0,
        diffeeOffset: 0,
        baseDataType: 'int',
        diffeeDataType: 'int'
      },
      {
        name: 'newField',
        status: 'NEW',
        offset: 4,
        dataType: 'long',
        diffeeOffset: 4,
        diffeeDataType: 'long'
      }
    ]

    const result = generateStructText('TEST_STRUCT', 8, fields, 'base')

    expect(result).toContain('oldField')
    expect(result).not.toContain('newField')
  })

  it('should skip DEL fields in diffee version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'deletedField',
        status: 'DEL',
        offset: 0,
        dataType: 'int',
        baseOffset: 0,
        baseDataType: 'int'
      },
      {
        name: 'remainingField',
        status: 'UNCHANGED',
        offset: 4,
        dataType: 'long',
        baseOffset: 4,
        diffeeOffset: 4,
        baseDataType: 'long',
        diffeeDataType: 'long'
      }
    ]

    const result = generateStructText('TEST_STRUCT', 8, fields, 'diffee')

    expect(result).not.toContain('deletedField')
    expect(result).toContain('remainingField')
  })

  it('should use version-specific offset and dataType for MOD fields', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'modifiedField',
        status: 'MOD',
        offset: 8,
        dataType: 'unsigned long*',
        baseOffset: 4,
        diffeeOffset: 8,
        baseDataType: 'unsigned int*',
        diffeeDataType: 'unsigned long*'
      }
    ]

    const baseResult = generateStructText('TEST_STRUCT', 12, fields, 'base')
    const diffeeResult = generateStructText('TEST_STRUCT', 16, fields, 'diffee')

    expect(baseResult).toContain('/* 0x0004 */ unsigned int* modifiedField;')
    expect(diffeeResult).toContain('/* 0x0008 */ unsigned long* modifiedField;')
  })

  it('should format offsets with leading zeros', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'field',
        status: 'UNCHANGED',
        offset: 255,
        dataType: 'char',
        baseOffset: 255,
        diffeeOffset: 255,
        baseDataType: 'char',
        diffeeDataType: 'char'
      }
    ]

    const result = generateStructText('TEST_STRUCT', 256, fields, 'base')

    expect(result).toContain('/* 0x00FF */')
  })
})

describe('generateStructText - version-specific offset handling', () => {
  it('should use baseOffset for base version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'NumberOfUltraMdlMaps',
        status: 'MOD',
        offset: 496,
        baseOffset: 488,
        diffeeOffset: 496,
        dataType: 'unknown',
        baseDataType: 'unknown',
        diffeeDataType: 'unknown'
      }
    ]

    const baseResult = generateStructText('MI_SYSTEM_PTE_STATE', 500, fields, 'base')

    expect(baseResult).toContain('/* 0x01E8 */ unknown NumberOfUltraMdlMaps;') // 488 = 0x1E8
  })

  it('should use diffeeOffset for diffee version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'NumberOfUltraMdlMaps',
        status: 'MOD',
        offset: 496,
        baseOffset: 488,
        diffeeOffset: 496,
        dataType: 'unknown',
        baseDataType: 'unknown',
        diffeeDataType: 'unknown'
      }
    ]

    const diffeeResult = generateStructText('MI_SYSTEM_PTE_STATE', 500, fields, 'diffee')

    expect(diffeeResult).toContain('/* 0x01F0 */ unknown NumberOfUltraMdlMaps;') // 496 = 0x1F0
  })

  it('should generate different base and diffee versions for MOD struct', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'MdlTrackerLookaside',
        status: 'UNCHANGED',
        offset: 0,
        baseOffset: 0,
        diffeeOffset: 0,
        dataType: 'unknown',
        baseDataType: 'unknown',
        diffeeDataType: 'unknown'
      },
      {
        name: 'BreakMakePte',
        status: 'NEW',
        offset: 424,
        diffeeOffset: 424,
        dataType: 'unknown',
        diffeeDataType: 'unknown'
      },
      {
        name: 'UltraSpaceContext',
        status: 'MOD',
        offset: 432,
        baseOffset: 424,
        diffeeOffset: 432,
        dataType: 'unknown',
        baseDataType: 'unknown',
        diffeeDataType: 'unknown'
      },
      {
        name: 'NumberOfUltraMdlMaps',
        status: 'MOD',
        offset: 496,
        baseOffset: 488,
        diffeeOffset: 496,
        dataType: 'unknown',
        baseDataType: 'unknown',
        diffeeDataType: 'unknown'
      }
    ]

    const baseCode = generateStructText('MI_SYSTEM_PTE_STATE', 500, fields, 'base')
    const diffeeCode = generateStructText('MI_SYSTEM_PTE_STATE', 512, fields, 'diffee')

    // Base version should NOT include NEW field
    expect(baseCode).not.toContain('BreakMakePte')

    // Diffee version SHOULD include NEW field
    expect(diffeeCode).toContain('BreakMakePte')

    // Both should include UNCHANGED field at same offset
    expect(baseCode).toContain('/* 0x0000 */ unknown MdlTrackerLookaside;')
    expect(diffeeCode).toContain('/* 0x0000 */ unknown MdlTrackerLookaside;')

    // MOD fields should have different offsets
    expect(baseCode).toContain('/* 0x01A8 */ unknown UltraSpaceContext;') // 424 = 0x1A8
    expect(diffeeCode).toContain('/* 0x01B0 */ unknown UltraSpaceContext;') // 432 = 0x1B0

    // Size should be different
    expect(baseCode).toContain('size: 0x1F4') // 500
    expect(diffeeCode).toContain('size: 0x200') // 512
  })
})

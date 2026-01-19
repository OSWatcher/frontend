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

  it('should handle struct names with existing underscore prefix', () => {
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
      }
    ]

    const result = generateStructText('_ETHREAD', 16, fields, 'base')

    // Should NOT have double underscore
    expect(result).toContain('typedef struct _ETHREAD {')
    expect(result).not.toContain('typedef struct __ETHREAD {')
    // Typedef name should be without underscore
    expect(result).toContain('} ETHREAD; /* size: 0x10 */')
  })

  it('should handle struct names without underscore prefix', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'field1',
        status: 'UNCHANGED',
        offset: 0,
        dataType: 'int',
        baseOffset: 0,
        diffeeOffset: 0,
        baseDataType: 'int',
        diffeeDataType: 'int'
      }
    ]

    const result = generateStructText('MyStruct', 8, fields, 'base')

    // Should add underscore to struct tag
    expect(result).toContain('typedef struct _MyStruct {')
    // Typedef name should be without underscore
    expect(result).toContain('} MyStruct; /* size: 0x8 */')
  })

  it('should throw error for negative struct size', () => {
    const fields: StructFieldDiffEntry[] = []

    expect(() => generateStructText('TEST_STRUCT', -10, fields, 'base')).toThrow(
      'Invalid struct size: -10'
    )
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

describe('generateStructText - edge cases', () => {
  it('should handle empty fields array', () => {
    const result = generateStructText('TEST_STRUCT', 0, [], 'base')

    expect(result).toContain('typedef struct _TEST_STRUCT {')
    expect(result).toContain('} TEST_STRUCT; /* size: 0x0 */')
    // Should have a valid struct even with no fields
    expect(result.split('\n')).toHaveLength(2) // Header and footer only
  })

  it('should handle zero struct size', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'field1',
        status: 'UNCHANGED',
        offset: 0,
        dataType: 'void',
        baseOffset: 0,
        diffeeOffset: 0
      }
    ]

    const result = generateStructText('EMPTY', 0, fields, 'base')

    expect(result).toContain('size: 0x0')
  })

  it('should handle large offsets with proper hex formatting', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'largeOffsetField',
        status: 'UNCHANGED',
        offset: 65535, // 0xFFFF - exactly 4 hex digits
        dataType: 'int',
        baseOffset: 65535,
        diffeeOffset: 65535
      },
      {
        name: 'veryLargeOffsetField',
        status: 'UNCHANGED',
        offset: 1048576, // 0x100000 - 6 hex digits
        dataType: 'long',
        baseOffset: 1048576,
        diffeeOffset: 1048576
      }
    ]

    const result = generateStructText('LARGE', 1048580, fields, 'base')

    // Should handle 4-digit hex
    expect(result).toContain('/* 0xFFFF */ int largeOffsetField;')
    // Should handle larger hex values (padStart only pads to minimum, doesn't truncate)
    expect(result).toContain('/* 0x100000 */ long veryLargeOffsetField;')
  })

  it('should skip fields when offset is undefined for the requested version', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'goodField',
        status: 'UNCHANGED',
        offset: 0,
        dataType: 'int',
        baseOffset: 0,
        diffeeOffset: 0
      },
      {
        name: 'newFieldNoBaseOffset',
        status: 'NEW',
        offset: 4,
        dataType: 'long',
        diffeeOffset: 4
        // baseOffset is undefined
      }
    ]

    const baseResult = generateStructText('TEST', 8, fields, 'base')

    // Base version should have goodField
    expect(baseResult).toContain('goodField')
    // Base version should skip NEW field (even though it would be skipped anyway)
    expect(baseResult).not.toContain('newFieldNoBaseOffset')
  })

  it('should handle very large struct sizes', () => {
    const fields: StructFieldDiffEntry[] = []
    const hugeSize = 16777216 // 0x1000000 (16MB)

    const result = generateStructText('HUGE', hugeSize, fields, 'base')

    expect(result).toContain('size: 0x1000000')
  })

  it('should handle all fields being filtered out', () => {
    const fields: StructFieldDiffEntry[] = [
      {
        name: 'newField1',
        status: 'NEW',
        offset: 0,
        dataType: 'int',
        diffeeOffset: 0
      },
      {
        name: 'newField2',
        status: 'NEW',
        offset: 4,
        dataType: 'long',
        diffeeOffset: 4
      }
    ]

    // Base version should filter out all NEW fields
    const result = generateStructText('TEST', 8, fields, 'base')

    expect(result).toContain('typedef struct _TEST {')
    expect(result).toContain('} TEST;')
    expect(result).not.toContain('newField1')
    expect(result).not.toContain('newField2')
    // Should only have header and footer
    expect(result.split('\n')).toHaveLength(2)
  })
})

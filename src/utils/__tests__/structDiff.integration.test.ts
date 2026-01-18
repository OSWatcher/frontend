import { describe, it, expect } from 'vitest'
import { parseFieldDiffEntries } from '../pdb'
import { generateStructText } from '../structFormatter'

describe('Struct Diff Integration - GraphQL to C struct', () => {
  it('should transform _MI_SYSTEM_PTE_STATE GraphQL response to correct base/diffee C structs', () => {
    // Use the exact GraphQL response from user's sample
    const graphqlResponse = {
      items: [
        {
          path: 'MdlTrackerLookaside',
          status: 'UNCHANGED',
          type: 'StructField',
          old_props: { properties: { offset: 0 } },
          new_props: { properties: { offset: 0 } }
        },
        {
          path: 'BreakMakePte',
          status: 'NEW',
          type: 'StructField',
          old_props: null,
          new_props: { properties: { offset: 424 } }
        },
        {
          path: 'UltraSpaceContext',
          status: 'MOD',
          type: 'StructField',
          old_props: { properties: { offset: 424 } },
          new_props: { properties: { offset: 432 } }
        },
        {
          path: 'NumberOfUltraMdlMaps',
          status: 'MOD',
          type: 'StructField',
          old_props: { properties: { offset: 488 } },
          new_props: { properties: { offset: 496 } }
        },
        {
          path: 'UltraMdlNodeMappings',
          status: 'MOD',
          type: 'StructField',
          old_props: { properties: { offset: 496 } },
          new_props: { properties: { offset: 504 } }
        }
      ]
    }

    // Step 1: Transform GraphQL to StructFieldDiffEntry
    const fields = parseFieldDiffEntries(graphqlResponse.items)

    // Step 2: Generate base C struct
    const baseStruct = generateStructText('MI_SYSTEM_PTE_STATE', 500, fields, 'base')

    // Step 3: Generate diffee C struct
    const diffeeStruct = generateStructText('MI_SYSTEM_PTE_STATE', 512, fields, 'diffee')

    // Verify base struct
    const baseLines = baseStruct.split('\n')
    expect(baseLines[0]).toBe('typedef struct _MI_SYSTEM_PTE_STATE {')
    expect(baseStruct).toContain('/* 0x0000 */ unknown MdlTrackerLookaside;')
    expect(baseStruct).toContain('/* 0x01A8 */ unknown UltraSpaceContext;') // 424
    expect(baseStruct).toContain('/* 0x01E8 */ unknown NumberOfUltraMdlMaps;') // 488
    expect(baseStruct).toContain('/* 0x01F0 */ unknown UltraMdlNodeMappings;') // 496
    expect(baseStruct).not.toContain('BreakMakePte') // NEW field excluded
    expect(baseStruct).toContain('size: 0x1F4') // 500

    // Verify diffee struct
    const diffeeLines = diffeeStruct.split('\n')
    expect(diffeeLines[0]).toBe('typedef struct _MI_SYSTEM_PTE_STATE {')
    expect(diffeeStruct).toContain('/* 0x0000 */ unknown MdlTrackerLookaside;')
    expect(diffeeStruct).toContain('/* 0x01A8 */ unknown BreakMakePte;') // 424 - NEW field included
    expect(diffeeStruct).toContain('/* 0x01B0 */ unknown UltraSpaceContext;') // 432 - MOD offset changed
    expect(diffeeStruct).toContain('/* 0x01F0 */ unknown NumberOfUltraMdlMaps;') // 496 - MOD offset changed
    expect(diffeeStruct).toContain('/* 0x01F8 */ unknown UltraMdlNodeMappings;') // 504 - MOD offset changed
    expect(diffeeStruct).toContain('size: 0x200') // 512

    // Critical assertion: base and diffee should be DIFFERENT
    expect(baseStruct).not.toBe(diffeeStruct)
  })
})

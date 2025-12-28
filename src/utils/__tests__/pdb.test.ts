import { describe, it, expect } from 'vitest'
import {
  parseSymbolEntries,
  parseSymbolDiffEntries,
  parseFieldDiffEntries,
  formatAddress,
  formatOffset,
  formatSize,
  sortSymbols,
  getStatusTagType,
  parseDataType,
  formatDataType,
  isStructType,
  parseStructEntries,
  sortStructs
} from '../pdb'
import type { SymbolEntry, StructEntry } from '@/types/pdb'
import { DiffStatus } from '@/graphql-types'

describe('pdb utils', () => {
  describe('formatAddress', () => {
    it('formats numeric address as 16-digit hex string', () => {
      expect(formatAddress(0)).toBe('0x0000000000000000')
      expect(formatAddress(255)).toBe('0x00000000000000FF')
      expect(formatAddress(4316144)).toBe('0x000000000041DBF0')
    })

    it('formats string address as hex', () => {
      expect(formatAddress('0')).toBe('0x0000000000000000')
      expect(formatAddress('4316144')).toBe('0x000000000041DBF0')
    })

    it('handles invalid input gracefully', () => {
      expect(formatAddress('invalid')).toBe('0x0000000000000000')
      expect(formatAddress(NaN)).toBe('0x0000000000000000')
    })

    it('pads with leading zeros', () => {
      expect(formatAddress(1)).toBe('0x0000000000000001')
      expect(formatAddress(15)).toBe('0x000000000000000F')
    })

    it('uppercases hex digits', () => {
      expect(formatAddress(0xabcdef)).toBe('0x0000000000ABCDEF')
    })
  })

  describe('formatOffset', () => {
    it('formats offset as 4-digit hex string', () => {
      expect(formatOffset(0)).toBe('0x0000')
      expect(formatOffset(16)).toBe('0x0010')
      expect(formatOffset(255)).toBe('0x00FF')
    })

    it('pads with leading zeros', () => {
      expect(formatOffset(1)).toBe('0x0001')
      expect(formatOffset(15)).toBe('0x000F')
    })

    it('uppercases hex digits', () => {
      expect(formatOffset(0xabc)).toBe('0x0ABC')
    })
  })

  describe('formatSize', () => {
    it('formats size as hex string without padding', () => {
      expect(formatSize(0)).toBe('0x0')
      expect(formatSize(16)).toBe('0x10')
      expect(formatSize(255)).toBe('0xFF')
      expect(formatSize(1080)).toBe('0x438')
    })

    it('uppercases hex digits', () => {
      expect(formatSize(0xabcd)).toBe('0xABCD')
    })
  })

  describe('parseSymbolEntries', () => {
    it('parses empty array', () => {
      expect(parseSymbolEntries([])).toEqual([])
    })

    it('parses single symbol', () => {
      const raw = [{ name: 'NtCreateFile', address: '4316144' }]
      const result = parseSymbolEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'NtCreateFile',
        address: '0x000000000041DBF0'
      })
    })

    it('parses multiple symbols', () => {
      const raw = [
        { name: 'NtCreateFile', address: '4316144' },
        { name: 'NtReadFile', address: '4316160' },
        { name: 'NtWriteFile', address: '4316176' }
      ]
      const result = parseSymbolEntries(raw)

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('NtCreateFile')
      expect(result[1].name).toBe('NtReadFile')
      expect(result[2].name).toBe('NtWriteFile')
    })

    it('formats all addresses correctly', () => {
      const raw = [
        { name: 'Sym1', address: '0' },
        { name: 'Sym2', address: '255' }
      ]
      const result = parseSymbolEntries(raw)

      expect(result[0].address).toBe('0x0000000000000000')
      expect(result[1].address).toBe('0x00000000000000FF')
    })
  })

  describe('sortSymbols', () => {
    it('sorts empty array', () => {
      expect(sortSymbols([])).toEqual([])
    })

    it('sorts single symbol', () => {
      const symbols: SymbolEntry[] = [{ name: 'NtCreateFile', address: '0x1234' }]
      expect(sortSymbols(symbols)).toEqual(symbols)
    })

    it('sorts symbols alphabetically by name', () => {
      const symbols: SymbolEntry[] = [
        { name: 'ZZZ', address: '0x1000' },
        { name: 'AAA', address: '0x2000' },
        { name: 'MMM', address: '0x3000' }
      ]
      const sorted = sortSymbols(symbols)

      expect(sorted[0].name).toBe('AAA')
      expect(sorted[1].name).toBe('MMM')
      expect(sorted[2].name).toBe('ZZZ')
    })

    it('does not mutate original array', () => {
      const symbols: SymbolEntry[] = [
        { name: 'ZZZ', address: '0x1000' },
        { name: 'AAA', address: '0x2000' }
      ]
      const originalOrder = [...symbols]
      sortSymbols(symbols)

      expect(symbols).toEqual(originalOrder)
    })

    it('handles case-insensitive sorting', () => {
      const symbols: SymbolEntry[] = [
        { name: 'zebra', address: '0x1000' },
        { name: 'Apple', address: '0x2000' },
        { name: 'banana', address: '0x3000' }
      ]
      const sorted = sortSymbols(symbols)

      expect(sorted[0].name).toBe('Apple')
      expect(sorted[1].name).toBe('banana')
      expect(sorted[2].name).toBe('zebra')
    })
  })

  describe('parseSymbolDiffEntries', () => {
    it('parses empty array', () => {
      expect(parseSymbolDiffEntries([])).toEqual([])
    })

    it('parses NEW symbol (only new_props)', () => {
      const raw = [
        {
          path: 'NewSymbol',
          status: 'NEW',
          old_props: null,
          new_props: { properties: { address: '4316144' } }
        }
      ]
      const result = parseSymbolDiffEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'NewSymbol',
        address: '0x000000000041DBF0',
        status: DiffStatus.New,
        baseAddress: undefined,
        diffeeAddress: '0x000000000041DBF0'
      })
    })

    it('parses DELETED symbol (only old_props)', () => {
      const raw = [
        {
          path: 'DeletedSymbol',
          status: 'DEL',
          old_props: { properties: { address: '1234567' } },
          new_props: null
        }
      ]
      const result = parseSymbolDiffEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'DeletedSymbol',
        address: '0x000000000012D687',
        status: DiffStatus.Del,
        baseAddress: '0x000000000012D687',
        diffeeAddress: undefined
      })
    })

    it('parses MODIFIED symbol (both old and new props)', () => {
      const raw = [
        {
          path: 'ModifiedSymbol',
          status: 'MOD',
          old_props: { properties: { address: '1000' } },
          new_props: { properties: { address: '2000' } }
        }
      ]
      const result = parseSymbolDiffEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'ModifiedSymbol',
        address: '0x00000000000007D0',
        status: DiffStatus.Mod,
        baseAddress: '0x00000000000003E8',
        diffeeAddress: '0x00000000000007D0'
      })
    })

    it('parses multiple diff entries', () => {
      const raw = [
        {
          path: 'SymA',
          status: 'NEW',
          old_props: null,
          new_props: { properties: { address: '100' } }
        },
        {
          path: 'SymB',
          status: 'DEL',
          old_props: { properties: { address: '200' } },
          new_props: null
        },
        {
          path: 'SymC',
          status: 'MOD',
          old_props: { properties: { address: '300' } },
          new_props: { properties: { address: '400' } }
        }
      ]
      const result = parseSymbolDiffEntries(raw)

      expect(result).toHaveLength(3)
      expect(result[0].status).toBe(DiffStatus.New)
      expect(result[1].status).toBe(DiffStatus.Del)
      expect(result[2].status).toBe(DiffStatus.Mod)
    })

    it('handles missing address properties gracefully', () => {
      const raw = [
        {
          path: 'SymbolNoAddress',
          status: 'NEW',
          old_props: null,
          new_props: { properties: {} }
        }
      ]
      const result = parseSymbolDiffEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0].address).toBe('0x0000000000000000')
    })
  })

  describe('getStatusTagType', () => {
    it('maps NEW status to success', () => {
      expect(getStatusTagType(DiffStatus.New)).toBe('success')
    })

    it('maps MOD status to warning', () => {
      expect(getStatusTagType(DiffStatus.Mod)).toBe('warning')
    })

    it('maps DEL status to error', () => {
      expect(getStatusTagType(DiffStatus.Del)).toBe('error')
    })

    it('returns default for unknown status', () => {
      expect(getStatusTagType('UNKNOWN' as DiffStatus)).toBe('default')
    })
  })

  describe('parseDataType', () => {
    it('parses base type', () => {
      const json = { type: 'base', name: 'unsigned long' }
      const result = parseDataType(json)

      expect(result.type).toBe('base')
      expect(result.name).toBe('unsigned long')
      expect(result.hasDataType).toBeUndefined()
    })

    it('parses pointer type', () => {
      const json = {
        type: 'pointer',
        name: null,
        has_data_type: { type: 'base', name: 'void' }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('pointer')
      expect(result.hasDataType).toBeDefined()
      expect(result.hasDataType?.type).toBe('base')
      expect(result.hasDataType?.name).toBe('void')
    })

    it('parses array type', () => {
      const json = {
        type: 'array',
        array_counter: 15,
        has_data_type: { type: 'base', name: 'char' }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('array')
      expect(result.arrayCounter).toBe(15)
      expect(result.hasDataType?.name).toBe('char')
    })

    it('parses nested pointer (pointer to pointer)', () => {
      const json = {
        type: 'pointer',
        has_data_type: {
          type: 'pointer',
          has_data_type: { type: 'base', name: 'void' }
        }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('pointer')
      expect(result.hasDataType?.type).toBe('pointer')
      expect(result.hasDataType?.hasDataType?.type).toBe('base')
    })

    it('parses struct type', () => {
      const json = { type: 'struct', name: '_EPROCESS' }
      const result = parseDataType(json)

      expect(result.type).toBe('struct')
      expect(result.name).toBe('_EPROCESS')
    })

    it('parses union type', () => {
      const json = { type: 'union', name: '_LARGE_INTEGER' }
      const result = parseDataType(json)

      expect(result.type).toBe('union')
      expect(result.name).toBe('_LARGE_INTEGER')
    })

    it('parses bitfield type', () => {
      const json = {
        type: 'bitfield',
        bit_length: 3,
        bit_position: 5,
        has_data_type: { type: 'base', name: 'unsigned long' }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('bitfield')
      expect(result.bitLength).toBe(3)
      expect(result.bitPosition).toBe(5)
    })

    it('handles missing fields gracefully', () => {
      const json = { type: 'struct' }
      const result = parseDataType(json)

      expect(result.type).toBe('struct')
      expect(result.name).toBeUndefined()
    })

    it('handles null input', () => {
      const result = parseDataType(null)

      expect(result.type).toBe('unknown')
      expect(result.name).toBe('unknown')
    })

    it('handles invalid input', () => {
      const result = parseDataType('invalid')

      expect(result.type).toBe('unknown')
      expect(result.name).toBe('unknown')
    })
  })

  describe('formatDataType', () => {
    it('formats base type', () => {
      const dataType = { type: 'base', name: 'unsigned long' }
      expect(formatDataType(dataType)).toBe('unsigned long')
    })

    it('formats pointer: void*', () => {
      const dataType = {
        type: 'pointer',
        hasDataType: { type: 'base', name: 'void' }
      }
      expect(formatDataType(dataType)).toBe('void*')
    })

    it('formats pointer to struct: struct _FOO*', () => {
      const dataType = {
        type: 'pointer',
        hasDataType: { type: 'struct', name: '_KPROCESS' }
      }
      expect(formatDataType(dataType)).toBe('struct _KPROCESS*')
    })

    it('formats array: char[15]', () => {
      const dataType = {
        type: 'array',
        arrayCounter: 15,
        hasDataType: { type: 'base', name: 'char' }
      }
      expect(formatDataType(dataType)).toBe('char[15]')
    })

    it('formats array without size: char[]', () => {
      const dataType = {
        type: 'array',
        hasDataType: { type: 'base', name: 'char' }
      }
      expect(formatDataType(dataType)).toBe('char[]')
    })

    it('formats nested pointers: void**', () => {
      const dataType = {
        type: 'pointer',
        hasDataType: {
          type: 'pointer',
          hasDataType: { type: 'base', name: 'void' }
        }
      }
      expect(formatDataType(dataType)).toBe('void**')
    })

    it('formats pointer to array', () => {
      const dataType = {
        type: 'pointer',
        hasDataType: {
          type: 'array',
          arrayCounter: 10,
          hasDataType: { type: 'base', name: 'int' }
        }
      }
      expect(formatDataType(dataType)).toBe('int[10]*')
    })

    it('formats struct type', () => {
      const dataType = { type: 'struct', name: '_EPROCESS' }
      expect(formatDataType(dataType)).toBe('struct _EPROCESS')
    })

    it('formats union type', () => {
      const dataType = { type: 'union', name: '_LARGE_INTEGER' }
      expect(formatDataType(dataType)).toBe('union _LARGE_INTEGER')
    })

    it('formats enumeration type', () => {
      const dataType = { type: 'enumeration', name: '_KWAIT_REASON' }
      expect(formatDataType(dataType)).toBe('enum _KWAIT_REASON')
    })

    it('formats bit field', () => {
      const dataType = {
        type: 'bitfield',
        bitLength: 3,
        hasDataType: { type: 'base', name: 'unsigned long' }
      }
      expect(formatDataType(dataType)).toBe('unsigned long : 3')
    })

    it('handles pointer without inner type', () => {
      const dataType = { type: 'pointer' }
      expect(formatDataType(dataType)).toBe('void*')
    })

    it('handles unknown type', () => {
      const dataType = { type: 'custom', name: 'CustomType' }
      expect(formatDataType(dataType)).toBe('CustomType')
    })

    it('handles null input', () => {
      expect(formatDataType(null as any)).toBe('unknown')
    })
  })

  describe('isStructType', () => {
    it('returns true for struct type', () => {
      const dataType = { type: 'struct', name: '_EPROCESS' }
      expect(isStructType(dataType)).toBe(true)
    })

    it('returns true for union type', () => {
      const dataType = { type: 'union', name: '_LARGE_INTEGER' }
      expect(isStructType(dataType)).toBe(true)
    })

    it('returns false for base type', () => {
      const dataType = { type: 'base', name: 'int' }
      expect(isStructType(dataType)).toBe(false)
    })

    it('returns false for pointer type', () => {
      const dataType = {
        type: 'pointer',
        hasDataType: { type: 'base', name: 'void' }
      }
      expect(isStructType(dataType)).toBe(false)
    })

    it('returns false for array type', () => {
      const dataType = {
        type: 'array',
        arrayCounter: 10,
        hasDataType: { type: 'base', name: 'char' }
      }
      expect(isStructType(dataType)).toBe(false)
    })
  })

  describe('parseStructEntries', () => {
    it('parses empty array', () => {
      expect(parseStructEntries([])).toEqual([])
    })

    it('parses single struct with fields', () => {
      const raw = [
        {
          name: '_EPROCESS',
          size: 2048,
          kind: 'struct',
          fields: [
            {
              name: 'Pcb',
              offset: 0,
              data_type: { type: 'struct', name: '_KPROCESS' }
            },
            {
              name: 'Pid',
              offset: 744,
              data_type: {
                type: 'pointer',
                has_data_type: { type: 'base', name: 'void' }
              }
            }
          ]
        }
      ]
      const result = parseStructEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('_EPROCESS')
      expect(result[0].size).toBe(2048)
      expect(result[0].kind).toBe('struct')
      expect(result[0].fields).toHaveLength(2)
      expect(result[0].fields?.[0].name).toBe('Pcb')
      expect(result[0].fields?.[0].offset).toBe(0)
      expect(result[0].fields?.[0].dataType).toBe('struct _KPROCESS')
      expect(result[0].fields?.[1].dataType).toBe('void*')
    })

    it('parses multiple structs', () => {
      const raw = [
        {
          name: '_EPROCESS',
          size: 2048,
          kind: 'struct',
          fields: []
        },
        {
          name: '_KTHREAD',
          size: 1440,
          kind: 'struct',
          fields: []
        }
      ]
      const result = parseStructEntries(raw)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('_EPROCESS')
      expect(result[1].name).toBe('_KTHREAD')
    })

    it('formats all data types correctly', () => {
      const raw = [
        {
          name: 'TestStruct',
          size: 100,
          kind: 'struct',
          fields: [
            {
              name: 'baseField',
              offset: 0,
              data_type: { type: 'base', name: 'unsigned long' }
            },
            {
              name: 'pointerField',
              offset: 8,
              data_type: {
                type: 'pointer',
                has_data_type: { type: 'base', name: 'char' }
              }
            },
            {
              name: 'arrayField',
              offset: 16,
              data_type: {
                type: 'array',
                array_counter: 15,
                has_data_type: { type: 'base', name: 'char' }
              }
            }
          ]
        }
      ]
      const result = parseStructEntries(raw)

      expect(result[0].fields?.[0].dataType).toBe('unsigned long')
      expect(result[0].fields?.[1].dataType).toBe('char*')
      expect(result[0].fields?.[2].dataType).toBe('char[15]')
    })

    it('preserves raw data_type for debugging', () => {
      const raw = [
        {
          name: 'TestStruct',
          size: 100,
          kind: 'struct',
          fields: [
            {
              name: 'testField',
              offset: 0,
              data_type: { type: 'base', name: 'int', custom_prop: 'value' }
            }
          ]
        }
      ]
      const result = parseStructEntries(raw)

      expect(result[0].fields?.[0].dataTypeRaw).toEqual({
        type: 'base',
        name: 'int',
        custom_prop: 'value'
      })
    })
  })

  describe('sortStructs', () => {
    it('sorts empty array', () => {
      expect(sortStructs([])).toEqual([])
    })

    it('sorts single struct', () => {
      const structs: StructEntry[] = [{ name: '_EPROCESS', size: 2048, kind: 'struct' }]
      expect(sortStructs(structs)).toEqual(structs)
    })

    it('sorts structs alphabetically by name', () => {
      const structs: StructEntry[] = [
        { name: '_ZPROCESS', size: 100, kind: 'struct' },
        { name: '_APROCESS', size: 200, kind: 'struct' },
        { name: '_MPROCESS', size: 300, kind: 'struct' }
      ]
      const sorted = sortStructs(structs)

      expect(sorted[0].name).toBe('_APROCESS')
      expect(sorted[1].name).toBe('_MPROCESS')
      expect(sorted[2].name).toBe('_ZPROCESS')
    })

    it('does not mutate original array', () => {
      const structs: StructEntry[] = [
        { name: '_ZPROCESS', size: 100, kind: 'struct' },
        { name: '_APROCESS', size: 200, kind: 'struct' }
      ]
      const originalOrder = [...structs]
      sortStructs(structs)

      expect(structs).toEqual(originalOrder)
    })

    it('handles case-insensitive sorting', () => {
      const structs: StructEntry[] = [
        { name: '_zebra', size: 100, kind: 'struct' },
        { name: '_Apple', size: 200, kind: 'struct' },
        { name: '_banana', size: 300, kind: 'struct' }
      ]
      const sorted = sortStructs(structs)

      expect(sorted[0].name).toBe('_Apple')
      expect(sorted[1].name).toBe('_banana')
      expect(sorted[2].name).toBe('_zebra')
    })
  })

  describe('parseFieldDiffEntries', () => {
    it('should parse UNCHANGED field with same offsets', () => {
      const input = [
        {
          path: 'AdjustCounter',
          status: 'UNCHANGED',
          type: 'StructField',
          old_props: {
            hash: '...',
            properties: { offset: 382 }
          },
          new_props: {
            hash: '...',
            properties: { offset: 382 }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('AdjustCounter')
      expect(result[0].status).toBe('UNCHANGED')
      expect(result[0].offset).toBe(382)
      expect(result[0].baseOffset).toBe(382)
      expect(result[0].diffeeOffset).toBe(382)
      expect(result[0].dataType).toBe('unknown')
      expect(result[0].baseDataType).toBeUndefined()
      expect(result[0].diffeeDataType).toBeUndefined()
    })

    it('should parse NEW field with only new_props', () => {
      const input = [
        {
          path: 'BreakMakePte',
          status: 'NEW',
          type: 'StructField',
          old_props: null,
          new_props: {
            hash: '...',
            properties: { offset: 424 }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('BreakMakePte')
      expect(result[0].status).toBe('NEW')
      expect(result[0].offset).toBe(424)
      expect(result[0].diffeeOffset).toBe(424)
      expect(result[0].baseOffset).toBeUndefined()
      expect(result[0].dataType).toBe('unknown')
      expect(result[0].diffeeDataType).toBeUndefined()
      expect(result[0].baseDataType).toBeUndefined()
    })

    it('should parse MOD field with different offsets', () => {
      const input = [
        {
          path: 'NumberOfUltraMdlMaps',
          status: 'MOD',
          type: 'StructField',
          old_props: {
            hash: '...',
            properties: { offset: 488 }
          },
          new_props: {
            hash: '...',
            properties: { offset: 496 }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('NumberOfUltraMdlMaps')
      expect(result[0].status).toBe('MOD')
      expect(result[0].offset).toBe(496) // Display offset should be diffee
      expect(result[0].baseOffset).toBe(488)
      expect(result[0].diffeeOffset).toBe(496)
      expect(result[0].dataType).toBe('unknown')
      expect(result[0].baseDataType).toBeUndefined()
      expect(result[0].diffeeDataType).toBeUndefined()
    })

    it('should parse DEL field with only old_props', () => {
      const input = [
        {
          path: 'DeletedField',
          status: 'DEL',
          type: 'StructField',
          old_props: {
            hash: '...',
            properties: { offset: 100 }
          },
          new_props: null
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('DeletedField')
      expect(result[0].status).toBe('DEL')
      expect(result[0].offset).toBe(100)
      expect(result[0].baseOffset).toBe(100)
      expect(result[0].diffeeOffset).toBeUndefined()
      expect(result[0].dataType).toBe('unknown')
      expect(result[0].baseDataType).toBeUndefined()
      expect(result[0].diffeeDataType).toBeUndefined()
    })

    it('should sort fields by offset (smallest to largest)', () => {
      const input = [
        {
          path: 'field3',
          status: 'UNCHANGED',
          old_props: { properties: { offset: 200 } },
          new_props: { properties: { offset: 200 } }
        },
        {
          path: 'field1',
          status: 'UNCHANGED',
          old_props: { properties: { offset: 0 } },
          new_props: { properties: { offset: 0 } }
        },
        {
          path: 'field2',
          status: 'UNCHANGED',
          old_props: { properties: { offset: 100 } },
          new_props: { properties: { offset: 100 } }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result.map((f) => f.name)).toEqual(['field1', 'field2', 'field3'])
    })

    it('should handle mixed field statuses from real GraphQL response', () => {
      // Use the actual _MI_SYSTEM_PTE_STATE sample the user provided
      const input = [
        {
          path: 'MdlTrackerLookaside',
          status: 'UNCHANGED',
          old_props: { properties: { offset: 0 } },
          new_props: { properties: { offset: 0 } }
        },
        {
          path: 'BreakMakePte',
          status: 'NEW',
          old_props: null,
          new_props: { properties: { offset: 424 } }
        },
        {
          path: 'NumberOfUltraMdlMaps',
          status: 'MOD',
          old_props: { properties: { offset: 488 } },
          new_props: { properties: { offset: 496 } }
        },
        {
          path: 'UltraSpaceContext',
          status: 'MOD',
          old_props: { properties: { offset: 424 } },
          new_props: { properties: { offset: 432 } }
        }
      ]

      const result = parseFieldDiffEntries(input)

      // Verify correct parsing of all statuses
      expect(result.find((f) => f.name === 'MdlTrackerLookaside')).toMatchObject({
        status: 'UNCHANGED',
        baseOffset: 0,
        diffeeOffset: 0
      })

      expect(result.find((f) => f.name === 'BreakMakePte')).toMatchObject({
        status: 'NEW',
        diffeeOffset: 424
      })
      expect(result.find((f) => f.name === 'BreakMakePte')?.baseOffset).toBeUndefined()

      expect(result.find((f) => f.name === 'NumberOfUltraMdlMaps')).toMatchObject({
        status: 'MOD',
        baseOffset: 488,
        diffeeOffset: 496
      })
    })
  })
})

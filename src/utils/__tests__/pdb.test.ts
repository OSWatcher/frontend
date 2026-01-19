import { describe, it, expect } from 'vitest'
import {
  parseSymbolEntries,
  parseSymbolDiffEntries,
  parseFieldDiffEntries,
  parseStructFieldEntries,
  formatAddress,
  formatOffset,
  formatSize,
  sortSymbols,
  sortByOffset,
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
      const json = { kind: 'base', name: 'unsigned long' }
      const result = parseDataType(json)

      expect(result.type).toBe('base')
      expect(result.name).toBe('unsigned long')
      expect(result.hasDataType).toBeUndefined()
    })

    it('parses base type with capitalized kind', () => {
      const json = { kind: 'Base', name: 'int' }
      const result = parseDataType(json)

      expect(result.type).toBe('base')
      expect(result.name).toBe('int')
    })

    it('parses pointer type', () => {
      const json = {
        kind: 'pointer',
        subtype: { kind: 'base', name: 'void' }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('pointer')
      expect(result.hasDataType).toBeDefined()
      expect(result.hasDataType?.type).toBe('base')
      expect(result.hasDataType?.name).toBe('void')
    })

    it('parses array type', () => {
      const json = {
        kind: 'array',
        count: 15,
        subtype: { kind: 'base', name: 'char' }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('array')
      expect(result.arrayCounter).toBe(15)
      expect(result.hasDataType?.name).toBe('char')
    })

    it('parses nested pointer (pointer to pointer)', () => {
      const json = {
        kind: 'pointer',
        subtype: {
          kind: 'pointer',
          subtype: { kind: 'base', name: 'void' }
        }
      }
      const result = parseDataType(json)

      expect(result.type).toBe('pointer')
      expect(result.hasDataType?.type).toBe('pointer')
      expect(result.hasDataType?.hasDataType?.type).toBe('base')
    })

    it('parses struct type', () => {
      const json = { kind: 'struct', name: '_EPROCESS' }
      const result = parseDataType(json)

      expect(result.type).toBe('struct')
      expect(result.name).toBe('_EPROCESS')
    })

    it('parses union type', () => {
      const json = { kind: 'union', name: '_LARGE_INTEGER' }
      const result = parseDataType(json)

      expect(result.type).toBe('union')
      expect(result.name).toBe('_LARGE_INTEGER')
    })

    it('parses enum type', () => {
      const json = { kind: 'enum', name: '_INTERFACE_TYPE' }
      const result = parseDataType(json)

      expect(result.type).toBe('enum')
      expect(result.name).toBe('_INTERFACE_TYPE')
    })

    it('parses bitfield type', () => {
      const json = {
        kind: 'bitfield',
        type: { kind: 'base', name: 'unsigned long' },
        bit_length: 3,
        bit_position: 5
      }
      const result = parseDataType(json)

      expect(result.type).toBe('bitfield')
      expect(result.bitLength).toBe(3)
      expect(result.bitPosition).toBe(5)
      expect(result.hasDataType?.type).toBe('base')
      expect(result.hasDataType?.name).toBe('unsigned long')
    })

    it('handles missing fields gracefully', () => {
      const json = { kind: 'struct' }
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

    it('formats enum type', () => {
      const dataType = { type: 'enum', name: '_INTERFACE_TYPE' }
      expect(formatDataType(dataType)).toBe('enum _INTERFACE_TYPE')
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

  describe('parseDataType + formatDataType integration', () => {
    it('formats base type from backend JSON', () => {
      const json = { kind: 'Base', name: 'int' }
      expect(formatDataType(parseDataType(json))).toBe('int')
    })

    it('formats pointer from backend JSON', () => {
      const json = { kind: 'pointer', subtype: { kind: 'base', name: 'void' } }
      expect(formatDataType(parseDataType(json))).toBe('void*')
    })

    it('formats struct from backend JSON', () => {
      const json = { kind: 'struct', name: '_EX_PUSH_LOCK' }
      expect(formatDataType(parseDataType(json))).toBe('struct _EX_PUSH_LOCK')
    })

    it('formats enum from backend JSON', () => {
      const json = { kind: 'enum', name: '_INTERFACE_TYPE' }
      expect(formatDataType(parseDataType(json))).toBe('enum _INTERFACE_TYPE')
    })

    it('formats union from backend JSON', () => {
      const json = { kind: 'union', name: '__anonymous_1d83' }
      expect(formatDataType(parseDataType(json))).toBe('union __anonymous_1d83')
    })

    it('formats bitfield from backend JSON', () => {
      const json = {
        kind: 'bitfield',
        type: { kind: 'base', name: 'unsigned long' },
        bit_length: 1,
        bit_position: 0
      }
      expect(formatDataType(parseDataType(json))).toBe('unsigned long : 1')
    })

    it('formats array of pointers from backend JSON', () => {
      const json = {
        count: 2,
        kind: 'array',
        subtype: { kind: 'pointer', subtype: { kind: 'base', name: 'void' } }
      }
      expect(formatDataType(parseDataType(json))).toBe('void*[2]')
    })

    it('formats nested pointer from backend JSON', () => {
      const json = {
        kind: 'pointer',
        subtype: { kind: 'pointer', subtype: { kind: 'base', name: 'void' } }
      }
      expect(formatDataType(parseDataType(json))).toBe('void**')
    })

    it('formats pointer to struct from backend JSON', () => {
      const json = {
        kind: 'pointer',
        subtype: { kind: 'struct', name: '_KPROCESS' }
      }
      expect(formatDataType(parseDataType(json))).toBe('struct _KPROCESS*')
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

    it('parses single struct (fields loaded lazily)', () => {
      const raw = [
        {
          name: '_EPROCESS',
          hash: 'abc123',
          size: 2048,
          kind: 'struct'
        }
      ]
      const result = parseStructEntries(raw)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('_EPROCESS')
      expect(result[0].hash).toBe('abc123')
      expect(result[0].size).toBe(2048)
      expect(result[0].kind).toBe('struct')
      // Fields are not included - they are loaded lazily via FETCH_STRUCT_FIELDS
    })

    it('parses multiple structs', () => {
      const raw = [
        {
          name: '_EPROCESS',
          hash: 'hash1',
          size: 2048,
          kind: 'struct'
        },
        {
          name: '_KTHREAD',
          hash: 'hash2',
          size: 1440,
          kind: 'struct'
        }
      ]
      const result = parseStructEntries(raw)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('_EPROCESS')
      expect(result[1].name).toBe('_KTHREAD')
    })

    it('parses union kind', () => {
      const raw = [
        {
          name: '_LARGE_INTEGER',
          hash: 'unionhash',
          size: 8,
          kind: 'union'
        }
      ]
      const result = parseStructEntries(raw)

      expect(result[0].kind).toBe('union')
    })
  })

  describe('parseStructFieldEntries', () => {
    it('parses empty array', () => {
      expect(parseStructFieldEntries([])).toEqual([])
    })

    it('parses fields from connection edges', () => {
      const raw = [
        {
          properties: { name: 'Pcb' },
          node: { offset: 0, data_type: { kind: 'struct', name: '_KPROCESS' } }
        },
        {
          properties: { name: 'Pid' },
          node: {
            offset: 744,
            data_type: { kind: 'pointer', subtype: { kind: 'base', name: 'void' } }
          }
        }
      ]
      const result = parseStructFieldEntries(raw)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Pcb')
      expect(result[0].offset).toBe(0)
      expect(result[0].dataType).toBe('struct _KPROCESS')
      expect(result[1].name).toBe('Pid')
      expect(result[1].offset).toBe(744)
      expect(result[1].dataType).toBe('void*')
    })

    it('sorts fields by offset (smallest to largest)', () => {
      const raw = [
        {
          properties: { name: 'field3' },
          node: { offset: 200, data_type: { kind: 'base', name: 'int' } }
        },
        {
          properties: { name: 'field1' },
          node: { offset: 0, data_type: { kind: 'base', name: 'int' } }
        },
        {
          properties: { name: 'field2' },
          node: { offset: 100, data_type: { kind: 'base', name: 'int' } }
        }
      ]
      const result = parseStructFieldEntries(raw)

      expect(result.map((f) => f.name)).toEqual(['field1', 'field2', 'field3'])
      expect(result.map((f) => f.offset)).toEqual([0, 100, 200])
    })

    it('formats all data types correctly', () => {
      const raw = [
        {
          properties: { name: 'baseField' },
          node: { offset: 0, data_type: { kind: 'base', name: 'unsigned long' } }
        },
        {
          properties: { name: 'pointerField' },
          node: {
            offset: 8,
            data_type: { kind: 'pointer', subtype: { kind: 'base', name: 'char' } }
          }
        },
        {
          properties: { name: 'arrayField' },
          node: {
            offset: 16,
            data_type: { kind: 'array', count: 15, subtype: { kind: 'base', name: 'char' } }
          }
        }
      ]
      const result = parseStructFieldEntries(raw)

      expect(result[0].dataType).toBe('unsigned long')
      expect(result[1].dataType).toBe('char*')
      expect(result[2].dataType).toBe('char[15]')
    })

    it('preserves raw data_type for debugging', () => {
      const raw = [
        {
          properties: { name: 'testField' },
          node: {
            offset: 0,
            data_type: { kind: 'base', name: 'int', custom_prop: 'value' }
          }
        }
      ]
      const result = parseStructFieldEntries(raw)

      expect(result[0].dataTypeRaw).toEqual({
        kind: 'base',
        name: 'int',
        custom_prop: 'value'
      })
    })
  })

  describe('sortByOffset', () => {
    it('sorts empty array', () => {
      expect(sortByOffset([])).toEqual([])
    })

    it('sorts single item', () => {
      const items = [{ offset: 100, name: 'field' }]
      expect(sortByOffset(items)).toEqual([{ offset: 100, name: 'field' }])
    })

    it('sorts items by offset ascending', () => {
      const items = [
        { offset: 200, name: 'c' },
        { offset: 0, name: 'a' },
        { offset: 100, name: 'b' }
      ]
      const sorted = sortByOffset(items)

      expect(sorted.map((i) => i.offset)).toEqual([0, 100, 200])
      expect(sorted.map((i) => i.name)).toEqual(['a', 'b', 'c'])
    })

    it('does not mutate original array', () => {
      const items = [
        { offset: 200, name: 'c' },
        { offset: 0, name: 'a' }
      ]
      const originalOrder = [...items]
      sortByOffset(items)

      expect(items).toEqual(originalOrder)
    })

    it('handles items with same offset', () => {
      const items = [
        { offset: 100, name: 'b' },
        { offset: 100, name: 'a' }
      ]
      const sorted = sortByOffset(items)

      // With same offset, original order is preserved (stable sort)
      expect(sorted[0].name).toBe('b')
      expect(sorted[1].name).toBe('a')
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

    it('should parse stringified JSON data_type from diffNodesAt API', () => {
      // diffNodesAt returns data_type as stringified JSON inside properties blob
      const input = [
        {
          path: 'Pcb',
          status: 'UNCHANGED',
          old_props: {
            hash: 'abc123',
            properties: {
              offset: 0,
              data_type: '{"kind": "struct", "name": "_KPROCESS"}'
            }
          },
          new_props: {
            hash: 'def456',
            properties: {
              offset: 0,
              data_type: '{"kind": "struct", "name": "_KPROCESS"}'
            }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].dataType).toBe('struct _KPROCESS')
      expect(result[0].baseDataType).toBe('struct _KPROCESS')
      expect(result[0].diffeeDataType).toBe('struct _KPROCESS')
    })

    it('should parse various stringified data_types correctly', () => {
      const input = [
        {
          path: 'BaseField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 0,
              data_type: '{"kind": "base", "name": "unsigned long"}'
            }
          },
          new_props: {
            properties: {
              offset: 0,
              data_type: '{"kind": "base", "name": "unsigned long"}'
            }
          }
        },
        {
          path: 'PointerField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 8,
              data_type: '{"kind": "pointer", "subtype": {"kind": "base", "name": "void"}}'
            }
          },
          new_props: {
            properties: {
              offset: 8,
              data_type: '{"kind": "pointer", "subtype": {"kind": "base", "name": "void"}}'
            }
          }
        },
        {
          path: 'ArrayField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 16,
              data_type:
                '{"kind": "array", "count": 4, "subtype": {"kind": "base", "name": "unsigned long"}}'
            }
          },
          new_props: {
            properties: {
              offset: 16,
              data_type:
                '{"kind": "array", "count": 4, "subtype": {"kind": "base", "name": "unsigned long"}}'
            }
          }
        },
        {
          path: 'BitfieldField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 32,
              data_type:
                '{"kind": "bitfield", "type": {"kind": "base", "name": "unsigned long"}, "bit_length": 1, "bit_position": 0}'
            }
          },
          new_props: {
            properties: {
              offset: 32,
              data_type:
                '{"kind": "bitfield", "type": {"kind": "base", "name": "unsigned long"}, "bit_length": 1, "bit_position": 0}'
            }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result.find((f) => f.name === 'BaseField')?.dataType).toBe('unsigned long')
      expect(result.find((f) => f.name === 'PointerField')?.dataType).toBe('void*')
      expect(result.find((f) => f.name === 'ArrayField')?.dataType).toBe('unsigned long[4]')
      expect(result.find((f) => f.name === 'BitfieldField')?.dataType).toBe('unsigned long : 1')
    })

    it('should handle malformed stringified JSON gracefully', () => {
      const input = [
        {
          path: 'BadField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 0,
              data_type: 'not valid json {'
            }
          },
          new_props: {
            properties: {
              offset: 0,
              data_type: 'not valid json {'
            }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result).toHaveLength(1)
      expect(result[0].dataType).toBe('unknown')
    })

    it('should handle both parsed objects and stringified JSON', () => {
      // In case some fields have parsed objects and others have strings
      const input = [
        {
          path: 'StringField',
          status: 'UNCHANGED',
          old_props: {
            properties: {
              offset: 0,
              data_type: '{"kind": "base", "name": "int"}'
            }
          },
          new_props: {
            properties: {
              offset: 0,
              data_type: { kind: 'base', name: 'int' } // Already parsed
            }
          }
        }
      ]

      const result = parseFieldDiffEntries(input)

      expect(result[0].baseDataType).toBe('int')
      expect(result[0].diffeeDataType).toBe('int')
    })
  })
})

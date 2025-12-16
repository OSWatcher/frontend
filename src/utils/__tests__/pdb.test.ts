import { describe, it, expect } from 'vitest'
import {
  parseSymbolEntries,
  parseSymbolDiffEntries,
  formatAddress,
  formatOffset,
  formatSize,
  sortSymbols,
  getStatusTagType
} from '../pdb'
import type { SymbolEntry } from '@/types/pdb'
import { DiffStatus } from '@/graphql-types'

describe('pdb utils', () => {
  describe('formatAddress', () => {
    it('formats numeric address as 16-digit hex string', () => {
      expect(formatAddress(0)).toBe('0x0000000000000000')
      expect(formatAddress(255)).toBe('0x00000000000000FF')
      expect(formatAddress(4316144)).toBe('0x000000000041DAF0')
    })

    it('formats string address as hex', () => {
      expect(formatAddress('0')).toBe('0x0000000000000000')
      expect(formatAddress('4316144')).toBe('0x000000000041DAF0')
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
        address: '0x000000000041DAF0'
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
        address: '0x000000000041DAF0',
        status: DiffStatus.New,
        baseAddress: undefined,
        diffeeAddress: '0x000000000041DAF0'
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
})

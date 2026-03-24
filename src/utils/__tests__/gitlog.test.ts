import { describe, expect, it } from 'vitest'

import { formatPropertyChange } from '../gitlog'

describe('formatPropertyChange', () => {
  it('formats struct field offsets in hex for single props', () => {
    expect(
      formatPropertyChange('StructField', null, {
        hash: 'abcd1234',
        properties: { offset: 520, data_type: '{"name":"void*"}' }
      })
    ).toBe('offset: 0x208')
  })

  it('formats struct field offset transitions in hex', () => {
    expect(
      formatPropertyChange(
        'StructField',
        {
          hash: 'abcd1234',
          properties: { offset: 520, data_type: '{"name":"void*"}' }
        },
        {
          hash: 'efgh5678',
          properties: { offset: 840, data_type: '{"name":"void*"}' }
        }
      )
    ).toBe('offset: 0x208 → 0x348')
  })
})

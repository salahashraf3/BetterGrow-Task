import { describe, expect, it } from 'vitest'
import { formatAed } from './format'

describe('formatAed', () => {
  it('formats money with an AED prefix and two decimal places', () => {
    expect(formatAed(1000)).toBe('AED 1,000.00')
    expect(formatAed(1000.5)).toBe('AED 1,000.50')
    expect(formatAed(0)).toBe('AED 0.00')
  })
})

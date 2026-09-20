import { describe, expect, it } from 'vitest'
import { parseMoney } from './money'

const ACCEPTED_MONEY: readonly { label: string; input: unknown; value: number }[] =
  [
    { label: 'finite Excel number 1000', input: 1000, value: 1000 },
    { label: 'finite Excel number 0', input: 0, value: 0 },
    { label: 'finite Excel number 1000.5', input: 1000.5, value: 1000.5 },
    { label: 'plain text 1000', input: '1000', value: 1000 },
    { label: 'plain text 1,000', input: '1,000', value: 1000 },
    { label: 'plain text 1000.50', input: '1000.50', value: 1000.5 },
    { label: 'plain text 1,000.50', input: '1,000.50', value: 1000.5 },
    { label: 'AED 1,000.50', input: 'AED 1,000.50', value: 1000.5 },
    { label: 'AED 1000', input: 'AED 1000', value: 1000 },
    { label: 'padded AED 1,000.50', input: '  AED 1,000.50  ', value: 1000.5 },
    { label: 'negative finite number for later policy', input: -25, value: -25 },
    { label: 'negative numeric text', input: '-1,000.50', value: -1000.5 },
  ]

const REJECTED_MONEY: readonly { label: string; input: unknown }[] = [
  { label: '100abc', input: '100abc' },
  { label: 'boolean true', input: true },
  { label: 'boolean false', input: false },
  { label: 'NaN', input: Number.NaN },
  { label: 'Infinity', input: Number.POSITIVE_INFINITY },
  { label: '-Infinity', input: Number.NEGATIVE_INFINITY },
  { label: 'USD 1,000', input: 'USD 1,000' },
  { label: 'currency symbol $1,000', input: '$1,000' },
  { label: 'euro amount', input: '€1000' },
  { label: 'ambiguous 1.000,50', input: '1.000,50' },
  { label: 'malformed grouping 10,00', input: '10,00' },
  { label: 'blank string', input: '' },
  { label: 'whitespace string', input: '   ' },
  { label: 'null', input: null },
  { label: 'AED without amount', input: 'AED' },
  { label: 'trailing currency AED', input: '1000 AED' },
  { label: 'partial 100abc with leading spaces', input: ' 100abc' },
]

describe('parseMoney accepted forms', () => {
  it.each(ACCEPTED_MONEY)('$label', ({ input, value }) => {
    expect(parseMoney(input)).toEqual({ ok: true, value })
  })
})

describe('parseMoney rejected forms', () => {
  it.each(REJECTED_MONEY)('$label', ({ input }) => {
    const result = parseMoney(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).not.toBeUndefined()
    }
  })

  it('does not parse 100abc with parseFloat-style partial parsing', () => {
    expect(Number.parseFloat('100abc')).toBe(100)
    expect(parseMoney('100abc')).toEqual({ ok: false, reason: 'invalid' })
  })
})

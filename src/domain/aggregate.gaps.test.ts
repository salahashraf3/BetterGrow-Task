import { describe, expect, it } from 'vitest'
import {
  aggregateSalesRecords,
  calculatePerformance,
  formatAchievementPercent,
} from './aggregate'
import { collapseWhitespace, normalizeKey } from './text'

describe('aggregation edges', () => {
  it('returns a No budget empty summary when there are no records', () => {
    const summary = aggregateSalesRecords([])
    expect(summary.salespersonResults).toEqual([])
    expect(summary.overallStatus).toBe('No budget')
    expect(summary.overallAchievementPercent).toBeNull()
    expect(summary.validRecordCount).toBe(0)
  })

  it('does not use a non-finite budget as a divisor', () => {
    expect(calculatePerformance(Number.POSITIVE_INFINITY, 10)).toEqual({
      achievementPercent: null,
      status: 'No budget',
    })
    expect(calculatePerformance(-5, 10).status).toBe('No budget')
  })

  it('formats null or non-finite achievement as N/A', () => {
    expect(formatAchievementPercent(null)).toBe('N/A')
    expect(formatAchievementPercent(Number.NaN)).toBe('N/A')
  })
})

describe('display and key normalization', () => {
  it('collapses spaces for display and lowercases keys', () => {
    expect(collapseWhitespace('  Ada   Lovelace  ')).toBe('Ada Lovelace')
    expect(normalizeKey('  ADA   Lovelace  ')).toBe('ada lovelace')
  })
})

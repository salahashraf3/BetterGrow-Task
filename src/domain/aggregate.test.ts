import { describe, expect, it } from 'vitest'
import {
  aggregateSalesRecords,
  calculatePerformance,
  formatAchievementPercent,
} from './aggregate'
import type { SalesRecord } from './types'

function record(
  salesperson: string,
  month: string,
  budgetAmount: number,
  actualSales: number,
  sourceRowNumber: number,
): SalesRecord {
  return {
    salesperson,
    month,
    budgetAmount,
    actualSales,
    sourceRowNumber,
  }
}

describe('calculatePerformance', () => {
  it('marks equality as On target from amounts, not a rounded percentage', () => {
    const equal = calculatePerformance(3, 3)
    expect(equal.status).toBe('On target')
    expect(equal.achievementPercent).toBe(100)

    const justBelow = calculatePerformance(3, 2.994)
    expect(justBelow.status).toBe('Below target')
    expect(justBelow.achievementPercent).not.toBeNull()
    if (justBelow.achievementPercent !== null) {
      expect(Math.round(justBelow.achievementPercent)).toBe(100)
    }
  })

  it('treats actual above budget as On target', () => {
    expect(calculatePerformance(100, 110).status).toBe('On target')
  })

  it('returns N/A and No budget when budget is 0, even if actual is positive', () => {
    const result = calculatePerformance(0, 500)
    expect(result).toEqual({
      achievementPercent: null,
      status: 'No budget',
    })
    expect(formatAchievementPercent(result.achievementPercent)).toBe('N/A')
  })

  it('does not expose NaN or Infinity', () => {
    expect(calculatePerformance(0, 0).achievementPercent).toBeNull()
    expect(calculatePerformance(0, 1).achievementPercent).toBeNull()
    expect(formatAchievementPercent(Number.NaN)).toBe('N/A')
    expect(formatAchievementPercent(Number.POSITIVE_INFINITY)).toBe('N/A')
  })
})

describe('aggregateSalesRecords', () => {
  it('sums repeated months for the same salesperson', () => {
    const summary = aggregateSalesRecords([
      record('Ada Lovelace', 'January', 100, 80, 2),
      record('Ada Lovelace', 'February', 50, 70, 3),
    ])

    expect(summary.salespersonResults).toHaveLength(1)
    expect(summary.salespersonResults[0]?.salesperson).toBe('Ada Lovelace')
    expect(summary.salespersonResults[0]?.budget).toBe(150)
    expect(summary.salespersonResults[0]?.actual).toBe(150)
    expect(summary.salespersonResults[0]?.status).toBe('On target')
    expect(summary.salespersonResults[0]?.achievementPercent).toBe(100)
    expect(summary.totalBudget).toBe(150)
    expect(summary.totalActual).toBe(150)
  })

  it('groups differently cased names and keeps the first cleaned display name', () => {
    const summary = aggregateSalesRecords([
      record('Ada Lovelace', 'January', 100, 40, 2),
      record('ada lovelace', 'February', 100, 50, 3),
    ])

    expect(summary.salespersonResults).toHaveLength(1)
    expect(summary.salespersonResults[0]?.salesperson).toBe('Ada Lovelace')
    expect(summary.salespersonResults[0]?.salespersonKey).toBe('ada lovelace')
    expect(summary.salespersonResults[0]?.budget).toBe(200)
    expect(summary.salespersonResults[0]?.actual).toBe(90)
  })

  it('counts Below target and On target, excluding No budget people', () => {
    const summary = aggregateSalesRecords([
      record('On Target', 'January', 100, 100, 2),
      record('Also On', 'January', 80, 90, 3),
      record('Below', 'January', 100, 20, 4),
      record('No Budget', 'January', 0, 75, 5),
    ])

    expect(summary.onTargetCount).toBe(2)
    expect(summary.belowTargetCount).toBe(1)
    expect(summary.salespersonResults.map((row) => row.status)).toEqual([
      'On target',
      'On target',
      'Below target',
      'No budget',
    ])
  })

  it('keeps positive actual with zero budget as No budget', () => {
    const summary = aggregateSalesRecords([
      record('Ada Lovelace', 'January', 0, 250, 2),
    ])

    expect(summary.salespersonResults[0]?.status).toBe('No budget')
    expect(summary.salespersonResults[0]?.achievementPercent).toBeNull()
    expect(summary.onTargetCount).toBe(0)
    expect(summary.belowTargetCount).toBe(0)
    expect(summary.overallStatus).toBe('No budget')
    expect(summary.overallAchievementPercent).toBeNull()
  })

  it('handles all-zero budgets without dividing by zero', () => {
    const summary = aggregateSalesRecords([
      record('Ada Lovelace', 'January', 0, 0, 2),
      record('Grace Hopper', 'January', 0, 10, 3),
    ])

    expect(summary.totalBudget).toBe(0)
    expect(summary.totalActual).toBe(10)
    expect(summary.overallAchievementPercent).toBeNull()
    expect(summary.overallStatus).toBe('No budget')
    expect(summary.onTargetCount).toBe(0)
    expect(summary.belowTargetCount).toBe(0)
    expect(
      summary.salespersonResults.every(
        (row) => row.achievementPercent === null && row.status === 'No budget',
      ),
    ).toBe(true)
  })

  it('computes exact overall totals from unrounded money', () => {
    const summary = aggregateSalesRecords([
      record('Ada Lovelace', 'January', 100.25, 40.1, 2),
      record('Grace Hopper', 'January', 50.05, 60.2, 3),
      record('Ada Lovelace', 'February', 10, 10, 4),
    ])

    expect(summary.totalBudget).toBe(100.25 + 50.05 + 10)
    expect(summary.totalActual).toBe(40.1 + 60.2 + 10)
    expect(summary.validRecordCount).toBe(3)
    expect(summary.salespersonResults).toHaveLength(2)
    expect(summary.overallAchievementPercent).toBe(
      ((40.1 + 60.2 + 10) / (100.25 + 50.05 + 10)) * 100,
    )
    expect(summary.overallStatus).toBe('Below target')
  })
})

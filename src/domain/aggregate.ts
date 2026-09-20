import { normalizeKey } from './text'
import type {
  DashboardSummary,
  SalespersonResult,
  SalesRecord,
  TargetStatus,
} from './types'

export type Performance = {
  readonly achievementPercent: number | null
  readonly status: TargetStatus
}

/**
 * Status is decided from unrounded monetary totals.
 * Achievement percent is also unrounded; format it only at display time.
 */
export function calculatePerformance(budget: number, actual: number): Performance {
  if (budget === 0) {
    return { achievementPercent: null, status: 'No budget' }
  }

  if (budget < 0 || !Number.isFinite(budget) || !Number.isFinite(actual)) {
    return { achievementPercent: null, status: 'No budget' }
  }

  const achievementPercent = (actual / budget) * 100
  if (!Number.isFinite(achievementPercent)) {
    return { achievementPercent: null, status: 'No budget' }
  }

  return {
    achievementPercent,
    status: actual >= budget ? 'On target' : 'Below target',
  }
}

export function formatAchievementPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) {
    return 'N/A'
  }

  return `${percent.toFixed(1)}%`
}

function emptySummary(validRecordCount: number): DashboardSummary {
  return {
    salespersonResults: [],
    totalBudget: 0,
    totalActual: 0,
    overallAchievementPercent: null,
    overallStatus: 'No budget',
    onTargetCount: 0,
    belowTargetCount: 0,
    validRecordCount,
    issues: [],
  }
}

/**
 * Aggregate monthly sales records by normalized salesperson key.
 * The first cleaned display name for each key is preserved.
 */
export function aggregateSalesRecords(
  records: readonly SalesRecord[],
): DashboardSummary {
  const groups = new Map<
    string,
    { displayName: string; budget: number; actual: number }
  >()

  for (const record of records) {
    const key = normalizeKey(record.salesperson)
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        displayName: record.salesperson,
        budget: record.budgetAmount,
        actual: record.actualSales,
      })
      continue
    }

    existing.budget += record.budgetAmount
    existing.actual += record.actualSales
  }

  const salespersonResults: SalespersonResult[] = []
  let totalBudget = 0
  let totalActual = 0
  let onTargetCount = 0
  let belowTargetCount = 0

  for (const [salespersonKey, group] of groups) {
    const performance = calculatePerformance(group.budget, group.actual)
    salespersonResults.push({
      salesperson: group.displayName,
      salespersonKey,
      budget: group.budget,
      actual: group.actual,
      achievementPercent: performance.achievementPercent,
      status: performance.status,
    })

    totalBudget += group.budget
    totalActual += group.actual

    if (performance.status === 'On target') {
      onTargetCount += 1
    } else if (performance.status === 'Below target') {
      belowTargetCount += 1
    }
  }

  if (salespersonResults.length === 0) {
    return emptySummary(records.length)
  }

  const overall = calculatePerformance(totalBudget, totalActual)

  return {
    salespersonResults,
    totalBudget,
    totalActual,
    overallAchievementPercent: overall.achievementPercent,
    overallStatus: overall.status,
    onTargetCount,
    belowTargetCount,
    validRecordCount: records.length,
    issues: [],
  }
}

/**
 * Canonical required fields. Display labels are in `CANONICAL_FIELD_LABELS`.
 */
export type CanonicalField =
  | 'salesperson'
  | 'month'
  | 'budgetAmount'
  | 'actualSales'

/**
 * One worksheet row before domain validation.
 * Keys are the original header strings; values are untyped cell contents.
 */
export type RawWorksheetRow = Readonly<Record<string, unknown>>

/**
 * A row that passed structural and numeric validation.
 */
export type SalesRecord = {
  readonly salesperson: string
  readonly month: string
  readonly budgetAmount: number
  readonly actualSales: number
  /** 1-based worksheet row number for error reporting. */
  readonly sourceRowNumber: number
}

export type ValidationIssueCode =
  | 'file-too-large'
  | 'unsupported-file-type'
  | 'empty-file'
  | 'unreadable-workbook'
  | 'no-data'
  | 'header-row-not-found'
  | 'no-sales-records'
  | 'duplicate-header-mapping'
  | 'negative-budget'
  | 'negative-actual-sales'
  | 'duplicate-salesperson-month'
  | 'missing-required-value'
  | 'invalid-number'
  | 'invalid-text'

export type ValidationIssue = {
  readonly code: ValidationIssueCode
  readonly message: string
  readonly rowNumber?: number
  readonly field?: CanonicalField
  readonly header?: string
  /** 0-based worksheet column index, when known. */
  readonly columnIndex?: number
  /** Second Excel row involved in a duplicate pair. */
  readonly otherRowNumber?: number
}

/**
 * Achievement is `null` (N/A) when total budget is zero.
 * Status is `No budget` in that case.
 * When budget is positive, actual >= budget is On target (by amounts, not
 * a rounded percentage). Actual < budget is Below target.
 */
export type TargetStatus = 'On target' | 'Below target' | 'No budget'

export type SalespersonResult = {
  readonly salesperson: string
  readonly salespersonKey: string
  readonly budget: number
  readonly actual: number
  /** Unrounded (actual / budget) * 100. Null when budget is 0. */
  readonly achievementPercent: number | null
  readonly status: TargetStatus
}

export type DashboardSummary = {
  readonly salespersonResults: readonly SalespersonResult[]
  readonly totalBudget: number
  readonly totalActual: number
  readonly overallAchievementPercent: number | null
  readonly overallStatus: TargetStatus
  readonly onTargetCount: number
  readonly belowTargetCount: number
  readonly validRecordCount: number
  readonly issues: readonly ValidationIssue[]
}

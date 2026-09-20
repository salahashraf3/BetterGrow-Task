import { parseMoney } from '../domain/money'
import { CANONICAL_FIELD_LABELS } from '../domain/policy'
import { collapseWhitespace, normalizeKey } from '../domain/text'
import type {
  CanonicalField,
  SalesRecord,
  ValidationIssue,
} from '../domain/types'
import { NEGATIVE_AMOUNT_SCOPE_MESSAGE } from './messages'
import { isBlankCellValue, type DetectedDataRow } from './structure'

export type RowValidationResult =
  | { readonly ok: true; readonly records: readonly SalesRecord[] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

type ParsedRow = {
  readonly excelRowNumber: number
  readonly displayName: string
  readonly personKey: string
  readonly displayMonth: string
  readonly monthKey: string
  readonly budgetAmount: number
  readonly actualSales: number
}

type TextParseResult =
  | { readonly ok: true; readonly display: string; readonly key: string }
  | { readonly ok: false; readonly issue: ValidationIssue }

type AmountParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly issue: ValidationIssue }

function missingIssue(
  rowNumber: number,
  field: CanonicalField,
  columnIndex: number,
): ValidationIssue {
  return {
    code: 'missing-required-value',
    message: `Row ${String(rowNumber)} is missing ${CANONICAL_FIELD_LABELS[field]}.`,
    rowNumber,
    field,
    columnIndex,
  }
}

function invalidTextIssue(
  rowNumber: number,
  field: CanonicalField,
  columnIndex: number,
): ValidationIssue {
  return {
    code: 'invalid-text',
    message: `Row ${String(rowNumber)} has an invalid ${CANONICAL_FIELD_LABELS[field]}.`,
    rowNumber,
    field,
    columnIndex,
  }
}

function invalidNumberIssue(
  rowNumber: number,
  field: CanonicalField,
  columnIndex: number,
): ValidationIssue {
  return {
    code: 'invalid-number',
    message: `Row ${String(rowNumber)} has an invalid ${CANONICAL_FIELD_LABELS[field]}.`,
    rowNumber,
    field,
    columnIndex,
  }
}

function negativeIssue(
  rowNumber: number,
  field: 'budgetAmount' | 'actualSales',
  columnIndex: number,
): ValidationIssue {
  return {
    code: field === 'budgetAmount' ? 'negative-budget' : 'negative-actual-sales',
    message: `Row ${String(rowNumber)} has a negative ${CANONICAL_FIELD_LABELS[field]}. ${NEGATIVE_AMOUNT_SCOPE_MESSAGE}`,
    rowNumber,
    field,
    columnIndex,
  }
}

function parseTextField(
  value: unknown,
  rowNumber: number,
  field: 'salesperson' | 'month',
  columnIndex: number,
): TextParseResult {
  if (isBlankCellValue(value)) {
    return { ok: false, issue: missingIssue(rowNumber, field, columnIndex) }
  }

  if (typeof value !== 'string') {
    return { ok: false, issue: invalidTextIssue(rowNumber, field, columnIndex) }
  }

  const display = collapseWhitespace(value)
  if (display === '') {
    return { ok: false, issue: missingIssue(rowNumber, field, columnIndex) }
  }

  return { ok: true, display, key: normalizeKey(value) }
}

function parseMoneyField(
  value: unknown,
  rowNumber: number,
  field: 'budgetAmount' | 'actualSales',
  columnIndex: number,
): AmountParseResult {
  const parsed = parseMoney(value)
  if (!parsed.ok) {
    if (parsed.reason === 'blank') {
      return { ok: false, issue: missingIssue(rowNumber, field, columnIndex) }
    }

    return { ok: false, issue: invalidNumberIssue(rowNumber, field, columnIndex) }
  }

  if (parsed.value < 0) {
    return { ok: false, issue: negativeIssue(rowNumber, field, columnIndex) }
  }

  return { ok: true, value: parsed.value }
}

/**
 * Validate every detected data row. Any issue fails the whole set:
 * partially valid records are never returned as a successful result.
 */
export function validateDataRows(
  rows: readonly DetectedDataRow[],
): RowValidationResult {
  const issues: ValidationIssue[] = []
  const parsedRows: ParsedRow[] = []

  for (const row of rows) {
    const salesperson = parseTextField(
      row.values.salesperson,
      row.excelRowNumber,
      'salesperson',
      row.columnIndexes.salesperson,
    )
    const month = parseTextField(
      row.values.month,
      row.excelRowNumber,
      'month',
      row.columnIndexes.month,
    )
    const budgetAmount = parseMoneyField(
      row.values.budgetAmount,
      row.excelRowNumber,
      'budgetAmount',
      row.columnIndexes.budgetAmount,
    )
    const actualSales = parseMoneyField(
      row.values.actualSales,
      row.excelRowNumber,
      'actualSales',
      row.columnIndexes.actualSales,
    )

    if (!salesperson.ok) {
      issues.push(salesperson.issue)
    }
    if (!month.ok) {
      issues.push(month.issue)
    }
    if (!budgetAmount.ok) {
      issues.push(budgetAmount.issue)
    }
    if (!actualSales.ok) {
      issues.push(actualSales.issue)
    }

    if (!salesperson.ok || !month.ok || !budgetAmount.ok || !actualSales.ok) {
      continue
    }

    parsedRows.push({
      excelRowNumber: row.excelRowNumber,
      displayName: salesperson.display,
      personKey: salesperson.key,
      displayMonth: month.display,
      monthKey: month.key,
      budgetAmount: budgetAmount.value,
      actualSales: actualSales.value,
    })
  }

  const seen = new Map<string, number>()
  for (const row of parsedRows) {
    const pairKey = `${row.personKey}\0${row.monthKey}`
    const firstRowNumber = seen.get(pairKey)
    if (firstRowNumber !== undefined) {
      issues.push({
        code: 'duplicate-salesperson-month',
        message: `Rows ${String(firstRowNumber)} and ${String(row.excelRowNumber)} have the same salesperson and month.`,
        rowNumber: firstRowNumber,
        otherRowNumber: row.excelRowNumber,
        field: 'salesperson',
      })
      continue
    }

    seen.set(pairKey, row.excelRowNumber)
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    records: parsedRows.map((row) => ({
      salesperson: row.displayName,
      month: row.displayMonth,
      budgetAmount: row.budgetAmount,
      actualSales: row.actualSales,
      sourceRowNumber: row.excelRowNumber,
    })),
  }
}

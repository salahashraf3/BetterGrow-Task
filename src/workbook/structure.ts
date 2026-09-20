import * as XLSX from 'xlsx'
import type { WorkSheet } from 'xlsx'
import {
  HEADER_SCAN_MAX_ROWS,
  lookupCanonicalField,
} from '../domain/policy'
import type { CanonicalField, ValidationIssue } from '../domain/types'
import {
  DUPLICATE_HEADER_MAPPING_MESSAGE,
  HEADERS_WITHOUT_RECORDS_MESSAGE,
  NO_DATA_MESSAGE,
  REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
} from './messages'

export type WorksheetRow = {
  readonly excelRowNumber: number
  readonly cells: readonly unknown[]
}

export type HeaderColumnMap = Readonly<Record<CanonicalField, number>>

export type DetectedDataRow = {
  readonly excelRowNumber: number
  readonly columnIndexes: HeaderColumnMap
  readonly values: Readonly<Record<CanonicalField, unknown>>
}

export type WorksheetStructure =
  | {
      readonly ok: true
      readonly headerRowNumber: number
      readonly columnIndexes: HeaderColumnMap
      readonly dataRows: readonly DetectedDataRow[]
    }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * SheetJS worksheet values are typed with `any` at the index signature.
 * Narrow to `unknown` before reading `.v` so domain code never uses `any`.
 */
function readRawCellValue(cell: unknown): unknown {
  if (!isRecord(cell) || !('v' in cell)) {
    return null
  }

  return cell.v
}

export function isBlankCellValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }

  return typeof value === 'string' && value.trim() === ''
}

export function isBlankRow(row: WorksheetRow): boolean {
  return row.cells.every((cell) => isBlankCellValue(cell))
}

function headerText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return undefined
}

function toHeaderColumnMap(
  columns: Partial<Record<CanonicalField, number>>,
): HeaderColumnMap | undefined {
  const salesperson = columns.salesperson
  const month = columns.month
  const budgetAmount = columns.budgetAmount
  const actualSales = columns.actualSales

  if (
    salesperson === undefined ||
    month === undefined ||
    budgetAmount === undefined ||
    actualSales === undefined
  ) {
    return undefined
  }

  return { salesperson, month, budgetAmount, actualSales }
}

/**
 * Convert a SheetJS worksheet into row objects.
 * Cell values are the raw `.v` contents; `excelRowNumber` is 1-based.
 */
export function worksheetToRows(sheet: WorkSheet): WorksheetRow[] {
  const valuesByRow = new Map<number, Map<number, unknown>>()

  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) {
      continue
    }

    const address = XLSX.utils.decode_cell(key)
    if (!Number.isInteger(address.r) || !Number.isInteger(address.c)) {
      continue
    }

    const excelRowNumber = address.r + 1
    const columnIndex = address.c
    let columns = valuesByRow.get(excelRowNumber)
    if (!columns) {
      columns = new Map<number, unknown>()
      valuesByRow.set(excelRowNumber, columns)
    }

    const cell: unknown = sheet[key]
    columns.set(columnIndex, readRawCellValue(cell))
  }

  return [...valuesByRow.entries()]
    .sort(([left], [right]) => left - right)
    .map(([excelRowNumber, columns]) => {
      const width = Math.max(...columns.keys()) + 1
      const cells: unknown[] = Array.from({ length: width }, () => null)

      for (const [columnIndex, value] of columns) {
        cells[columnIndex] = value
      }

      return { excelRowNumber, cells }
    })
}

type HeaderRowInspection =
  | { readonly kind: 'complete'; readonly columns: HeaderColumnMap }
  | {
      readonly kind: 'duplicate'
      readonly field: CanonicalField
      readonly header: string
      readonly columnIndex: number
    }
  | { readonly kind: 'incomplete' }

function inspectHeaderRow(row: WorksheetRow): HeaderRowInspection {
  const columns: Partial<Record<CanonicalField, number>> = {}
  let duplicate: Extract<HeaderRowInspection, { kind: 'duplicate' }> | undefined

  for (const [columnIndex, value] of row.cells.entries()) {
    const text = headerText(value)
    if (text === undefined || isBlankCellValue(text)) {
      continue
    }

    const field = lookupCanonicalField(text)
    if (field === undefined) {
      continue
    }

    const existing = columns[field]
    if (existing !== undefined && existing !== columnIndex) {
      duplicate = {
        kind: 'duplicate',
        field,
        header: text,
        columnIndex,
      }
      continue
    }

    columns[field] = columnIndex
  }

  const mapped = toHeaderColumnMap(columns)
  if (mapped && duplicate) {
    return duplicate
  }

  if (!mapped) {
    return { kind: 'incomplete' }
  }

  return { kind: 'complete', columns: mapped }
}

function valuesForRow(
  row: WorksheetRow,
  columnIndexes: HeaderColumnMap,
): Readonly<Record<CanonicalField, unknown>> {
  return {
    salesperson: row.cells[columnIndexes.salesperson] ?? null,
    month: row.cells[columnIndexes.month] ?? null,
    budgetAmount: row.cells[columnIndexes.budgetAmount] ?? null,
    actualSales: row.cells[columnIndexes.actualSales] ?? null,
  }
}

/**
 * Detect a single header row in Excel rows 1–20 and collect non-blank data
 * rows after it. Fully blank rows are ignored when deciding whether the
 * sheet contains data and when collecting sales records.
 */
export function detectWorksheetStructure(rows: readonly WorksheetRow[]): WorksheetStructure {
  const nonBlankRows = rows.filter((row) => !isBlankRow(row))
  if (nonBlankRows.length === 0) {
    return {
      ok: false,
      issues: [{ code: 'no-data', message: NO_DATA_MESSAGE }],
    }
  }

  const scanRows = rows.filter(
    (row) =>
      row.excelRowNumber >= 1 && row.excelRowNumber <= HEADER_SCAN_MAX_ROWS,
  )

  for (const row of scanRows) {
    const inspection = inspectHeaderRow(row)
    if (inspection.kind === 'incomplete') {
      continue
    }

    if (inspection.kind === 'duplicate') {
      return {
        ok: false,
        issues: [
          {
            code: 'duplicate-header-mapping',
            message: DUPLICATE_HEADER_MAPPING_MESSAGE,
            rowNumber: row.excelRowNumber,
            field: inspection.field,
            header: inspection.header,
            columnIndex: inspection.columnIndex,
          },
        ],
      }
    }

    const dataRows = rows
      .filter(
        (candidate) =>
          candidate.excelRowNumber > row.excelRowNumber && !isBlankRow(candidate),
      )
      .map((candidate) => ({
        excelRowNumber: candidate.excelRowNumber,
        columnIndexes: inspection.columns,
        values: valuesForRow(candidate, inspection.columns),
      }))

    if (dataRows.length === 0) {
      return {
        ok: false,
        issues: [
          {
            code: 'no-sales-records',
            message: HEADERS_WITHOUT_RECORDS_MESSAGE,
            rowNumber: row.excelRowNumber,
          },
        ],
      }
    }

    return {
      ok: true,
      headerRowNumber: row.excelRowNumber,
      columnIndexes: inspection.columns,
      dataRows,
    }
  }

  return {
    ok: false,
    issues: [
      {
        code: 'header-row-not-found',
        message: REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
      },
    ],
  }
}

export function detectSheetStructure(sheet: WorkSheet): WorksheetStructure {
  return detectWorksheetStructure(worksheetToRows(sheet))
}

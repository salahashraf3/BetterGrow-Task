import * as XLSX from 'xlsx'
import type { WorkSheet } from 'xlsx'

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function writeWorkbookBytes(
  workbook: XLSX.WorkBook,
  bookType: 'xlsx' | 'xls',
): Uint8Array {
  const output: unknown = XLSX.write(workbook, { bookType, type: 'array' })

  if (output instanceof Uint8Array) {
    return output
  }

  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output)
  }

  throw new Error('SheetJS write did not return binary data')
}

export const CANONICAL_HEADERS = [
  'Salesperson',
  'Month',
  'Budget Amount',
  'Actual Sales',
] as const

export function createWorkbookFromSheets(
  fileName: string,
  sheets: Readonly<Record<string, unknown[][]>>,
  bookType: 'xlsx' | 'xls' = 'xlsx',
): File {
  const workbook = XLSX.utils.book_new()

  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      name,
    )
  }

  return new File([toArrayBuffer(writeWorkbookBytes(workbook, bookType))], fileName)
}

export function createAoAWorkbookFile(
  fileName: string,
  rows: unknown[][],
  bookType: 'xlsx' | 'xls' = 'xlsx',
): File {
  return createWorkbookFromSheets(fileName, { Data: rows }, bookType)
}

export function createWorkbookFile(
  fileName: string,
  bookType: 'xlsx' | 'xls' = 'xlsx',
): File {
  return createAoAWorkbookFile(fileName, [['placeholder']], bookType)
}

export function createSalesWorkbookFile(
  fileName: string,
  rows: readonly (readonly unknown[])[],
  bookType: 'xlsx' | 'xls' = 'xlsx',
  headers: readonly string[] = CANONICAL_HEADERS,
): File {
  return createAoAWorkbookFile(fileName, [[...headers], ...rows.map((row) => [...row])], bookType)
}

export function createNamedFile(
  fileName: string,
  contents: BlobPart,
  size?: number,
): File {
  const file = new File([contents], fileName)
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

export function createZipMasqueradingAsXlsx(fileName: string): File {
  return new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03])],
    fileName,
  )
}

export function sheetFromAoa(rows: unknown[][]): WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows)
}

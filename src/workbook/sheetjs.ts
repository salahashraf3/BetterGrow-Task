import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'

/**
 * Isolates the SheetJS `read` boundary (`data` is typed as `any` in the library).
 * Callers pass an ArrayBuffer only. Parse errors are thrown to the intake service.
 * Encryption is not detected here: SheetJS does not expose a reliable
 * distinguishable signal, so callers use the generic unreadable-workbook message.
 */
export function parseExcelArrayBuffer(buffer: ArrayBuffer): WorkBook {
  return XLSX.read(new Uint8Array(buffer), { type: 'array' })
}

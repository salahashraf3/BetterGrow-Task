import { ALLOWED_WORKBOOK_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../domain/policy'
import type { ValidationIssue } from '../domain/types'
import {
  EMPTY_FILE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  UNREADABLE_WORKBOOK_MESSAGE,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from './messages'
import { parseExcelArrayBuffer } from './sheetjs'
import type { WorkSheet } from 'xlsx'

export type AllowedWorkbookExtension = (typeof ALLOWED_WORKBOOK_EXTENSIONS)[number]

export type LoadedWorkbook = {
  readonly fileName: string
  /** First worksheet only; additional sheets are ignored. */
  readonly worksheetName: string
  readonly worksheet: WorkSheet
}

export type WorkbookIntakeResult =
  | { readonly ok: true; readonly workbook: LoadedWorkbook }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

const ZIP_SIGNATURE = [0x50, 0x4b] as const
const OLE_CFBF_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const

function unreadableIssue(): ValidationIssue {
  return {
    code: 'unreadable-workbook',
    message: UNREADABLE_WORKBOOK_MESSAGE,
  }
}

export function getFileExtension(fileName: string): string | undefined {
  const separator = fileName.lastIndexOf('.')
  if (separator <= 0 || separator === fileName.length - 1) {
    return undefined
  }

  return fileName.slice(separator).toLowerCase()
}

export function getAllowedWorkbookExtension(
  fileName: string,
): AllowedWorkbookExtension | undefined {
  const extension = getFileExtension(fileName)
  if (extension === '.xlsx' || extension === '.xls') {
    return extension
  }

  return undefined
}

function startsWithSignature(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.length < signature.length) {
    return false
  }

  return signature.every((value, index) => bytes[index] === value)
}

/**
 * Content-type check after the extension is already accepted.
 * `.xlsx` must be a ZIP container; `.xls` must be an OLE compound file.
 * This is not fuzzy matching and does not treat the filename as proof.
 */
export function hasExpectedWorkbookSignature(
  bytes: Uint8Array,
  extension: AllowedWorkbookExtension,
): boolean {
  if (extension === '.xlsx') {
    return startsWithSignature(bytes, ZIP_SIGNATURE)
  }

  return startsWithSignature(bytes, OLE_CFBF_SIGNATURE)
}

export function inspectUploadFile(file: File): ValidationIssue[] {
  if (getAllowedWorkbookExtension(file.name) === undefined) {
    return [
      {
        code: 'unsupported-file-type',
        message: UNSUPPORTED_FILE_TYPE_MESSAGE,
      },
    ]
  }

  if (file.size === 0) {
    return [
      {
        code: 'empty-file',
        message: EMPTY_FILE_MESSAGE,
      },
    ]
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return [
      {
        code: 'file-too-large',
        message: FILE_TOO_LARGE_MESSAGE,
      },
    ]
  }

  return []
}

export async function readWorkbookFile(file: File): Promise<WorkbookIntakeResult> {
  const issues = inspectUploadFile(file)
  if (issues.length > 0) {
    return { ok: false, issues }
  }

  const extension = getAllowedWorkbookExtension(file.name)
  if (extension === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: 'unsupported-file-type',
          message: UNSUPPORTED_FILE_TYPE_MESSAGE,
        },
      ],
    }
  }

  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (!hasExpectedWorkbookSignature(bytes, extension)) {
      return { ok: false, issues: [unreadableIssue()] }
    }

    const parsed = parseExcelArrayBuffer(buffer)
    const worksheetName = parsed.SheetNames[0]
    if (worksheetName === undefined) {
      return { ok: false, issues: [unreadableIssue()] }
    }

    const worksheet = parsed.Sheets[worksheetName]
    if (worksheet === undefined) {
      return { ok: false, issues: [unreadableIssue()] }
    }

    return {
      ok: true,
      workbook: {
        fileName: file.name,
        worksheetName,
        worksheet,
      },
    }
  } catch {
    return { ok: false, issues: [unreadableIssue()] }
  }
}

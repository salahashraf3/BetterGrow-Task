import { aggregateSalesRecords } from '../domain/aggregate'
import type { DashboardSummary, SalesRecord, ValidationIssue } from '../domain/types'
import { readWorkbookFile } from './intake'
import { detectSheetStructure } from './structure'
import { validateDataRows } from './validateRows'

export type WorkbookPipelineSuccess = {
  readonly ok: true
  readonly fileName: string
  readonly summary: DashboardSummary
  readonly records: readonly SalesRecord[]
}

export type WorkbookPipelineFailure = {
  readonly ok: false
  readonly issues: readonly ValidationIssue[]
}

export type WorkbookPipelineResult = WorkbookPipelineSuccess | WorkbookPipelineFailure

export type ProcessWorkbook = (file: File) => Promise<WorkbookPipelineResult>

/**
 * Parse and validate a workbook into a temporary result.
 * Callers must commit this only after checking the request token.
 */
export async function runWorkbookPipeline(file: File): Promise<WorkbookPipelineResult> {
  const intake = await readWorkbookFile(file)
  if (!intake.ok) {
    return { ok: false, issues: intake.issues }
  }

  const structure = detectSheetStructure(intake.workbook.worksheet)
  if (!structure.ok) {
    return { ok: false, issues: structure.issues }
  }

  const validated = validateDataRows(structure.dataRows)
  if (!validated.ok) {
    return { ok: false, issues: validated.issues }
  }

  return {
    ok: true,
    fileName: intake.workbook.fileName,
    summary: aggregateSalesRecords(validated.records),
    records: validated.records,
  }
}

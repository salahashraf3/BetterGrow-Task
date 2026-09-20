import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { aggregateSalesRecords } from '../domain/aggregate'
import { parseMoney } from '../domain/money'
import {
  ACCEPTED_HEADER_ALIASES,
  CANONICAL_FIELD_LABELS,
  lookupCanonicalField,
  MAX_FILE_SIZE_BYTES,
} from '../domain/policy'
import type { CanonicalField, SalesRecord } from '../domain/types'
import {
  createAoAWorkbookFile,
  createNamedFile,
  createSalesWorkbookFile,
  createWorkbookFromSheets,
  createZipMasqueradingAsXlsx,
  sheetFromAoa,
} from '../test/excelFiles'
import { inspectUploadFile, readWorkbookFile } from '../workbook/intake'
import {
  EMPTY_FILE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  HEADERS_WITHOUT_RECORDS_MESSAGE,
  NO_DATA_MESSAGE,
  REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
  UNREADABLE_WORKBOOK_MESSAGE,
} from '../workbook/messages'
import {
  runWorkbookPipeline,
  type ProcessWorkbook,
  type WorkbookPipelineResult,
} from '../workbook/pipeline'
import { detectSheetStructure } from '../workbook/structure'

const CANONICAL = [
  CANONICAL_FIELD_LABELS.salesperson,
  CANONICAL_FIELD_LABELS.month,
  CANONICAL_FIELD_LABELS.budgetAmount,
  CANONICAL_FIELD_LABELS.actualSales,
]

function issuesOf(
  result: { ok: false; issues: readonly { message: string }[] } | { ok: true },
): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.message)
}

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function committedSummary(person: string, fileName: string): WorkbookPipelineResult {
  const records: readonly SalesRecord[] = [
    {
      salesperson: person,
      month: 'January',
      budgetAmount: 100,
      actualSales: 100,
      sourceRowNumber: 2,
    },
  ]
  return {
    ok: true,
    fileName,
    records,
    summary: aggregateSalesRecords(records),
  }
}

describe('contract: mixed-case .xlsx and .xls are accepted', () => {
  it('reads a valid .XLSX workbook', async () => {
    const file = createSalesWorkbookFile('Team.XLSX', [['Ada', 'January', 10, 10]])
    const result = await runWorkbookPipeline(file)
    expect(result.ok).toBe(true)
  })

  it('reads a valid .Xls workbook', async () => {
    const file = createSalesWorkbookFile('Legacy.Xls', [['Ada', 'January', 10, 10]], 'xls')
    const result = await runWorkbookPipeline(file)
    expect(result.ok).toBe(true)
  })
})

describe('contract: zero-byte, exact 10 MB, and over 10 MB', () => {
  it('rejects a zero-byte .xlsx before parsing', async () => {
    const result = await readWorkbookFile(new File([], 'empty.xlsx'))
    expect(issuesOf(result)).toEqual([EMPTY_FILE_MESSAGE])
  })

  it('allows a file whose size is exactly 10 MB', () => {
    const file = createNamedFile('edge.xlsx', 'x', MAX_FILE_SIZE_BYTES)
    expect(inspectUploadFile(file)).toEqual([])
  })

  it('rejects a file larger than 10 MB before parsing', async () => {
    const file = createNamedFile('huge.xlsx', 'x', MAX_FILE_SIZE_BYTES + 1)
    const spy = vi.spyOn(file, 'arrayBuffer')
    const result = await readWorkbookFile(file)
    expect(spy).not.toHaveBeenCalled()
    expect(issuesOf(result)).toEqual([FILE_TOO_LARGE_MESSAGE])
  })
})

describe('contract: valid extension with invalid workbook content', () => {
  it('rejects a renamed text file with a .xlsx name using the generic unreadable message', async () => {
    const result = await runWorkbookPipeline(
      createNamedFile('disguised.xlsx', 'this is not excel'),
    )
    expect(issuesOf(result)).toEqual([UNREADABLE_WORKBOOK_MESSAGE])
  })

  it('rejects a PK-signature zip that is not a readable workbook with the same generic message', async () => {
    const result = await runWorkbookPipeline(createZipMasqueradingAsXlsx('broken.xlsx'))
    expect(issuesOf(result)).toEqual([UNREADABLE_WORKBOOK_MESSAGE])
  })
})

describe('contract: empty, malformed, and header-only sheets', () => {
  it('reports no data for a completely empty sheet', async () => {
    const result = await runWorkbookPipeline(createAoAWorkbookFile('empty.xlsx', []))
    expect(issuesOf(result)).toEqual([NO_DATA_MESSAGE])
  })

  it('reports required columns not found for a malformed sheet', async () => {
    const result = await runWorkbookPipeline(
      createAoAWorkbookFile('malformed.xlsx', [
        ['Name', 'Amount'],
        ['Ada', 50],
      ]),
    )
    expect(issuesOf(result)).toEqual([REQUIRED_COLUMNS_NOT_FOUND_MESSAGE])
  })

  it('reports headers found but no sales records for a header-only sheet', async () => {
    const result = await runWorkbookPipeline(
      createAoAWorkbookFile('headers.xlsx', [[...CANONICAL]]),
    )
    expect(issuesOf(result)).toEqual([HEADERS_WITHOUT_RECORDS_MESSAGE])
  })
})

describe('contract: header scan is rows 1-20, one row, no duplicate mappings', () => {
  it('accepts headers on row 20 with a record on row 21', () => {
    const rows = Array.from({ length: 21 }, () => [] as unknown[])
    rows[19] = [...CANONICAL]
    rows[20] = ['Ada', 'January', 10, 9]
    const result = detectSheetStructure(sheetFromAoa(rows))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.headerRowNumber).toBe(20)
    }
  })

  it('rejects headers that only appear on row 21', () => {
    const rows = Array.from({ length: 22 }, () => [] as unknown[])
    rows[20] = [...CANONICAL]
    rows[21] = ['Ada', 'January', 10, 9]
    expect(detectSheetStructure(sheetFromAoa(rows)).ok).toBe(false)
  })

  it('rejects headers split across two rows', async () => {
    const result = await runWorkbookPipeline(
      createAoAWorkbookFile('split.xlsx', [
        ['Salesperson', 'Month'],
        ['Budget Amount', 'Actual Sales'],
        ['Ada', 'January', 10, 9],
      ]),
    )
    expect(issuesOf(result)).toEqual([REQUIRED_COLUMNS_NOT_FOUND_MESSAGE])
  })

  it('rejects two columns that map to the same canonical field', async () => {
    const result = await runWorkbookPipeline(
      createAoAWorkbookFile('dup-header.xlsx', [
        ['Salesperson', 'Month', 'Budget Amount', 'Actual Sales', 'Budget'],
        ['Ada', 'January', 10, 9, 8],
      ]),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('duplicate-header-mapping')
    }
  })
})

describe('contract: every documented alias is accepted and fuzzy names are not', () => {
  const fieldOrder: readonly CanonicalField[] = [
    'salesperson',
    'month',
    'budgetAmount',
    'actualSales',
  ]

  it.each(ACCEPTED_HEADER_ALIASES)(
    'accepts documented alias "$alias" for $field',
    async ({ alias, field }) => {
      const headers = fieldOrder.map((item) =>
        item === field ? alias : CANONICAL_FIELD_LABELS[item],
      )
      const result = await runWorkbookPipeline(
        createSalesWorkbookFile('alias.xlsx', [['Ada', 'January', 10, 10]], 'xlsx', headers),
      )
      expect(lookupCanonicalField(alias)).toBe(field)
      expect(result.ok).toBe(true)
    },
  )

  it.each(['Salespersons', 'Actual Sale', 'Budget Amt', 'USD Amount'])(
    'rejects fuzzy or undocumented header %s',
    (header) => {
      expect(lookupCanonicalField(header)).toBeUndefined()
    },
  )
})

describe('contract: blank fields are missing, never zero; incomplete rows cite Excel row numbers', () => {
  it('rejects a row whose salesperson is blank even when amounts are Excel numbers', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('blank-name.xlsx', [['', 'January', 1000, 900]]),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('Row 2')
      expect(result.issues[0]?.code).toBe('missing-required-value')
    }
  })

  it('treats a numeric zero amount as present, not missing', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('zero-actual.xlsx', [['Ada', 'January', 100, 0]]),
    )
    expect(result.ok).toBe(true)
  })
})

describe('contract: Excel numeric currency and strict AED text', () => {
  it('accepts native Excel numbers for budget and actual', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('numbers.xlsx', [['Ada', 'January', 1000.5, 900]]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records[0]?.budgetAmount).toBe(1000.5)
    }
  })

  it('accepts strict AED text such as AED 1,000.50', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('aed.xlsx', [['Ada', 'January', 'AED 1,000.50', 'AED 900']]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records[0]?.budgetAmount).toBe(1000.5)
    }
  })
})

describe('contract: money parser rejects unsafe and foreign forms', () => {
  it.each([
    ['boolean true', true],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['partial 100abc', '100abc'],
    ['ambiguous 1.000,50', '1.000,50'],
    ['malformed grouping 10,00', '10,00'],
    ['USD 1,000', 'USD 1,000'],
    ['mixed AED USD 1,000', 'AED USD 1,000'],
    ['currency symbol $1,000', '$1,000'],
    ['object cell', { amount: 10 }],
  ] as const)('rejects %s', (_label, input) => {
    expect(parseMoney(input).ok).toBe(false)
  })
})

describe('contract: negative Budget and Actual are out of scope', () => {
  it('rejects a negative Excel budget', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('neg-budget.xlsx', [['Ada', 'January', -10, 5]]),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('negative-budget')
      expect(result.issues[0]?.message).toContain('outside scope')
    }
  })

  it('rejects negative actual sales text', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('neg-actual.xlsx', [['Ada', 'January', 10, '-1,000.50']]),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('negative-actual-sales')
    }
  })
})

describe('contract: casing and space normalization', () => {
  it('groups the same person across casing and repeated spaces', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('names.xlsx', [
        ['  ADA   Lovelace ', 'January', 50, 40],
        ['ada lovelace', 'February', 50, 40],
      ]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.salespersonResults).toHaveLength(1)
      expect(result.summary.salespersonResults[0]?.salesperson).toBe('ADA Lovelace')
      expect(result.summary.totalBudget).toBe(100)
    }
  })
})

describe('contract: duplicate salesperson-month vs distinct months', () => {
  it('rejects the same normalized person and month on two rows and names both Excel rows', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('dup-month.xlsx', [
        ['Ada Lovelace', 'January', 10, 9],
        ['  ada   lovelace ', ' JANUARY ', 20, 19],
      ]),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(
        'Rows 2 and 3 have the same salesperson and month.',
      )
    }
  })

  it('accepts the same person in different months', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('months.xlsx', [
        ['Ada Lovelace', 'January', 10, 9],
        ['Ada Lovelace', 'February', 10, 9],
      ]),
    )
    expect(result.ok).toBe(true)
  })
})

describe('contract: actual equals budget is On target from amounts', () => {
  it('marks a salesperson On target when actual equals budget', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('equal.xlsx', [['Ada', 'January', 30, 30]]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.salespersonResults[0]?.status).toBe('On target')
      expect(result.summary.onTargetCount).toBe(1)
    }
  })
})

describe('contract: zero budget with zero or positive actual is No budget', () => {
  it('uses N/A and No budget when budget is 0 and actual is 0', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('zero-zero.xlsx', [['Ada', 'January', 0, 0]]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.salespersonResults[0]?.achievementPercent).toBeNull()
      expect(result.summary.salespersonResults[0]?.status).toBe('No budget')
      expect(result.summary.onTargetCount).toBe(0)
    }
  })

  it('still uses No budget when budget is 0 and actual is positive', async () => {
    const result = await runWorkbookPipeline(
      createSalesWorkbookFile('zero-pos.xlsx', [['Ada', 'January', 0, 250]]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.salespersonResults[0]?.status).toBe('No budget')
      expect(result.summary.belowTargetCount).toBe(0)
    }
  })
})

describe('contract: first worksheet only', () => {
  it('reads the first sheet and ignores a second sheet', async () => {
    const file = createWorkbookFromSheets('two-sheets.xlsx', {
      First: [[...CANONICAL], ['Ada', 'January', 10, 10]],
      Second: [[...CANONICAL], ['Ignored Person', 'January', 99, 99]],
    })
    const result = await runWorkbookPipeline(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.salespersonResults.map((row) => row.salesperson)).toEqual([
        'Ada',
      ])
    }
  })
})

describe('contract: failed upload preserves prior valid dashboard state', () => {
  it('keeps committed KPI values after a later invalid file', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(
      input,
      createSalesWorkbookFile('ok.xlsx', [['Ada Lovelace', 'January', 100, 100]]),
    )
    expect(await screen.findByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 100.00',
    )

    await user.upload(input, createNamedFile('bad.xlsx', 'not excel'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      UNREADABLE_WORKBOOK_MESSAGE,
    )
    expect(screen.getByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 100.00',
    )
    expect(screen.getByRole('table')).toHaveTextContent('Ada Lovelace')
  })
})

describe('contract: out-of-order uploads are latest-wins', () => {
  it('displays the newer workbook when an older read finishes last', async () => {
    const user = userEvent.setup()
    const older = createDeferred<WorkbookPipelineResult>()
    const newer = createDeferred<WorkbookPipelineResult>()
    const processWorkbook: ProcessWorkbook = vi
      .fn<ProcessWorkbook>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)

    render(<App processWorkbook={processWorkbook} />)
    const input = screen.getByLabelText('Choose Excel file')
    await user.upload(
      input,
      createSalesWorkbookFile('older.xlsx', [['Older', 'January', 1, 1]]),
    )
    await user.upload(
      input,
      createSalesWorkbookFile('newer.xlsx', [['Newer', 'January', 1, 1]]),
    )

    newer.resolve(committedSummary('Newer Person', 'newer.xlsx'))
    older.resolve(committedSummary('Older Person', 'older.xlsx'))

    expect(await screen.findByText('Newer Person')).toBeInTheDocument()
    expect(screen.queryByText('Older Person')).not.toBeInTheDocument()
  })
})

describe('contract: selecting the same file again processes it twice', () => {
  it('runs the pipeline again after the native input is reset', async () => {
    const user = userEvent.setup()
    const processWorkbook = vi.fn(runWorkbookPipeline)
    render(<App processWorkbook={processWorkbook} />)
    const input = screen.getByLabelText('Choose Excel file')
    const file = createSalesWorkbookFile('repeat.xlsx', [['Ada', 'January', 10, 10]])

    await user.upload(input, file)
    await screen.findByText('Ada')
    await user.upload(input, file)
    await waitFor(() => {
      expect(processWorkbook).toHaveBeenCalledTimes(2)
    })
  })
})

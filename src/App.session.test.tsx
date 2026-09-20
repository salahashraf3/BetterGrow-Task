import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { aggregateSalesRecords } from './domain/aggregate'
import type { SalesRecord } from './domain/types'
import {
  createNamedFile,
  createSalesWorkbookFile,
  createWorkbookFile,
} from './test/excelFiles'
import { REQUIRED_COLUMNS_NOT_FOUND_MESSAGE } from './workbook/messages'
import {
  runWorkbookPipeline,
  type ProcessWorkbook,
  type WorkbookPipelineResult,
} from './workbook/pipeline'

function salesFile(
  fileName: string,
  person: string,
): File {
  return createSalesWorkbookFile(fileName, [[person, 'January', 100, 90]])
}

function summaryFor(person: string, fileName: string): WorkbookPipelineResult {
  const records: readonly SalesRecord[] = [
    {
      salesperson: person,
      month: 'January',
      budgetAmount: 100,
      actualSales: 90,
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

describe('workbook session integration', () => {
  it('commits dashboard data after the first valid upload', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.upload(
      screen.getByLabelText('Choose Excel file'),
      salesFile('first.xlsx', 'Ada Lovelace'),
    )

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Workbook: first.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-status',
      'ready',
    )
    expect(screen.queryByRole('alert')).toBeEmptyDOMElement()
  })

  it('keeps prior dashboard data when a later invalid upload fails', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(input, salesFile('valid.xlsx', 'Ada Lovelace'))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    await user.upload(input, createNamedFile('broken.xlsx', 'not a workbook'))

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Workbook: valid.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-status',
      'error',
    )
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-has-dashboard',
      'true',
    )
  })

  it('clears the error after a valid upload following a failed one', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(input, createNamedFile('broken.xlsx', 'not a workbook'))
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.upload(input, salesFile('recovered.xlsx', 'Grace Hopper'))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeEmptyDOMElement()
    })
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Workbook: recovered.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-status',
      'ready',
    )
  })

  it('lets only the newest deferred upload commit when results arrive out of order', async () => {
    const user = userEvent.setup()
    const older = createDeferred<WorkbookPipelineResult>()
    const newer = createDeferred<WorkbookPipelineResult>()
    const processWorkbook: ProcessWorkbook = vi
      .fn<ProcessWorkbook>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)

    render(<App processWorkbook={processWorkbook} />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(input, salesFile('older.xlsx', 'Older Person'))
    await user.upload(input, salesFile('newer.xlsx', 'Newer Person'))

    newer.resolve(summaryFor('Newer Person', 'newer.xlsx'))
    older.resolve(summaryFor('Older Person', 'older.xlsx'))

    expect(await screen.findByText('Newer Person')).toBeInTheDocument()
    expect(screen.getByText('Workbook: newer.xlsx')).toBeInTheDocument()
    expect(screen.queryByText('Older Person')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-status',
      'ready',
    )
  })

  it('processes the same file again after the native input is reset', async () => {
    const user = userEvent.setup()
    const processWorkbook = vi.fn(runWorkbookPipeline)
    render(<App processWorkbook={processWorkbook} />)
    const input = screen.getByLabelText('Choose Excel file')
    const file = salesFile('repeat.xlsx', 'Ada Lovelace')

    await user.upload(input, file)
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    await user.upload(input, file)
    await waitFor(() => {
      expect(processWorkbook).toHaveBeenCalledTimes(2)
    })
  })

  it('surfaces a thrown pipeline as the generic unreadable error without dropping prior data', async () => {
    const user = userEvent.setup()
    const processWorkbook = vi
      .fn<ProcessWorkbook>()
      .mockResolvedValueOnce(summaryFor('Ada Lovelace', 'ok.xlsx'))
      .mockRejectedValueOnce(new Error('disk failed'))

    render(<App processWorkbook={processWorkbook} />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(input, salesFile('ok.xlsx', 'Ada Lovelace'))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    await user.upload(input, salesFile('later.xlsx', 'Later'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to read this workbook. It may be password-protected or damaged. Upload an unprotected Excel file.',
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('keeps error-without-data distinct from a header-only workbook', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.upload(
      screen.getByLabelText('Choose Excel file'),
      createSalesWorkbookFile('headers-only.xlsx', []),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Headers found, but no sales records.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Workbook drop zone' })).toHaveAttribute(
      'data-has-dashboard',
      'false',
    )
  })
})

describe('placeholder intake still fails the pipeline', () => {
  it('does not commit a workbook that lacks required columns', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.upload(
      screen.getByLabelText('Choose Excel file'),
      createWorkbookFile('placeholder.xlsx'),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      REQUIRED_COLUMNS_NOT_FOUND_MESSAGE,
    )
  })
})

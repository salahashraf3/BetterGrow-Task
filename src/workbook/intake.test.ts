import { describe, expect, it, vi } from 'vitest'
import { MAX_FILE_SIZE_BYTES } from '../domain/policy'
import {
  EMPTY_FILE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  UNREADABLE_WORKBOOK_MESSAGE,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from './messages'
import { inspectUploadFile, readWorkbookFile } from './intake'
import { createNamedFile, createWorkbookFile } from '../test/excelFiles'

describe('inspectUploadFile', () => {
  it.each(['sales.XLSX', 'budget.xLsX', 'legacy.XLS', 'q1.xLs'])(
    'accepts mixed-case Excel extension %s',
    (fileName) => {
      expect(inspectUploadFile(createNamedFile(fileName, 'placeholder'))).toEqual(
        [],
      )
    },
  )

  it.each(['notes.csv', 'sales.xlsx.txt', 'workbook.pdf', 'data'])(
    'rejects wrong extension %s before parsing',
    (fileName) => {
      const issues = inspectUploadFile(createNamedFile(fileName, 'placeholder'))
      expect(issues).toEqual([
        {
          code: 'unsupported-file-type',
          message: UNSUPPORTED_FILE_TYPE_MESSAGE,
        },
      ])
    },
  )

  it('rejects a zero-byte workbook', () => {
    const file = new File([], 'empty.xlsx')
    expect(file.size).toBe(0)
    expect(inspectUploadFile(file)).toEqual([
      {
        code: 'empty-file',
        message: EMPTY_FILE_MESSAGE,
      },
    ])
  })

  it('accepts a file that is exactly 10 MB', () => {
    const file = createNamedFile('edge.xlsx', 'placeholder', MAX_FILE_SIZE_BYTES)
    expect(file.size).toBe(MAX_FILE_SIZE_BYTES)
    expect(inspectUploadFile(file)).toEqual([])
  })

  it('rejects a file over 10 MB', () => {
    const file = createNamedFile(
      'too-big.xlsx',
      'placeholder',
      MAX_FILE_SIZE_BYTES + 1,
    )
    expect(inspectUploadFile(file)).toEqual([
      {
        code: 'file-too-large',
        message: FILE_TOO_LARGE_MESSAGE,
      },
    ])
  })
})

describe('readWorkbookFile', () => {
  it('reads a valid .xlsx file with a mixed-case extension', async () => {
    const result = await readWorkbookFile(createWorkbookFile('Team.XLSX', 'xlsx'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.workbook.fileName).toBe('Team.XLSX')
      expect(result.workbook.worksheetName).toBe('Data')
    }
  })

  it('reads a valid .xls file with a mixed-case extension', async () => {
    const result = await readWorkbookFile(createWorkbookFile('Legacy.Xls', 'xls'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.workbook.fileName).toBe('Legacy.Xls')
    }
  })

  it('does not parse a wrong extension', async () => {
    const file = createNamedFile('sales.csv', 'a,b\n1,2')
    const spy = vi.spyOn(file, 'arrayBuffer')
    const result = await readWorkbookFile(file)
    expect(spy).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unsupported-file-type',
          message: UNSUPPORTED_FILE_TYPE_MESSAGE,
        },
      ],
    })
  })

  it('does not parse a zero-byte file', async () => {
    const file = new File([], 'empty.xlsx')
    const spy = vi.spyOn(file, 'arrayBuffer')
    const result = await readWorkbookFile(file)
    expect(spy).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'empty-file',
          message: EMPTY_FILE_MESSAGE,
        },
      ],
    })
  })

  it('parses a file whose reported size is exactly 10 MB', async () => {
    const valid = createWorkbookFile('ok.xlsx')
    const bytes = await valid.arrayBuffer()
    const file = createNamedFile('ok.xlsx', bytes, MAX_FILE_SIZE_BYTES)
    const result = await readWorkbookFile(file)
    expect(file.size).toBe(MAX_FILE_SIZE_BYTES)
    expect(result.ok).toBe(true)
  })

  it('does not parse a file over 10 MB', async () => {
    const file = createNamedFile(
      'too-big.xlsx',
      'placeholder',
      MAX_FILE_SIZE_BYTES + 1,
    )
    const spy = vi.spyOn(file, 'arrayBuffer')
    const result = await readWorkbookFile(file)
    expect(spy).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'file-too-large',
          message: FILE_TOO_LARGE_MESSAGE,
        },
      ],
    })
  })

  it('fails during parsing for a renamed text file with a .xlsx extension', async () => {
    const file = createNamedFile(
      'disguised.xlsx',
      'This is a renamed text file, not an Excel workbook.',
    )
    const spy = vi.spyOn(file, 'arrayBuffer')
    const result = await readWorkbookFile(file)
    expect(spy).toHaveBeenCalledOnce()
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unreadable-workbook',
          message: UNREADABLE_WORKBOOK_MESSAGE,
        },
      ],
    })
  })
})

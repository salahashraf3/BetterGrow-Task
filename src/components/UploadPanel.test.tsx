import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { UNREADABLE_WORKBOOK_MESSAGE, UNSUPPORTED_FILE_TYPE_MESSAGE } from '../workbook/messages'
import { createNamedFile, createSalesWorkbookFile } from '../test/excelFiles'

describe('UploadPanel', () => {
  it('loads a workbook from the file input and shows the filename', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('Choose Excel file')
    await user.upload(input, createSalesWorkbookFile('north.XLSX', [
      ['Ada Lovelace', 'January', 100, 90],
    ]))

    expect(
      await screen.findByText('Selected file: north.XLSX — workbook loaded'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeEmptyDOMElement()
  })

  it('loads a workbook from drag and drop', async () => {
    render(<App />)

    fireEvent.drop(screen.getByRole('group', { name: 'Workbook drop zone' }), {
      dataTransfer: { files: [createSalesWorkbookFile('east.xls', [['Grace Hopper', 'January', 50, 50]], 'xls')] },
    })

    expect(
      await screen.findByText('Selected file: east.xls — workbook loaded'),
    ).toBeInTheDocument()
  })

  it('shows the parse error for unreadable content with a valid extension', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.upload(
      screen.getByLabelText('Choose Excel file'),
      createNamedFile('fake.xlsx', 'not a workbook'),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      UNREADABLE_WORKBOOK_MESSAGE,
    )
    expect(screen.getByText('Selected file: fake.xlsx')).toBeInTheDocument()
  })

  it('shows an error when a non-Excel file is dropped', async () => {
    render(<App />)

    fireEvent.drop(screen.getByRole('group', { name: 'Workbook drop zone' }), {
      dataTransfer: { files: [createNamedFile('notes.csv', 'a,b')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      UNSUPPORTED_FILE_TYPE_MESSAGE,
    )
    expect(screen.getByText('Selected file: notes.csv')).toBeInTheDocument()
  })

  it('clears a previous validation error after a valid upload', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(input, createNamedFile('fake.xlsx', 'not a workbook'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      UNREADABLE_WORKBOOK_MESSAGE,
    )

    await user.upload(input, createSalesWorkbookFile('clean.xlsx', [
      ['Ada Lovelace', 'January', 100, 90],
    ]))
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeEmptyDOMElement()
    })
    expect(
      screen.getByText('Selected file: clean.xlsx — workbook loaded'),
    ).toBeInTheDocument()
  })
})

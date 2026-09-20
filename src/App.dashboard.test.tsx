import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createNamedFile, createSalesWorkbookFile } from './test/excelFiles'

describe('finished dashboard UI', () => {
  it('keeps KPI cards, chart, and table hidden in the empty state', () => {
    render(<App />)

    expect(screen.queryByRole('article', { name: 'Overall Budget' })).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Overall Actual Sales' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /budget versus actual/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.queryByText(/AED /)).not.toBeInTheDocument()
  })

  it('reveals KPI cards, chart, and table after a valid upload', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.upload(
      screen.getByLabelText('Choose Excel file'),
      createSalesWorkbookFile('team.xlsx', [
        ['Ada Lovelace', 'January', 100, 90],
        ['Grace Hopper', 'January', 80, 80],
      ]),
    )

    expect(await screen.findByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 180.00',
    )
    expect(screen.getByRole('article', { name: 'Overall Actual Sales' })).toHaveTextContent(
      'AED 170.00',
    )
    expect(screen.getByRole('img', { name: /budget versus actual sales/i })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Salesperson' })).toBeInTheDocument()
  })

  it('keeps previous KPI and table values after a failed replacement upload', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Choose Excel file')

    await user.upload(
      input,
      createSalesWorkbookFile('valid.xlsx', [['Ada Lovelace', 'January', 100, 90]]),
    )
    expect(
      await screen.findByRole('article', { name: 'Overall Budget' }),
    ).toHaveTextContent('AED 100.00')
    expect(screen.getByRole('article', { name: 'Overall Actual Sales' })).toHaveTextContent(
      'AED 90.00',
    )

    await user.upload(input, createNamedFile('broken.xlsx', 'not a workbook'))

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.getByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 100.00',
    )
    expect(screen.getByRole('article', { name: 'Overall Actual Sales' })).toHaveTextContent(
      'AED 90.00',
    )
    expect(screen.getByRole('table')).toHaveTextContent('Ada Lovelace')
    expect(screen.getByRole('img', { name: /budget versus actual sales/i })).toBeInTheDocument()
  })
})

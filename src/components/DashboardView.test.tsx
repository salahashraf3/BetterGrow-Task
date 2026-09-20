import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { aggregateSalesRecords } from '../domain/aggregate'
import type { SalesRecord } from '../domain/types'
import DashboardView from './DashboardView'

function records(rows: readonly (readonly [string, number, number])[]): SalesRecord[] {
  return rows.map(([salesperson, budgetAmount, actualSales], index) => ({
    salesperson,
    month: 'January',
    budgetAmount,
    actualSales,
    sourceRowNumber: index + 2,
  }))
}

describe('DashboardView', () => {
  it('reveals KPI cards, chart, and detail table for a valid summary', () => {
    const summary = aggregateSalesRecords(
      records([
        ['Ada Lovelace', 100, 90],
        ['Grace Hopper', 80, 80],
      ]),
    )

    render(<DashboardView fileName="team.xlsx" summary={summary} />)

    expect(screen.getByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 180.00',
    )
    expect(
      screen.getByRole('article', { name: 'Overall Actual Sales' }),
    ).toHaveTextContent('AED 170.00')
    expect(
      screen.getByRole('article', { name: 'Overall Achievement' }),
    ).toHaveTextContent('%')
    expect(screen.getByRole('article', { name: 'On target' })).toHaveTextContent('1')
    expect(screen.getByRole('article', { name: 'Below target' })).toHaveTextContent(
      '1',
    )
    expect(
      screen.getByRole('img', { name: /budget versus actual sales/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('On target')
    expect(screen.getByRole('table')).toHaveTextContent('Below target')
  })

  it('shows N/A achievement and No budget when total budget is zero', () => {
    const summary = aggregateSalesRecords(records([['Ada Lovelace', 0, 250]]))

    render(<DashboardView fileName="zero.xlsx" summary={summary} />)

    expect(
      screen.getByRole('article', { name: 'Overall Achievement' }),
    ).toHaveTextContent('N/A')
    expect(screen.getByRole('article', { name: 'On target' })).toHaveTextContent('0')
    expect(screen.getByRole('article', { name: 'Below target' })).toHaveTextContent(
      '0',
    )
    expect(screen.getByText('No budget')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Overall Budget' })).toHaveTextContent(
      'AED 0.00',
    )
  })
})

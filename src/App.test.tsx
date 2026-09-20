import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the dashboard title', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Bettergrow Sales Dashboard' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Upload workbook' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

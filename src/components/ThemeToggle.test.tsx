import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('theme toggle', () => {
  it('switches the document theme and persists the choice', async () => {
    window.localStorage.removeItem('bettergrow-theme')
    const user = userEvent.setup()
    render(<App />)

    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('bettergrow-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('restores a stored dark preference on load', () => {
    window.localStorage.setItem('bettergrow-theme', 'dark')
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    window.localStorage.removeItem('bettergrow-theme')
  })
})

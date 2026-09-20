import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createElement } from 'react'
import { afterEach, vi } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Bar: ({ 'aria-label': label }: { readonly 'aria-label'?: string }) =>
    createElement('div', {
      role: 'img',
      'aria-label': label ?? 'Budget vs Actual chart',
    }),
}))

afterEach(() => {
  cleanup()
})

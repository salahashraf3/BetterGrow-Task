/**
 * Display-only AED formatting. Calculations always use unrounded numbers.
 */
export function formatAed(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `AED ${formatted}`
}

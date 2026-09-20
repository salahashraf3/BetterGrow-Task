import type { CanonicalField } from './types'

/**
 * Fixed ingest and validation policies (not configurable):
 *
 * - Maximum file size is 10 MB.
 * - Only `.xlsx` and `.xls` are accepted (extension compared case-insensitively).
 * - Scan at most the first 20 worksheet rows for one row containing all four
 *   required headers.
 * - Reject duplicate columns that map to the same required field.
 * - Reject negative Budget and negative Actual Sales. Returns and credit notes
 *   are outside scope.
 * - Actual >= Budget is On target when Budget is positive (compared on
 *   amounts, not a rounded percentage). Actual < Budget is Below target.
 * - A zero total budget produces achievement N/A and status No budget.
 * - Reject duplicate normalized salesperson + normalized month pairs.
 *
 * Header matching is exact lookup in `HEADER_ALIAS_MAP` after `normalizeHeader`.
 * There is no fuzzy matching, substring matching, or edit-distance fallback.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_WORKBOOK_EXTENSIONS = ['.xlsx', '.xls'] as const

export const HEADER_SCAN_MAX_ROWS = 20

export const REQUIRED_CANONICAL_FIELDS = [
  'salesperson',
  'month',
  'budgetAmount',
  'actualSales',
] as const satisfies readonly CanonicalField[]

export const CANONICAL_FIELD_LABELS: Readonly<Record<CanonicalField, string>> = {
  salesperson: 'Salesperson',
  month: 'Month',
  budgetAmount: 'Budget Amount',
  actualSales: 'Actual Sales',
}

export type HeaderAlias = {
  readonly alias: string
  readonly field: CanonicalField
}

/**
 * The only accepted header spellings, in their documented display form.
 * Matching uses `normalizeHeader` (trim, lowercase, collapse repeated spaces)
 * and then an exact key lookup — never fuzzy comparison.
 */
export const ACCEPTED_HEADER_ALIASES: readonly HeaderAlias[] = [
  { alias: 'Salesperson', field: 'salesperson' },
  { alias: 'Sales Person', field: 'salesperson' },
  { alias: 'Month', field: 'month' },
  { alias: 'Budget Amount', field: 'budgetAmount' },
  { alias: 'Budget', field: 'budgetAmount' },
  { alias: 'Actual Sales', field: 'actualSales' },
  { alias: 'Actual', field: 'actualSales' },
  { alias: 'Actual Sales Amount', field: 'actualSales' },
]

/**
 * Trim, lowercase, and collapse repeated whitespace to a single space.
 */
export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/ +/g, ' ')
}

function createHeaderAliasMap(): Record<string, CanonicalField> {
  const map: Record<string, CanonicalField> = {}

  for (const { alias, field } of ACCEPTED_HEADER_ALIASES) {
    map[normalizeHeader(alias)] = field
  }

  return map
}

/**
 * Normalized header → canonical field. Keys are produced only from
 * `ACCEPTED_HEADER_ALIASES` via `normalizeHeader`. Lookup is `map[key]` only.
 */
export const HEADER_ALIAS_MAP: Readonly<Record<string, CanonicalField>> =
  createHeaderAliasMap()

export function lookupCanonicalField(header: string): CanonicalField | undefined {
  return HEADER_ALIAS_MAP[normalizeHeader(header)]
}

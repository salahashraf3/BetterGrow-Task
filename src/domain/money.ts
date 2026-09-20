export type MoneyParseFailure = 'blank' | 'invalid'

export type MoneyParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: MoneyParseFailure }

/**
 * Strict money parser. Does not use parseFloat (which accepts `100abc`).
 *
 * Accepted:
 * - finite Excel numbers
 * - plain numeric text: `1000`, `1,000`, `1000.50`
 * - AED text: `AED 1,000.50`
 *
 * Rejected: booleans, NaN/Infinity, partial numeric strings, currency symbols,
 * non-AED currency codes, ambiguous `1.000,50`, malformed grouping `10,00`,
 * and blank strings.
 */
const STRICT_NUMERIC_TEXT =
  /^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/

const AED_PREFIX = /^AED\s+(.+)$/i

export function parseMoney(value: unknown): MoneyParseResult {
  if (value === null || value === undefined) {
    return { ok: false, reason: 'blank' }
  }

  if (typeof value === 'boolean') {
    return { ok: false, reason: 'invalid' }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, reason: 'invalid' }
    }

    return { ok: true, value }
  }

  if (typeof value !== 'string') {
    return { ok: false, reason: 'invalid' }
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return { ok: false, reason: 'blank' }
  }

  const aedMatch = AED_PREFIX.exec(trimmed)
  const numericText = aedMatch?.[1]
  if (aedMatch) {
    if (numericText === undefined || numericText.trim() === '') {
      return { ok: false, reason: 'invalid' }
    }

    return parseStrictNumericText(numericText)
  }

  return parseStrictNumericText(trimmed)
}

function parseStrictNumericText(text: string): MoneyParseResult {
  if (!STRICT_NUMERIC_TEXT.test(text)) {
    return { ok: false, reason: 'invalid' }
  }

  const signed = text.startsWith('-')
  const digits = (signed ? text.slice(1) : text).replaceAll(',', '')
  const value = signed ? Number(`-${digits}`) : Number(digits)

  if (!Number.isFinite(value)) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true, value }
}

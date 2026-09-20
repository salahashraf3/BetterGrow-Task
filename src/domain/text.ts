/**
 * Trim and collapse repeated spaces. Used for display names and month labels.
 */
export function collapseWhitespace(value: string): string {
  return value.trim().replace(/ +/g, ' ')
}

/**
 * Duplicate-detection key: collapsed whitespace, then lowercase.
 */
export function normalizeKey(value: string): string {
  return collapseWhitespace(value).toLowerCase()
}

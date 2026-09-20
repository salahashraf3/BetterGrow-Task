export type {
  CanonicalField,
  DashboardSummary,
  RawWorksheetRow,
  SalespersonResult,
  SalesRecord,
  TargetStatus,
  ValidationIssue,
  ValidationIssueCode,
} from './types'
export type { Performance } from './aggregate'
export type { HeaderAlias } from './policy'
export {
  aggregateSalesRecords,
  calculatePerformance,
  formatAchievementPercent,
} from './aggregate'
export { formatAed } from './format'
export {
  ACCEPTED_HEADER_ALIASES,
  ALLOWED_WORKBOOK_EXTENSIONS,
  CANONICAL_FIELD_LABELS,
  HEADER_ALIAS_MAP,
  HEADER_SCAN_MAX_ROWS,
  lookupCanonicalField,
  MAX_FILE_SIZE_BYTES,
  normalizeHeader,
  REQUIRED_CANONICAL_FIELDS,
} from './policy'


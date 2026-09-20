# Bettergrow Sales Dashboard

A small web app for the Bettergrow Holding Group practical assessment: upload one Excel
workbook of salesperson budget vs actual sales, and see KPIs, a budget-vs-actual chart,
and a per-salesperson detail table. Everything runs in the browser - no backend, and the
uploaded data never leaves the device.

- Live app: https://salahashraf3.github.io/BetterGrow-Task/
- Stack: React 19, TypeScript, Vite, SheetJS (xlsx), Chart.js (react-chartjs-2), Vitest

## Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm 10+

## Commands

```bash
npm install        # install dependencies
npm run dev        # local development server
npm run lint       # strict ESLint
npm run test:run   # Vitest once (CI-friendly)
npm test           # Vitest in watch mode
npm run test:coverage  # tests with v8 coverage report
npm run build      # TypeScript check + production bundle to dist/
npm run preview    # serve the production build locally
```

## Architecture

```
src/
  domain/       Pure types, policies, alias map, money/percent formatting, aggregation
  workbook/     File intake guards, SheetJS parsing, header detection, row validation
  state/        React session state (transactional, race-safe) and colour theme
  components/   UploadPanel, DashboardView (KPIs + table), BudgetActualChart, ThemeToggle
  test/         Vitest setup and workbook fixture builders
```

Data flow: file guard -> workbook parse -> header detection -> row validation ->
duplicate detection -> aggregation -> transactional commit -> render.

## Assessment walkthrough

1. **File guard** (`workbook/intake.ts`) - only `.xlsx`/`.xls` (case-insensitive),
   zero-byte files rejected, anything over 10 MB rejected before parsing.
2. **Workbook parse** (`workbook/sheetjs.ts`) - read with SheetJS from an ArrayBuffer.
   Unreadable or password-protected files get one clear message. Only the **first
   worksheet** is processed; additional sheets are ignored.
3. **Header detection** (`workbook/structure.ts`) - the first 20 worksheet rows are
   scanned for a single row containing all four required headers via an explicit alias
   map. No fuzzy matching. Distinct errors for "No data found", "Required columns not
   found", and "Headers found, but no sales records".
4. **Row validation** (`workbook/validateRows.ts`) - blank cells are missing, never
   zero; strict money parsing (see below); negative Budget and negative Actual Sales are
   rejected; every error cites the original Excel row number.
5. **Duplicate detection** - after normalization (trim, collapse repeated spaces,
   lowercase), a duplicate salesperson + month pair rejects the file and names both
   Excel rows.
6. **Aggregation** (`domain/aggregate.ts`) - per-salesperson and overall Budget/Actual
   sums; achievement computed from unrounded totals; zero budget -> achievement N/A,
   status "No budget", excluded from On/Below target counts.
7. **Transactional commit** (`state/useWorkbookSession.ts`) - a workbook replaces the
   dashboard only when the whole file passes. A failed upload keeps the last valid
   dashboard on screen and shows its error beside it. A monotonically increasing request
   token guarantees latest-upload-wins: an older slow read can never overwrite a newer
   result. The file input is reset after each pick so the same file can be reselected.
8. **Render** - KPI cards, grouped Budget vs Actual bar chart, and a detail table with
   On target / Below target / No budget status pills. Nothing renders before the first
   valid upload; there is no demo or dummy data anywhere.

## Workbook contract

Required columns (all four on the same row, within the first 20 rows):

| Canonical field | Accepted aliases |
| --- | --- |
| Salesperson | `Salesperson`, `Sales Person` |
| Month | `Month` |
| Budget Amount | `Budget Amount`, `Budget` |
| Actual Sales | `Actual Sales`, `Actual`, `Actual Sales Amount` |

Aliases are compared after trim + lowercase + collapsing repeated spaces. Two columns
mapping to the same field are rejected.

Money parsing is strict:

- Accepted: real Excel numbers, plain numeric text (`1000`, `1,000`, `1000.50`), and
  strict AED text (`AED 1,000.50`).
- Rejected: booleans, NaN/Infinity, partial strings (`100abc`), currency symbols,
  non-AED currency codes (`USD 1,000`), ambiguous separators (`1.000,50`), malformed
  grouping (`10,00`), and blank strings. No parseFloat-style partial parsing.

Business policies:

- Negative Budget and negative Actual Sales are rejected. Returns and credit notes are
  outside the scope of this tool.
- Actual equal to Budget counts as **On target** (compared on amounts, before any
  percentage rounding).
- Zero total budget -> achievement **N/A**, status **No budget**, excluded from the
  On/Below target counts.
- Duplicate normalized salesperson + month pairs reject the whole file.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`:
`npm ci`, lint, tests, production build, then publishes `dist/` to GitHub Pages.
The site is only deployed when all checks pass. Vite's `base` is set to
`/BetterGrow-Task/` to match the repository name. No secrets are stored in the repo.

## Testing

Vitest + Testing Library. Workbook fixtures are built programmatically with SheetJS in
`src/test/excelFiles.ts`, so the whole contract above is covered by repeatable tests:
intake guards, unreadable workbooks, header scan limits, every alias, strict money
forms, negatives, normalization, duplicates, aggregation rules, transactional upload
state, out-of-order upload races, and same-file reselection.

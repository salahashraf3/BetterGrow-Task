import { formatAchievementPercent } from '../domain/aggregate'
import { formatAed } from '../domain/format'
import type { DashboardSummary } from '../domain/types'
import BudgetActualChart from './BudgetActualChart'
import './DashboardView.css'

type DashboardViewProps = {
  readonly fileName: string
  readonly summary: DashboardSummary
}

function KpiCard({
  title,
  value,
}: {
  readonly title: string
  readonly value: string
}) {
  return (
    <article className="kpi-card" aria-label={title}>
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  )
}

export default function DashboardView({ fileName, summary }: DashboardViewProps) {
  return (
    <section className="dashboard" aria-label="Sales performance">
      <header className="dashboard__header">
        <h2>Performance</h2>
        <p className="dashboard__file">Workbook: {fileName}</p>
      </header>

      <div className="kpi-grid">
        <KpiCard title="Overall Budget" value={formatAed(summary.totalBudget)} />
        <KpiCard
          title="Overall Actual Sales"
          value={formatAed(summary.totalActual)}
        />
        <KpiCard
          title="Overall Achievement"
          value={formatAchievementPercent(summary.overallAchievementPercent)}
        />
        <KpiCard title="On target" value={String(summary.onTargetCount)} />
        <KpiCard title="Below target" value={String(summary.belowTargetCount)} />
      </div>

      <section className="dashboard__chart" aria-labelledby="chart-heading">
        <h3 id="chart-heading">Budget vs Actual</h3>
        <BudgetActualChart rows={summary.salespersonResults} />
      </section>

      <section className="dashboard__table" aria-labelledby="table-heading">
        <h3 id="table-heading">Salesperson detail</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Salesperson</th>
                <th scope="col">Budget</th>
                <th scope="col">Actual</th>
                <th scope="col">Achievement</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.salespersonResults.map((row) => (
                <tr key={row.salespersonKey}>
                  <th scope="row">{row.salesperson}</th>
                  <td>{formatAed(row.budget)}</td>
                  <td>{formatAed(row.actual)}</td>
                  <td>{formatAchievementPercent(row.achievementPercent)}</td>
                  <td>
                    <span
                      className={`status status--${row.status === 'On target' ? 'on' : row.status === 'Below target' ? 'below' : 'none'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

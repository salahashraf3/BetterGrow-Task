import { useMemo } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { formatAed } from '../domain/format'
import type { SalespersonResult } from '../domain/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type BudgetActualChartProps = {
  readonly rows: readonly SalespersonResult[]
}

const BUDGET_COLOR = '#1e3a8a'
const ACTUAL_COLOR = '#0f766e'

export default function BudgetActualChart({ rows }: BudgetActualChartProps) {
  const data = useMemo(
    (): ChartData<'bar'> => ({
      labels: rows.map((row) => row.salesperson),
      datasets: [
        {
          label: 'Budget',
          data: rows.map((row) => row.budget),
          backgroundColor: BUDGET_COLOR,
          borderColor: BUDGET_COLOR,
          borderWidth: 1,
        },
        {
          label: 'Actual Sales',
          data: rows.map((row) => row.actual),
          backgroundColor: ACTUAL_COLOR,
          borderColor: ACTUAL_COLOR,
          borderWidth: 1,
        },
      ],
    }),
    [rows],
  )

  const options = useMemo(
    (): ChartOptions<'bar'> => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#0f172a',
            boxWidth: 14,
            font: { size: 13 },
          },
        },
        title: {
          display: true,
          text: 'Budget vs Actual by salesperson',
          color: '#0f172a',
          font: { size: 15, weight: 600 },
        },
        tooltip: {
          callbacks: {
            label(item): string {
              const label = item.dataset.label ?? ''
              const value = typeof item.parsed.y === 'number' ? item.parsed.y : 0
              return `${label}: ${formatAed(value)}`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#334155', maxRotation: 45, minRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#334155',
            callback(value): string {
              return typeof value === 'number' ? formatAed(value) : value
            },
          },
        },
      },
    }),
    [],
  )

  const description = rows
    .map(
      (row) =>
        `${row.salesperson}: Budget ${formatAed(row.budget)}, Actual ${formatAed(row.actual)}`,
    )
    .join('. ')

  return (
    <figure className="chart-block">
      <div className="chart-block__scroll">
        <div
          className="chart-block__canvas"
          style={{ minWidth: `${String(Math.max(20, rows.length * 7))}rem` }}
        >
          <Bar
            data={data}
            options={options}
            role="img"
            aria-label={`Grouped bar chart of budget versus actual sales by salesperson. ${description}`}
          />
        </div>
      </div>
      <figcaption className="chart-block__caption">
        Grouped bars compare Budget and Actual Sales for each salesperson. The
        legend below the chart identifies the two series.
      </figcaption>
    </figure>
  )
}

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
import { useTheme } from '../state/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type BudgetActualChartProps = {
  readonly rows: readonly SalespersonResult[]
}

type ChartPalette = {
  readonly budget: string
  readonly actual: string
  readonly text: string
  readonly grid: string
}

const PALETTES: Record<'light' | 'dark', ChartPalette> = {
  light: {
    budget: '#1f3a32',
    actual: '#0f766e',
    text: '#5c6b62',
    grid: '#e8e2d2',
  },
  dark: {
    budget: '#7a8f86',
    actual: '#2dd4bf',
    text: '#9aaca0',
    grid: '#2e3b33',
  },
}

export default function BudgetActualChart({ rows }: BudgetActualChartProps) {
  const { theme } = useTheme()
  const palette = PALETTES[theme]

  const data = useMemo(
    (): ChartData<'bar'> => ({
      labels: rows.map((row) => row.salesperson),
      datasets: [
        {
          label: 'Budget',
          data: rows.map((row) => row.budget),
          backgroundColor: palette.budget,
          borderColor: palette.budget,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Actual Sales',
          data: rows.map((row) => row.actual),
          backgroundColor: palette.actual,
          borderColor: palette.actual,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    }),
    [rows, palette],
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
            color: palette.text,
            boxWidth: 14,
            font: { size: 13 },
          },
        },
        title: {
          display: true,
          text: 'Budget vs Actual Sales by salesperson',
          color: palette.text,
          font: { size: 13, weight: 'normal' },
        },
        tooltip: {
          callbacks: {
            label(context): string {
              const value = context.parsed.y
              const series = context.dataset.label ?? ''
              return `${series}: ${formatAed(typeof value === 'number' ? value : 0)}`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: palette.text, maxRotation: 45, minRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: palette.text,
            callback(value): string {
              return typeof value === 'number' ? formatAed(value) : value
            },
          },
          grid: { color: palette.grid },
        },
      },
    }),
    [palette],
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

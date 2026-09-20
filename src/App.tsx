import DashboardView from './components/DashboardView'
import ThemeToggle from './components/ThemeToggle'
import UploadPanel from './components/UploadPanel'
import { useTheme } from './state/useTheme'
import { useWorkbookSession } from './state/useWorkbookSession'
import type { ProcessWorkbook } from './workbook/pipeline'
import { runWorkbookPipeline } from './workbook/pipeline'
import './App.css'

type AppProps = {
  readonly processWorkbook?: ProcessWorkbook
}

function App({ processWorkbook = runWorkbookPipeline }: AppProps) {
  const session = useWorkbookSession(processWorkbook)
  const { theme, toggleTheme } = useTheme()

  return (
    <main className="page">
      <header className="page__intro">
        <div className="page__topline">
          <p className="page__eyebrow">Bettergrow Holding Group</p>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <h1>Bettergrow Sales Dashboard</h1>
        <p className="page__lede">
          Upload an Excel workbook to compare salesperson actuals against
          budget. Nothing is shown until a valid file is processed.
        </p>
      </header>
      <UploadPanel session={session} />
      {session.summary && session.committedFileName ? (
        <DashboardView
          fileName={session.committedFileName}
          summary={session.summary}
        />
      ) : null}
      <footer className="page__footer">
        <p>Built with React, TypeScript, and Vite. Data never leaves the browser.</p>
      </footer>
    </main>
  )
}

export default App

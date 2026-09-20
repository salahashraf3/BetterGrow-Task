import DashboardView from './components/DashboardView'
import UploadPanel from './components/UploadPanel'
import { useWorkbookSession } from './state/useWorkbookSession'
import type { ProcessWorkbook } from './workbook/pipeline'
import { runWorkbookPipeline } from './workbook/pipeline'
import './App.css'

type AppProps = {
  readonly processWorkbook?: ProcessWorkbook
}

function App({ processWorkbook = runWorkbookPipeline }: AppProps) {
  const session = useWorkbookSession(processWorkbook)

  return (
    <main className="page">
      <header className="page__intro">
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
    </main>
  )
}

export default App

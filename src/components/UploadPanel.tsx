import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import type { WorkbookSession } from '../state/useWorkbookSession'
import './UploadPanel.css'

function firstDroppedFile(fileList: ArrayLike<File> | null | undefined): File | undefined {
  if (!fileList || fileList.length === 0) {
    return undefined
  }

  return fileList[0]
}

type UploadPanelProps = {
  readonly session: WorkbookSession
}

type SampleWorkbook = {
  readonly label: string
  readonly description: string
  readonly fileName: string
}

const SAMPLE_WORKBOOKS: readonly SampleWorkbook[] = [
  {
    label: 'Valid workbook',
    description: 'Loads the complete dashboard',
    fileName: 'BGH_Sample_Valid.xlsx',
  },
  {
    label: 'Invalid rows',
    description: 'Shows row-level validation',
    fileName: 'BGH_Sample_Invalid_Rows.xlsx',
  },
  {
    label: 'Duplicate entry',
    description: 'Shows duplicate salesperson-month validation',
    fileName: 'BGH_Sample_Duplicate.xlsx',
  },
]

export default function UploadPanel({ session }: UploadPanelProps) {
  const inputId = useId()
  const errorId = useId()
  const fileStatusId = useId()
  const [isDragging, setIsDragging] = useState(false)
  const [sampleLoadError, setSampleLoadError] = useState<string | null>(null)
  const isReading = session.status === 'reading'
  const hasErrors = session.issues.length > 0

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.target
    const file = input.files?.[0]
    if (file) {
      void session.processFile(file)
    }
    input.value = ''
  }

  async function handleSampleClick(sample: SampleWorkbook): Promise<void> {
    setSampleLoadError(null)

    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}samples/${sample.fileName}`,
      )
      if (!response.ok) {
        throw new Error('Sample workbook could not be loaded')
      }

      const workbook = new File([await response.blob()], sample.fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      await session.processFile(workbook)
    } catch {
      setSampleLoadError('The testing sample could not be loaded. Please try again.')
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(false)
    const file = firstDroppedFile(event.dataTransfer.files)
    if (file) {
      void session.processFile(file)
    }
  }

  return (
    <section className="upload-panel rise" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Upload workbook</h2>
      <p className="upload-panel__hint">
        Excel files only (.xlsx or .xls). The first worksheet is read.
      </p>

      <div
        className={
          isDragging ? 'upload-panel__dropzone is-dragging' : 'upload-panel__dropzone'
        }
        role="group"
        aria-label="Workbook drop zone"
        aria-busy={isReading}
        data-status={session.status}
        data-has-dashboard={session.summary !== null ? 'true' : 'false'}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className="upload-panel__label" htmlFor={inputId}>
          Choose Excel file
        </label>
        <input
          id={inputId}
          className="upload-panel__input"
          type="file"
          accept=".xlsx,.xls"
          aria-invalid={hasErrors}
          aria-describedby={`${fileStatusId} ${errorId}`}
          onChange={handleInputChange}
        />
        <p className="upload-panel__drop-hint">or drag and drop it here</p>
      </div>

      <aside className="upload-panel__samples" aria-labelledby="sample-heading">
        <div className="upload-panel__samples-intro">
          <h3 id="sample-heading">Testing samples</h3>
          <p>Optional files for quickly checking the upload states.</p>
        </div>
        <div className="upload-panel__sample-list">
          {SAMPLE_WORKBOOKS.map((sample) => (
            <button
              key={sample.fileName}
              className="upload-panel__sample"
              type="button"
              disabled={isReading}
              onClick={() => void handleSampleClick(sample)}
            >
              <span>{sample.label}</span>
              <small>{sample.description}</small>
            </button>
          ))}
        </div>
        {sampleLoadError ? (
          <p className="upload-panel__sample-error" role="alert">
            {sampleLoadError}
          </p>
        ) : null}
      </aside>

      <p id={fileStatusId} className="upload-panel__file" aria-live="polite">
        {isReading ? 'Reading workbook… ' : null}
        {session.selectedFileName
          ? `Selected file: ${session.selectedFileName}`
          : 'No file selected'}
        {session.status === 'ready' ? ' — workbook loaded' : null}
      </p>

      <div id={errorId} className="upload-panel__errors" role="alert">
        {session.issues.map((issue) => (
          <p
            key={`${issue.code}-${String(issue.rowNumber ?? '')}-${issue.field ?? ''}-${issue.header ?? ''}`}
          >
            {issue.message}
          </p>
        ))}
      </div>
    </section>
  )
}

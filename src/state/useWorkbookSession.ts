import { useCallback, useRef, useState } from 'react'
import type { DashboardSummary, ValidationIssue } from '../domain/types'
import { UNREADABLE_WORKBOOK_MESSAGE } from '../workbook/messages'
import {
  runWorkbookPipeline,
  type ProcessWorkbook,
  type WorkbookPipelineResult,
} from '../workbook/pipeline'

export type SessionStatus = 'idle' | 'reading' | 'ready' | 'error'

export type WorkbookSession = {
  readonly status: SessionStatus
  readonly selectedFileName: string | null
  readonly committedFileName: string | null
  readonly summary: DashboardSummary | null
  readonly issues: readonly ValidationIssue[]
  readonly requestVersion: number
  readonly processFile: (file: File) => Promise<void>
}

function failedRead(): WorkbookPipelineResult {
  return {
    ok: false,
    issues: [
      {
        code: 'unreadable-workbook',
        message: UNREADABLE_WORKBOOK_MESSAGE,
      },
    ],
  }
}

export function useWorkbookSession(
  processWorkbook: ProcessWorkbook = runWorkbookPipeline,
): WorkbookSession {
  const versionRef = useRef(0)
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [committedFileName, setCommittedFileName] = useState<string | null>(
    null,
  )
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([])
  const [requestVersion, setRequestVersion] = useState(0)

  const processFile = useCallback(
    async (file: File): Promise<void> => {
      const nextVersion = versionRef.current + 1
      versionRef.current = nextVersion
      setRequestVersion(nextVersion)
      setSelectedFileName(file.name)
      setStatus('reading')

      let result: WorkbookPipelineResult
      try {
        result = await processWorkbook(file)
      } catch {
        result = failedRead()
      }

      if (nextVersion !== versionRef.current) {
        return
      }

      if (result.ok) {
        setSummary(result.summary)
        setCommittedFileName(result.fileName)
        setIssues([])
        setStatus('ready')
        return
      }

      setIssues(result.issues)
      setStatus('error')
    },
    [processWorkbook],
  )

  return {
    status,
    selectedFileName,
    committedFileName,
    summary,
    issues,
    requestVersion,
    processFile,
  }
}

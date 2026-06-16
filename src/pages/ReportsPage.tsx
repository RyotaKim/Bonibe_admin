import { Archive, FileDown, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  MutationNotice,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  ReportRows,
  Toolbar,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { fetchReports } from '../lib/adminData'
import {
  generateAllReports,
  generateReport,
  generatedReportKinds,
  type GeneratedReportFormat,
  type GeneratedReportKind,
} from '../lib/reportGenerator'
import type { ReportExport, ReportsData } from '../types/admin'

export function ReportsPage() {
  const query = useAdminQuery(fetchReports)
  const [filter, setFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [previewReport, setPreviewReport] = useState<ReportExport | null>(null)
  const [kind, setKind] = useState<GeneratedReportKind>('branch-daily-summary')
  const [format, setFormat] = useState<GeneratedReportFormat>('pdf')
  const [sourceLocationId, setSourceLocationId] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => defaultDateFrom())
  const [dateTo, setDateTo] = useState(() => today())
  const [generateStatus, setGenerateStatus] = useMutationStatus()
  const filtered = useMemo(() => {
    const reports = query.data?.reports ?? []
    const locations = query.data?.locations ?? []

    return reports.filter((report) => {
      const location = locations.find((item) => item.id === report.location_id)
      const matchesLocation =
        locationFilter === 'all' ||
        report.location_id === locationFilter ||
        location?.type === locationFilter

      return (
        matchesLocation &&
        [
          report.report_type,
          report.format,
          report.file_name,
          report.sync_status,
          report.origin,
          location?.name,
          location?.type,
        ]
        .join(' ')
        .toLowerCase()
        .includes(filter.toLowerCase())
      )
    })
  }, [filter, locationFilter, query.data?.locations, query.data?.reports])

  const sourceOptions = useMemo(() => {
    const locations = query.data?.locations ?? []

    return locations.filter((location) =>
      ['branch', 'kitchen'].includes(location.type),
    )
  }, [query.data?.locations])

  const generatorLocations = useMemo(() => {
    const locations = query.data?.locations ?? []

    if (kind.startsWith('branch')) {
      return locations.filter((location) => location.type === 'branch')
    }

    if (kind.startsWith('client')) {
      return locations.filter((location) => location.type === 'client')
    }

    return locations.filter((location) =>
      ['branch', 'client', 'kitchen'].includes(location.type),
    )
  }, [kind, query.data?.locations])
  const sourceAllLabel = kind.startsWith('branch')
    ? 'All branches'
    : kind.startsWith('client')
      ? 'All clients'
      : 'All branches and clients'

  function onKindChange(nextKind: GeneratedReportKind) {
    setKind(nextKind)
    setSourceLocationId('all')
  }

  return (
    <PageShell
      pageKey="reports"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: ReportsData) => (
          <>
            <NoticeList notices={data.notices} />
            <Panel title="Generate Reports" icon={Archive}>
              <MutationNotice status={generateStatus} />
              <div className="report-generator-grid">
                <label className="field">
                  <span>Report</span>
                  <select
                    value={kind}
                    onChange={(event) =>
                      onKindChange(event.target.value as GeneratedReportKind)
                    }
                  >
                    {generatedReportKinds.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Source</span>
                  <select
                    value={sourceLocationId}
                    onChange={(event) => setSourceLocationId(event.target.value)}
                  >
                    <option value="all">{sourceAllLabel}</option>
                    {generatorLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} ({location.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Format</span>
                  <select
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value as GeneratedReportFormat)
                    }
                  >
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel</option>
                  </select>
                </label>
              </div>
              <div className="button-row report-generator-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() =>
                    void runMutation(
                      setGenerateStatus,
                      async () => {
                        generateReport(data, {
                          kind,
                          format,
                          locationId: sourceLocationId,
                          dateFrom,
                          dateTo,
                        })
                      },
                      'Report generated.',
                    )
                  }
                >
                  <FileDown size={18} />
                  Generate Selected
                </button>
                <button
                  className="inline-action"
                  type="button"
                  onClick={() =>
                    void runMutation(
                      setGenerateStatus,
                      () =>
                        generateAllReports(data, {
                          dateFrom,
                          dateTo,
                        }),
                      'Daily and weekly report pack generated.',
                    )
                  }
                >
                  <Archive size={16} />
                  Generate All PDF + Excel
                </button>
              </div>
            </Panel>

            <Panel title="Report Exports" icon={FileDown}>
              <div className="toolbar-row">
                <Toolbar value={filter} onChange={setFilter} />
                <label className="field compact-field">
                  <span>Source</span>
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                  >
                    <option value="all">All branches and kitchens</option>
                    <option value="branch">All branches</option>
                    <option value="kitchen">All kitchens</option>
                    {sourceOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ReportRows
                reports={filtered}
                locations={data.locations}
                onPreview={setPreviewReport}
              />
            </Panel>
            {previewReport?.download_url ? (
              <div
                className="preview-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Document preview"
              >
                <section className="preview-panel">
                  <div className="preview-header">
                    <div>
                      <strong>{previewReport.report_type}</strong>
                      <span>{previewReport.file_name}</span>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Close preview"
                      onClick={() => setPreviewReport(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <iframe
                    src={previewReport.download_url}
                    title={previewReport.file_name}
                  />
                </section>
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function defaultDateFrom() {
  const date = new Date()
  date.setDate(date.getDate() - 6)

  return date.toISOString().slice(0, 10)
}

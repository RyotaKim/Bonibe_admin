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
  generateReport,
} from '../lib/reportGenerator'
import type { ReportExport, ReportsData } from '../types/admin'

type ProductionReportSource = 'branch' | 'kitchen' | 'whole'
type ReportDatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

export function ReportsPage() {
  const query = useAdminQuery(fetchReports)
  const [filter, setFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [previewReport, setPreviewReport] = useState<ReportExport | null>(null)
  const [reportSource, setReportSource] =
    useState<ProductionReportSource>('kitchen')
  const [branchLocationId, setBranchLocationId] = useState('all')
  const [kitchenLocationId, setKitchenLocationId] = useState('all')
  const [productId, setProductId] = useState('all')
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('today')
  const [dateFrom, setDateFrom] = useState(() => today())
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

  const branchOptions = useMemo(() => {
    const locations = query.data?.locations ?? []

    return locations.filter((location) => location.type === 'branch')
  }, [query.data?.locations])
  const kitchenOptions = useMemo(() => {
    const locations = query.data?.locations ?? []

    return locations.filter((location) => location.type === 'kitchen')
  }, [query.data?.locations])
  const productOptions = useMemo(() => {
    const products = query.data?.products ?? []

    return products.filter((product) => product.active)
  }, [query.data?.products])

  const selectedLocationId =
    reportSource === 'branch'
      ? branchLocationId
      : reportSource === 'kitchen'
        ? kitchenLocationId
        : 'all'
  const selectedReportKind =
    reportSource === 'branch'
      ? 'branch-daily-production'
      : reportSource === 'kitchen'
        ? 'kitchen-daily-production'
        : 'bonibe-daily-production-summary'
  const primaryReportLabel =
    reportSource === 'branch'
      ? 'Generate Branch Report'
      : reportSource === 'kitchen'
        ? 'Generate Kitchen Report'
        : 'Generate Whole Bonibe'
  const locationOptions =
    reportSource === 'branch'
      ? branchOptions
      : reportSource === 'kitchen'
        ? kitchenOptions
        : []
  const handlePresetChange = (preset: ReportDatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const range = rangeForPreset(preset)
      setDateFrom(range.dateFrom)
      setDateTo(range.dateTo)
    }
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
            <Panel title="Daily Production Report" icon={Archive}>
              <MutationNotice status={generateStatus} />
              <div className="report-generator-grid">
                <label className="field">
                  <span>Report source</span>
                  <select
                    value={reportSource}
                    onChange={(event) =>
                      setReportSource(event.target.value as ProductionReportSource)
                    }
                  >
                    <option value="kitchen">Kitchen daily report</option>
                    <option value="branch">Branch daily report</option>
                    <option value="whole">Whole Bonibe summary</option>
                  </select>
                </label>
                <label className="field">
                  <span>
                    {reportSource === 'branch'
                      ? 'Branch'
                      : reportSource === 'kitchen'
                        ? 'Kitchen'
                        : 'Scope'}
                  </span>
                  <select
                    value={selectedLocationId}
                    disabled={reportSource === 'whole'}
                    onChange={(event) => {
                      if (reportSource === 'branch') {
                        setBranchLocationId(event.target.value)
                      } else if (reportSource === 'kitchen') {
                        setKitchenLocationId(event.target.value)
                      }
                    }}
                  >
                    <option value="all">
                      {reportSource === 'branch'
                        ? 'All branches'
                        : reportSource === 'kitchen'
                          ? 'All kitchens'
                          : 'All branches and kitchens'}
                    </option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Product</span>
                  <select
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                  >
                    <option value="all">All products</option>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Date filter</span>
                  <select
                    value={datePreset}
                    onChange={(event) =>
                      handlePresetChange(event.target.value as ReportDatePreset)
                    }
                  >
                    <option value="today">Today</option>
                    <option value="this-week">This Week</option>
                    <option value="this-month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </label>
                <label className="field">
                  <span>From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      const next = event.target.value
                      setDatePreset('custom')
                      setDateFrom(next)
                      if (dateTo < next) {
                        setDateTo(next)
                      }
                    }}
                  />
                </label>
                <label className="field">
                  <span>To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      const next = event.target.value
                      setDatePreset('custom')
                      setDateTo(next)
                      if (dateFrom > next) {
                        setDateFrom(next)
                      }
                    }}
                  />
                </label>
              </div>
              <div className="button-row report-generator-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() =>
                    void runMutation(
                      setGenerateStatus,
                      () =>
                        generateReport(data, {
                          kind: selectedReportKind,
                          format: 'xlsx',
                          locationId: selectedLocationId,
                          productId,
                          dateFrom,
                          dateTo,
                        }),
                      `${primaryReportLabel.replace('Generate ', '')} generated.`,
                    )
                  }
                >
                  <FileDown size={18} />
                  {primaryReportLabel}
                </button>
                {reportSource !== 'whole' ? (
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() =>
                      void runMutation(
                        setGenerateStatus,
                        () =>
                          generateReport(data, {
                            kind: 'bonibe-daily-production-summary',
                            format: 'xlsx',
                            locationId: 'all',
                            productId,
                            dateFrom,
                            dateTo,
                          }),
                        'Whole Bonibe production summary generated.',
                      )
                    }
                  >
                    <Archive size={16} />
                    Whole Bonibe XLSX
                  </button>
                ) : null}
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
  return dateInputValue(new Date())
}

function rangeForPreset(preset: ReportDatePreset) {
  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = dateInputValue(todayDate)

  if (preset === 'this-week') {
    const start = new Date(todayDate)
    const mondayOffset = (todayDate.getDay() + 6) % 7
    start.setDate(todayDate.getDate() - mondayOffset)

    return { dateFrom: dateInputValue(start), dateTo: end }
  }

  if (preset === 'this-month') {
    const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)

    return { dateFrom: dateInputValue(start), dateTo: end }
  }

  return { dateFrom: end, dateTo: end }
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

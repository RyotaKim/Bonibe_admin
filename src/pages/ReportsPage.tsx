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

export function ReportsPage() {
  const query = useAdminQuery(fetchReports)
  const [filter, setFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [previewReport, setPreviewReport] = useState<ReportExport | null>(null)
  const [branchLocationId, setBranchLocationId] = useState('all')
  const [productId, setProductId] = useState('all')
  const [productionDate, setProductionDate] = useState(() => today())
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
  const productOptions = useMemo(() => {
    const products = query.data?.products ?? []

    return products.filter((product) => product.active)
  }, [query.data?.products])

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
                  <span>Branch</span>
                  <select
                    value={branchLocationId}
                    onChange={(event) => setBranchLocationId(event.target.value)}
                  >
                    <option value="all">All branches</option>
                    {branchOptions.map((location) => (
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
                  <span>Production date</span>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(event) => setProductionDate(event.target.value)}
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
                          kind: 'branch-daily-production',
                          format: 'xlsx',
                          locationId: branchLocationId,
                          productId,
                          dateFrom: productionDate,
                          dateTo: productionDate,
                        }),
                      'Branch production report generated.',
                    )
                  }
                >
                  <FileDown size={18} />
                  Generate Branch PROD
                </button>
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
                          dateFrom: productionDate,
                          dateTo: productionDate,
                        }),
                      'Whole Bonibe production summary generated.',
                    )
                  }
                >
                  <Archive size={16} />
                  Whole Bonibe XLSX
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

import { AlertTriangle, BarChart3, Eye, Loader2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Badge,
  EmptyRows,
  NoticeList,
  RefreshButton,
} from '../components/ui/AdminUi'
import { PageShell } from '../components/layout/PageShell'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { fetchDashboard } from '../lib/adminData'
import type {
  DashboardBranch,
  DashboardBranchRecord,
  DashboardData,
} from '../types/admin'
import { formatDate, formatMoney, formatNumber } from '../utils/format'

type FilterMode = 'today' | 'week' | 'month' | 'custom'

type DateRange = {
  from: string
  to: string
  label: string
}

type BranchRow = {
  branch: DashboardBranch
  todaySales: number
  weekSales: number
  monthSales: number
  selectedSales: number
  latestRecord: DashboardBranchRecord | null
  hasRecordToday: boolean
}

const dateFilterOptions: Array<{ value: FilterMode; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Date' },
]

export function OverviewPage() {
  const query = useAdminQuery(fetchDashboard)
  const today = dateKey(new Date())
  const [filterMode, setFilterMode] = useState<FilterMode>('today')
  const [customDate, setCustomDate] = useState(today)
  const [selectedRecord, setSelectedRecord] =
    useState<DashboardBranchRecord | null>(null)

  const range = useMemo(
    () => rangeForFilter(filterMode, customDate),
    [customDate, filterMode],
  )

  return (
    <PageShell
      pageKey="overview"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      {query.loading ? <OverviewLoading /> : null}
      {!query.loading && query.error ? (
        <OverviewError message={query.error} onRetry={query.reload} />
      ) : null}
      {!query.loading && !query.error && query.data ? (
        <DashboardContent
          data={query.data}
          filterMode={filterMode}
          customDate={customDate}
          onFilterModeChange={setFilterMode}
          onCustomDateChange={setCustomDate}
          range={range}
          onViewRecord={setSelectedRecord}
        />
      ) : null}
      {selectedRecord ? (
        <BranchDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}
    </PageShell>
  )
}

function DashboardContent({
  data,
  filterMode,
  customDate,
  onFilterModeChange,
  onCustomDateChange,
  range,
  onViewRecord,
}: {
  data: DashboardData
  filterMode: FilterMode
  customDate: string
  onFilterModeChange: (mode: FilterMode) => void
  onCustomDateChange: (date: string) => void
  range: DateRange
  onViewRecord: (record: DashboardBranchRecord) => void
}) {
  const today = dateKey(new Date())
  const weekRange = rangeForFilter('week', today)
  const monthRange = rangeForFilter('month', today)
  const branchRows = buildBranchRows(data.branches, data.records, range)
  const selectedRecords = data.records.filter((record) =>
    isWithinRange(record.businessDate, range),
  )
  const todaySales = totalSalesInRange(data.records, {
    from: today,
    to: today,
    label: 'Today',
  })
  const weekSales = totalSalesInRange(data.records, weekRange)
  const monthSales = totalSalesInRange(data.records, monthRange)
  const activeBranches = branchRows.filter((row) => row.hasRecordToday).length
  const recentRecords = [...data.records]
    .sort(compareRecentRecords)
    .slice(0, 10)

  return (
    <>
      <NoticeList notices={data.notices} />

      <section className="sales-filter-panel" aria-label="Date filter">
        <div className="segmented-control">
          {dateFilterOptions.map((option) => (
            <button
              className={filterMode === option.value ? 'active' : ''}
              key={option.value}
              type="button"
              onClick={() => onFilterModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {filterMode === 'custom' ? (
          <label className="compact-date-field">
            <span>Date</span>
            <input
              type="date"
              value={customDate}
              onChange={(event) =>
                onCustomDateChange(event.target.value || dateKey(new Date()))
              }
            />
          </label>
        ) : null}
      </section>

      <section className="metric-grid" aria-label="Branch sales summary">
        <SalesMetric label="Total Sales Today" value={todaySales} />
        <SalesMetric label="Total Sales This Week" value={weekSales} />
        <SalesMetric label="Total Sales This Month" value={monthSales} />
        <article className="metric-card sales-metric">
          <span>Active Branches</span>
          <strong>{formatNumber(activeBranches)}</strong>
          <small>With records today</small>
        </article>
      </section>

      <section className="panel sales-panel">
        <div className="panel-heading">
          <div>
            <h2>Branch Sales Chart</h2>
            <p className="panel-note">{range.label}</p>
          </div>
          <BarChart3 size={20} />
        </div>
        {selectedRecords.some((record) => record.sales > 0) ? (
          <BranchSalesChart rows={branchRows} />
        ) : (
          <EmptyRows label="No branch sales recorded for this period." />
        )}
      </section>

      <section className="panel sales-panel">
        <div className="panel-heading">
          <div>
            <h2>Branch Sales Overview</h2>
            <p className="panel-note">
              Simple branch totals from encoded inventory records.
            </p>
          </div>
        </div>
        <BranchSalesTable rows={branchRows} onViewRecord={onViewRecord} />
      </section>

      <section className="panel sales-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent Branch Records</h2>
            <p className="panel-note">Latest encoded branch sessions.</p>
          </div>
        </div>
        <RecentRecordsTable
          records={recentRecords}
          onViewRecord={onViewRecord}
        />
      </section>
    </>
  )
}

function SalesMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card sales-metric">
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
      <small>From branch encoded records</small>
    </article>
  )
}

function BranchSalesChart({ rows }: { rows: BranchRow[] }) {
  const maxSales = Math.max(...rows.map((row) => row.selectedSales), 0)

  return (
    <div className="branch-sales-chart">
      {rows.map((row) => (
        <div className="chart-row" key={row.branch.id}>
          <span>{row.branch.name}</span>
          <div className="chart-track">
            <div
              className="chart-bar"
              style={{
                width: `${
                  maxSales > 0 ? Math.max((row.selectedSales / maxSales) * 100, 2) : 0
                }%`,
              }}
            />
          </div>
          <strong>{formatMoney(row.selectedSales)}</strong>
        </div>
      ))}
    </div>
  )
}

function BranchSalesTable({
  rows,
  onViewRecord,
}: {
  rows: BranchRow[]
  onViewRecord: (record: DashboardBranchRecord) => void
}) {
  if (!rows.length) {
    return <EmptyRows label="No branch sales recorded for this period." />
  }

  return (
    <div className="table-scroll">
      <table className="data-table sales-table">
        <thead>
          <tr>
            <th>Branch Name</th>
            <th>Today Sales</th>
            <th>Week Sales</th>
            <th>Month Sales</th>
            <th>Latest Encoded Date</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.branch.id}>
              <td>
                <strong>{row.branch.name}</strong>
              </td>
              <td>{formatMoney(row.todaySales)}</td>
              <td>{formatMoney(row.weekSales)}</td>
              <td>{formatMoney(row.monthSales)}</td>
              <td>{formatDate(row.latestRecord?.businessDate)}</td>
              <td>
                <Badge tone={row.hasRecordToday ? 'green' : 'neutral'}>
                  {row.hasRecordToday ? 'Updated' : 'No Record Today'}
                </Badge>
              </td>
              <td>
                {row.latestRecord ? (
                  <ViewDetailsButton
                    record={row.latestRecord}
                    onViewRecord={onViewRecord}
                  />
                ) : (
                  <span className="muted-text">No record</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecentRecordsTable({
  records,
  onViewRecord,
}: {
  records: DashboardBranchRecord[]
  onViewRecord: (record: DashboardBranchRecord) => void
}) {
  if (!records.length) {
    return <EmptyRows label="No branch sales recorded for this period." />
  }

  return (
    <div className="table-scroll">
      <table className="data-table recent-sales-table">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Date</th>
            <th>Sales</th>
            <th>Expenses</th>
            <th>Remarks</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.sessionId}>
              <td>
                <strong>{record.branchName}</strong>
              </td>
              <td>{formatDate(record.businessDate)}</td>
              <td>{formatMoney(record.sales)}</td>
              <td>{formatMoney(record.expenses)}</td>
              <td>{record.remarks || 'None'}</td>
              <td>
                <ViewDetailsButton
                  record={record}
                  onViewRecord={onViewRecord}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ViewDetailsButton({
  record,
  onViewRecord,
}: {
  record: DashboardBranchRecord
  onViewRecord: (record: DashboardBranchRecord) => void
}) {
  return (
    <button
      className="inline-action"
      type="button"
      onClick={() => onViewRecord(record)}
    >
      <Eye size={16} />
      View Details
    </button>
  )
}

function BranchDetailModal({
  record,
  onClose,
}: {
  record: DashboardBranchRecord
  onClose: () => void
}) {
  const detail = record.detail

  return (
    <div className="confirm-overlay" role="presentation">
      <section className="branch-detail-modal" role="dialog" aria-modal="true">
        <div className="preview-header">
          <div>
            <strong>{record.branchName}</strong>
            <span>{formatDate(record.businessDate)} encoded details</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="branch-detail-grid">
          <DetailStat
            label="Opening inventory"
            value={formatNumber(detail.openingInventory)}
          />
          <DetailStat label="Sales / manual sales" value={formatMoney(detail.manualSales)} />
          <DetailStat
            label="Sold quantity"
            value={formatNumber(detail.soldQuantity)}
          />
          <DetailStat
            label="Deliveries"
            value={formatNumber(detail.deliveries)}
          />
          <DetailStat
            label="Damages / returns / molds"
            value={`${formatNumber(detail.damages)} / ${formatNumber(
              detail.returns,
            )} / ${formatNumber(detail.molds)}`}
          />
          <DetailStat label="Expenses" value={formatMoney(detail.expenses)} />
          <DetailStat
            label="Ending inventory"
            value={formatNumber(detail.endingInventory)}
          />
          <DetailStat
            label="Variance"
            value={formatNumber(detail.variance)}
          />
          <DetailStat label="Record status" value={record.status} />
          <DetailStat label="Line items" value={formatNumber(detail.lineCount)} />
        </div>
        <div className="branch-detail-remarks">
          <strong>Remarks</strong>
          <p>{record.remarks || 'None'}</p>
        </div>
      </section>
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="detail-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function OverviewLoading() {
  return (
    <div className="panel loading-panel">
      <Loader2 size={22} />
      <span>Loading branch sales overview...</span>
    </div>
  )
}

function OverviewError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="message-card overview-error">
      <AlertTriangle size={26} />
      <div>
        <h1>Sales overview could not load</h1>
        <p>{message}</p>
        <button className="primary-action retry-action" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  )
}

function buildBranchRows(
  branches: DashboardBranch[],
  records: DashboardBranchRecord[],
  selectedRange: DateRange,
): BranchRow[] {
  const today = dateKey(new Date())
  const weekRange = rangeForFilter('week', today)
  const monthRange = rangeForFilter('month', today)

  return branches.map((branch) => {
    const branchRecords = records
      .filter((record) => record.branchId === branch.id)
      .sort(compareRecentRecords)
    const latestRecord = branchRecords[0] ?? null

    return {
      branch,
      todaySales: totalSalesInRange(branchRecords, {
        from: today,
        to: today,
        label: 'Today',
      }),
      weekSales: totalSalesInRange(branchRecords, weekRange),
      monthSales: totalSalesInRange(branchRecords, monthRange),
      selectedSales: totalSalesInRange(branchRecords, selectedRange),
      latestRecord,
      hasRecordToday: branchRecords.some(
        (record) => record.businessDate === today,
      ),
    }
  })
}

function totalSalesInRange(
  records: DashboardBranchRecord[],
  range: DateRange,
) {
  return records
    .filter((record) => isWithinRange(record.businessDate, range))
    .reduce((total, record) => total + record.sales, 0)
}

function isWithinRange(value: string, range: DateRange) {
  return value >= range.from && value <= range.to
}

function compareRecentRecords(
  left: DashboardBranchRecord,
  right: DashboardBranchRecord,
) {
  const byDate = right.businessDate.localeCompare(left.businessDate)

  if (byDate !== 0) {
    return byDate
  }

  return right.updatedAt.localeCompare(left.updatedAt)
}

function rangeForFilter(mode: FilterMode, customDate: string): DateRange {
  const today = dateKey(new Date())
  const current = fromDateKey(today)

  if (mode === 'custom') {
    return {
      from: customDate,
      to: customDate,
      label: `Custom date: ${formatDate(customDate)}`,
    }
  }

  if (mode === 'week') {
    const from = startOfWeek(current)

    return {
      from: dateKey(from),
      to: today,
      label: `This week: ${formatDate(dateKey(from))} to ${formatDate(today)}`,
    }
  }

  if (mode === 'month') {
    const from = new Date(current.getFullYear(), current.getMonth(), 1)

    return {
      from: dateKey(from),
      to: today,
      label: `This month: ${formatDate(dateKey(from))} to ${formatDate(today)}`,
    }
  }

  return {
    from: today,
    to: today,
    label: `Today: ${formatDate(today)}`,
  }
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date)
  const dayOffset = (nextDate.getDay() + 6) % 7
  nextDate.setDate(nextDate.getDate() - dayOffset)

  return nextDate
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function fromDateKey(value: string) {
  return new Date(`${value}T00:00:00`)
}

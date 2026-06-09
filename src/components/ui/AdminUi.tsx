import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { MutationStatus } from '../../hooks/useMutationStatus'
import type {
  AdminNotice,
  AuditLog,
  ReportExport,
  SyncQueueItem,
} from '../../types/admin'
import { formatDate, formatNumber } from '../../utils/format'

export function MessageState({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ size?: number }>
  title: string
  body: string
}) {
  return (
    <section className="message-card">
      <Icon size={26} />
      <div>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  )
}

export function QueryState<T>({
  query,
  children,
}: {
  query: {
    data: T | null
    loading: boolean
    error: string | null
  }
  children: (data: T) => ReactNode
}) {
  if (query.loading) {
    return <LoadingPanel />
  }

  if (query.error) {
    return (
      <MessageState
        icon={AlertTriangle}
        title="Supabase request failed"
        body={query.error}
      />
    )
  }

  if (!query.data) {
    return (
      <MessageState
        icon={AlertTriangle}
        title="No data returned"
        body="The request completed without a data payload."
      />
    )
  }

  return children(query.data)
}

export function LoadingPanel() {
  return (
    <div className="panel loading-panel">
      <Loader2 size={22} />
      <span>Loading Supabase data...</span>
    </div>
  )
}

export function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: ComponentType<{ size?: number }>
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <Icon size={20} />
      </div>
      {children}
    </section>
  )
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>Live from Supabase</small>
    </article>
  )
}

export function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean
  onClick: () => void
}) {
  return (
    <button className="primary-action" type="button" onClick={onClick}>
      {loading ? <Loader2 size={18} /> : <RefreshCw size={18} />}
      Refresh
    </button>
  )
}

export function Toolbar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="table-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter rows"
      />
    </label>
  )
}

export function NoticeList({ notices }: { notices: AdminNotice[] }) {
  if (!notices.length) {
    return null
  }

  return (
    <div className="notice-list">
      {notices.map((item) => (
        <p key={`${item.source}-${item.message}`}>
          <AlertTriangle size={16} />
          <strong>{item.source}:</strong> {item.message}
        </p>
      ))}
    </div>
  )
}

export function SyncRows({
  items,
  compact = false,
}: {
  items: SyncQueueItem[]
  compact?: boolean
}) {
  if (!items.length) {
    return <EmptyRows label="No sync queue items found." />
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Updated</th>
            {!compact ? <th>Payload</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.entity_type}</strong>
                <small>{item.summary ?? item.action}</small>
              </td>
              <td>
                <Badge tone={item.status === 'failed' ? 'yellow' : 'neutral'}>
                  {item.status}
                </Badge>
              </td>
              <td>{item.attempts}</td>
              <td>{formatDate(item.updated_at)}</td>
              {!compact ? (
                <td>
                  <details>
                    <summary>View</summary>
                    <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                  </details>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportRows({
  reports,
  compact = false,
}: {
  reports: ReportExport[]
  compact?: boolean
}) {
  if (!reports.length) {
    return <EmptyRows label="No report exports found." />
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Format</th>
            <th>Status</th>
            <th>Generated</th>
            {!compact ? <th>File</th> : null}
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <strong>{report.report_type}</strong>
                <small>{report.file_name}</small>
              </td>
              <td>{report.format.toUpperCase()}</td>
              <td>{report.sync_status}</td>
              <td>{formatDate(report.generated_at)}</td>
              {!compact ? (
                <td>
                  {report.file_url ? (
                    <a className="inline-action" href={report.file_url}>
                      <Download size={16} />
                      Open
                    </a>
                  ) : (
                    'Local only'
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AuditRows({ audit }: { audit: AuditLog[] }) {
  if (!audit.length) {
    return <EmptyRows label="No audit logs found." />
  }

  return (
    <div className="activity-list">
      {audit.map((item) => (
        <article className="activity-row" key={item.id}>
          <div>
            <strong>{item.action}</strong>
            <span>
              {item.entity_type}
              {item.entity_id ? ` / ${item.entity_id}` : ''}
            </span>
          </div>
          <em>{formatDate(item.created_at)}</em>
        </article>
      ))}
    </div>
  )
}

export function EmptyRows({ label }: { label: string }) {
  return <p className="empty-state">{label}</p>
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'green' | 'yellow' | 'neutral'
}) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Field({
  label,
  name,
  type = 'text',
  required = false,
  defaultValue,
  placeholder,
  step,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  step?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
      />
    </label>
  )
}

export function Toggle({
  label,
  name,
  defaultChecked = false,
}: {
  label: string
  name: string
  defaultChecked?: boolean
}) {
  return (
    <label className="toggle-row">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  )
}

export function MutationNotice({ status }: { status: MutationStatus }) {
  if (status.state === 'idle') {
    return null
  }

  return <p className={`mutation-notice ${status.state}`}>{status.message}</p>
}

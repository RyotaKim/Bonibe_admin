import { ClipboardCheck, FileDown } from 'lucide-react'
import {
  Metric,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  ReportRows,
  SyncRows,
} from '../components/ui/AdminUi'
import { PageShell } from '../components/layout/PageShell'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { fetchDashboard } from '../lib/adminData'
import type { DashboardData } from '../types/admin'

export function OverviewPage() {
  const query = useAdminQuery(fetchDashboard)

  return (
    <PageShell
      pageKey="overview"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: DashboardData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="metric-grid" aria-label="Operational metrics">
              <Metric label="Staff accounts" value={data.counts.staff} />
              <Metric
                label="Active products"
                value={data.counts.activeProducts}
              />
              <Metric
                label="Active locations"
                value={data.counts.activeLocations}
              />
              <Metric label="Open sync items" value={data.counts.openSync} />
            </section>

            <section className="content-grid">
              <Panel title="Recent Sync Queue" icon={ClipboardCheck}>
                <SyncRows items={data.recentSync} compact />
              </Panel>
              <Panel title="Recent Reports" icon={FileDown}>
                <ReportRows reports={data.recentReports} compact />
              </Panel>
            </section>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

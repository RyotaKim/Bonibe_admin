import { ClipboardCheck, Eye } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import {
  AuditRows,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  SyncRows,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { fetchSyncReview } from '../lib/adminData'
import type { SyncData } from '../types/admin'

export function SyncReviewPage() {
  const query = useAdminQuery(fetchSyncReview)

  return (
    <PageShell
      pageKey="sync"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: SyncData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Queue Items" icon={ClipboardCheck}>
                <SyncRows items={data.items} />
              </Panel>
              <Panel title="Audit Trail" icon={Eye}>
                <AuditRows audit={data.audit} />
              </Panel>
            </section>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

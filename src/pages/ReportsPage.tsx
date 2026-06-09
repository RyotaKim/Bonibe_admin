import { FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  ReportRows,
  Toolbar,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { fetchReports } from '../lib/adminData'
import type { ReportsData } from '../types/admin'

export function ReportsPage() {
  const query = useAdminQuery(fetchReports)
  const [filter, setFilter] = useState('')
  const filtered = useMemo(() => {
    const reports = query.data?.reports ?? []

    return reports.filter((report) =>
      [report.report_type, report.format, report.file_name, report.sync_status]
        .join(' ')
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
  }, [filter, query.data?.reports])

  return (
    <PageShell
      pageKey="reports"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: ReportsData) => (
          <>
            <NoticeList notices={data.notices} />
            <Panel title="Report Exports" icon={FileDown}>
              <Toolbar value={filter} onChange={setFilter} />
              <ReportRows reports={filtered} />
            </Panel>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

import { Building2, Save, ShieldCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  Field,
  MutationNotice,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { fetchLocations, saveCompany } from '../lib/adminData'
import type { LocationsData } from '../types/admin'

export function SettingsPage() {
  const query = useAdminQuery(fetchLocations)
  const [status, setStatus] = useMutationStatus()
  const company = query.data?.companies[0]

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setStatus, () =>
      saveCompany(new FormData(event.currentTarget)),
    )
    query.reload()
  }

  return (
    <PageShell
      pageKey="settings"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: LocationsData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Company Header" icon={Building2}>
                <MutationNotice status={status} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <input
                    type="hidden"
                    name="id"
                    value={company?.id ?? 'bonibe'}
                  />
                  <Field
                    label="Company name"
                    name="company_name"
                    defaultValue={company?.company_name ?? 'Bonibe Bakeshop'}
                  />
                  <Field
                    label="Address"
                    name="address"
                    defaultValue={company?.address ?? ''}
                  />
                  <Field
                    label="Contact number"
                    name="contact_number"
                    defaultValue={company?.contact_number ?? ''}
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    defaultValue={company?.email ?? ''}
                  />
                  <Field
                    label="Receipt footer"
                    name="receipt_footer"
                    defaultValue={company?.receipt_footer ?? ''}
                  />
                  <Field
                    label="Prepared label"
                    name="prepared_by_label"
                    defaultValue={company?.prepared_by_label ?? 'Prepared by'}
                  />
                  <Field
                    label="Checked label"
                    name="checked_by_label"
                    defaultValue={company?.checked_by_label ?? 'Checked by'}
                  />
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Save Company
                  </button>
                </form>
              </Panel>

              <Panel title="Owner Reminders" icon={ShieldCheck}>
                <ul className="scope-list">
                  <li>
                    Keep at least one owner or admin account active at all
                    times.
                  </li>
                  <li>
                    New staff profiles are available after their account details
                    and access role are saved.
                  </li>
                  <li>
                    Account emails are stored for contact and identification;
                    this admin page does not send verification emails.
                  </li>
                  <li>
                    Branch and kitchen downloads appear here after the device
                    has synced its records.
                  </li>
                </ul>
              </Panel>
            </section>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

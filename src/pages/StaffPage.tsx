import { Save, ShieldCheck, UsersRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  Badge,
  Field,
  MutationNotice,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  Toggle,
  Toolbar,
} from '../components/ui/AdminUi'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { fetchStaff, saveProfile } from '../lib/adminData'
import type { StaffData } from '../types/admin'
import { formatDate } from '../utils/format'
import { locationName } from '../utils/relations'

export function StaffPage() {
  const query = useAdminQuery(fetchStaff)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useMutationStatus()
  const locations = query.data?.locations ?? []
  const filtered = useMemo(() => {
    const staff = query.data?.profiles ?? []

    return staff.filter((profile) =>
      [profile.staff_name, profile.email, profile.employee_code, profile.role]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
  }, [search, query.data?.profiles])

  const staff = query.data?.profiles ?? []

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setStatus, () =>
      saveProfile(new FormData(event.currentTarget)),
    )
    query.reload()
  }

  return (
    <PageShell
      pageKey="staff"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: StaffData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Profile Directory" icon={UsersRound}>
                <Toolbar value={search} onChange={setSearch} />
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Role</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((profile) => (
                        <tr key={profile.id}>
                          <td>
                            <strong>{profile.staff_name}</strong>
                            <small>
                              {profile.email ?? profile.employee_code}
                            </small>
                          </td>
                          <td>
                            <Badge
                              tone={
                                profile.role === 'admin' ? 'green' : 'neutral'
                              }
                            >
                              {profile.role}
                            </Badge>
                          </td>
                          <td>
                            {locationName(
                              locations,
                              profile.assigned_location_id,
                            )}
                          </td>
                          <td>{profile.active ? 'Active' : 'Inactive'}</td>
                          <td>{formatDate(profile.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="panel-note">{staff.length} total profiles</p>
              </Panel>

              <Panel title="Link Auth User" icon={ShieldCheck}>
                <p className="panel-note">
                  Create the Supabase Auth user in the dashboard, then save the
                  matching profile here.
                </p>
                <MutationNotice status={status} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <Field label="Auth user ID" name="id" required />
                  <Field label="Staff name" name="staff_name" required />
                  <Field label="Email" name="email" type="email" />
                  <Field label="Employee code" name="employee_code" />
                  <label className="field">
                    <span>Role</span>
                    <select name="role" defaultValue="branch">
                      <option value="admin">admin</option>
                      <option value="kitchen">kitchen</option>
                      <option value="branch">branch</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Assigned location</span>
                    <select name="assigned_location_id" defaultValue="">
                      <option value="">None</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Toggle label="Active" name="active" defaultChecked />
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Save Profile
                  </button>
                </form>
              </Panel>
            </section>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

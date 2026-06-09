import { KeyRound, Save, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
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
  Toolbar,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { createStaffAccount, fetchStaff } from '../lib/adminData'
import type { AppRole, StaffData } from '../types/admin'
import { formatDate } from '../utils/format'
import { locationName } from '../utils/relations'

export function AccountsPage() {
  const query = useAdminQuery(fetchStaff)
  const [role, setRole] = useState<AppRole>('branch')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useMutationStatus()
  const locations = query.data?.locations ?? []
  const filtered = useMemo(() => {
    const profiles = query.data?.profiles ?? []

    return profiles.filter((profile) =>
      [profile.staff_name, profile.email, profile.employee_code, profile.role]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
  }, [query.data?.profiles, search])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setStatus, () =>
      createStaffAccount(new FormData(event.currentTarget)),
    )
    event.currentTarget.reset()
    setRole('branch')
    query.reload()
  }

  return (
    <PageShell
      pageKey="accounts"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: StaffData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Create Account" icon={UserPlus}>
                <p className="panel-note">
                  This creates a Supabase Auth account, then links it to a
                  Bonibe profile with the selected role.
                </p>
                <MutationNotice status={status} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <Field
                    label="Staff name"
                    name="staff_name"
                    required
                    placeholder="Bonibe Admin"
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    required
                    placeholder="staff@example.com"
                  />
                  <Field
                    label="Temporary password"
                    name="password"
                    type="password"
                    required
                    defaultValue="Bonibe1234"
                  />
                  <Field
                    label="Employee code"
                    name="employee_code"
                    placeholder="ADMIN-001"
                  />
                  <label className="field">
                    <span>Role</span>
                    <select
                      name="role"
                      value={role}
                      onChange={(event) => setRole(event.target.value as AppRole)}
                    >
                      <option value="admin">admin</option>
                      <option value="kitchen">kitchen</option>
                      <option value="branch">branch</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Assigned branch location</span>
                    <select
                      name="assigned_location_id"
                      disabled={role !== 'branch'}
                      required={role === 'branch'}
                      defaultValue=""
                    >
                      <option value="">Select branch</option>
                      {locations
                        .filter((location) => location.type === 'branch')
                        .map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Create Account
                  </button>
                </form>
              </Panel>

              <Panel title="Creation Rules" icon={ShieldCheck}>
                <ul className="scope-list">
                  <li>
                    Admin accounts can access this admin website after the
                    profile row is saved.
                  </li>
                  <li>
                    Branch accounts require an assigned branch location for RLS
                    and Flutter routing.
                  </li>
                  <li>
                    Kitchen accounts do not need a branch location and use the
                    Kitchen workspace in the operations app.
                  </li>
                  <li>
                    If Supabase rejects signup, check Auth signups, email rate
                    limits, and the admin RLS policy SQL.
                  </li>
                </ul>
              </Panel>
            </section>

            <Panel title="Existing Accounts" icon={UsersRound}>
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
                          <small>{profile.email ?? profile.employee_code}</small>
                        </td>
                        <td>
                          <Badge
                            tone={profile.role === 'admin' ? 'green' : 'neutral'}
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
            </Panel>

            <Panel title="Password Handling" icon={KeyRound}>
              <p className="panel-note">
                `Bonibe1234` is provided as a simple temporary password. Ask
                staff to change it before real production use.
              </p>
            </Panel>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

import {
  KeyRound,
  Pencil,
  Save,
  Send,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'
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
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import {
  createStaffAccount,
  fetchStaff,
  requestPasswordReset,
  saveProfile,
} from '../lib/adminData'
import type { AppRole, StaffData } from '../types/admin'
import { formatDate } from '../utils/format'
import { locationName } from '../utils/relations'

export function AccountsPage() {
  const query = useAdminQuery(fetchStaff)
  const [role, setRole] = useState<AppRole>('branch')
  const [editRole, setEditRole] = useState<AppRole>('branch')
  const [search, setSearch] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [createStatus, setCreateStatus] = useMutationStatus()
  const [manageStatus, setManageStatus] = useMutationStatus()
  const [resetStatus, setResetStatus] = useMutationStatus()
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
  const selectedProfile = useMemo(
    () =>
      query.data?.profiles.find((profile) => profile.id === selectedProfileId) ??
      null,
    [query.data?.profiles, selectedProfileId],
  )

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setCreateStatus, () =>
      createStaffAccount(new FormData(event.currentTarget)),
    )
    event.currentTarget.reset()
    setRole('branch')
    query.reload()
  }

  async function onManageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setManageStatus, () =>
      saveProfile(new FormData(event.currentTarget)),
    )
    query.reload()
  }

  async function onResetPassword(email: string | null) {
    await runMutation(
      setResetStatus,
      () => requestPasswordReset(email ?? ''),
      'Password reset email sent.',
    )
  }

  function selectProfile(profileId: string) {
    const profile = query.data?.profiles.find((item) => item.id === profileId)

    setSelectedProfileId(profileId)

    if (profile) {
      setEditRole(profile.role)
    }
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
                  Create a staff sign-in account and choose the correct access
                  for an admin, kitchen, or branch user.
                </p>
                <MutationNotice status={createStatus} />
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
                    Admin accounts can access this owner website after the
                    account details are saved.
                  </li>
                  <li>
                    Branch accounts need an assigned branch so their work opens
                    in the right location.
                  </li>
                  <li>
                    Kitchen accounts do not need a branch location and use the
                    Kitchen workspace in the operations app.
                  </li>
                  <li>
                    Password reset emails are sent to the account email address.
                  </li>
                </ul>
              </Panel>
            </section>

            <section className="content-grid">
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
                        <th>Actions</th>
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
                          <td>
                            <div className="table-actions">
                              <button
                                className="inline-action"
                                type="button"
                                onClick={() => selectProfile(profile.id)}
                              >
                                <Pencil size={16} />
                                Edit
                              </button>
                              <button
                                className="inline-action"
                                type="button"
                                onClick={() => void onResetPassword(profile.email)}
                              >
                                <KeyRound size={16} />
                                Reset
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Manage Account" icon={ShieldCheck}>
                <MutationNotice status={manageStatus} />
                <MutationNotice status={resetStatus} />
                <label className="field">
                  <span>Select account</span>
                  <select
                    value={selectedProfileId}
                    onChange={(event) => selectProfile(event.target.value)}
                  >
                    <option value="">Choose staff account</option>
                    {data.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.staff_name}
                        {profile.email ? ` - ${profile.email}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedProfile ? (
                  <form
                    className="form-grid manage-account-form"
                    key={selectedProfile.id}
                    onSubmit={onManageSubmit}
                  >
                    <input type="hidden" name="id" value={selectedProfile.id} />
                    <Field
                      label="Staff name"
                      name="staff_name"
                      required
                      defaultValue={selectedProfile.staff_name}
                    />
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      defaultValue={selectedProfile.email ?? ''}
                    />
                    <Field
                      label="Employee code"
                      name="employee_code"
                      defaultValue={selectedProfile.employee_code ?? ''}
                    />
                    <label className="field">
                      <span>Role</span>
                      <select
                        name="role"
                        value={editRole}
                        onChange={(event) =>
                          setEditRole(event.target.value as AppRole)
                        }
                      >
                        <option value="admin">admin</option>
                        <option value="kitchen">kitchen</option>
                        <option value="branch">branch</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Assigned location</span>
                      <select
                        name="assigned_location_id"
                        disabled={editRole !== 'branch'}
                        required={editRole === 'branch'}
                        defaultValue={selectedProfile.assigned_location_id ?? ''}
                      >
                        <option value="">None</option>
                        {locations
                          .filter((location) => location.type === 'branch')
                          .map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Toggle
                      label="Active"
                      name="active"
                      defaultChecked={selectedProfile.active}
                    />
                    <div className="button-row">
                      <button className="primary-action" type="submit">
                        <Save size={18} />
                        Save Changes
                      </button>
                      <button
                        className="inline-action"
                        type="button"
                        onClick={() => void onResetPassword(selectedProfile.email)}
                      >
                        <Send size={16} />
                        Send Reset Email
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="empty-state">
                    Select an account to edit details or send a password reset.
                  </p>
                )}
              </Panel>
            </section>

            <Panel title="Password Handling" icon={KeyRound}>
              <p className="panel-note">
                `Bonibe1234` is provided as a simple temporary password for new
                accounts. For existing accounts, use reset email so staff can
                securely choose a new password.
              </p>
            </Panel>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

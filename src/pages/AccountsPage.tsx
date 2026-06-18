import {
  Pencil,
  Save,
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
  saveProfile,
} from '../lib/adminData'
import type { AppRole, StaffData } from '../types/admin'
import { formatDate } from '../utils/format'
import { locationName } from '../utils/relations'

function accountNameLabel(role: AppRole) {
  if (role === 'branch') {
    return 'Branch name'
  }

  if (role === 'kitchen') {
    return 'Kitchen name'
  }

  return 'Staff name'
}

function accountNamePlaceholder(role: AppRole) {
  if (role === 'branch') {
    return 'Bonibe Branch'
  }

  if (role === 'kitchen') {
    return 'Bonibe Kitchen'
  }

  return 'Bonibe Admin'
}

function assignedLocationLabel(role: AppRole) {
  if (role === 'branch') {
    return 'Assigned branch location'
  }

  if (role === 'kitchen') {
    return 'Assigned kitchen location'
  }

  return 'Assigned location'
}

export function AccountsPage() {
  const query = useAdminQuery(fetchStaff)
  const [role, setRole] = useState<AppRole>('branch')
  const [editRole, setEditRole] = useState<AppRole>('branch')
  const [search, setSearch] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [createStatus, setCreateStatus] = useMutationStatus()
  const [manageStatus, setManageStatus] = useMutationStatus()
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
    const saved = await runMutation(setCreateStatus, () =>
      createStaffAccount(new FormData(event.currentTarget)),
    )

    if (!saved) {
      return
    }

    event.currentTarget.reset()
    setRole('branch')
    query.reload()
  }

  async function onManageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await runMutation(setManageStatus, () =>
      saveProfile(new FormData(event.currentTarget)),
    )

    if (!saved) {
      return
    }

    query.reload()
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
                  Create an admin, kitchen, or branch profile with a valid
                  email. Kitchen and branch profiles automatically get their
                  own workspace location.
                </p>
                <MutationNotice status={createStatus} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <Field
                    label={accountNameLabel(role)}
                    name="staff_name"
                    required
                    placeholder={accountNamePlaceholder(role)}
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    required
                    placeholder="staff@example.com"
                  />
                  <Field
                    label="Password"
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
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Create Account
                  </button>
                </form>
              </Panel>

              <Panel title="Creation Rules" icon={ShieldCheck}>
                <ul className="scope-list">
                  <li>
                    Admin profiles are saved here for records and access
                    management. Owner website sign-in still uses the existing
                    Supabase admin login.
                  </li>
                  <li>
                    Branch accounts create a new branch location from the
                    branch name and are assigned to it automatically.
                  </li>
                  <li>
                    Kitchen accounts create a new kitchen location from the
                    kitchen name and are assigned to it automatically.
                  </li>
                  <li>
                    Passwords are saved as hashes for app login. No Supabase
                    Auth verification or password reset email is sent.
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
                      label={accountNameLabel(editRole)}
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
                    {editRole === 'admin' ? null : (
                      <label className="field">
                        <span>{assignedLocationLabel(editRole)}</span>
                        <input
                          type="hidden"
                          name="sync_location_name"
                          value="on"
                        />
                        <select
                          name="assigned_location_id"
                          required
                          defaultValue={
                            locations.find(
                              (location) =>
                                location.id ===
                                selectedProfile.assigned_location_id,
                            )?.type === editRole
                              ? selectedProfile.assigned_location_id ?? ''
                              : ''
                          }
                        >
                          <option value="">Select {editRole}</option>
                          {locations
                            .filter((location) => location.type === editRole)
                            .map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
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
                    </div>
                  </form>
                ) : (
                  <p className="empty-state">
                    Select an account to edit details.
                  </p>
                )}
              </Panel>
            </section>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

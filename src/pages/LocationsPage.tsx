import { Building2, Save, Store } from 'lucide-react'
import type { FormEvent } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  Field,
  MutationNotice,
  NoticeList,
  Panel,
  QueryState,
  RefreshButton,
  Toggle,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { fetchLocations, saveLocation } from '../lib/adminData'
import type { LocationsData } from '../types/admin'

export function LocationsPage() {
  const query = useAdminQuery(fetchLocations)
  const [status, setStatus] = useMutationStatus()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setStatus, () =>
      saveLocation(new FormData(event.currentTarget)),
    )
    query.reload()
  }

  return (
    <PageShell
      pageKey="locations"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: LocationsData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Locations" icon={Store}>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Contact</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.locations.map((location) => (
                        <tr key={location.id}>
                          <td>
                            <strong>{location.name}</strong>
                            <small>{location.address}</small>
                          </td>
                          <td>{location.code}</td>
                          <td>{location.type}</td>
                          <td>{location.contact_person ?? 'None'}</td>
                          <td>{location.active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Location Editor" icon={Building2}>
                <MutationNotice status={status} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <Field
                    label="Location ID"
                    name="id"
                    required
                    placeholder="branch_1"
                  />
                  <Field
                    label="Name"
                    name="name"
                    required
                    placeholder="Branch 1"
                  />
                  <Field label="Code" name="code" placeholder="BR-1" />
                  <label className="field">
                    <span>Type</span>
                    <select name="type" defaultValue="branch">
                      <option value="kitchen">kitchen</option>
                      <option value="branch">branch</option>
                      <option value="client">client</option>
                    </select>
                  </label>
                  <Field label="Address" name="address" />
                  <Field label="Contact person" name="contact_person" />
                  <Toggle label="Active" name="active" defaultChecked />
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Save Location
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

import { Building2, Pencil, Save, Store } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
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
  const [selectedLocationId, setSelectedLocationId] = useState('')

  const workspaceLocations = useMemo(() => {
    const data = query.data
    if (!data) {
      return []
    }

    const assignedLocationIds = new Set(
      data.profiles
        .filter(
          (profile) => profile.role === 'kitchen' || profile.role === 'branch',
        )
        .map((profile) => profile.assigned_location_id)
        .filter((id): id is string => Boolean(id)),
    )

    return data.locations.filter(
      (location) =>
        (location.type === 'kitchen' || location.type === 'branch') &&
        assignedLocationIds.has(location.id),
    )
  }, [query.data])

  const effectiveSelectedLocationId =
    selectedLocationId || workspaceLocations[0]?.id || ''

  const selectedLocation =
    workspaceLocations.find((location) => location.id === effectiveSelectedLocationId) ??
    null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await runMutation(setStatus, () =>
      saveLocation(new FormData(event.currentTarget)),
    )

    if (saved) {
      query.reload()
    }
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceLocations.map((location) => (
                        <tr key={location.id}>
                          <td>
                            <strong>{location.name}</strong>
                            <small>{location.address}</small>
                          </td>
                          <td>{location.code}</td>
                          <td>{location.type}</td>
                          <td>{location.contact_person ?? 'None'}</td>
                          <td>{location.active ? 'Active' : 'Inactive'}</td>
                          <td>
                            <button
                              className="inline-action"
                              type="button"
                              onClick={() => setSelectedLocationId(location.id)}
                            >
                              <Pencil size={16} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workspaceLocations.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <p className="empty-state">
                              No kitchen or branch account locations found.
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Location Editor" icon={Building2}>
                <MutationNotice status={status} />
                {selectedLocation ? (
                  <form
                    className="form-grid"
                    key={selectedLocation.id}
                    onSubmit={onSubmit}
                  >
                    <Field
                      label="Location ID"
                      name="id"
                      required
                      defaultValue={selectedLocation.id}
                      readOnly
                    />
                    <Field
                      label="Name"
                      name="name"
                      required
                      defaultValue={selectedLocation.name}
                    />
                    <Field
                      label="Code"
                      name="code"
                      defaultValue={selectedLocation.code}
                    />
                    <label className="field">
                      <span>Type</span>
                      <select name="type" defaultValue={selectedLocation.type}>
                        <option value="kitchen">kitchen</option>
                        <option value="branch">branch</option>
                      </select>
                    </label>
                    <Field
                      label="Address"
                      name="address"
                      defaultValue={selectedLocation.address ?? ''}
                    />
                    <Field
                      label="Contact person"
                      name="contact_person"
                      defaultValue={selectedLocation.contact_person ?? ''}
                    />
                    <Toggle
                      label="Active"
                      name="active"
                      defaultChecked={selectedLocation.active}
                    />
                    <button className="primary-action" type="submit">
                      <Save size={18} />
                      Save Location
                    </button>
                  </form>
                ) : (
                  <p className="empty-state">
                    Select a kitchen or branch location to edit.
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

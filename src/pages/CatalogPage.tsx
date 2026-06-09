import { Boxes, PackageCheck, Save } from 'lucide-react'
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
  Toolbar,
} from '../components/ui/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { runMutation, useMutationStatus } from '../hooks/useMutationStatus'
import { fetchCatalog, saveProduct } from '../lib/adminData'
import type { CatalogData } from '../types/admin'
import { formatDate, formatMoney } from '../utils/format'

export function CatalogPage() {
  const query = useAdminQuery(fetchCatalog)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useMutationStatus()
  const filtered = useMemo(() => {
    const products = query.data?.products ?? []

    return products.filter((product) =>
      [product.name, product.id, product.category]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
  }, [query.data?.products, search])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runMutation(setStatus, () =>
      saveProduct(new FormData(event.currentTarget)),
    )
    query.reload()
  }

  return (
    <PageShell
      pageKey="catalog"
      action={<RefreshButton loading={query.loading} onClick={query.reload} />}
    >
      <QueryState query={query}>
        {(data: CatalogData) => (
          <>
            <NoticeList notices={data.notices} />
            <section className="content-grid">
              <Panel title="Products" icon={PackageCheck}>
                <Toolbar value={search} onChange={setSearch} />
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Plate</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <strong>{product.name}</strong>
                            <small>{product.id}</small>
                          </td>
                          <td>{product.category}</td>
                          <td>{formatMoney(product.unit_price)}</td>
                          <td>{product.pieces_per_plate} pcs</td>
                          <td>{product.active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Product Editor" icon={Boxes}>
                <MutationNotice status={status} />
                <form className="form-grid" onSubmit={onSubmit}>
                  <Field
                    label="Product ID"
                    name="id"
                    required
                    placeholder="pandesal"
                  />
                  <Field
                    label="Name"
                    name="name"
                    required
                    placeholder="Pandesal"
                  />
                  <Field
                    label="Category"
                    name="category"
                    defaultValue="Bread"
                  />
                  <Field
                    label="Unit price"
                    name="unit_price"
                    type="number"
                    step="0.01"
                    defaultValue="0"
                  />
                  <Field
                    label="Pieces per plate"
                    name="pieces_per_plate"
                    type="number"
                    defaultValue="1"
                  />
                  <Field
                    label="Low stock threshold"
                    name="low_stock_threshold"
                    type="number"
                    defaultValue="0"
                  />
                  <Toggle
                    label="Bundle eligible"
                    name="bundle_eligible"
                    defaultChecked
                  />
                  <Toggle label="Active" name="active" defaultChecked />
                  <button className="primary-action" type="submit">
                    <Save size={18} />
                    Save Product
                  </button>
                </form>
              </Panel>
            </section>

            <Panel title="Composite Bundles" icon={PackageCheck}>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bundle</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bundles.map((bundle) => (
                      <tr key={bundle.id}>
                        <td>
                          <strong>{bundle.name}</strong>
                          <small>{bundle.id}</small>
                        </td>
                        <td>{formatMoney(bundle.bundle_price)}</td>
                        <td>{bundle.active ? 'Active' : 'Inactive'}</td>
                        <td>{formatDate(bundle.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

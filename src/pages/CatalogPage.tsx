import {
  AlertTriangle,
  Boxes,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
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
import { deleteProduct, fetchCatalog, saveProduct } from '../lib/adminData'
import type { CatalogData, Product } from '../types/admin'
import { formatDate, formatMoney } from '../utils/format'

type EditorMode = 'add' | 'edit'

export function CatalogPage() {
  const query = useAdminQuery(fetchCatalog)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<EditorMode>('add')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productPendingDelete, setProductPendingDelete] =
    useState<Product | null>(null)
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
  const selectedProduct = useMemo(
    () =>
      query.data?.products.find(
        (product) => product.id === selectedProductId,
      ) ?? null,
    [query.data?.products, selectedProductId],
  )

  function selectProduct(productId: string) {
    setSelectedProductId(productId)
    setMode(productId ? 'edit' : 'add')
  }

  function startAddProduct() {
    setMode('add')
    setSelectedProductId('')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await runMutation(setStatus, () =>
      saveProduct(new FormData(event.currentTarget)),
    )

    if (!saved) {
      return
    }

    if (mode === 'add') {
      event.currentTarget.reset()
    }

    query.reload()
  }

  async function confirmDeleteProduct() {
    if (!productPendingDelete) {
      return
    }

    const deleted = await runMutation(
      setStatus,
      () => deleteProduct(productPendingDelete.id),
      'Product deleted successfully.',
    )

    if (!deleted) {
      return
    }

    if (selectedProductId === productPendingDelete.id) {
      startAddProduct()
    }

    setProductPendingDelete(null)
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
                        <th>Actions</th>
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
                          <td>
                            <button
                              className="inline-action"
                              type="button"
                              onClick={() => selectProduct(product.id)}
                            >
                              <Pencil size={16} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Product Editor" icon={Boxes}>
                <MutationNotice status={status} />
                <div className="form-grid">
                  <label className="field">
                    <span>Select product</span>
                    <select
                      value={mode === 'edit' ? selectedProductId : ''}
                      onChange={(event) => selectProduct(event.target.value)}
                    >
                      <option value="">Add new product</option>
                      {data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="inline-action"
                    type="button"
                    onClick={startAddProduct}
                  >
                    <Plus size={16} />
                    Add Product
                  </button>
                </div>
                <form
                  className="form-grid"
                  key={`${mode}-${selectedProduct?.id ?? 'new'}`}
                  onSubmit={onSubmit}
                >
                  <input
                    type="hidden"
                    name="id"
                    value={mode === 'edit' ? (selectedProduct?.id ?? '') : ''}
                  />
                  <Field
                    label="Name"
                    name="name"
                    required
                    defaultValue={selectedProduct?.name ?? ''}
                    placeholder="Product name"
                  />
                  <Field
                    label="Category"
                    name="category"
                    defaultValue={selectedProduct?.category ?? 'Bread'}
                  />
                  <Field
                    label="Unit price"
                    name="unit_price"
                    type="number"
                    step="0.01"
                    defaultValue={String(selectedProduct?.unit_price ?? 0)}
                  />
                  <Field
                    label="Pieces per plate"
                    name="pieces_per_plate"
                    type="number"
                    defaultValue={String(
                      selectedProduct?.pieces_per_plate ?? 1,
                    )}
                  />
                  <Field
                    label="Low stock threshold"
                    name="low_stock_threshold"
                    type="number"
                    defaultValue={String(
                      selectedProduct?.low_stock_threshold ?? 0,
                    )}
                  />
                  <Toggle
                    label="Bundle eligible"
                    name="bundle_eligible"
                    defaultChecked={selectedProduct?.bundle_eligible ?? true}
                  />
                  <Toggle
                    label="Active"
                    name="active"
                    defaultChecked={selectedProduct?.active ?? true}
                  />
                  <div className="confirm-actions">
                    <button className="primary-action" type="submit">
                      <Save size={18} />
                      {mode === 'edit' ? 'Save Product' : 'Create Product'}
                    </button>
                    {selectedProduct ? (
                      <button
                        className="danger-action"
                        type="button"
                        onClick={() => setProductPendingDelete(selectedProduct)}
                      >
                        <Trash2 size={18} />
                        Delete Product
                      </button>
                    ) : null}
                  </div>
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
            {productPendingDelete ? (
              <div
                className="confirm-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-product-title"
              >
                <div className="confirm-panel">
                  <div className="confirm-icon">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h2 id="delete-product-title">Delete Product?</h2>
                    <p>
                      Are you sure about deleting{' '}
                      <strong>{productPendingDelete.name}</strong>? Products
                      with synced production or sales records may be blocked by
                      the database.
                    </p>
                  </div>
                  <div className="confirm-actions">
                    <button
                      className="inline-action"
                      type="button"
                      onClick={() => setProductPendingDelete(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="danger-action"
                      type="button"
                      onClick={confirmDeleteProduct}
                    >
                      <Trash2 size={18} />
                      Delete Product
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </PageShell>
  )
}

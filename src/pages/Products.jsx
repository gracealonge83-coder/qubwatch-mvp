import { useEffect, useState } from 'react'

// Stage 2: product viewing, add/edit, search and filtering (PRD Sections 14 + 31).
// In-memory only. No database.
const EMPTY_FORM = { name: '', category: '', price: '', stock: '' }

function Products({ products, onAdd, onUpdate }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  // Role comes from the session (this page receives no user prop).
  // Management UI stays hidden until a non-Staff role is confirmed.
  const [role, setRole] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data && data.user) setRole(data.user.role) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const showManagement = role !== null && role !== 'Staff User'

  const categories = [...new Set(products.map((p) => p.category))]

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (q && !p.name.toLowerCase().includes(q)) return false
    if (category !== 'all' && p.category !== category) return false
    if (stockFilter === 'low' && p.stock >= 10) return false
    if (stockFilter === 'discrepancy' && p.stock === p.expectedStock) return false
    return true
  })

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setNotice('')
  }

  function startEdit(product) {
    setEditingId(product.id)
    setNotice('')
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const price = Number(form.price)
    const stock = Number(form.stock)
    if (!form.name.trim() || !form.category.trim()) return
    if (!(price > 0) || !(stock >= 0)) return
    const data = { name: form.name.trim(), category: form.category.trim(), price, stock }
    setNotice('')
    setBusy(true)
    let ok = false
    try {
      if (editingId) {
        ok = await onUpdate(editingId, data)
      } else {
        ok = await onAdd(data)
      }
    } finally {
      setBusy(false)
    }
    if (!ok) return
    const wasEditing = !!editingId
    cancelEdit()
    setNotice(wasEditing ? 'Product updated successfully.' : 'Product added successfully.')
  }

  return (
    <div className="grid">
      {showManagement && (
      <div className="card">
        <h2>{editingId ? 'Edit product' : 'Add product'}</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Rice" />
          </label>
          <label>
            Category
            <input name="category" value={form.category} onChange={handleChange} placeholder="e.g. Grains" />
          </label>
          <label>
            Price (₦)
            <input name="price" value={form.price} onChange={handleChange} placeholder="e.g. 85000" />
          </label>
          <label>
            Stock
            <input name="stock" value={form.stock} onChange={handleChange} placeholder="e.g. 42" />
          </label>
          <div className="form-row">
            <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Saving…' : (editingId ? 'Save changes' : 'Add product')}</button>
            {editingId && (
              <button type="button" className="secondary-btn" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
          {notice && <p role="status">{notice}</p>}
        </form>
      </div>
      )}

      <div className="card">
        <h2>Products ({filtered.length})</h2>
        <div className="toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All stock</option>
            <option value="low">Low stock (&lt; 10)</option>
            <option value="discrepancy">Stock discrepancy</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="muted">No products match.</p>
        ) : (
          <div className="table-wrap">
            <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    {showManagement && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>₦{p.price.toLocaleString()}</td>
                      <td>{p.stock}{p.stock !== p.expectedStock ? ' *' : ''}</td>
                      {showManagement && (
                      <td>
                        <button className="secondary-btn" onClick={() => startEdit(p)}>Edit</button>
                      </td>
                      )}
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        )}
        <p className="muted">* = stock differs from expected stock.</p>
      </div>
    </div>
  )
}

export default Products

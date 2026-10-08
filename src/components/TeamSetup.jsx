import { useState } from 'react'

// Simple team management (PRD Sections 4 + 33: basic roles only).
// Add users and edit name/role. In-memory only. No delete: seeded
// transactions, notes, and audit entries reference these user IDs.
const ROLES = [
  'Business Owner',
  'Authorized Manager',
  'Staff User',
  'Administrator',
]

function TeamSetup({ users, onAdd, onUpdate, newCredentials, onClearCredentials }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Staff User')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('Staff User')
  const [addNotice, setAddNotice] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [editNotice, setEditNotice] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  async function handleAdd(event) {
    event.preventDefault()
    if (!name.trim()) return
    setAddNotice('')
    setAddBusy(true)
    let ok = false
    try {
      ok = await onAdd({ name: name.trim(), role })
    } finally {
      setAddBusy(false)
    }
    if (!ok) return
    setName('')
    setRole('Staff User')
    setAddNotice('User added successfully.')
  }

  function startEdit(user) {
    setEditingId(user.id)
    setEditNotice('')
    setEditName(user.name)
    setEditRole(user.role)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditRole('Staff User')
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!editName.trim()) return
    setEditNotice('')
    setEditBusy(true)
    let ok = false
    try {
      ok = await onUpdate(editingId, { name: editName.trim(), role: editRole })
    } finally {
      setEditBusy(false)
    }
    if (!ok) return
    cancelEdit()
    setEditNotice('User updated successfully.')
  }

  return (
    <div className="card">
      <h2>Team</h2>
      {newCredentials && (
        <div className="card">
          <p><strong>Login password for {newCredentials.name}:</strong></p>
          <p>{newCredentials.temporaryPassword}</p>
          <p className="muted">Shown once. Share it securely, then dismiss.</p>
          <div className="form-row">
            <button type="button" className="secondary-btn" onClick={onClearCredentials}>Dismiss</button>
          </div>
        </div>
      )}
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {editingId === u.id ? (
              <form onSubmit={handleSaveEdit} className="form">
                <label>
                  Name
                  <input value={editName} onChange={(e) => { setEditName(e.target.value); setEditNotice('') }} />
                </label>
                <label>
                  Role
                  <select value={editRole} onChange={(e) => { setEditRole(e.target.value); setEditNotice('') }}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <button type="submit" className="primary-btn" disabled={editBusy}>{editBusy ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="secondary-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </form>
            ) : (
              <span>
                {u.name} — {u.role}{' '}
                <button className="secondary-btn" onClick={() => startEdit(u)}>Edit</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {editNotice && <p role="status">{editNotice}</p>}
      <h3>Add staff/user</h3>
      <form onSubmit={handleAdd} className="form">
        <label>
          Name
          <input value={name} onChange={(e) => { setName(e.target.value); setAddNotice('') }} placeholder="e.g. Ngozi Ade" />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => { setRole(e.target.value); setAddNotice('') }}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary-btn" disabled={addBusy}>{addBusy ? 'Adding…' : 'Add user'}</button>
        {addNotice && <p role="status">{addNotice}</p>}
      </form>
    </div>
  )
}

export default TeamSetup

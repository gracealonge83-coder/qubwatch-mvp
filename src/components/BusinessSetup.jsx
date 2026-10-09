import { useState } from 'react'

// Simple business setup form (PRD Section 12).
// Edits in-memory business only. No database.
function BusinessSetup({ business, onSave }) {
  const [form, setForm] = useState({ ...business })
  const [saved, setSaved] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await onSave(form)
    if (ok) setSaved(true)
  }

  return (
    <div className="card">
      <h2>Business Setup</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Business name
          <input name="name" value={form.name} onChange={handleChange} />
        </label>
        <label>
          Business type
          <input name="type" value={form.type} onChange={handleChange} />
        </label>
        <label>
          Location
          <input name="location" value={form.location} onChange={handleChange} />
        </label>
        <label>
          Owner
          <input name="owner" value={form.owner} onChange={handleChange} />
        </label>
        <label>
          Contact
          <input name="contact" value={form.contact} onChange={handleChange} />
        </label>
        <label>
          Operating hours
          <input name="hours" value={form.hours} onChange={handleChange} />
        </label>
        <button type="submit" className="primary-btn">Save business</button>
        {saved && <p role="status">Business saved successfully.</p>}
      </form>
    </div>
  )
}

export default BusinessSetup

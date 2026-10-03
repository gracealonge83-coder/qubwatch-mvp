// Dashboard with Stage 2 KPIs plus a Stage 3 attention card.
// Attention card lists rule-based alerts for review. No auto-decisions.
import { formatDateTime } from '../utils/formatDateTime.js'
import Icon from '../components/Icon.jsx'

function Dashboard({ business, user, users, products, transactions, alerts, openInvestigationCount, onNavigate, onReviewAlert }) {
  const today = formatDateTime(new Date())
  const productById = Object.fromEntries(products.map((p) => [p.id, p]))
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))

  const sales = transactions.filter((t) => t.type === 'sale')
  const refunds = transactions.filter((t) => t.type === 'refund')
  const discounts = transactions.filter((t) => t.type === 'discount')
  const salesTotal = sales.reduce((sum, t) => sum + t.amount, 0)
  const refundTotal = refunds.reduce((sum, t) => sum + t.amount, 0)
  const discountTotal = discounts.reduce((sum, t) => sum + t.amount, 0)
  const inventoryIssues = products.filter((p) => p.stock !== p.expectedStock).length

  const openAlerts = alerts.filter((a) => a.status === 'New' || a.status === 'Under Review')
  const recent = [...transactions].slice(-6).reverse()
  const hour = new Date().getHours()
  const daypart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const firstName = user.name.split(' ')[0]

  return (
    <div>
      <div className="dash-top">
        <div>
          <h1>Good {daypart}, {firstName}</h1>
          <div className="muted">{business.name} · {user.role} · Monitoring overview</div>
        </div>
        <div className="user-card">
          <div>{user.role}</div>
          <div><strong>{user.name}</strong></div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card kpi kpi-sales">
          <div className="kpi-heading"><span className="kpi-icon"><Icon name="sales" /></span><div className="metric-label">Sales</div></div>
          <div className="metric">₦{salesTotal.toLocaleString()}</div>
          <p className="muted">{sales.length} sales</p>
        </div>
        <div className="card kpi kpi-refunds">
          <div className="kpi-heading"><span className="kpi-icon"><Icon name="refund" /></span><div className="metric-label">Refunds</div></div>
          <div className="metric">₦{refundTotal.toLocaleString()}</div>
          <p className="muted">{refunds.length} refunds</p>
        </div>
        <div className="card kpi kpi-discounts">
          <div className="kpi-heading"><span className="kpi-icon"><Icon name="discount" /></span><div className="metric-label">Discounts</div></div>
          <div className="metric">₦{discountTotal.toLocaleString()}</div>
          <p className="muted">{discounts.length} discounted</p>
        </div>
        <div className="card kpi kpi-alerts">
          <div className="kpi-heading"><span className="kpi-icon"><Icon name="alertMetric" /></span><div className="metric-label">Open alerts</div></div>
          <div className="metric">{openAlerts.length}</div>
          <p className="muted">need review</p>
        </div>
      </div>

      <div className="grid" style={{ marginTop: '18px' }}>
        <div className="card">
          <div className="section-title">Business information</div>
          <p><strong>{business.name}</strong></p>
          <p>{business.type} — {business.location}</p>
          <p>Date: {today}</p>
          <p>User: {user.name}</p>
          <p>Role: {user.role}</p>
          <div className="form-row">
            <button className="secondary-btn" onClick={() => onNavigate('Products')}>View products</button>
            <button className="secondary-btn" onClick={() => onNavigate('Transactions')}>View transactions</button>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Needs attention</div>
          {openAlerts.length === 0 ? (
            <p className="muted">No alerts need review right now.</p>
          ) : (
            <div>
              {openAlerts.slice(0, 3).map((a) => (
                <div key={a.id} className="dash-alert">
                  <strong>{a.type}</strong>
                  <span className="muted">{a.message}</span>
                  <span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                  <span><button className="secondary-btn" onClick={() => onReviewAlert(a.id)}>Review</button></span>
                </div>
              ))}
            </div>
          )}
          <button className="secondary-btn" onClick={() => onNavigate('Alerts')}>Open alerts</button>
          <p className="muted">Open investigations: {openInvestigationCount}</p>
          <button className="secondary-btn" onClick={() => onNavigate('Investigations')}>Open investigations</button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: '18px' }}>
        <div className="card">
          <div className="section-title">Recent activity</div>
          {recent.length === 0 ? (
            <p className="muted">No recent activity yet.</p>
          ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Product</th><th>Type</th><th>Amount</th><th>User</th></tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDateTime(t.date)}</td>
                    <td>{productById[t.productId] ? productById[t.productId].name : t.productId}</td>
                    <td>{t.type}</td>
                    <td>₦{t.amount.toLocaleString()}</td>
                    <td>{userById[t.staffId] ? userById[t.staffId].name : t.staffId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Inventory</div>
          <p className="muted">{inventoryIssues} product(s) differ from expected stock.</p>
          <button className="secondary-btn" onClick={() => onNavigate('Products')}>View products</button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

import { useEffect, useState } from 'react'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Settings from './pages/Settings.jsx'
import Products from './pages/Products.jsx'
import Transactions from './pages/Transactions.jsx'
import Alerts from './pages/Alerts.jsx'
import Investigations from './pages/Investigations.jsx'
import AiAssistant from './pages/AiAssistant.jsx'
import Notifications from './pages/Notifications.jsx'
import { DEMO_THRESHOLDS } from '../shared/rules.js'
import { api } from './api/client.js'

// LOCAL DEMO ONLY: when the dev server is started with VITE_QUBWATCH_DEMO=1
// (local .env.local, never committed), the app may establish a demo session
// via POST /api/auth/demo instead of showing the Login page. Production
// builds omit the flag, so this is always false there.
const DEMO_AUTOLOGIN = import.meta.env.VITE_QUBWATCH_DEMO === '1'

// Stage 6 frontend API migration: the backend is the source of truth.
// Pages keep the same props and UI; only the data layer changed.
// No ML or autonomous decisions.
function App() {
  const [page, setPage] = useState(() => (
    new URLSearchParams(window.location.search).get('billing') === 'callback'
      ? 'Settings'
      : 'Dashboard'
  ))
  const [session, setSession] = useState({ status: 'loading', user: null })
  const [biz, setBiz] = useState(null)
  const [productList, setProductList] = useState([])
  const [txnList, setTxnList] = useState([])
  const [userList, setUserList] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selectedAlertId, setSelectedAlertId] = useState(null)
  const [investigations, setInvestigations] = useState([])
  const [selectedInvestigationId, setSelectedInvestigationId] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [ruleConfig, setRuleConfig] = useState({ ...DEMO_THRESHOLDS })
  const [aiContext, setAiContext] = useState({ type: 'overview', id: null })
  const [apiError, setApiError] = useState(null)
  const [newUserCredentials, setNewUserCredentials] = useState(null)
  const currentUser = session.user

  // Loads every slice from the API after login. Returns true on success.
  async function refreshAll() {
    const [bizRes, usersRes, productsRes, txnsRes, alertsRes, invRes, auditRes, rulesRes] = await Promise.all([
      api.get('/business'),
      api.get('/users'),
      api.get('/products'),
      api.get('/transactions'),
      api.get('/alerts'),
      api.get('/investigations'),
      api.get('/audit'),
      api.get('/rules'),
    ])
    // Audit read is restricted to Owner/Manager on the server; a 403 here must
    // not lock other roles out of the app. Default to an empty trail.
    const failed = [bizRes, usersRes, productsRes, txnsRes, alertsRes, invRes, rulesRes].find((r) => !r.ok)
    if (failed) {
      setApiError(failed.error)
      return false
    }
    setBiz(bizRes.data)
    setUserList(usersRes.data)
    setProductList(productsRes.data)
    setTxnList(txnsRes.data)
    setAlerts(alertsRes.data)
    setInvestigations(invRes.data)
    setAuditLog(auditRes.ok ? auditRes.data : [])
    setRuleConfig(rulesRes.data)
    setApiError(null)
    return true
  }

  function apiFailed(res) {
    if (res.status === 401) {
      setSession({ status: 'ready', user: null })
      setApiError('Your session has ended. Please log in again.')
    } else {
      setApiError(res.error)
    }
    return false
  }

  // Session bootstrap: restore the login on refresh, then load all data.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      let me = await api.get('/auth/me')
      if (!me.ok && DEMO_AUTOLOGIN) {
        const demo = await api.post('/auth/demo')
        if (demo.ok) me = await api.get('/auth/me')
      }
      if (cancelled) return
      if (!me.ok) {
        setSession({ status: 'ready', user: null })
        return
      }
      setSession({ status: 'ready', user: me.data.user })
      await refreshAll()
    }
    boot()
    return () => { cancelled = true }
  }, [])

  async function login(identifier, password) {
    setApiError(null)
    const res = await api.post('/auth/login', { identifier, password })
    if (!res.ok) return res.error
    setSession({ status: 'ready', user: res.data.user })
    const ok = await refreshAll()
    return ok ? null : 'Logged in, but data failed to load. Please try again.'
  }

  async function logout() {
    await api.post('/auth/logout')
    setSession({ status: 'ready', user: null })
    setBiz(null)
    setProductList([])
    setTxnList([])
    setUserList([])
    setAlerts([])
    setSelectedAlertId(null)
    setInvestigations([])
    setSelectedInvestigationId(null)
    setAuditLog([])
    setRuleConfig({ ...DEMO_THRESHOLDS })
    setApiError(null)
    setNewUserCredentials(null)
    setPage('Dashboard')
  }

  async function refreshAudit() {
    const res = await api.get('/audit')
    if (res.ok) setAuditLog(res.data)
  }

  async function refreshAlerts() {
    const res = await api.get('/alerts')
    if (res.ok) setAlerts(res.data)
  }

  function openAlert(id) {
    setSelectedAlertId(id)
    setPage('Alerts')
  }

  const canEditRules = !!currentUser && currentUser.role === 'Business Owner'

  async function saveBusiness(data) {
    const res = await api.patch('/business', data)
    if (!res.ok) return apiFailed(res)
    setBiz(res.data)
    return true
  }

  async function addUser(data) {
    const res = await api.post('/users', data)
    if (!res.ok) return apiFailed(res)
    setUserList((prev) => [...prev, res.data.user])
    setNewUserCredentials({ name: res.data.user.name, temporaryPassword: res.data.temporaryPassword })
    return true
  }

  async function updateUser(id, updates) {
    const res = await api.patch(`/users/${id}`, updates)
    if (!res.ok) return apiFailed(res)
    setUserList((prev) => prev.map((u) => (u.id === id ? res.data : u)))
    return true
  }

  async function addProduct(data) {
    const res = await api.post('/products', data)
    if (!res.ok) return apiFailed(res)
    setProductList((prev) => [...prev, res.data])
    return true
  }

  async function updateProduct(id, updates) {
    const res = await api.patch(`/products/${id}`, updates)
    if (!res.ok) return apiFailed(res)
    setProductList((prev) => prev.map((p) => (p.id === id ? res.data : p)))
    return true
  }

  async function addTransaction(data) {
    const res = await api.post('/transactions', data)
    if (!res.ok) return apiFailed(res)
    setTxnList((prev) => [...prev, res.data])
    await refreshAlerts()
    return true
  }

  async function updateRuleConfig(config) {
    const res = await api.put('/rules', config)
    if (!res.ok) return apiFailed(res)
    setRuleConfig(res.data)
    await refreshAlerts()
    return true
  }

  async function restoreDefaultRules() {
    const res = await api.put('/rules', { ...DEMO_THRESHOLDS })
    if (!res.ok) return apiFailed(res)
    setRuleConfig(res.data)
    await refreshAlerts()
    return true
  }

  async function updateAlertStatus(id, status) {
    const res = await api.patch(`/alerts/${id}/status`, { status })
    if (!res.ok) return apiFailed(res)
    setAlerts((prev) => prev.map((a) => (a.id === id ? res.data : a)))
    return true
  }

  async function startInvestigation(alertId) {
    const existing = investigations.find((i) => i.alertId === alertId && i.status !== 'Closed')
    if (existing) {
      setSelectedInvestigationId(existing.id)
      setPage('Investigations')
      return true
    }
    const res = await api.post('/investigations', { alertId })
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => [...prev, res.data])
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'Investigating' } : a)))
    await refreshAudit()
    setSelectedInvestigationId(res.data.id)
    setPage('Investigations')
    return true
  }

  function openInvestigation(id) {
    setSelectedInvestigationId(id)
    setPage('Investigations')
  }

  function askAiAboutAlert(id) {
    setAiContext({ type: 'alert', id })
    setPage('AI Assistant')
  }

  function askAiAboutInvestigation(id) {
    setAiContext({ type: 'investigation', id })
    setPage('AI Assistant')
  }

  async function addNote(invId, content) {
    const res = await api.post(`/investigations/${invId}/notes`, { content })
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.map((inv) => (inv.id === invId
      ? { ...inv, notes: [...inv.notes, res.data], status: inv.status === 'Open' ? 'Under Investigation' : inv.status }
      : inv)))
    await refreshAudit()
    return true
  }

  async function assignInvestigator(invId, userId) {
    const res = await api.patch(`/investigations/${invId}`, { investigatorId: userId })
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.map((inv) => (inv.id === invId ? res.data : inv)))
    return true
  }

  async function recordFinding(invId, finding, findingOther) {
    const res = await api.post(`/investigations/${invId}/finding`, { finding, findingOther })
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.map((inv) => (inv.id === invId ? res.data : inv)))
    await refreshAudit()
    return true
  }

  async function resolveInvestigation(invId, resolutionNotes) {
    const res = await api.post(`/investigations/${invId}/resolve`, { resolutionNotes })
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.map((i) => (i.id === invId ? res.data : i)))
    setAlerts((prev) => prev.map((a) => (a.id === res.data.alertId ? { ...a, status: 'Resolved' } : a)))
    await refreshAudit()
    return true
  }

  async function closeInvestigation(invId) {
    const res = await api.post(`/investigations/${invId}/close`)
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.map((i) => (i.id === invId ? res.data : i)))
    await refreshAudit()
    return true
  }

  const openInvestigationCount = investigations.filter(
    (i) => i.status === 'Open' || i.status === 'Under Investigation',
  ).length

  // Restricted page requests resolve before rendering so protected content
  // is never shown, even when a page is requested programmatically.
  const isStaff = currentUser?.role === 'Staff User'
  const STAFF_PAGES = ['Dashboard', 'Products', 'Transactions']
  const effectivePage = page === 'Business Setup'
    ? (currentUser?.role === 'Business Owner' ? 'Settings' : 'Dashboard')
    : isStaff && !STAFF_PAGES.includes(page) ? 'Dashboard' : page

  let content = null
  if (effectivePage === 'Dashboard') {
    content = (
      <Dashboard
        business={biz}
        user={currentUser}
        users={userList}
        products={productList}
        transactions={txnList}
        alerts={alerts}
        openInvestigationCount={openInvestigationCount}
        onNavigate={setPage}
        onReviewAlert={openAlert}
      />
    )
  } else if (effectivePage === 'Settings') {
    content = (
      <Settings
        business={biz}
        onSaveBusiness={saveBusiness}
        users={userList}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        ruleConfig={ruleConfig}
        canEditRules={canEditRules}
        onSaveRules={updateRuleConfig}
        onRestoreRules={restoreDefaultRules}
        newCredentials={newUserCredentials}
        onClearCredentials={() => setNewUserCredentials(null)}
        currentUser={currentUser}
      />
    )
  } else if (effectivePage === 'Products') {
    content = <Products products={productList} onAdd={addProduct} onUpdate={updateProduct} />
  } else if (effectivePage === 'Transactions') {
    content = (
      <Transactions
        transactions={txnList}
        products={productList}
        users={userList}
        currentUser={currentUser}
        onAdd={addTransaction}
      />
    )
  } else if (effectivePage === 'Alerts') {
    content = (
      <Alerts
        alerts={alerts}
        products={productList}
        transactions={txnList}
        users={userList}
        selectedId={selectedAlertId}
        onSelect={setSelectedAlertId}
        onStatusChange={updateAlertStatus}
        investigations={investigations}
        onStartInvestigation={startInvestigation}
        onOpenInvestigation={openInvestigation}
        onAskAiAboutAlert={askAiAboutAlert}
      />
    )
  } else if (effectivePage === 'Investigations') {
    content = (
      <Investigations
        investigations={investigations}
        alerts={alerts}
        products={productList}
        transactions={txnList}
        users={userList}
        currentUser={currentUser}
        selectedId={selectedInvestigationId}
        onSelect={setSelectedInvestigationId}
        onAddNote={addNote}
        onAssignInvestigator={assignInvestigator}
        onRecordFinding={recordFinding}
        onResolve={resolveInvestigation}
        onClose={closeInvestigation}
        onOpenAlert={openAlert}
        onAskAiAboutInvestigation={askAiAboutInvestigation}
        auditLog={auditLog}
      />
    )
  } else if (effectivePage === 'AI Assistant') {
    content = (
      <AiAssistant
        key={`${aiContext.type}-${aiContext.id || 'none'}`}
        business={biz}
        alerts={alerts}
        investigations={investigations}
        products={productList}
        transactions={txnList}
        users={userList}
        initialContext={aiContext}
        thresholds={ruleConfig}
        onOpenAlert={openAlert}
        onOpenInvestigation={openInvestigation}
      />
    )
  } else if (effectivePage === 'Notifications') {
    content = (
      <Notifications
        alerts={alerts}
        investigations={investigations}
        onOpenAlert={openAlert}
        onOpenInvestigation={openInvestigation}
      />
    )
  }

  if (session.status === 'loading') {
    return (
      <div className="app">
        <main className="main">
          <div className="card"><p>Loading QubWatch…</p></div>
        </main>
      </div>
    )
  }

  if (!session.user) {
    return <Login onLogin={login} />
  }

  // Data must be present before any page renders: pages read business.name
  // and other records unconditionally. This covers both the post-login
  // window and refresh-with-session while data is still loading.
  async function retryLoad() {
    setApiError(null)
    await refreshAll()
  }

  if (!biz) {
    return (
      <div className="app">
        <main className="main">
          <div className="card">
            <p>{apiError || 'Loading QubWatch…'}</p>
            <div className="form-row">
              <button type="button" className="secondary-btn" onClick={retryLoad}>Retry</button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <Layout
      currentPage={effectivePage}
      onNavigate={setPage}
      businessName={biz.name}
      notificationCount={alerts.filter((a) => a.status === 'New' || a.status === 'Under Review').length}
      onOpenNotifications={() => setPage('Notifications')}
      user={currentUser}
      onLogout={logout}
    >
      {apiError && (
        <div className="card">
          <p>{apiError}</p>
          <div className="form-row">
            <button type="button" className="secondary-btn" onClick={() => setApiError(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {content}
    </Layout>
  )
}

export default App

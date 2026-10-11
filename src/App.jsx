import { useEffect, useState } from 'react'
import Layout from './components/Layout.jsx'
import SubscriptionModal from './components/SubscriptionModal.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Settings from './pages/Settings.jsx'
import Products from './pages/Products.jsx'
import Transactions from './pages/Transactions.jsx'
import Alerts from './pages/Alerts.jsx'
import Archived from './pages/Archived.jsx'
import Investigations from './pages/Investigations.jsx'
import AiAssistant from './pages/AiAssistant.jsx'
import Notifications from './pages/Notifications.jsx'
import { DEMO_THRESHOLDS } from '../shared/rules.js'
import { api } from './api/client.js'
import {
  clearPendingSubscriptionAction,
  readPendingSubscriptionAction,
} from './subscription/pendingAction.js'

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
  const [archivedAlerts, setArchivedAlerts] = useState([])
  const [archivedInvestigations, setArchivedInvestigations] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [ruleConfig, setRuleConfig] = useState({ ...DEMO_THRESHOLDS })
  const [aiContext, setAiContext] = useState({ type: 'overview', id: null })
  const [apiError, setApiError] = useState(null)
  const [newUserCredentials, setNewUserCredentials] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [subscriptionActive, setSubscriptionActive] = useState(false)
  const [subscriptionModal, setSubscriptionModal] = useState({ open: false, pendingAction: null, message: '' })
  const [pendingAiAsk, setPendingAiAsk] = useState(null)
  const currentUser = session.user

  async function refreshSubscription() {
    const result = await api.get('/billing/status')
    if (!result.ok) {
      setSubscriptionActive(false)
      return false
    }
    setSubscriptionActive(!!result.data.active)
    return !!result.data.active
  }

  function requireSubscription(pendingAction, message = '') {
    setSubscriptionModal({ open: true, pendingAction: pendingAction || null, message })
  }

  function closeSubscriptionModal() {
    setSubscriptionModal({ open: false, pendingAction: null, message: '' })
  }

  async function resumePendingAction(action) {
    if (!action || typeof action !== 'object') return
    if (action.type === 'startInvestigation' && action.alertId) {
      setSelectedAlertId(action.alertId)
      setPage('Alerts')
      await startInvestigation(action.alertId, { skipGate: true })
      return
    }
    if (action.type === 'askAiAboutAlert' && action.alertId) {
      setAiContext({ type: 'alert', id: action.alertId })
      setPage('AI Assistant')
      return
    }
    if (action.type === 'openAiAssistant') {
      if (action.contextType) {
        setAiContext({ type: action.contextType, id: action.contextId || null })
      }
      setPage('AI Assistant')
      if (action.question) {
        setPendingAiAsk({
          contextType: action.contextType || 'overview',
          contextId: action.contextId || null,
          question: action.question,
        })
      }
      return
    }
    if (action.type === 'aiAsk') {
      setAiContext({
        type: action.contextType || 'overview',
        id: action.contextId || null,
      })
      setPage('AI Assistant')
      setPendingAiAsk({
        contextType: action.contextType || 'overview',
        contextId: action.contextId || null,
        question: action.question || 'summarize',
      })
    }
  }

  async function handleBillingCallback() {
    const url = new URL(window.location.href)
    const params = url.searchParams
    const callback = params.get('billing') === 'callback'
    const reference = params.get('reference') || params.get('trxref')
    if (!callback && !reference) return

    for (const name of ['billing', 'reference', 'trxref', 'status']) params.delete(name)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)

    const pending = readPendingSubscriptionAction()
    clearPendingSubscriptionAction()
    if (reference) {
      const result = await api.get(`/billing/verify?reference=${encodeURIComponent(reference)}`)
      if (result.ok && result.data.status === 'verified') {
        setSubscriptionActive(true)
        closeSubscriptionModal()
        await resumePendingAction(pending)
        return
      }
      requireSubscription(pending, result.error || 'Payment was not successful. Investigations and AI Assistant remain locked.')
      return
    }
    requireSubscription(pending, 'Payment was cancelled or not completed. No successful payment was recorded.')
  }

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
    await refreshArchived()
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
      if (cancelled) return
      await refreshSubscription()
      if (cancelled) return
      await handleBillingCallback()
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
    if (ok) await refreshSubscription()
    return ok ? null : 'Logged in, but data failed to load. Please try again.'
  }

  // Customer sign-up: creates the business and owner, then signs in and
  // loads the fresh workspace. Returns null on success, else { message, fields }.
  async function register(data) {
    setApiError(null)
    const res = await api.post('/auth/register', data)
    if (!res.ok) return { message: res.error, fields: res.fields }
    setSession({ status: 'ready', user: res.data.user })
    const ok = await refreshAll()
    if (ok) await refreshSubscription()
    return ok ? null : { message: 'Account created, but data failed to load. Please log in.', fields: null }
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
    setArchivedAlerts([])
    setArchivedInvestigations([])
    setAuditLog([])
    setRuleConfig({ ...DEMO_THRESHOLDS })
    setApiError(null)
    setNewUserCredentials(null)
    setSubscriptionActive(false)
    setSubscriptionModal({ open: false, pendingAction: null, message: '' })
    setPendingAiAsk(null)
    clearPendingSubscriptionAction()
    setPage('Dashboard')
    setAuthMode('login')
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

  async function startInvestigation(alertId, { skipGate = false } = {}) {
    const existing = investigations.find((i) => i.alertId === alertId && i.status !== 'Closed')
    if (existing) {
      setSelectedInvestigationId(existing.id)
      setPage('Investigations')
      return true
    }
    if (!skipGate && !subscriptionActive) {
      requireSubscription({ type: 'startInvestigation', alertId })
      return null
    }
    const res = await api.post('/investigations', { alertId })
    if (!res.ok) {
      if (res.code === 'SUBSCRIPTION_REQUIRED' || res.status === 402) {
        requireSubscription({ type: 'startInvestigation', alertId }, res.error)
        return null
      }
      return apiFailed(res)
    }
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
    if (!subscriptionActive) {
      requireSubscription({ type: 'askAiAboutAlert', alertId: id })
      return
    }
    setAiContext({ type: 'alert', id })
    setPage('AI Assistant')
  }

  function askAiAboutInvestigation(id) {
    if (!subscriptionActive) {
      requireSubscription({ type: 'openAiAssistant', contextType: 'investigation', contextId: id })
      return
    }
    setAiContext({ type: 'investigation', id })
    setPage('AI Assistant')
  }

  function navigateWithSubscriptionGate(nextPage) {
    if (nextPage === 'AI Assistant' && !subscriptionActive) {
      requireSubscription({ type: 'openAiAssistant', contextType: 'overview', contextId: null })
      return
    }
    setPage(nextPage)
  }

  function handleSubscriptionRequired(pendingAction, message = '') {
    requireSubscription(pendingAction, message)
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

  async function archiveAlert(id) {
    const res = await api.post(`/alerts/${id}/archive`)
    if (!res.ok) return apiFailed(res)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    setArchivedAlerts((prev) => [res.data, ...prev.filter((a) => a.id !== id)])
    if (selectedAlertId === id) setSelectedAlertId(null)
    await refreshAudit()
    return true
  }

  async function restoreAlert(id) {
    const res = await api.post(`/alerts/${id}/restore`)
    if (!res.ok) return apiFailed(res)
    setArchivedAlerts((prev) => prev.filter((a) => a.id !== id))
    setAlerts((prev) => [...prev, res.data])
    await refreshAudit()
    return true
  }

  async function archiveInvestigation(invId) {
    const res = await api.post(`/investigations/${invId}/archive`)
    if (!res.ok) return apiFailed(res)
    setInvestigations((prev) => prev.filter((i) => i.id !== invId))
    setArchivedInvestigations((prev) => [res.data, ...prev.filter((i) => i.id !== invId)])
    if (selectedInvestigationId === invId) setSelectedInvestigationId(null)
    await refreshAudit()
    return true
  }

  async function restoreInvestigation(invId) {
    const res = await api.post(`/investigations/${invId}/restore`)
    if (!res.ok) return apiFailed(res)
    setArchivedInvestigations((prev) => prev.filter((i) => i.id !== invId))
    setInvestigations((prev) => [...prev, res.data])
    await refreshAudit()
    return true
  }

  async function refreshArchived() {
    const [archivedAlertsRes, archivedInvestigationsRes] = await Promise.all([
      api.get('/alerts?archived=true'),
      api.get('/investigations?archived=true'),
    ])
    if (archivedAlertsRes.ok) setArchivedAlerts(archivedAlertsRes.data)
    if (archivedInvestigationsRes.ok) setArchivedInvestigations(archivedInvestigationsRes.data)
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
        subscriptionActive={subscriptionActive}
        onSubscriptionChange={setSubscriptionActive}
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
        onArchiveAlert={archiveAlert}
      />
    )
  } else if (effectivePage === 'Archived') {
    content = (
      <Archived
        alerts={archivedAlerts}
        investigations={archivedInvestigations}
        users={userList}
        onRestoreAlert={restoreAlert}
        onRestoreInvestigation={restoreInvestigation}
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
        onArchive={archiveInvestigation}
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
        subscriptionActive={subscriptionActive}
        onSubscriptionRequired={handleSubscriptionRequired}
        pendingAsk={pendingAiAsk}
        onPendingAskHandled={() => setPendingAiAsk(null)}
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
    return authMode === 'register'
      ? <Register onRegister={register} onShowLogin={() => setAuthMode('login')} />
      : <Login onLogin={login} onShowRegister={() => setAuthMode('register')} />
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
      onNavigate={navigateWithSubscriptionGate}
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
      <SubscriptionModal
        open={subscriptionModal.open}
        currentUser={currentUser}
        pendingAction={subscriptionModal.pendingAction}
        paymentMessage={subscriptionModal.message}
        onClose={closeSubscriptionModal}
      />
    </Layout>
  )
}

export default App

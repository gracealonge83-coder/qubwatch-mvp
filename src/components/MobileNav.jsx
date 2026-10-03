// Stage 6 mobile bottom navigation. Shown only on small screens (see CSS).
// Desktop keeps the existing top nav. No behavior change, navigation only.
import Icon from './Icon.jsx'

const TABS = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Alerts', icon: 'alerts' },
  { label: 'Transactions', icon: 'transactions' },
  { label: 'Investigations', icon: 'investigations' },
  { label: 'AI Assistant', icon: 'ai' },
]

function MobileNav({ currentPage, onNavigate, openAlertCount }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {TABS.map((item) => (
        <button
          key={item.label}
          className={item.label === currentPage ? 'tab-btn active' : 'tab-btn'}
          onClick={() => onNavigate(item.label)}
        >
          <Icon name={item.icon} size={19} />
          <span>{item.label === 'Alerts' && openAlertCount > 0 ? `Alerts (${openAlertCount})` : item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default MobileNav

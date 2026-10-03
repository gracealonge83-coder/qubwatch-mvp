const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.3 7.6 7.7 4.5 7.7-4.5M12 12v9" /></>,
  transactions: <><path d="M7 3h10l3 3v15H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M17 3v4h4M8 12h8M8 16h8" /></>,
  alerts: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  investigations: <><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /><circle cx="15" cy="9" r="5" /><path d="m18.5 12.5 3 3M7 8h3M7 12h2M7 16h4" /></>,
  ai: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16ZM5 2l.7 1.3L7 4l-1.3.7L5 6l-.7-1.3L3 4l1.3-.7L5 2Z" /></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.6.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.6-.6 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.8Z" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  sales: <><path d="M4 18V6M4 18h17" /><path d="m7 14 4-4 3 2 6-7" /></>,
  refund: <><path d="M4 7v5h5M5 12a8 8 0 1 0 2-5.3L4 9" /><path d="M12 8v4l3 2" /></>,
  discount: <><path d="M20 13 13 20 3 10V4h6l11 9Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  alertMetric: <><path d="m12 3 9 17H3l9-17Z" /><path d="M12 9v4M12 17h.01" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
}

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name] || ICON_PATHS.dashboard}
    </svg>
  )
}

export default Icon

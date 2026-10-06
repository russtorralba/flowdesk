const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-3.2 2.5-5 5.5-5s5 1.8 5.5 5" /><path d="M16 5.5a3 3 0 0 1 0 5" /><path d="M17 15.5c2.1.4 3.2 1.8 3.5 4" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  receipt: <><path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  team: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M2.5 20c.6-3.4 2.5-5.3 5.5-5.3s4.9 1.9 5.5 5.3M15 15.2c2.7.2 4.3 1.8 4.7 4.8" /></>,
  chart: <><path d="M4 20V4M4 20h17" /><path d="m7 16 4-4 3 2 5-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.1 2.1-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2h-3v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.1-2.1.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H5.5v-3h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1L8.9 6l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5v-.2h3v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.1 2.1-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2v3h-.2a1.6 1.6 0 0 0-1.5 1Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></>,
  bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  arrow: <path d="M5 12h13M14 7l5 5-5 5" />,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  spark: <path d="m12 3 1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8L12 3Z" />,
}

export function Icon({ name, size = 20 }) {
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

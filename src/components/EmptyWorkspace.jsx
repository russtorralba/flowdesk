import { Icon } from './Icon.jsx'

const emptyMessages = {
  dashboard: { eyebrow: 'Start here', title: 'Your workspace is ready for its first job.', body: 'Business activity will appear here once your workspace is connected and you start creating jobs.', actions: ['Create first job', 'Add customer'] },
  customers: { eyebrow: 'Customers', title: 'Build your customer directory.', body: 'Customer records will live here once you connect your workspace and add your first contact.' },
  jobs: { eyebrow: 'Jobs', title: 'Turn requests into organized work.', body: 'Create your first job to begin tracking work, owners, and progress in one place.' },
  schedule: { eyebrow: 'Schedule', title: 'Your schedule will take shape here.', body: 'Jobs and team availability will appear in this shared calendar once your workspace is connected.' },
  invoices: { eyebrow: 'Invoices', title: 'Keep billing organized.', body: 'Invoice drafting and tracking will be available here when billing is connected.' },
  team: { eyebrow: 'Team', title: 'Invite your team when you are ready.', body: 'Your people, roles, and availability will be managed here.' },
  analytics: { eyebrow: 'Analytics', title: 'Useful signals, not noise.', body: 'Business trends will appear once FlowDesk has real workspace activity to learn from.' },
  settings: { eyebrow: 'Settings', title: 'Make FlowDesk yours.', body: 'Workspace preferences and operational settings will appear here as the foundation grows.' },
}

export function EmptyWorkspace({ section }) {
  const message = emptyMessages[section.id] ?? emptyMessages.dashboard
  const isDashboard = section.id === 'dashboard'

  return <section className="workspace-content"><div className="welcome-panel"><div className="welcome-copy"><span className="welcome-icon"><Icon name={isDashboard ? 'spark' : section.icon} size={26} /></span><p className="eyebrow">{message.eyebrow}</p><h2>{message.title}</h2><p className="welcome-description">{message.body}</p>{isDashboard && <div className="empty-actions"><button className="primary-action" type="button"><Icon name="plus" size={17} />Create first job</button><button className="secondary-action" type="button"><Icon name="plus" size={17} />Add customer</button></div>}</div><div className="welcome-illustration" aria-hidden="true"><div className="illustration-window"><span /><span /><span /><i /><b /></div><div className="illustration-note"><i /><i /><i /></div></div></div><div className="foundation-note"><span><Icon name="spark" size={16} /></span><p><strong>Built for the next step.</strong> This foundation is ready to connect customers, jobs, schedules, and more as FlowDesk grows.</p></div></section>
}

import { Brand } from './Brand.jsx'
import { Icon } from './Icon.jsx'
import { navigationItems } from '../data/navigation.js'

export function AppSidebar({ activeSection, onSelectSection, workspaceProfile, workspaceStatus }) {
  const workspaceName = workspaceProfile?.name || 'Workspace'
  const workspaceLabel = workspaceStatus === 'loading' ? 'Loading profile' : 'Workspace'

  return <aside className="desktop-sidebar">
    <Brand />
    <nav className="sidebar-navigation" aria-label="Workspace navigation">
      <p className="navigation-label">Workspace</p>
      {navigationItems.slice(0, 6).map((item) => <button className={item.id === activeSection ? 'nav-item active' : 'nav-item'} type="button" key={item.id} onClick={() => onSelectSection(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}
      <p className="navigation-label navigation-label-secondary">Manage</p>
      {navigationItems.slice(6).map((item) => <button className={item.id === activeSection ? 'nav-item active' : 'nav-item'} type="button" key={item.id} onClick={() => onSelectSection(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}
    </nav>
    <div className="sidebar-footer"><span className="workspace-dot" /><div><strong>{workspaceName}</strong><small>{workspaceLabel}</small></div></div>
  </aside>
}

import { useEffect } from 'react'
import { Brand } from './Brand.jsx'
import { Icon } from './Icon.jsx'
import { navigationItems } from '../data/navigation.js'

export function MobileNavigation({ activeSection, isOpen, onClose, onSelectSection, workspaceProfile, workspaceStatus }) {
  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const workspaceName = workspaceProfile?.name || 'Workspace'
  const workspaceLabel = workspaceStatus === 'loading' ? 'Loading profile' : 'Workspace'

  return <div className="mobile-navigation-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="mobile-navigation" aria-label="Workspace navigation"><div className="mobile-navigation-top"><Brand /><button className="menu-button" type="button" aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button></div><nav>{navigationItems.map((item) => <button className={item.id === activeSection ? 'nav-item active' : 'nav-item'} type="button" key={item.id} onClick={() => onSelectSection(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}</nav><div className="sidebar-footer"><span className="workspace-dot" /><div><strong>{workspaceName}</strong><small>{workspaceLabel}</small></div></div></aside></div>
}

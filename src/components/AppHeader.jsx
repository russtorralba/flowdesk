import { useState } from 'react'
import { Brand } from './Brand.jsx'
import { Icon } from './Icon.jsx'

const formatRole = (role) => role ? role.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null

export function AppHeader({ title, user, workspaceRole, onOpenNavigation, onSignOut, isSigningOut, signOutError }) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const displayName = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Account'
  const roleLabel = formatRole(workspaceRole)

  return <header className="app-header">
    <div className="mobile-brand"><button className="menu-button" type="button" aria-label="Open navigation" onClick={onOpenNavigation}><Icon name="menu" /></button><Brand compact /></div>
    <div className="header-title"><p>Workspace</p><h1>{title}</h1></div>
    <div className="header-tools">
      <div className="account-menu"><button className="account-button" type="button" aria-label="Account menu" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}><b>{displayName.slice(0, 1).toUpperCase()}</b><span><strong>{displayName}</strong>{roleLabel && <small>{roleLabel}</small>}</span></button>{isAccountMenuOpen && <div className="account-menu-panel" role="menu"><p className="account-menu-error" role="alert">{signOutError}</p><button type="button" role="menuitem" onClick={onSignOut} disabled={isSigningOut}>{isSigningOut ? 'Signing out…' : 'Sign out'}</button></div>}</div>
    </div>
  </header>
}

import { lazy, Suspense, useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader.jsx'
import { AppSidebar } from './components/AppSidebar.jsx'
import { EmptyWorkspace } from './components/EmptyWorkspace.jsx'
import { MobileNavigation } from './components/MobileNavigation.jsx'
import { AuthLoadingScreen, SignInScreen } from './components/SignInScreen.jsx'
import { navigationItems } from './data/navigation.js'
import { neon } from './lib/neon.js'
import './styles/app-shell.css'
import './styles/dashboard.css'
import './styles/auth.css'

const workspaceProfileFields = 'id, name, business_email, business_phone, address_line1, address_line2, city, state_region, postal_code, country'
const DashboardPage = lazy(() => import('./components/DashboardPage.jsx').then(({ DashboardPage: Page }) => ({ default: Page })))
const CustomersPage = lazy(() => import('./components/CustomersPage.jsx').then(({ CustomersPage: Page }) => ({ default: Page })))
const JobsPage = lazy(() => import('./components/JobsPage.jsx').then(({ JobsPage: Page }) => ({ default: Page })))
const SchedulePage = lazy(() => import('./components/SchedulePage.jsx').then(({ SchedulePage: Page }) => ({ default: Page })))
const InvoicesPage = lazy(() => import('./components/InvoicesPage.jsx').then(({ InvoicesPage: Page }) => ({ default: Page })))
const TeamPage = lazy(() => import('./components/TeamPage.jsx').then(({ TeamPage: Page }) => ({ default: Page })))
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage.jsx').then(({ AnalyticsPage: Page }) => ({ default: Page })))
const SettingsPage = lazy(() => import('./components/SettingsPage.jsx').then(({ SettingsPage: Page }) => ({ default: Page })))

function SectionLoading() {
  return <section className="workspace-content section-loading-state" aria-busy="true" aria-live="polite"><span className="section-loading-indicator" aria-hidden="true" /><p>Loading workspace</p></section>
}

function App() {
  const session = neon.auth.useSession()
  const user = session.data?.user ?? null
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [requestedJobId, setRequestedJobId] = useState(null)
  const [workspaceProfile, setWorkspaceProfile] = useState(null)
  const [workspaceRole, setWorkspaceRole] = useState(null)
  const [workspaceStatus, setWorkspaceStatus] = useState('loading')
  const activeItem = navigationItems.find((item) => item.id === activeSection) ?? navigationItems[0]

  useEffect(() => {
    let isCurrent = true

    const loadWorkspaceProfile = async () => {
      if (!user?.id) {
        if (isCurrent) {
          setWorkspaceProfile(null)
          setWorkspaceRole(null)
          setWorkspaceStatus('loading')
        }
        return
      }

      setWorkspaceProfile(null)
      setWorkspaceRole(null)
      setWorkspaceStatus('loading')
      try {
        const { data: membership, error: membershipError } = await neon
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (membershipError || !membership?.workspace_id) {
          if (isCurrent) setWorkspaceStatus('error')
          return
        }

        const { data: workspace, error: workspaceError } = await neon
          .from('workspaces')
          .select(workspaceProfileFields)
          .eq('id', membership.workspace_id)
          .maybeSingle()

        if (workspaceError || !workspace) {
          if (isCurrent) setWorkspaceStatus('error')
          return
        }

        if (!isCurrent) return
        setWorkspaceProfile(workspace)
        setWorkspaceRole(membership.role || 'staff')
        setWorkspaceStatus('ready')
      } catch {
        if (isCurrent) setWorkspaceStatus('error')
      }
    }

    loadWorkspaceProfile()
    return () => { isCurrent = false }
  }, [user?.id])

  const selectSection = (sectionId) => {
    setActiveSection(sectionId)
    setIsMobileNavigationOpen(false)
    if (sectionId !== 'jobs') setRequestedJobId(null)
  }

  const openJobFromSchedule = (jobId) => {
    setRequestedJobId(jobId)
    setActiveSection('jobs')
    setIsMobileNavigationOpen(false)
  }

  const handleSignOut = async () => {
    setSignOutError('')
    setIsSigningOut(true)

    try {
      const result = await neon.auth.signOut()
      if (result?.error) setSignOutError('Unable to sign out. Please try again.')
    } catch {
      setSignOutError('Unable to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  if (session.isPending) return <AuthLoadingScreen />
  if (!user) return <SignInScreen />

  return (
    <div className="flowdesk-shell">
      <AppSidebar activeSection={activeSection} onSelectSection={selectSection} workspaceProfile={workspaceProfile} workspaceStatus={workspaceStatus} />
      <MobileNavigation activeSection={activeSection} isOpen={isMobileNavigationOpen} onClose={() => setIsMobileNavigationOpen(false)} onSelectSection={selectSection} workspaceProfile={workspaceProfile} workspaceStatus={workspaceStatus} />
      <main className="main-workspace">
        <AppHeader title={activeItem.label} user={user} workspaceRole={workspaceRole} onOpenNavigation={() => setIsMobileNavigationOpen(true)} onSignOut={handleSignOut} isSigningOut={isSigningOut} signOutError={signOutError} />
        <Suspense fallback={<SectionLoading />}>
          {activeSection === 'dashboard' ? <DashboardPage user={user} onNavigate={selectSection} /> : activeSection === 'customers' ? <CustomersPage user={user} /> : activeSection === 'jobs' ? <JobsPage user={user} requestedJobId={requestedJobId} onRequestedJobHandled={() => setRequestedJobId(null)} /> : activeSection === 'schedule' ? <SchedulePage user={user} onNavigate={selectSection} onOpenJob={openJobFromSchedule} /> : activeSection === 'invoices' ? <InvoicesPage user={user} /> : activeSection === 'team' ? <TeamPage user={user} /> : activeSection === 'analytics' ? <AnalyticsPage user={user} /> : activeSection === 'settings' ? <SettingsPage key={workspaceProfile?.id || 'workspace-loading'} workspaceProfile={workspaceProfile} workspaceRole={workspaceRole} workspaceStatus={workspaceStatus} onWorkspaceProfileUpdated={setWorkspaceProfile} /> : <EmptyWorkspace section={activeItem} />}
        </Suspense>
      </main>
    </div>
  )
}

export default App

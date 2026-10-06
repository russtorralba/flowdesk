import { useState } from 'react'
import { neon } from '../lib/neon.js'
import { Brand } from './Brand.jsx'

function AuthBrandPanel() {
  return <aside className="auth-brand-panel">
    <Brand />
    <div className="auth-brand-copy"><p className="eyebrow">FlowDesk</p><h1>Run your service business from one place.</h1><p>Customers, jobs, schedules, and your team — organized in one connected workspace.</p></div>
    <div className="auth-brand-visual" aria-hidden="true"><span /><span /><span /><i /><b /></div>
  </aside>
}

export function AuthLoadingScreen() {
  return <main className="auth-screen" aria-busy="true" aria-live="polite">
    <AuthBrandPanel />
    <section className="auth-content-panel"><div className="auth-loading-card"><div className="auth-mobile-brand"><Brand /></div><span className="auth-loading-indicator" aria-hidden="true" /><p>Loading your workspace</p></div></section>
  </main>
}

export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await neon.auth.signIn.email({
        email,
        password
      })

      if (result?.error) setError('We couldn’t sign you in. Check your email and password and try again.')
    } catch {
      setError('We couldn’t sign you in. Check your email and password and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="auth-screen">
    <AuthBrandPanel />
    <section className="auth-content-panel"><section className="sign-in-card" aria-labelledby="sign-in-title"><div className="auth-mobile-brand"><Brand /></div><div className="sign-in-heading"><p className="eyebrow">FlowDesk workspace</p><h1 id="sign-in-title">Welcome back</h1><p>Sign in to continue to your workspace.</p></div><form className="sign-in-form" onSubmit={handleSubmit}><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} /><p className="sign-in-error" role="alert" aria-live="assertive">{error}</p><button className="sign-in-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button></form></section></section>
  </main>
}

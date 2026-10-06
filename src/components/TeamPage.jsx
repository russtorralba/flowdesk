import { useEffect, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import '../styles/team.css'

const formatRole = (role) => (role || 'staff').replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatJoinedDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function TeamPage({ user }) {
  const [members, setMembers] = useState([])
  const [status, setStatus] = useState('loading')
  const userId = user?.id

  useEffect(() => {
    let isCurrent = true

    const loadMembers = async () => {
      if (!userId) return

      setStatus('loading')
      try {
        const { data: membership, error: membershipError } = await neon
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (membershipError || !membership?.workspace_id) {
          if (isCurrent) setStatus('error')
          return
        }

        const { data, error } = await neon
          .from('workspace_members')
          .select('id, workspace_id, user_id, role, created_at')
          .eq('workspace_id', membership.workspace_id)
          .order('created_at', { ascending: true })

        if (!isCurrent) return
        if (error) {
          setStatus('error')
          return
        }

        setMembers(data ?? [])
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadMembers()
    return () => { isCurrent = false }
  }, [userId])

  const isEmpty = status === 'ready' && members.length === 0

  return <section className="workspace-content team-page">
    <div className="team-page-header">
      <div><p className="eyebrow">Team</p><h2>Team</h2><p>See the people who help keep your work moving. Team management is read-only in this version.</p></div>
    </div>

    {status === 'loading' && <div className="team-state" aria-busy="true" aria-live="polite"><span className="team-loading-indicator" aria-hidden="true" /><p>Loading team</p></div>}
    {status === 'error' && <div className="team-state team-error" role="alert"><span className="welcome-icon"><Icon name="team" size={23} /></span><h3>Team couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}
    {isEmpty && <div className="team-state team-empty"><span className="welcome-icon"><Icon name="team" size={23} /></span><h3>No team members yet</h3><p>Team members will appear here as your workspace grows.</p></div>}
    {status === 'ready' && members.length > 0 && <div className="team-list"><div className="team-row team-row-heading" aria-hidden="true"><span>Member</span><span>Email</span><span>Role</span><span>Joined</span></div>{members.map((member) => {
      const isCurrentUser = member.user_id === userId
      const memberName = isCurrentUser ? (user.name || user.email?.split('@')[0] || 'You') : 'Team member'
      const memberEmail = isCurrentUser ? (user.email || '—') : '—'
      return <article className="team-row" key={member.id}><div className="team-member"><span className="team-avatar">{memberName.slice(0, 1).toUpperCase()}</span><strong>{memberName}</strong></div><div className="team-email">{memberEmail}</div><span className={`team-role team-role-${member.role || 'staff'}`}>{formatRole(member.role)}</span><div className="team-joined">{formatJoinedDate(member.created_at)}</div></article>
    })}</div>}
  </section>
}

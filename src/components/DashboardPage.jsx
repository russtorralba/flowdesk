import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import '../styles/dashboard-page.css'

const customerFields = 'id, first_name, last_name, status'
const jobFields = 'id, customer_id, title, status, priority, scheduled_start, scheduled_end, created_at'
const assignmentFields = 'job_id, user_id, workspace_id'
const activeStatuses = new Set(['new', 'scheduled', 'in_progress'])
const terminalStatuses = new Set(['completed', 'cancelled'])

const formatLabel = (value, fallback) => (value || fallback).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatToken = (value, fallback) => (value || fallback).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')

const toValidDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const isToday = (date, today) => date.getFullYear() === today.getFullYear()
  && date.getMonth() === today.getMonth()
  && date.getDate() === today.getDate()

const formatSchedule = (value) => {
  const date = toValidDate(value)
  if (!date) return 'Not scheduled'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

const formatCreatedDate = (value) => {
  const date = toValidDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function DashboardPage({ user, onNavigate }) {
  const [customers, setCustomers] = useState([])
  const [jobs, setJobs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [currentTime, setCurrentTime] = useState(null)
  const [status, setStatus] = useState('loading')
  const userId = user?.id

  useEffect(() => {
    let isCurrent = true

    const loadDashboard = async () => {
      if (!userId) return

      setStatus('loading')
      setCurrentTime(null)
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

        const [customerResult, jobResult, assignmentResult] = await Promise.all([
          neon.from('customers').select(customerFields).eq('workspace_id', membership.workspace_id),
          neon.from('jobs').select(jobFields).eq('workspace_id', membership.workspace_id).order('created_at', { ascending: false }),
          neon.from('job_assignments').select(assignmentFields).eq('workspace_id', membership.workspace_id),
        ])

        if (customerResult.error || jobResult.error || assignmentResult.error) {
          if (isCurrent) setStatus('error')
          return
        }

        if (!isCurrent) return
        setCustomers(customerResult.data ?? [])
        setJobs(jobResult.data ?? [])
        setAssignments(assignmentResult.data ?? [])
        setCurrentTime(new Date())
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadDashboard()
    return () => { isCurrent = false }
  }, [userId])

  const dashboard = useMemo(() => {
    const now = currentTime
    const customerNames = Object.fromEntries(customers.map((customer) => [
      customer.id,
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unnamed customer',
    ]))
    const assignedJobIds = new Set(assignments.map((assignment) => assignment.job_id))
    const activeJobs = jobs.filter((job) => activeStatuses.has(job.status || 'new'))
    const scheduledToday = activeJobs.filter((job) => {
      const date = toValidDate(job.scheduled_start)
      return Boolean(date && now && isToday(date, now))
    })
    const unassignedJobs = activeJobs.filter((job) => !assignedJobIds.has(job.id))
    const upcomingJobs = jobs
      .filter((job) => {
        const date = toValidDate(job.scheduled_start)
        return Boolean(date && now && !terminalStatuses.has(job.status) && date >= now)
      })
      .sort((first, second) => new Date(first.scheduled_start) - new Date(second.scheduled_start))
      .slice(0, 5)
    const recentJobs = jobs.slice(0, 5)
    const newUnscheduledJobs = jobs.filter((job) => (job.status || 'new') === 'new' && !toValidDate(job.scheduled_start))

    return {
      customerNames,
      assignedJobIds,
      upcomingJobs,
      recentJobs,
      metrics: {
        activeJobs: activeJobs.length,
        scheduledToday: scheduledToday.length,
        unassignedJobs: unassignedJobs.length,
        activeCustomers: customers.filter((customer) => customer.status === 'active').length,
      },
      attention: {
        unassignedJobs: unassignedJobs.length,
        newUnscheduledJobs: newUnscheduledJobs.length,
      },
      isFirstUse: customers.length === 0 && jobs.length === 0,
    }
  }, [assignments, currentTime, customers, jobs])

  const metrics = [
    { label: 'Active jobs', value: dashboard.metrics.activeJobs, caption: 'Work currently in your pipeline', icon: 'briefcase' },
    { label: 'Scheduled today', value: dashboard.metrics.scheduledToday, caption: 'Jobs planned for today', icon: 'calendar' },
    { label: 'Unassigned jobs', value: dashboard.metrics.unassignedJobs, caption: 'Active work needing an owner', icon: 'users' },
    { label: 'Active customers', value: dashboard.metrics.activeCustomers, caption: 'Customers currently in service', icon: 'spark' },
  ]

  return <section className="workspace-content dashboard-page">
    <div className="dashboard-page-header">
      <div><p className="eyebrow">Dashboard</p><h2>Operations overview</h2><p>Keep track of today&apos;s work, active jobs, and what needs attention.</p></div>
      <button className="primary-action dashboard-view-jobs" type="button" onClick={() => onNavigate('jobs')}><Icon name="briefcase" size={17} />View jobs</button>
    </div>

    {status === 'loading' && <div className="dashboard-state" aria-busy="true" aria-live="polite"><span className="dashboard-loading-indicator" aria-hidden="true" /><p>Loading operations overview</p></div>}
    {status === 'error' && <div className="dashboard-state dashboard-error" role="alert"><span className="welcome-icon"><Icon name="grid" size={23} /></span><h3>Dashboard couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}

    {status === 'ready' && <>
      <div className="dashboard-metrics">{metrics.map((metric) => <article className="dashboard-metric" key={metric.label}><span className="dashboard-metric-icon"><Icon name={metric.icon} size={18} /></span><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.caption}</small></article>)}</div>

      {dashboard.isFirstUse && <section className="dashboard-first-use"><span><Icon name="spark" size={18} /></span><div><strong>Your operations workspace is ready.</strong><p>Add a customer, then create a job to start building your live operations view.</p></div><div className="dashboard-first-use-actions"><button type="button" onClick={() => onNavigate('customers')}>View customers</button><button type="button" onClick={() => onNavigate('jobs')}>Manage jobs</button></div></section>}

      <div className="dashboard-layout">
        <div className="dashboard-main-column">
          <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">Schedule</p><h3>Upcoming work</h3></div><button type="button" className="dashboard-text-action" onClick={() => onNavigate('schedule')}>View schedule</button></div>{dashboard.upcomingJobs.length === 0 ? <div className="dashboard-compact-empty"><p>No upcoming work scheduled.</p></div> : <div className="dashboard-job-list">{dashboard.upcomingJobs.map((job) => <article className="dashboard-job-row" key={job.id}><div className="dashboard-job-primary"><strong>{job.title || 'Untitled job'}</strong><span>{dashboard.customerNames[job.customer_id] || 'No customer'}</span></div><div className="dashboard-job-schedule">{formatSchedule(job.scheduled_start)}</div><span className={`job-status job-status-${formatToken(job.status, 'new')}`}>{formatLabel(job.status, 'New')}</span><span className={`job-priority job-priority-${formatToken(job.priority, 'normal')}`}>{formatLabel(job.priority, 'Normal')}</span><span className="dashboard-assignment-state">{dashboard.assignedJobIds.has(job.id) ? 'Assigned' : 'Unassigned'}</span></article>)}</div>}</section>
          <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">Activity</p><h3>Recent jobs</h3></div><button type="button" className="dashboard-text-action" onClick={() => onNavigate('jobs')}>View jobs</button></div>{dashboard.recentJobs.length === 0 ? <div className="dashboard-compact-empty"><p>No jobs yet.</p></div> : <div className="dashboard-job-list">{dashboard.recentJobs.map((job) => <article className="dashboard-job-row dashboard-recent-job-row" key={job.id}><div className="dashboard-job-primary"><strong>{job.title || 'Untitled job'}</strong><span>{dashboard.customerNames[job.customer_id] || 'No customer'}</span></div><div className="dashboard-job-schedule">Created {formatCreatedDate(job.created_at)}</div><span className={`job-status job-status-${formatToken(job.status, 'new')}`}>{formatLabel(job.status, 'New')}</span><span className={`job-priority job-priority-${formatToken(job.priority, 'normal')}`}>{formatLabel(job.priority, 'Normal')}</span><span className="dashboard-assignment-state">{dashboard.assignedJobIds.has(job.id) ? 'Assigned' : 'Unassigned'}</span></article>)}</div>}</section>
        </div>

        <aside className="dashboard-secondary-column">
          <section className="dashboard-panel dashboard-attention-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">Operations</p><h3>Needs attention</h3></div></div>{dashboard.attention.unassignedJobs === 0 && dashboard.attention.newUnscheduledJobs === 0 ? <div className="dashboard-compact-empty"><p>Everything looks on track.</p></div> : <div className="dashboard-attention-list">{dashboard.attention.unassignedJobs > 0 && <p><strong>{dashboard.attention.unassignedJobs}</strong> unassigned {dashboard.attention.unassignedJobs === 1 ? 'job' : 'jobs'}</p>}{dashboard.attention.newUnscheduledJobs > 0 && <p><strong>{dashboard.attention.newUnscheduledJobs}</strong> new {dashboard.attention.newUnscheduledJobs === 1 ? 'job needs' : 'jobs need'} scheduling</p>}</div>}</section>
          <section className="dashboard-panel dashboard-actions-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">Shortcuts</p><h3>Quick actions</h3></div></div><div className="dashboard-quick-actions"><button type="button" onClick={() => onNavigate('jobs')}><Icon name="briefcase" size={17} /><span>Manage jobs</span></button><button type="button" onClick={() => onNavigate('customers')}><Icon name="users" size={17} /><span>View customers</span></button><button type="button" onClick={() => onNavigate('schedule')}><Icon name="calendar" size={17} /><span>Open schedule</span></button><button type="button" onClick={() => onNavigate('invoices')}><Icon name="receipt" size={17} /><span>View invoices</span></button></div></section>
        </aside>
      </div>
    </>}
  </section>
}

import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import { ScheduleJobModal } from './ScheduleJobModal.jsx'
import '../styles/schedule.css'

const jobFields = 'id, workspace_id, customer_id, title, status, priority, scheduled_start, scheduled_end, created_at'
const customerFields = 'id, first_name, last_name, status'
const assignmentFields = 'id, workspace_id, job_id, user_id, created_at'
const operationalStatuses = new Set(['new', 'scheduled', 'in_progress'])
const scheduleStatuses = new Set(['new', 'scheduled', 'in_progress', 'completed', 'cancelled'])

const toValidDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const startOfLocalWeek = (value) => {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

const addDays = (value, amount) => {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

const isSameLocalDate = (first, second) => first.getFullYear() === second.getFullYear()
  && first.getMonth() === second.getMonth()
  && first.getDate() === second.getDate()

const formatLabel = (value, fallback) => (value || fallback).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatToken = (value, fallback) => (value || fallback).toLowerCase().replaceAll('_', '-')
const formatTime = (value) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(value)

const formatWeekRange = (start, end) => {
  const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  const endWithYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const fullDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return start.getFullYear() === end.getFullYear()
    ? `${shortDate.format(start)} – ${endWithYear.format(end)}`
    : `${fullDate.format(start)} – ${fullDate.format(end)}`
}

const formatEndIndicator = (value) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(value)

const getScheduleTime = (job) => {
  const start = toValidDate(job.scheduled_start)
  if (!start) return { primary: 'Time unavailable', endIndicator: '' }

  const end = toValidDate(job.scheduled_end)
  if (!end || end <= start) return { primary: formatTime(start), endIndicator: '' }
  if (isSameLocalDate(start, end)) return { primary: `${formatTime(start)} – ${formatTime(end)}`, endIndicator: '' }
  return { primary: formatTime(start), endIndicator: `Ends ${formatEndIndicator(end)}` }
}

export function SchedulePage({ user, onNavigate, onOpenJob }) {
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [status, setStatus] = useState('loading')
  const [workspaceId, setWorkspaceId] = useState(null)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfLocalWeek(new Date()))
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfLocalWeek(new Date()))
  const [viewFilter, setViewFilter] = useState('operational')
  const [jobToSchedule, setJobToSchedule] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const userId = user?.id

  useEffect(() => {
    let isCurrent = true

    const loadSchedule = async () => {
      if (!userId) return

      setStatus('loading')
      setWorkspaceId(null)
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

        const workspaceId = membership.workspace_id
        const [jobsResult, customersResult, assignmentsResult] = await Promise.all([
          neon.from('jobs').select(jobFields).eq('workspace_id', workspaceId).order('scheduled_start', { ascending: true }),
          neon.from('customers').select(customerFields).eq('workspace_id', workspaceId),
          neon.from('job_assignments').select(assignmentFields).eq('workspace_id', workspaceId),
        ])

        if (jobsResult.error || customersResult.error || assignmentsResult.error) {
          if (isCurrent) setStatus('error')
          return
        }

        if (!isCurrent) return
        setWorkspaceId(workspaceId)
        setJobs(jobsResult.data ?? [])
        setCustomers(customersResult.data ?? [])
        setAssignments(assignmentsResult.data ?? [])
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadSchedule()
    return () => { isCurrent = false }
  }, [userId])

  const schedule = useMemo(() => {
    const weekEnd = addDays(selectedWeekStart, 6)
    const nextWeekStart = addDays(selectedWeekStart, 7)
    const customerNames = Object.fromEntries(customers.map((customer) => [
      customer.id,
      [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer unavailable',
    ]))
    const assignedJobIds = new Set(assignments.map((assignment) => assignment.job_id))
    const matchesFilter = (job) => {
      const jobStatus = job.status || 'new'
      return (viewFilter === 'all' && scheduleStatuses.has(jobStatus)) || (viewFilter === 'operational' && operationalStatuses.has(jobStatus)) || jobStatus === viewFilter
    }
    const filteredJobs = jobs.filter(matchesFilter)
    const scheduledJobs = filteredJobs
      .filter((job) => {
        const start = toValidDate(job.scheduled_start)
        return Boolean(start && start >= selectedWeekStart && start < nextWeekStart)
      })
      .sort((first, second) => {
        const timeDifference = new Date(first.scheduled_start).getTime() - new Date(second.scheduled_start).getTime()
        return timeDifference || String(first.id).localeCompare(String(second.id))
      })
    const unscheduledJobs = filteredJobs.filter((job) => !toValidDate(job.scheduled_start))
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(selectedWeekStart, index)
      return {
        date,
        jobs: scheduledJobs.filter((job) => isSameLocalDate(toValidDate(job.scheduled_start), date)),
      }
    })

    return { weekEnd, customerNames, assignedJobIds, scheduledJobs, unscheduledJobs, days }
  }, [assignments, customers, jobs, selectedWeekStart, viewFilter])

  const customerName = (job) => schedule.customerNames[job.customer_id] || 'Customer unavailable'
  const assignmentState = (job) => schedule.assignedJobIds.has(job.id) ? 'Assigned' : 'Unassigned'
  const goToPreviousWeek = () => setSelectedWeekStart((current) => addDays(current, -7))
  const goToCurrentWeek = () => {
    const currentWeek = startOfLocalWeek(new Date())
    setCurrentWeekStart(currentWeek)
    setSelectedWeekStart(currentWeek)
  }
  const goToNextWeek = () => setSelectedWeekStart((current) => addDays(current, 7))
  const isCurrentWeek = isSameLocalDate(selectedWeekStart, currentWeekStart)
  const weekEmptyMessage = {
    operational: 'No scheduled work this week.',
    all: 'No scheduled jobs this week.',
    completed: 'No completed jobs scheduled this week.',
    cancelled: 'No cancelled jobs scheduled this week.',
  }[viewFilter]
  const unscheduledHeading = {
    operational: 'Unscheduled jobs',
    all: 'All unscheduled jobs',
    completed: 'Unscheduled completed jobs',
    cancelled: 'Unscheduled cancelled jobs',
  }[viewFilter]
  const canSchedule = (job) => operationalStatuses.has(job.status || 'new')
  const scheduleActionLabel = (job) => toValidDate(job.scheduled_start) ? 'Reschedule' : 'Schedule'

  const updateJobSchedule = async (values) => {
    if (!workspaceId || !jobToSchedule) return null

    const targetJob = jobs.find((job) => job.id === jobToSchedule.id && job.workspace_id === workspaceId)
    const start = new Date(values.scheduled_start)
    const end = values.scheduled_end ? new Date(values.scheduled_end) : null
    if (!targetJob || !canSchedule(targetJob) || !values.scheduled_start || Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) return null

    try {
      const { data, error } = await neon
        .from('jobs')
        .update({
          scheduled_start: new Date(values.scheduled_start).toISOString(),
          scheduled_end: values.scheduled_end ? new Date(values.scheduled_end).toISOString() : null,
        })
        .eq('id', targetJob.id)
        .eq('workspace_id', workspaceId)
        .select(jobFields)
        .single()

      if (error || !data || data.id !== targetJob.id || data.workspace_id !== workspaceId) return null

      setJobs((current) => current.map((job) => job.id === data.id ? data : job))
      setSuccessMessage('Schedule updated.')
      return data
    } catch {
      return null
    }
  }

  return <section className="workspace-content schedule-page">
    <div className="schedule-page-header">
      <div><p className="eyebrow">Schedule</p><h2>Schedule</h2><p>Plan your week and keep every service job on track.</p></div>
    </div>

    {successMessage && <p className="schedule-success" role="status">{successMessage}</p>}

    {status === 'loading' && <div className="schedule-state" aria-busy="true" aria-live="polite"><span className="schedule-loading-indicator" aria-hidden="true" /><p>Loading schedule</p></div>}
    {status === 'error' && <div className="schedule-state schedule-error" role="alert"><span className="welcome-icon"><Icon name="calendar" size={23} /></span><h3>Schedule couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}

    {status === 'ready' && <>
      <section className="schedule-agenda" aria-labelledby="weekly-agenda-title">
        <div className="schedule-agenda-header">
          <div><p className="eyebrow">Weekly agenda</p><div className="schedule-range"><h3 id="weekly-agenda-title">{formatWeekRange(selectedWeekStart, schedule.weekEnd)}</h3>{isCurrentWeek && <span>Current week</span>}</div></div>
          <div className="schedule-controls">
            <div className="schedule-week-controls" aria-label="Week navigation">
              <button className="secondary-action" type="button" onClick={goToPreviousWeek}>Previous week</button>
              <button className="schedule-today-action" type="button" onClick={goToCurrentWeek}>Today</button>
              <button className="secondary-action" type="button" onClick={goToNextWeek}>Next week</button>
            </div>
            <label className="schedule-filter"><span>Show</span><select value={viewFilter} onChange={(event) => setViewFilter(event.target.value)} aria-label="Schedule view filter"><option value="operational">Operational</option><option value="all">All</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          </div>
        </div>

        {schedule.scheduledJobs.length === 0 && <p className="schedule-week-empty" role="status">{weekEmptyMessage}</p>}
        <div className="schedule-days">
          {schedule.days.map((day) => <section className="schedule-day" key={day.date.toISOString()}>
            <header className="schedule-day-header"><span>{new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(day.date)}</span><strong>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(day.date)}</strong></header>
            {day.jobs.length === 0 ? <p className="schedule-day-empty">No scheduled work</p> : <div className="schedule-job-list">{day.jobs.map((job) => {
              const time = getScheduleTime(job)
              return <article className={`schedule-job schedule-job--${formatToken(job.status, 'new')}`} key={job.id}>
                <div className="schedule-job-time"><strong>{time.primary}</strong>{time.endIndicator && <span>{time.endIndicator}</span>}</div>
                <div className="schedule-job-main"><strong>{job.title || 'Untitled job'}</strong><span>{customerName(job)}</span></div>
                <div className="schedule-job-meta"><span className={`job-status job-status-${formatToken(job.status, 'new')}`}>{formatLabel(job.status, 'New')}</span><span className={`job-priority job-priority-${formatToken(job.priority, 'normal')}`}>{formatLabel(job.priority, 'Normal')}</span><span className="schedule-assignment-state">{assignmentState(job)}</span></div>
                <div className="schedule-job-actions">{canSchedule(job) && <button className="schedule-update-action" type="button" onClick={() => { setSuccessMessage(''); setJobToSchedule(job) }}>{scheduleActionLabel(job)}</button>}<button className="schedule-view-action" type="button" onClick={() => onOpenJob ? onOpenJob(job.id) : onNavigate('jobs')}>View in Jobs</button></div>
              </article>
            })}</div>}
          </section>)}
        </div>
      </section>

      <section className="schedule-unscheduled" aria-labelledby="unscheduled-jobs-title">
        <div className="schedule-section-heading"><div><p className="eyebrow">Unscheduled work</p><h3 id="unscheduled-jobs-title">{unscheduledHeading}</h3></div></div>
        {schedule.unscheduledJobs.length === 0 ? <p className="schedule-unscheduled-empty">{viewFilter === 'operational' ? 'All active jobs are scheduled.' : 'No unscheduled jobs match this view.'}</p> : <div className="schedule-unscheduled-list">{schedule.unscheduledJobs.map((job) => <article className={`schedule-unscheduled-job schedule-unscheduled-job--${formatToken(job.status, 'new')}`} key={job.id}>
          <div><strong>{job.title || 'Untitled job'}</strong><span>{customerName(job)}</span></div>
          <div className="schedule-job-meta"><span className={`job-status job-status-${formatToken(job.status, 'new')}`}>{formatLabel(job.status, 'New')}</span><span className={`job-priority job-priority-${formatToken(job.priority, 'normal')}`}>{formatLabel(job.priority, 'Normal')}</span><span className="schedule-assignment-state">{assignmentState(job)}</span></div>
          <div className="schedule-job-actions">{canSchedule(job) && <button className="schedule-update-action" type="button" onClick={() => { setSuccessMessage(''); setJobToSchedule(job) }}>{scheduleActionLabel(job)}</button>}<button className="schedule-view-action" type="button" onClick={() => onOpenJob ? onOpenJob(job.id) : onNavigate('jobs')}>View in Jobs</button></div>
        </article>)}</div>}
      </section>
      {jobToSchedule && <ScheduleJobModal job={jobToSchedule} onClose={() => setJobToSchedule(null)} onSave={updateJobSchedule} />}
    </>}
  </section>
}

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import { CreateJobModal } from './CreateJobModal.jsx'
import { JobDetailsModal } from './JobDetailsModal.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'
import '../styles/jobs.css'

const jobFields = 'id, workspace_id, customer_id, title, description, status, priority, scheduled_start, scheduled_end, notes, created_at, updated_at'
const assignmentFields = 'id, workspace_id, job_id, user_id, created_at'
const memberFields = 'id, workspace_id, user_id, role, created_at'
const assignmentEligibleStatuses = ['new', 'scheduled', 'in_progress']

const formatLabel = (value, fallback) => {
  if (!value) return fallback
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const formatToken = (value, fallback) => (value || fallback).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')

const formatSchedule = (scheduledStart) => {
  if (!scheduledStart) return 'Not scheduled'

  const date = new Date(scheduledStart)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function JobsPage({ user, requestedJobId, onRequestedJobHandled }) {
  const [jobs, setJobs] = useState([])
  const [customerNames, setCustomerNames] = useState({})
  const [customers, setCustomers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [members, setMembers] = useState([])
  const [status, setStatus] = useState('loading')
  const [workspaceId, setWorkspaceId] = useState(null)
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false)
  const [jobToView, setJobToView] = useState(null)
  const [jobToEdit, setJobToEdit] = useState(null)
  const [jobToCancel, setJobToCancel] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [assignmentToRemove, setAssignmentToRemove] = useState(null)
  const [isManagingAssignments, setIsManagingAssignments] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const userId = user?.id
  const requestedJobIdRef = useRef(requestedJobId)
  const onRequestedJobHandledRef = useRef(onRequestedJobHandled)
  const cancelDialogRef = useRef(null)
  const removeAssignmentDialogRef = useRef(null)

  useDialogFocus(cancelDialogRef, { active: Boolean(jobToCancel) })
  useDialogFocus(removeAssignmentDialogRef, { active: Boolean(assignmentToRemove) })

  useEffect(() => {
    requestedJobIdRef.current = requestedJobId
    onRequestedJobHandledRef.current = onRequestedJobHandled
  }, [onRequestedJobHandled, requestedJobId])

  useEffect(() => {
    let isCurrent = true

    const loadJobs = async () => {
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

        setWorkspaceId(membership.workspace_id)

        const { data: jobData, error: jobsError } = await neon
          .from('jobs')
          .select(jobFields)
          .eq('workspace_id', membership.workspace_id)
          .order('created_at', { ascending: false })

        if (jobsError) {
          if (isCurrent) setStatus('error')
          return
        }

        const jobsForWorkspace = jobData ?? []
        const { data: customerData, error: customersError } = await neon
          .from('customers')
          .select('id, first_name, last_name, status')
          .eq('workspace_id', membership.workspace_id)

        if (customersError) {
          if (isCurrent) setStatus('error')
          return
        }

        const { data: assignmentData, error: assignmentsError } = await neon
          .from('job_assignments')
          .select(assignmentFields)
          .eq('workspace_id', membership.workspace_id)

        if (assignmentsError) {
          if (isCurrent) setStatus('error')
          return
        }

        const { data: memberData, error: membersError } = await neon
          .from('workspace_members')
          .select(memberFields)
          .eq('workspace_id', membership.workspace_id)
          .order('created_at', { ascending: true })

        if (membersError) {
          if (isCurrent) setStatus('error')
          return
        }

        const customersForWorkspace = customerData ?? []
        const names = Object.fromEntries(customersForWorkspace
          .map((customer) => [customer.id, [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unnamed customer']))
        const customerRecords = customersForWorkspace.map((customer) => ({
          id: customer.id,
          name: names[customer.id],
          status: customer.status,
        }))

        if (!isCurrent) return
        setCustomerNames(names)
        setCustomers(customerRecords)
        setJobs(jobsForWorkspace)
        setAssignments(assignmentData ?? [])
        setMembers(memberData ?? [])
        if (requestedJobIdRef.current) {
          const requestedJob = jobsForWorkspace.find((job) => job.id === requestedJobIdRef.current && job.workspace_id === membership.workspace_id)
          if (requestedJob) {
            setStatusError('')
            setAssignmentError('')
            setJobToView(requestedJob)
          }
          onRequestedJobHandledRef.current?.()
        }
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadJobs()
    return () => { isCurrent = false }
  }, [userId])

  const isEmpty = status === 'ready' && jobs.length === 0
  const activeCustomers = customers.filter((customer) => customer.status === 'active')
  const matchesFilter = (job) => {
    const jobStatus = job.status || 'new'
    return filter === 'all' || filter === jobStatus || (filter === 'active' && ['new', 'scheduled', 'in_progress'].includes(jobStatus))
  }
  const visibleJobs = jobs.filter((job) => {
    const searchText = [job.title, job.description, customerNames[job.customer_id]].filter(Boolean).join(' ').toLowerCase()
    return matchesFilter(job) && searchText.includes(search.trim().toLowerCase())
  })

  const createJob = async (values) => {
    if (!workspaceId || !activeCustomers.some((customer) => customer.id === values.customer_id)) return null

    const optionalValues = Object.fromEntries(Object.entries({
      description: values.description,
      notes: values.notes,
      scheduled_start: values.scheduled_start ? new Date(values.scheduled_start).toISOString() : '',
      scheduled_end: values.scheduled_end ? new Date(values.scheduled_end).toISOString() : '',
    }).filter(([, value]) => value))

    try {
      const { data, error } = await neon
        .from('jobs')
        .insert({
          workspace_id: workspaceId,
          customer_id: values.customer_id,
          title: values.title,
          priority: values.priority,
          status: 'new',
          ...optionalValues,
        })
        .select(jobFields)
        .single()

      if (error || !data) return null

      setJobs((current) => [data, ...current])
      setSuccessMessage('Job created.')
      return data
    } catch {
      return null
    }
  }

  const updateJob = async (values) => {
    if (!workspaceId || !jobToEdit) return null
    const selectedCustomerIsAllowed = activeCustomers.some((customer) => customer.id === values.customer_id) || values.customer_id === jobToEdit.customer_id
    if (!selectedCustomerIsAllowed) return null

    try {
      const { data, error } = await neon
        .from('jobs')
        .update({
          customer_id: values.customer_id,
          title: values.title,
          description: values.description,
          priority: values.priority,
          scheduled_start: values.scheduled_start ? new Date(values.scheduled_start).toISOString() : null,
          scheduled_end: values.scheduled_end ? new Date(values.scheduled_end).toISOString() : null,
          notes: values.notes,
        })
        .eq('id', jobToEdit.id)
        .eq('workspace_id', workspaceId)
        .select(jobFields)
        .single()

      if (error || !data) return null

      setJobs((current) => current.map((job) => job.id === data.id ? data : job))
      setJobToView((current) => current?.id === data.id ? data : current)
      setSuccessMessage('Job updated.')
      return data
    } catch {
      return null
    }
  }

  const updateJobStatus = async (job, nextStatus) => {
    if (!workspaceId || !job) return
    if (nextStatus === 'scheduled' && !job.scheduled_start) {
      setStatusError('Add a schedule before moving this job to Scheduled.')
      return
    }

    setIsUpdatingStatus(true)
    setStatusError('')
    try {
      const { data, error } = await neon
        .from('jobs')
        .update({ status: nextStatus })
        .eq('id', job.id)
        .eq('workspace_id', workspaceId)
        .select(jobFields)
        .single()

      if (error || !data || data.id !== job.id || data.status !== nextStatus) {
        setStatusError('Job status couldn’t be updated. Please try again.')
        return
      }

      setJobs((current) => current.map((currentJob) => currentJob.id === data.id ? data : currentJob))
      setJobToView(data)
      setJobToCancel(null)
      setSuccessMessage('Job status updated.')
    } catch {
      setStatusError('Job status couldn’t be updated. Please try again.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const addAssignment = async (job, memberUserId) => {
    const currentJob = jobs.find((current) => current.id === job?.id && current.workspace_id === workspaceId)
    const selectedMember = members.find((member) => member.user_id === memberUserId && member.workspace_id === workspaceId)
    const alreadyAssigned = assignments.some((assignment) => assignment.job_id === job?.id && assignment.user_id === memberUserId)

    if (!workspaceId || !currentJob || !selectedMember || alreadyAssigned || !assignmentEligibleStatuses.includes(currentJob.status || 'new')) {
      setAssignmentError('Team member couldn’t be assigned. Please try again.')
      return
    }

    setIsManagingAssignments(true)
    setAssignmentError('')
    try {
      const { data, error } = await neon
        .from('job_assignments')
        .insert({
          workspace_id: workspaceId,
          job_id: currentJob.id,
          user_id: selectedMember.user_id,
        })
        .select(assignmentFields)
        .single()

      if (error || !data || data.job_id !== currentJob.id || data.user_id !== selectedMember.user_id || data.workspace_id !== workspaceId) {
        setAssignmentError('Team member couldn’t be assigned. Please try again.')
        return
      }

      setAssignments((current) => [...current, data])
      setSuccessMessage('Team member assigned.')
    } catch {
      setAssignmentError('Team member couldn’t be assigned. Please try again.')
    } finally {
      setIsManagingAssignments(false)
    }
  }

  const removeAssignment = async () => {
    if (!assignmentToRemove || !workspaceId) return

    const currentJob = jobs.find((job) => job.id === assignmentToRemove.job_id && job.workspace_id === workspaceId)
    const currentAssignment = assignments.find((assignment) => assignment.id === assignmentToRemove.id && assignment.workspace_id === workspaceId && assignment.job_id === assignmentToRemove.job_id)

    if (!currentJob || !currentAssignment || !assignmentEligibleStatuses.includes(currentJob.status || 'new')) {
      setAssignmentError('Team member couldn’t be removed. Please try again.')
      return
    }

    setIsManagingAssignments(true)
    setAssignmentError('')
    try {
      const { data, error } = await neon
        .from('job_assignments')
        .delete()
        .eq('id', currentAssignment.id)
        .eq('workspace_id', workspaceId)
        .eq('job_id', currentJob.id)
        .select(assignmentFields)
        .single()

      if (error || !data || data.id !== currentAssignment.id || data.workspace_id !== workspaceId || data.job_id !== currentJob.id || data.user_id !== currentAssignment.user_id) {
        setAssignmentError('Team member couldn’t be removed. Please try again.')
        return
      }

      setAssignments((current) => current.filter((assignment) => assignment.id !== data.id))
      setAssignmentToRemove(null)
      setSuccessMessage('Team member removed.')
    } catch {
      setAssignmentError('Team member couldn’t be removed. Please try again.')
    } finally {
      setIsManagingAssignments(false)
    }
  }

  const editCustomerOptions = jobToEdit ? customers.filter((customer) => customer.status === 'active' || customer.id === jobToEdit.customer_id) : activeCustomers
  const assignmentsByJob = assignments.reduce((grouped, assignment) => {
    grouped[assignment.job_id] = [...(grouped[assignment.job_id] ?? []), assignment]
    return grouped
  }, {})
  const memberForAssignment = (assignment) => members.find((member) => member.user_id === assignment.user_id && member.workspace_id === workspaceId)
  const memberDisplay = (member) => {
    const isCurrentUser = member?.user_id === userId
    return {
      name: isCurrentUser ? (user?.name || user?.email?.split('@')[0] || 'You') : 'Team member',
      role: formatLabel(member?.role, 'Staff'),
    }
  }
  const assignmentSummary = (job) => {
    const jobAssignments = assignmentsByJob[job.id] ?? []
    if (jobAssignments.length === 0) return 'Unassigned'
    if (jobAssignments.length > 1) return `${jobAssignments.length} team members`
    return memberDisplay(memberForAssignment(jobAssignments[0])).name
  }
  const viewedAssignments = jobToView ? (assignmentsByJob[jobToView.id] ?? []).map((assignment) => ({ ...assignment, member: memberForAssignment(assignment) })) : []

  return <section className="workspace-content jobs-page">
    <div className="jobs-page-header">
      <div><p className="eyebrow">Jobs</p><h2>Jobs</h2><p>Track every service job from request to completion.</p></div>
      <button className="primary-action jobs-create-button" type="button" onClick={() => setIsCreateJobOpen(true)} disabled={status === 'loading'}><Icon name="plus" size={17} />Create job</button>
    </div>

    {successMessage && <p className="jobs-success" role="status">{successMessage}</p>}

    {status === 'loading' && <div className="jobs-state" aria-busy="true" aria-live="polite"><span className="jobs-loading-indicator" aria-hidden="true" /><p>Loading jobs</p></div>}
    {status === 'error' && <div className="jobs-state jobs-error" role="alert"><span className="welcome-icon"><Icon name="briefcase" size={23} /></span><h3>Jobs couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}
    {isEmpty && <div className="jobs-state jobs-empty"><span className="welcome-icon"><Icon name="briefcase" size={23} /></span><h3>No jobs yet</h3><p>Create your first job to start tracking service work, schedules, and progress.</p></div>}
    {status === 'ready' && jobs.length > 0 && <div className="job-directory-controls"><label className="job-search"><span className="visually-hidden">Search jobs</span><Icon name="search" size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs" /></label><label className="job-filter"><span className="visually-hidden">Filter jobs</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Active</option><option value="new">New</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option></select></label></div>}
    {status === 'ready' && jobs.length > 0 && visibleJobs.length === 0 && <div className="jobs-state jobs-no-results"><h3>No matching jobs</h3><p>Try another search or filter to find the job you need.</p></div>}
    {status === 'ready' && visibleJobs.length > 0 && <div className="jobs-list"><div className="job-row job-row-heading" aria-hidden="true"><span>Job</span><span>Customer</span><span>Status</span><span>Priority</span><span>Schedule</span><span>Actions</span></div>{visibleJobs.map((job) => <article className="job-row" key={job.id}><div className="job-title"><strong>{job.title || 'Untitled job'}</strong><span>{job.description || 'No description'}</span></div><div className="job-customer"><span>{customerNames[job.customer_id] || 'No customer'}</span><span className="job-assignment-summary">Assigned · {assignmentSummary(job)}</span></div><span className={`job-status job-status-${formatToken(job.status, 'new')}`}>{formatLabel(job.status, 'New')}</span><span className={`job-priority job-priority-${formatToken(job.priority, 'normal')}`}>{formatLabel(job.priority, 'Normal')}</span><div className="job-schedule">{formatSchedule(job.scheduled_start)}</div><button className="job-view-action" type="button" onClick={() => { setStatusError(''); setAssignmentError(''); setJobToView(job) }}>View</button></article>)}</div>}
    {isCreateJobOpen && <CreateJobModal customers={activeCustomers} onClose={() => setIsCreateJobOpen(false)} onCreate={createJob} />}
    {jobToView && <JobDetailsModal job={jobToView} customerName={customerNames[jobToView.customer_id]} assignments={viewedAssignments} members={members} memberDisplay={memberDisplay} assignmentError={assignmentError} isManagingAssignments={isManagingAssignments} onAssign={(memberUserId) => addAssignment(jobToView, memberUserId)} onRequestRemove={setAssignmentToRemove} statusError={statusError} isUpdatingStatus={isUpdatingStatus} onClose={() => setJobToView(null)} onEdit={() => { setJobToEdit(jobToView); setJobToView(null) }} onStatusChange={(nextStatus) => nextStatus === 'cancelled' ? setJobToCancel(jobToView) : updateJobStatus(jobToView, nextStatus)} />}
    {jobToEdit && <CreateJobModal job={jobToEdit} customers={editCustomerOptions} onClose={() => setJobToEdit(null)} onCreate={createJob} onUpdate={updateJob} />}
    {jobToCancel && <div className="job-modal-backdrop" role="presentation"><section ref={cancelDialogRef} className="job-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="cancel-job-title" tabIndex="-1"><h2 id="cancel-job-title">Cancel {jobToCancel.title || 'job'}?</h2><p>This keeps the job in FlowDesk for history, but marks it as cancelled.</p>{statusError && <p className="job-form-error" role="alert">{statusError}</p>}<div className="job-modal-actions"><button className="secondary-action" type="button" disabled={isUpdatingStatus} onClick={() => setJobToCancel(null)}>Keep job</button><button className="job-cancel-action" type="button" disabled={isUpdatingStatus} onClick={() => updateJobStatus(jobToCancel, 'cancelled')}>{isUpdatingStatus ? 'Cancelling…' : 'Cancel job'}</button></div></section></div>}
    {assignmentToRemove && <div className="job-modal-backdrop" role="presentation"><section ref={removeAssignmentDialogRef} className="job-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="remove-assignment-title" tabIndex="-1"><h2 id="remove-assignment-title">Remove {memberDisplay(memberForAssignment(assignmentToRemove)).name} from this job?</h2><p>This removes the assignment but keeps the job and team member.</p>{assignmentError && <p className="job-form-error" role="alert">{assignmentError}</p>}<div className="job-modal-actions"><button className="secondary-action" type="button" disabled={isManagingAssignments} onClick={() => setAssignmentToRemove(null)}>Keep assignment</button><button className="job-cancel-action" type="button" disabled={isManagingAssignments} onClick={removeAssignment}>{isManagingAssignments ? 'Removing…' : 'Remove assignment'}</button></div></section></div>}
  </section>
}

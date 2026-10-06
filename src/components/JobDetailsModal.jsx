import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const formatDate = (value, fallback = '—') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

const formatLabel = (value, fallback) => (value || fallback).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function JobDetailsModal({ job, customerName, assignments, members, memberDisplay, assignmentError, isManagingAssignments, onAssign, onRequestRemove, statusError, isUpdatingStatus, onClose, onEdit, onStatusChange }) {
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('')
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const transitions = {
    new: ['scheduled', 'cancelled'],
    scheduled: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  }
  const nextStatuses = transitions[job.status] ?? []
  const canManageAssignments = ['new', 'scheduled', 'in_progress'].includes(job.status || 'new')
  const assignedUserIds = new Set(assignments.map((assignment) => assignment.user_id))
  const availableMembers = members.filter((member) => !assignedUserIds.has(member.user_id))
  const isBusy = isUpdatingStatus || isManagingAssignments

  useDialogFocus(dialogRef, { initialFocusRef: closeButtonRef })

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  return <div className="job-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="job-details-modal" role="dialog" aria-modal="true" aria-labelledby="job-details-title" tabIndex="-1">
      <div className="job-modal-header">
        <div><p className="eyebrow">Job details</p><h2 id="job-details-title">{job.title || 'Untitled job'}</h2><span className={`job-status job-status-${(job.status || 'new').replaceAll('_', '-')}`}>{formatLabel(job.status, 'New')}</span></div>
        <button ref={closeButtonRef} className="job-modal-close" type="button" onClick={onClose} disabled={isUpdatingStatus} aria-label="Close job details"><Icon name="close" size={19} /></button>
      </div>
      <div className="job-details-content">
        <dl className="job-details-grid">
          <div><dt>Customer</dt><dd>{customerName || '—'}</dd></div>
          <div><dt>Priority</dt><dd>{formatLabel(job.priority, 'Normal')}</dd></div>
          <div><dt>Scheduled start</dt><dd>{formatDate(job.scheduled_start, 'Not scheduled')}</dd></div>
          <div><dt>Scheduled end</dt><dd>{formatDate(job.scheduled_end, 'Not scheduled')}</dd></div>
          <div><dt>Created</dt><dd>{formatDate(job.created_at)}</dd></div>
          <div className="job-details-wide"><dt>Description</dt><dd>{job.description || '—'}</dd></div>
          <div className="job-details-wide"><dt>Notes</dt><dd>{job.notes || '—'}</dd></div>
        </dl>
        <section className="job-assignment-section" aria-labelledby="assigned-team-title">
          <h3 id="assigned-team-title">Assigned team</h3>
          {assignments.length === 0 ? <p>Unassigned</p> : <ul className="job-assignment-list">{assignments.map((assignment) => {
            const member = memberDisplay(assignment.member)
            return <li key={assignment.id}><div><strong>{member.name}</strong><span>{member.role}</span></div>{canManageAssignments && <button className="job-remove-assignment" type="button" disabled={isBusy} onClick={() => onRequestRemove(assignment)}>Remove</button>}</li>
          })}</ul>}
          {canManageAssignments ? <div className="job-assignment-controls"><label><span className="visually-hidden">Assign team member</span><select value={selectedMemberUserId} onChange={(event) => setSelectedMemberUserId(event.target.value)} disabled={isBusy || availableMembers.length === 0}><option value="">{availableMembers.length === 0 ? 'No additional team members' : 'Select team member'}</option>{availableMembers.map((member) => <option key={member.id} value={member.user_id}>{memberDisplay(member).name} · {memberDisplay(member).role}</option>)}</select></label><button className="secondary-action" type="button" disabled={isBusy || !selectedMemberUserId} onClick={() => { onAssign(selectedMemberUserId); setSelectedMemberUserId('') }}>{isManagingAssignments ? 'Assigning…' : 'Assign team member'}</button></div> : <p>Assignments are locked because this job is in a final status.</p>}
          {assignmentError && <p className="job-form-error" role="alert">{assignmentError}</p>}
        </section>
        <div className="job-status-workflow"><h3>Update status</h3>{nextStatuses.length > 0 ? <div className="job-status-actions">{nextStatuses.map((nextStatus) => <button key={nextStatus} className={nextStatus === 'cancelled' ? 'job-cancel-action' : 'secondary-action'} type="button" disabled={isBusy} onClick={() => onStatusChange(nextStatus)}>{formatLabel(nextStatus)}</button>)}</div> : <p>This job is in a final status.</p>}{statusError && <p className="job-form-error" role="alert">{statusError}</p>}</div>
      </div>
      <div className="job-modal-actions"><button className="secondary-action" type="button" onClick={onClose} disabled={isBusy}>Close</button><button className="primary-action" type="button" onClick={onEdit} disabled={isBusy}>Edit job</button></div>
    </section>
  </div>
}

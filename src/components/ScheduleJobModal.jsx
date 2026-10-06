import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const toLocalDateTimeInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ScheduleJobModal({ job, onClose, onSave }) {
  const isRescheduling = Boolean(toLocalDateTimeInput(job.scheduled_start))
  const [form, setForm] = useState(() => ({
    scheduled_start: toLocalDateTimeInput(job.scheduled_start),
    scheduled_end: toLocalDateTimeInput(job.scheduled_end),
  }))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const startInput = useRef(null)
  const dialogRef = useRef(null)

  useDialogFocus(dialogRef, { initialFocusRef: startInput })

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const start = new Date(form.scheduled_start)
    const end = form.scheduled_end ? new Date(form.scheduled_end) : null

    if (!form.scheduled_start || Number.isNaN(start.getTime())) {
      setError('Enter a valid scheduled start.')
      return
    }
    if (end && (Number.isNaN(end.getTime()) || end <= start)) {
      setError('Scheduled end must be later than the start time.')
      return
    }

    setError('')
    setIsSaving(true)
    const updatedJob = await onSave(form)
    setIsSaving(false)

    if (!updatedJob) {
      setError('Schedule couldn’t be updated. Please try again.')
      return
    }

    onClose()
  }

  return <div className="schedule-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-job-title" tabIndex="-1">
      <div className="schedule-modal-header">
        <div><p className="eyebrow">Schedule</p><h2 id="schedule-job-title">{isRescheduling ? 'Reschedule job' : 'Schedule job'}</h2><p>{job.title || 'Untitled job'}</p></div>
        <button className="schedule-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Close schedule form"><Icon name="close" size={19} /></button>
      </div>
      <form className="schedule-form" onSubmit={handleSubmit} noValidate>
        <label>Scheduled start <span aria-hidden="true">*</span><input ref={startInput} name="scheduled_start" type="datetime-local" value={form.scheduled_start} onChange={updateField} disabled={isSaving} required /></label>
        <label>Scheduled end <input name="scheduled_end" type="datetime-local" value={form.scheduled_end} onChange={updateField} disabled={isSaving} /></label>
        {error && <p className="schedule-form-error" role="alert">{error}</p>}
        <div className="schedule-modal-actions"><button className="secondary-action" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? 'Saving schedule…' : isRescheduling ? 'Save changes' : 'Save schedule'}</button></div>
      </form>
    </section>
  </div>
}

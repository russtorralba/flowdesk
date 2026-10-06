import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const initialForm = {
  customer_id: '',
  title: '',
  description: '',
  priority: 'normal',
  scheduled_start: '',
  scheduled_end: '',
  notes: '',
}

const toLocalDateTimeInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateJobModal({ customers, job, onClose, onCreate, onUpdate }) {
  const isEditing = Boolean(job)
  const [form, setForm] = useState(() => job ? {
    customer_id: job.customer_id ?? '',
    title: job.title ?? '',
    description: job.description ?? '',
    priority: job.priority ?? 'normal',
    scheduled_start: toLocalDateTimeInput(job.scheduled_start),
    scheduled_end: toLocalDateTimeInput(job.scheduled_end),
    notes: job.notes ?? '',
  } : initialForm)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const customerInput = useRef(null)
  const dialogRef = useRef(null)
  const hasActiveCustomers = customers.length > 0

  useDialogFocus(dialogRef, { initialFocusRef: customerInput })

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
    const values = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
    }

    if (!hasActiveCustomers || !values.customer_id) {
      setError(isEditing ? 'Select a customer before updating the job.' : 'Select an active customer before creating a job.')
      return
    }

    if (!values.title) {
      setError('Enter a job title.')
      return
    }

    if (values.scheduled_end && !values.scheduled_start) {
      setError('Add a scheduled start before the end time.')
      return
    }

    if (values.scheduled_start && values.scheduled_end && new Date(values.scheduled_end) <= new Date(values.scheduled_start)) {
      setError('Scheduled end must be later than the start time.')
      return
    }

    setError('')
    setIsSaving(true)
    const savedJob = await (isEditing ? onUpdate(values) : onCreate(values))
    setIsSaving(false)

    if (!savedJob) {
      setError(isEditing ? 'Job couldn’t be updated. Please try again.' : 'Job couldn’t be created. Please try again.')
      return
    }

    setForm(initialForm)
    onClose()
  }

  return <div className="job-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="job-modal" role="dialog" aria-modal="true" aria-labelledby="job-form-title" tabIndex="-1">
      <div className="job-modal-header">
        <div><p className="eyebrow">Jobs</p><h2 id="job-form-title">{isEditing ? 'Edit job' : 'Create job'}</h2><p>{isEditing ? 'Update the service details for this job.' : 'Set up the customer and essentials for a new service job.'}</p></div>
        <button className="job-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Close job form"><Icon name="close" size={19} /></button>
      </div>

      <form className="job-form" onSubmit={handleSubmit} noValidate>
        {!hasActiveCustomers && <p className="job-form-note" role="status">Add an active customer before creating a job.</p>}
        <div className="job-form-grid">
          <label className="job-form-wide">Customer <span aria-hidden="true">*</span><select ref={customerInput} name="customer_id" value={form.customer_id} onChange={updateField} disabled={!hasActiveCustomers || isSaving} required><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label className="job-form-wide">Job title <span aria-hidden="true">*</span><input name="title" value={form.title} onChange={updateField} disabled={isSaving} required /></label>
          <label className="job-form-wide">Description<textarea name="description" value={form.description} onChange={updateField} disabled={isSaving} rows="3" /></label>
          <label>Priority<select name="priority" value={form.priority} onChange={updateField} disabled={isSaving}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <div className="job-form-spacer" aria-hidden="true" />
          <label>Scheduled start<input name="scheduled_start" type="datetime-local" value={form.scheduled_start} onChange={updateField} disabled={isSaving} /></label>
          <label>Scheduled end<input name="scheduled_end" type="datetime-local" value={form.scheduled_end} onChange={updateField} disabled={isSaving} /></label>
          <label className="job-form-wide">Notes<textarea name="notes" value={form.notes} onChange={updateField} disabled={isSaving} rows="3" /></label>
        </div>

        {error && <p className="job-form-error" role="alert">{error}</p>}
        <div className="job-modal-actions"><button className="secondary-action" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-action" type="submit" disabled={isSaving || !hasActiveCustomers}>{isSaving ? (isEditing ? 'Saving changes…' : 'Creating job…') : (isEditing ? 'Save changes' : 'Create job')}</button></div>
      </form>
    </section>
  </div>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const toLocalDateInput = (value = new Date()) => {
  const pad = (number) => String(number).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

const parseMinorUnits = (value) => {
  const normalized = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

const formatMinorUnits = (value) => new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) / 100)

const blankItem = (id) => ({ id, description: '', quantity: '', unit_price: '' })

export function CreateInvoiceModal({ customers, jobs, onClose, onCreate }) {
  const nextItemId = useRef(2)
  const customerInput = useRef(null)
  const dialogRef = useRef(null)
  const [form, setForm] = useState(() => ({ customer_id: '', job_id: '', issue_date: toLocalDateInput(), due_date: '', tax: '0', notes: '' }))
  const [items, setItems] = useState(() => [blankItem(1)])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const completedJobs = useMemo(() => jobs.filter((job) => job.status === 'completed' && job.customer_id === form.customer_id), [form.customer_id, jobs])

  useDialogFocus(dialogRef, { initialFocusRef: customerInput })

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const updateForm = (event) => {
    const { name, value } = event.target
    setForm((current) => name === 'customer_id'
      ? { ...current, customer_id: value, job_id: '' }
      : { ...current, [name]: value })
  }
  const updateItem = (id, field, value) => setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  const addItem = () => setItems((current) => [...current, blankItem(nextItemId.current++)])
  const removeItem = (id) => setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current)

  const preview = useMemo(() => {
    const subtotal = items.reduce((total, item) => {
      const quantity = parseMinorUnits(item.quantity)
      const unitPrice = parseMinorUnits(item.unit_price)
      return quantity === null || unitPrice === null ? total : total + ((quantity * unitPrice + 50n) / 100n)
    }, 0n)
    const tax = parseMinorUnits(form.tax)
    return { subtotal, tax: tax ?? 0n, total: subtotal + (tax ?? 0n) }
  }, [form.tax, items])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const tax = parseMinorUnits(form.tax)
    const normalizedItems = items.map((item) => ({
      description: item.description.trim(),
      quantity: parseMinorUnits(item.quantity),
      unit_price: parseMinorUnits(item.unit_price),
    }))

    if (!form.customer_id) {
      setError('Select a customer before creating the invoice.')
      return
    }
    if (!form.issue_date) {
      setError('Enter an issue date.')
      return
    }
    if (form.due_date && form.due_date < form.issue_date) {
      setError('Due date cannot be before the issue date.')
      return
    }
    if (tax === null) {
      setError('Enter a valid tax amount.')
      return
    }
    if (normalizedItems.some((item) => !item.description || item.quantity === null || item.quantity <= 0n || item.unit_price === null)) {
      setError('Add a description, quantity greater than zero, and unit price for every item.')
      return
    }

    setError('')
    setIsSaving(true)
    const createdInvoice = await onCreate({
      customer_id: form.customer_id,
      job_id: form.job_id,
      issue_date: form.issue_date,
      due_date: form.due_date,
      tax: Number(form.tax),
      notes: form.notes.trim(),
      items: normalizedItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) / 100,
        unit_price: Number(item.unit_price) / 100,
      })),
    })
    setIsSaving(false)

    if (!createdInvoice) {
      setError('Invoice couldn’t be created. Please try again.')
      return
    }

    onClose()
  }

  return <div className="invoice-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="create-invoice-modal" role="dialog" aria-modal="true" aria-labelledby="create-invoice-title" tabIndex="-1">
      <div className="invoice-modal-header">
        <div><p className="eyebrow">Invoices</p><h2 id="create-invoice-title">Create invoice</h2><p>Prepare a draft billing record for a customer.</p></div>
        <button className="invoice-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Close create invoice form"><Icon name="close" size={19} /></button>
      </div>
      <form className="create-invoice-form" onSubmit={handleSubmit} noValidate>
        {customers.length === 0 && <p className="invoice-form-note" role="status">Add an active customer before creating an invoice.</p>}
        <div className="create-invoice-grid">
          <label>Customer <span aria-hidden="true">*</span><select ref={customerInput} name="customer_id" value={form.customer_id} onChange={updateForm} disabled={isSaving || customers.length === 0} required><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Linked completed job<select name="job_id" value={form.job_id} onChange={updateForm} disabled={isSaving || !form.customer_id}><option value="">No linked job</option>{completedJobs.map((job) => <option key={job.id} value={job.id}>{job.title || 'Untitled job'}</option>)}</select></label>
          <label>Issue date <span aria-hidden="true">*</span><input name="issue_date" type="date" value={form.issue_date} onChange={updateForm} disabled={isSaving} required /></label>
          <label>Due date<input name="due_date" type="date" value={form.due_date} onChange={updateForm} disabled={isSaving} min={form.issue_date || undefined} /></label>
        </div>

        <section className="invoice-editor-items" aria-labelledby="invoice-items-editor-title"><div className="invoice-editor-heading"><div><p className="eyebrow">Line items</p><h3 id="invoice-items-editor-title">Invoice items</h3></div><button className="invoice-add-item" type="button" onClick={addItem} disabled={isSaving}>+ Add item</button></div><div className="invoice-item-editor-list">{items.map((item, index) => <div className="invoice-item-editor" key={item.id}><label>Description <input value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} disabled={isSaving} /></label><label>Quantity <input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', event.target.value)} disabled={isSaving} /></label><label>Unit price <input inputMode="decimal" value={item.unit_price} onChange={(event) => updateItem(item.id, 'unit_price', event.target.value)} disabled={isSaving} /></label><button className="invoice-remove-item" type="button" onClick={() => removeItem(item.id)} disabled={isSaving || items.length === 1} aria-label={`Remove item ${index + 1}`}>Remove</button></div>)}</div></section>

        <div className="create-invoice-grid create-invoice-summary-fields"><label>Tax amount<input name="tax" inputMode="decimal" value={form.tax} onChange={updateForm} disabled={isSaving} /></label><label className="create-invoice-notes">Notes<textarea name="notes" value={form.notes} onChange={updateForm} disabled={isSaving} rows="3" /></label></div>
        <section className="invoice-preview" aria-label="Invoice total preview"><div><span>Subtotal</span><strong>{formatMinorUnits(preview.subtotal)}</strong></div><div><span>Tax</span><strong>{formatMinorUnits(preview.tax)}</strong></div><div><span>Total</span><strong>{formatMinorUnits(preview.total)}</strong></div></section>
        {error && <p className="invoice-form-error" role="alert">{error}</p>}
        <div className="invoice-modal-actions"><button className="secondary-action" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-action" type="submit" disabled={isSaving || customers.length === 0}>{isSaving ? 'Creating invoice…' : 'Create invoice'}</button></div>
      </form>
    </section>
  </div>
}

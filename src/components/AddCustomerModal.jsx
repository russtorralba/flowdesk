import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const initialForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_region: '',
  postal_code: '',
  country: '',
  notes: '',
}

export function AddCustomerModal({ customer, onClose, onCreate, onUpdate }) {
  const isEditing = Boolean(customer)
  const [form, setForm] = useState(() => customer ? Object.fromEntries(Object.keys(initialForm).map((key) => [key, customer[key] ?? ''])) : initialForm)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const firstNameInput = useRef(null)
  const dialogRef = useRef(null)

  useDialogFocus(dialogRef, { initialFocusRef: firstNameInput })

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
    const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))

    if (!values.first_name) {
      setError('Enter a first name.')
      return
    }

    if (!values.last_name) {
      setError('Enter a last name.')
      return
    }

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('Enter a valid email address.')
      return
    }

    setError('')
    setIsSaving(true)
    const savedCustomer = await (isEditing ? onUpdate(values) : onCreate(values))
    setIsSaving(false)

    if (!savedCustomer) {
      setError(isEditing ? 'Customer couldn’t be updated. Please try again.' : 'Customer couldn’t be added. Please try again.')
      return
    }

    setForm(initialForm)
    onClose()
  }

  return <div className="customer-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title" tabIndex="-1">
      <div className="customer-modal-header">
        <div>
          <p className="eyebrow">Customers</p>
          <h2 id="customer-form-title">{isEditing ? 'Edit customer' : 'Add customer'}</h2>
          <p>{isEditing ? 'Update this customer’s contact and service details.' : 'Save the essential details for a new customer.'}</p>
        </div>
        <button className="customer-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Close customer form"><Icon name="close" size={19} /></button>
      </div>

      <form className="customer-form" onSubmit={handleSubmit} noValidate>
        <div className="customer-form-grid">
          <label>First name <span aria-hidden="true">*</span><input ref={firstNameInput} name="first_name" value={form.first_name} onChange={updateField} autoComplete="given-name" required /></label>
          <label>Last name <span aria-hidden="true">*</span><input name="last_name" value={form.last_name} onChange={updateField} autoComplete="family-name" required /></label>
          <label>Email<input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" /></label>
          <label>Phone<input name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" /></label>
          <label className="customer-form-wide">Address line 1<input name="address_line1" value={form.address_line1} onChange={updateField} autoComplete="address-line1" /></label>
          <label className="customer-form-wide">Address line 2<input name="address_line2" value={form.address_line2} onChange={updateField} autoComplete="address-line2" /></label>
          <label>City<input name="city" value={form.city} onChange={updateField} autoComplete="address-level2" /></label>
          <label>State / Region<input name="state_region" value={form.state_region} onChange={updateField} autoComplete="address-level1" /></label>
          <label>Postal code<input name="postal_code" value={form.postal_code} onChange={updateField} autoComplete="postal-code" /></label>
          <label>Country<input name="country" value={form.country} onChange={updateField} autoComplete="country-name" /></label>
          <label className="customer-form-wide">Notes<textarea name="notes" value={form.notes} onChange={updateField} rows="3" /></label>
        </div>

        {error && <p className="customer-form-error" role="alert">{error}</p>}

        <div className="customer-modal-actions">
          <button className="secondary-action" type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? (isEditing ? 'Saving changes…' : 'Adding customer…') : (isEditing ? 'Save changes' : 'Add customer')}</button>
        </div>
      </form>
    </section>
  </div>
}

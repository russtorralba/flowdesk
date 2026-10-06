import { useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import '../styles/settings.css'

const workspaceProfileFields = 'id, name, business_email, business_phone, address_line1, address_line2, city, state_region, postal_code, country'
const editableFields = ['name', 'business_email', 'business_phone', 'address_line1', 'address_line2', 'city', 'state_region', 'postal_code', 'country']

const toFormValues = (workspace) => Object.fromEntries(editableFields.map((field) => [field, workspace?.[field] || '']))

export function SettingsPage({ workspaceProfile, workspaceRole, workspaceStatus, onWorkspaceProfileUpdated }) {
  const [form, setForm] = useState(() => toFormValues(workspaceProfile))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const canEdit = workspaceRole === 'owner' || workspaceRole === 'admin'

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canEdit || !workspaceProfile?.id || isSaving) return

    const name = form.name.trim()
    const email = form.business_email.trim()
    if (!name) {
      setError('Enter a business name.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid business email address.')
      return
    }

    const values = Object.fromEntries(editableFields.map((field) => [field, field === 'name' ? name : form[field].trim() || null]))
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const { data, error: updateError } = await neon
        .from('workspaces')
        .update(values)
        .eq('id', workspaceProfile.id)
        .select(workspaceProfileFields)
        .single()

      if (updateError || !data || data.id !== workspaceProfile.id) {
        setError('Business profile couldn’t be updated. Please try again.')
        return
      }

      onWorkspaceProfileUpdated(data)
      setForm(toFormValues(data))
      setSuccess('Business profile updated.')
    } catch {
      setError('Business profile couldn’t be updated. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (workspaceStatus === 'loading') return <section className="workspace-content settings-page"><div className="settings-state" aria-busy="true" aria-live="polite"><span className="settings-loading-indicator" aria-hidden="true" /><p>Loading business profile</p></div></section>
  if (workspaceStatus === 'error' || !workspaceProfile) return <section className="workspace-content settings-page"><div className="settings-state settings-error" role="alert"><span className="welcome-icon"><Icon name="settings" size={23} /></span><h3>Settings couldn’t be loaded</h3><p>Please try again in a moment.</p></div></section>

  return <section className="workspace-content settings-page">
    <div className="settings-page-header"><div><p className="eyebrow">Settings</p><h2>Business profile</h2><p>Manage the business information used across your FlowDesk workspace.</p></div></div>
    <section className="settings-profile-card" aria-labelledby="business-profile-title">
      <div className="settings-card-heading"><div><p className="eyebrow">Workspace</p><h3 id="business-profile-title">Business details</h3><p>Keep your workspace identity accurate and up to date.</p></div>{!canEdit && <span className="settings-readonly-badge">Read only</span>}</div>
      {!canEdit && <p className="settings-permission-note">Only workspace owners and admins can update business settings.</p>}
      <form className="settings-profile-form" onSubmit={handleSubmit} noValidate>
        <div className="settings-form-grid">
          <label className="settings-form-wide">Business name <span aria-hidden="true">*</span><input name="name" value={form.name} onChange={updateField} disabled={!canEdit || isSaving} required /></label>
          <label>Business email<input name="business_email" type="email" value={form.business_email} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="email" /></label>
          <label>Business phone<input name="business_phone" type="tel" value={form.business_phone} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="tel" /></label>
          <label className="settings-form-wide">Address line 1<input name="address_line1" value={form.address_line1} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="address-line1" /></label>
          <label className="settings-form-wide">Address line 2<input name="address_line2" value={form.address_line2} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="address-line2" /></label>
          <label>City<input name="city" value={form.city} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="address-level2" /></label>
          <label>State / Region<input name="state_region" value={form.state_region} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="address-level1" /></label>
          <label>Postal code<input name="postal_code" value={form.postal_code} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="postal-code" /></label>
          <label>Country<input name="country" value={form.country} onChange={updateField} disabled={!canEdit || isSaving} autoComplete="country-name" /></label>
        </div>
        {error && <p className="settings-form-error" role="alert">{error}</p>}
        {success && <p className="settings-success" role="status">{success}</p>}
        {canEdit && <div className="settings-form-actions"><button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? 'Saving changes…' : 'Save changes'}</button></div>}
      </form>
    </section>
  </section>
}

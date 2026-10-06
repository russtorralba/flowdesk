import { useEffect, useRef, useState } from 'react'
import { neon } from '../lib/neon.js'
import { AddCustomerModal } from './AddCustomerModal.jsx'
import { Icon } from './Icon.jsx'
import { useDialogFocus } from '../hooks/useDialogFocus.js'
import '../styles/customers.css'

export function CustomersPage({ user }) {
  const [customers, setCustomers] = useState([])
  const [status, setStatus] = useState('loading')
  const [workspaceId, setWorkspaceId] = useState(null)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState(null)
  const [customerToArchive, setCustomerToArchive] = useState(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const userId = user?.id
  const archiveDialogRef = useRef(null)

  useDialogFocus(archiveDialogRef, { active: Boolean(customerToArchive) })

  useEffect(() => {
    let isCurrent = true

    const loadCustomers = async () => {
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

        const { data, error } = await neon
          .from('customers')
          .select('id, workspace_id, first_name, last_name, email, phone, address_line1, address_line2, city, state_region, postal_code, country, notes, status, created_at, updated_at')
          .eq('workspace_id', membership.workspace_id)
          .order('created_at', { ascending: false })

        if (!isCurrent) return
        if (error) {
          setStatus('error')
          return
        }

        setCustomers(data ?? [])
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadCustomers()
    return () => { isCurrent = false }
  }, [userId])

  const isEmpty = status === 'ready' && customers.length === 0
  const visibleCustomers = customers.filter((customer) => {
    const matchesFilter = filter === 'all' || (customer.status || 'active') === filter
    const searchText = [customer.first_name, customer.last_name, customer.email, customer.phone, customer.city, customer.state_region].filter(Boolean).join(' ').toLowerCase()
    return matchesFilter && searchText.includes(search.trim().toLowerCase())
  })

  const createCustomer = async (values) => {
    if (!workspaceId) return null

    const optionalValues = Object.fromEntries(Object.entries(values).filter(([, value]) => value))
    try {
      const { data, error } = await neon
        .from('customers')
        .insert({
          workspace_id: workspaceId,
          ...optionalValues,
          status: 'active',
        })
        .select('id, workspace_id, first_name, last_name, email, phone, address_line1, address_line2, city, state_region, postal_code, country, notes, status, created_at, updated_at')
        .single()

      if (error || !data) return null

      setCustomers((current) => [data, ...current])
      setStatus('ready')
      setSuccessMessage('Customer added.')
      return data
    } catch {
      return null
    }
  }

  const updateCustomer = async (values) => {
    if (!workspaceId || !customerToEdit) return null

    try {
      const { data, error } = await neon
        .from('customers')
        .update(values)
        .eq('id', customerToEdit.id)
        .eq('workspace_id', workspaceId)
        .select('id, workspace_id, first_name, last_name, email, phone, address_line1, address_line2, city, state_region, postal_code, country, notes, status, created_at, updated_at')
        .single()

      if (error || !data) return null

      setCustomers((current) => current.map((customer) => customer.id === data.id ? data : customer))
      setSuccessMessage('Customer updated.')
      return data
    } catch {
      return null
    }
  }

  const archiveCustomer = async () => {
    if (!workspaceId || !customerToArchive) return

    setIsArchiving(true)
    setArchiveError(false)
    try {
      const { data, error } = await neon
        .from('customers')
        .update({ status: 'archived' })
        .eq('id', customerToArchive.id)
        .eq('workspace_id', workspaceId)
        .select('id, workspace_id, first_name, last_name, email, phone, address_line1, address_line2, city, state_region, postal_code, country, notes, status, created_at, updated_at')
        .single()

      if (error || !data) {
        setArchiveError(true)
        return
      }

      setCustomers((current) => current.map((customer) => customer.id === data.id ? data : customer))
      setCustomerToArchive(null)
      setSuccessMessage('Customer archived.')
    } catch {
      setArchiveError(true)
    } finally {
      setIsArchiving(false)
    }
  }

  return <section className="workspace-content customers-page">
    <div className="customers-page-header">
      <div><p className="eyebrow">Customers</p><h2>Customer directory</h2><p>Keep every customer relationship and service detail in one place.</p></div>
      <button className="primary-action customers-add-button" type="button" onClick={() => setIsAddCustomerOpen(true)} disabled={status !== 'ready' || !workspaceId}><Icon name="plus" size={17} />Add customer</button>
    </div>

    {successMessage && <p className="customers-success" role="status">{successMessage}</p>}

    {status === 'ready' && customers.length > 0 && <div className="customer-directory-controls">
      <label className="customer-search"><span className="visually-hidden">Search customers</span><Icon name="search" size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" /></label>
      <label className="customer-filter"><span className="visually-hidden">Filter customers</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
    </div>}

    {status === 'loading' && <div className="customers-state" aria-busy="true" aria-live="polite"><span className="customers-loading-indicator" aria-hidden="true" /><p>Loading customers</p></div>}
    {status === 'error' && <div className="customers-state customers-error" role="alert"><span className="welcome-icon"><Icon name="users" size={23} /></span><h3>Customers couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}
    {isEmpty && <div className="customers-state customers-empty"><span className="welcome-icon"><Icon name="users" size={23} /></span><h3>No customers yet</h3><p>Add your first customer to start organizing jobs, invoices, and service history.</p></div>}
    {status === 'ready' && customers.length > 0 && visibleCustomers.length === 0 && <div className="customers-state customers-no-results"><h3>No matching customers</h3><p>Try another search or filter to find the customer you need.</p></div>}
    {status === 'ready' && visibleCustomers.length > 0 && <div className="customers-list"><div className="customer-row customer-row-heading" aria-hidden="true"><span>Customer</span><span>Email</span><span>Phone</span><span>Location</span><span>Status</span><span>Actions</span></div>{visibleCustomers.map((customer) => <article className="customer-row" key={customer.id}><div className="customer-primary"><div className="customer-avatar">{`${customer.first_name?.[0] ?? ''}${customer.last_name?.[0] ?? ''}` || '?'}</div><strong>{[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unnamed customer'}</strong></div><div className="customer-email">{customer.email || '—'}</div><div className="customer-phone">{customer.phone || '—'}</div><div className="customer-location">{[customer.city, customer.state_region].filter(Boolean).join(', ') || 'No location'}</div><span className={`customer-status customer-status-${(customer.status || 'active').replaceAll('_', '-')}`}>{customer.status || 'active'}</span><div className="customer-actions"><button type="button" onClick={() => setCustomerToEdit(customer)}>Edit</button>{(customer.status || 'active') === 'active' && <button type="button" className="customer-archive-action" onClick={() => { setArchiveError(false); setCustomerToArchive(customer) }}>Archive</button>}</div></article>)}</div>}
    {isAddCustomerOpen && <AddCustomerModal onClose={() => setIsAddCustomerOpen(false)} onCreate={createCustomer} />}
    {customerToEdit && <AddCustomerModal customer={customerToEdit} onClose={() => setCustomerToEdit(null)} onCreate={createCustomer} onUpdate={updateCustomer} />}
    {customerToArchive && <div className="customer-modal-backdrop" role="presentation"><section ref={archiveDialogRef} className="customer-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="archive-customer-title" tabIndex="-1"><h2 id="archive-customer-title">Archive {[customerToArchive.first_name, customerToArchive.last_name].filter(Boolean).join(' ') || 'customer'}?</h2><p>Archived customers remain in FlowDesk but won’t appear in the active customer list.</p>{archiveError && <p className="customer-form-error" role="alert">Unable to archive customer. Please try again.</p>}<div className="customer-modal-actions"><button className="secondary-action" type="button" onClick={() => setCustomerToArchive(null)} disabled={isArchiving}>Cancel</button><button className="archive-confirmation-action" type="button" onClick={archiveCustomer} disabled={isArchiving}>{isArchiving ? 'Archiving…' : 'Archive customer'}</button></div></section></div>}
  </section>
}

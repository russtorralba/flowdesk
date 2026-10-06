import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { CreateInvoiceModal } from './CreateInvoiceModal.jsx'
import { InvoiceDetailsModal } from './InvoiceDetailsModal.jsx'
import { neon } from '../lib/neon.js'
import { getInvoiceEffectiveStatus, getLocalDate, getPaymentTotalsByInvoice } from '../lib/invoiceCalculations.js'
import '../styles/invoices.css'

const invoiceFields = 'id, workspace_id, customer_id, job_id, invoice_number, status, issue_date, due_date, subtotal, tax_amount, total_amount, notes, created_at, updated_at'
const customerFields = 'id, first_name, last_name, status'
const jobFields = 'id, customer_id, title, status'
const paymentTotalFields = 'invoice_id, amount'

const formatAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) : '—'
}

const formatDate = (value) => {
  if (!value || typeof value !== 'string') return '—'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const formatLabel = (value, fallback) => (value || fallback).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatToken = (value, fallback) => (value || fallback).toLowerCase().replaceAll('_', '-')

export function InvoicesPage({ user }) {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [jobs, setJobs] = useState([])
  const [workspaceId, setWorkspaceId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [filter, setFilter] = useState('all')
  const [invoiceToView, setInvoiceToView] = useState(null)
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [paidAmountsByInvoice, setPaidAmountsByInvoice] = useState({})
  const [hasPaymentTotals, setHasPaymentTotals] = useState(false)
  const userId = user?.id

  useEffect(() => {
    let isCurrent = true

    const loadInvoices = async () => {
      if (!userId) return

      setStatus('loading')
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

        const resolvedWorkspaceId = membership.workspace_id
        const [invoicesResult, customersResult, jobsResult, paymentTotalsResult] = await Promise.all([
          neon.from('invoices').select(invoiceFields).eq('workspace_id', resolvedWorkspaceId).order('created_at', { ascending: false }),
          neon.from('customers').select(customerFields).eq('workspace_id', resolvedWorkspaceId),
          neon.from('jobs').select(jobFields).eq('workspace_id', resolvedWorkspaceId),
          neon.from('payments').select(paymentTotalFields).eq('workspace_id', resolvedWorkspaceId),
        ])

        if (invoicesResult.error || customersResult.error || jobsResult.error) {
          if (isCurrent) setStatus('error')
          return
        }

        if (!isCurrent) return
        const loadedInvoices = invoicesResult.data ?? []
        const loadedPaidAmounts = paymentTotalsResult.error ? {} : getPaymentTotalsByInvoice(paymentTotalsResult.data ?? [])
        setInvoices(loadedInvoices)
        setInvoiceToView((current) => current ? loadedInvoices.find((invoice) => invoice.id === current.id && invoice.workspace_id === resolvedWorkspaceId) ?? current : current)
        setCustomers(customersResult.data ?? [])
        setJobs(jobsResult.data ?? [])
        setPaidAmountsByInvoice(loadedPaidAmounts)
        setHasPaymentTotals(!paymentTotalsResult.error)
        setWorkspaceId(resolvedWorkspaceId)
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadInvoices()
    return () => { isCurrent = false }
  }, [refreshKey, userId])

  const customerNames = useMemo(() => Object.fromEntries(customers.map((customer) => [customer.id, [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer unavailable'])), [customers])
  const jobNames = useMemo(() => Object.fromEntries(jobs.map((job) => [job.id, job.title || 'Linked job unavailable'])), [jobs])
  const todayLocal = getLocalDate()
  const getEffectiveStatus = (invoice) => hasPaymentTotals ? getInvoiceEffectiveStatus(invoice, paidAmountsByInvoice[invoice.id] ?? 0n, todayLocal) : (invoice.status || 'draft')
  const visibleInvoices = invoices.filter((invoice) => filter === 'all' || getEffectiveStatus(invoice) === filter)
  const openInvoiceDetails = (invoice) => {
    const verifiedInvoice = invoices.find((current) => current.id === invoice.id && current.workspace_id === workspaceId)
    if (verifiedInvoice) setInvoiceToView(verifiedInvoice)
  }
  const isEmpty = status === 'ready' && invoices.length === 0
  const activeCustomers = customers.filter((customer) => customer.status === 'active').map((customer) => ({ id: customer.id, name: customerNames[customer.id] }))

  const createInvoice = async (values) => {
    if (!workspaceId) return null
    const selectedCustomer = customers.find((customer) => customer.id === values.customer_id && customer.status === 'active')
    const selectedJob = values.job_id ? jobs.find((job) => job.id === values.job_id && job.customer_id === values.customer_id && job.status === 'completed') : null
    if (!selectedCustomer || (values.job_id && !selectedJob)) return null

    try {
      const { data, error } = await neon.rpc('create_invoice', {
        p_workspace_id: workspaceId,
        p_customer_id: values.customer_id,
        p_job_id: values.job_id || null,
        p_issue_date: values.issue_date,
        p_due_date: values.due_date || null,
        p_tax: values.tax,
        p_notes: values.notes || null,
        p_items: values.items,
      })

      if (error) {
        return null
      }

      if (!data) return null

      setIsCreateInvoiceOpen(false)
      setSuccessMessage('Invoice created.')
      setRefreshKey((current) => current + 1)
      return data
    } catch {
      return null
    }
  }

  const markInvoiceSent = async (invoiceId) => {
    if (!workspaceId) return false
    const currentInvoice = invoices.find((invoice) => invoice.id === invoiceId && invoice.workspace_id === workspaceId && invoice.status === 'draft')
    if (!currentInvoice) return false

    try {
      const { error } = await neon.rpc('mark_invoice_sent', {
        p_workspace_id: workspaceId,
        p_invoice_id: invoiceId,
      })

      if (error) return false

      const updatedInvoice = { ...currentInvoice, status: 'sent' }
      setInvoices((current) => current.map((invoice) => invoice.id === invoiceId && invoice.workspace_id === workspaceId ? updatedInvoice : invoice))
      setInvoiceToView((current) => current?.id === invoiceId && current.workspace_id === workspaceId ? updatedInvoice : current)
      setSuccessMessage('Invoice marked as sent.')
      setRefreshKey((current) => current + 1)
      return true
    } catch {
      return false
    }
  }

  const recordInvoicePayment = async (invoiceId, { amount, paymentMethod, paymentDate, referenceNumber, notes }) => {
    if (!workspaceId) return false
    const currentInvoice = invoices.find((invoice) => invoice.id === invoiceId && invoice.workspace_id === workspaceId && invoice.status === 'sent')
    if (!currentInvoice) return false

    try {
      const { data, error } = await neon.rpc('record_invoice_payment', {
        p_workspace_id: workspaceId,
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_date: paymentDate,
        p_reference_number: referenceNumber.trim() || null,
        p_notes: notes.trim() || null,
      })

      if (error) {
        return false
      }

      if (!data) return false

      setSuccessMessage('Payment recorded.')
      setRefreshKey((current) => current + 1)
      return true
    } catch {
      return false
    }
  }

  const cancelInvoice = async (invoiceId) => {
    if (!workspaceId) return false
    const currentInvoice = invoices.find((invoice) => invoice.id === invoiceId && invoice.workspace_id === workspaceId && (invoice.status === 'draft' || invoice.status === 'sent'))
    if (!currentInvoice) return false

    try {
      const { error } = await neon.rpc('cancel_invoice', {
        p_workspace_id: workspaceId,
        p_invoice_id: invoiceId,
      })

      if (error) {
        return false
      }

      setSuccessMessage('Invoice cancelled.')
      setRefreshKey((current) => current + 1)
      return true
    } catch {
      return false
    }
  }

  return <section className="workspace-content invoices-page">
    <div className="invoices-page-header"><div><p className="eyebrow">Invoices</p><h2>Invoices</h2><p>Track billing, due dates, and payment status in one place.</p></div><button className="primary-action invoices-create-button" type="button" onClick={() => setIsCreateInvoiceOpen(true)} disabled={status !== 'ready' || !workspaceId}><Icon name="plus" size={17} />Create invoice</button></div>
    {successMessage && <p className="invoices-success" role="status">{successMessage}</p>}
    {status === 'loading' && <div className="invoices-state" aria-busy="true" aria-live="polite"><span className="invoices-loading-indicator" aria-hidden="true" /><p>Loading invoices</p></div>}
    {status === 'error' && <div className="invoices-state invoices-error" role="alert"><span className="welcome-icon"><Icon name="receipt" size={23} /></span><h3>Invoices couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}
    {isEmpty && <div className="invoices-state invoices-empty"><span className="welcome-icon"><Icon name="receipt" size={23} /></span><h3>No invoices yet</h3><p>Invoices will appear here as billing records are created for your workspace.</p></div>}
    {status === 'ready' && invoices.length > 0 && <div className="invoice-directory-controls"><label className="invoice-filter"><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Invoice status filter"><option value="all">All</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option></select></label></div>}
    {status === 'ready' && invoices.length > 0 && visibleInvoices.length === 0 && <div className="invoices-state invoices-no-results"><h3>No invoices match this filter</h3><p>Try another invoice status to find the billing record you need.</p></div>}
    {status === 'ready' && visibleInvoices.length > 0 && <div className="invoices-list"><div className="invoice-row invoice-row-heading" aria-hidden="true"><span>Invoice</span><span>Customer</span><span>Issued</span><span>Due</span><span>Total</span><span>Status</span><span>Actions</span></div>{visibleInvoices.map((invoice) => { const effectiveStatus = getEffectiveStatus(invoice); return <article className="invoice-row" key={invoice.id}><strong className="invoice-number">{invoice.invoice_number || 'Invoice unavailable'}</strong><span className="invoice-customer">{customerNames[invoice.customer_id] || 'Customer unavailable'}</span><span className="invoice-date invoice-issue-date">{formatDate(invoice.issue_date)}</span><span className="invoice-date invoice-due-date">{formatDate(invoice.due_date)}</span><strong className="invoice-total">{formatAmount(invoice.total_amount)}</strong><span className={`invoice-status invoice-status-${formatToken(effectiveStatus, 'draft')}`}>{formatLabel(effectiveStatus, 'Draft')}</span><button className="invoice-view-action" type="button" onClick={() => openInvoiceDetails(invoice)}>View</button></article>})}</div>}
    {isCreateInvoiceOpen && <CreateInvoiceModal customers={activeCustomers} jobs={jobs} onClose={() => setIsCreateInvoiceOpen(false)} onCreate={createInvoice} />}
    {invoiceToView && <InvoiceDetailsModal invoice={invoiceToView} effectiveStatus={getEffectiveStatus(invoiceToView)} workspaceId={workspaceId} customerName={customerNames[invoiceToView.customer_id]} jobName={jobNames[invoiceToView.job_id]} onMarkAsSent={markInvoiceSent} onRecordPayment={recordInvoicePayment} onCancelInvoice={cancelInvoice} onClose={() => setInvoiceToView(null)} />}
  </section>
}

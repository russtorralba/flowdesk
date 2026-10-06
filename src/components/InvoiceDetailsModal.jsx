import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import { getLocalDate, getOutstandingBalance, toMinorUnits } from '../lib/invoiceCalculations.js'
import { useDialogFocus } from '../hooks/useDialogFocus.js'

const itemFields = 'id, invoice_id, description, quantity, unit_price, created_at'
const paymentFields = 'id, workspace_id, invoice_id, amount, payment_method, payment_date, reference_number, notes, created_at'

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

const formatMinorUnits = (value) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) / 100)
const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
]

const createPaymentForm = () => ({ amount: '', paymentMethod: 'cash', paymentDate: getLocalDate(), referenceNumber: '', notes: '' })

export function InvoiceDetailsModal({ invoice, effectiveStatus, workspaceId, customerName, jobName, onMarkAsSent, onRecordPayment, onCancelInvoice, onClose }) {
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [status, setStatus] = useState('loading')
  const [isConfirmingSent, setIsConfirmingSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState(createPaymentForm)
  const [paymentError, setPaymentError] = useState('')
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [isCancellationRefreshPending, setIsCancellationRefreshPending] = useState(false)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const sentConfirmationRef = useRef(null)
  const cancelConfirmationRef = useRef(null)

  useDialogFocus(dialogRef, { initialFocusRef: closeButtonRef })
  useDialogFocus(sentConfirmationRef, { active: isConfirmingSent })
  useDialogFocus(cancelConfirmationRef, { active: isConfirmingCancel })

  useEffect(() => {
    let isCurrent = true

    const loadInvoiceDetails = async () => {
      if (!invoice?.id || !workspaceId || invoice.workspace_id !== workspaceId) {
        if (isCurrent) setStatus('error')
        return
      }

      setStatus('loading')
      try {
        const [itemsResult, paymentsResult] = await Promise.all([
          neon.from('invoice_items').select(itemFields).eq('invoice_id', invoice.id),
          neon.from('payments').select(paymentFields).eq('workspace_id', workspaceId).eq('invoice_id', invoice.id),
        ])

        if (itemsResult.error || paymentsResult.error) {
          if (isCurrent) setStatus('error')
          return
        }

        if (!isCurrent) return
        setItems(itemsResult.data ?? [])
        setPayments(paymentsResult.data ?? [])
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadInvoiceDetails()
    return () => { isCurrent = false }
  }, [invoice?.id, invoice?.workspace_id, paymentRefreshKey, workspaceId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSending && !isRecordingPayment && !isCancelling) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCancelling, isRecordingPayment, isSending, onClose])

  const paymentSummary = useMemo(() => {
    const total = toMinorUnits(invoice.total_amount) ?? 0n
    const alreadyPaid = payments.reduce((sum, payment) => sum + (toMinorUnits(payment.amount) ?? 0n), 0n)
    return { total, alreadyPaid, outstanding: getOutstandingBalance(total, alreadyPaid) }
  }, [invoice.total_amount, payments])
  const displayStatus = effectiveStatus || invoice.status || 'draft'
  const canCancelInvoice = (invoice.status === 'draft' || invoice.status === 'sent') && displayStatus !== 'overdue'

  const handleMarkAsSent = async () => {
    if (isSending || invoice.status !== 'draft') return

    setIsSending(true)
    setSendError('')
    const succeeded = await onMarkAsSent(invoice.id)
    if (!succeeded) setSendError('Invoice couldn’t be marked as sent. Please try again.')
    if (succeeded) setIsConfirmingSent(false)
    setIsSending(false)
  }

  const closePaymentForm = () => {
    if (isRecordingPayment) return
    setIsPaymentFormOpen(false)
    setPaymentError('')
    setPaymentForm(createPaymentForm())
  }

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()
    if (isRecordingPayment || invoice.status !== 'sent') return

    const amountMinorUnits = toMinorUnits(paymentForm.amount)
    if (!amountMinorUnits || amountMinorUnits <= 0n) {
      setPaymentError('Enter a payment amount greater than 0.')
      return
    }
    if (amountMinorUnits > paymentSummary.outstanding) {
      setPaymentError('Payment amount can’t exceed the outstanding balance.')
      return
    }
    if (!paymentMethods.some((method) => method.value === paymentForm.paymentMethod) || !paymentForm.paymentDate) {
      setPaymentError('Complete the required payment details.')
      return
    }

    setIsRecordingPayment(true)
    setPaymentError('')
    const succeeded = await onRecordPayment(invoice.id, paymentForm)
    if (!succeeded) {
      setPaymentError('Payment couldn’t be recorded. Please try again.')
      setIsRecordingPayment(false)
      return
    }

    setPaymentRefreshKey((current) => current + 1)
    setIsPaymentFormOpen(false)
    setPaymentForm(createPaymentForm())
    setIsRecordingPayment(false)
  }

  const handleCancelInvoice = async () => {
    if (isCancelling || !canCancelInvoice) return

    setIsCancelling(true)
    setCancelError('')
    const succeeded = await onCancelInvoice(invoice.id)
    if (!succeeded) {
      setCancelError("Invoice couldn't be cancelled. Please try again.")
    } else {
      setIsConfirmingCancel(false)
      setIsCancellationRefreshPending(true)
    }
    setIsCancelling(false)
  }

  return <div className="invoice-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="invoice-details-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-details-title" tabIndex="-1">
      <div className="invoice-modal-header">
        <div><p className="eyebrow">Invoice details</p><h2 id="invoice-details-title">{invoice.invoice_number || 'Invoice'}</h2><span className={`invoice-status invoice-status-${formatToken(displayStatus, 'draft')}`}>{formatLabel(displayStatus, 'Draft')}</span></div>
        <button ref={closeButtonRef} className="invoice-modal-close" type="button" onClick={onClose} aria-label="Close invoice details" disabled={isSending || isRecordingPayment || isCancelling}><Icon name="close" size={19} /></button>
      </div>
      <div className="invoice-details-content">
        <dl className="invoice-details-grid">
          <div><dt>Customer</dt><dd>{customerName || 'Customer unavailable'}</dd></div>
          <div><dt>Linked job</dt><dd>{invoice.job_id ? (jobName || 'Linked job unavailable') : 'No linked job'}</dd></div>
          <div><dt>Issue date</dt><dd>{formatDate(invoice.issue_date)}</dd></div>
          <div><dt>Due date</dt><dd>{formatDate(invoice.due_date)}</dd></div>
          {invoice.notes && <div className="invoice-details-wide"><dt>Notes</dt><dd>{invoice.notes}</dd></div>}
        </dl>

        <section className="invoice-financial-summary" aria-labelledby="invoice-summary-title"><h3 id="invoice-summary-title">Financial summary</h3><dl><div><dt>Subtotal</dt><dd>{formatAmount(invoice.subtotal)}</dd></div><div><dt>Tax</dt><dd>{formatAmount(invoice.tax_amount)}</dd></div><div><dt>Total</dt><dd>{formatAmount(invoice.total_amount)}</dd></div></dl></section>

        {status === 'loading' && <div className="invoice-related-state" aria-busy="true" aria-live="polite"><span className="invoice-loading-indicator" aria-hidden="true" /><p>Loading invoice details</p></div>}
        {status === 'error' && <div className="invoice-related-state invoice-related-error" role="alert"><p>Invoice details couldn’t be loaded. Please try again in a moment.</p></div>}
        {status === 'ready' && <>
          <section className="invoice-detail-section" aria-labelledby="invoice-items-title"><div className="invoice-detail-section-heading"><p className="eyebrow">Items</p><h3 id="invoice-items-title">Invoice items</h3></div>{items.length === 0 ? <p className="invoice-detail-empty">No invoice items have been recorded.</p> : <div className="invoice-items-list">{items.map((item) => <article key={item.id}><div><strong>{item.description || 'Untitled item'}</strong><span>Quantity {formatAmount(item.quantity)} · Unit price {formatAmount(item.unit_price)}</span></div><strong>{formatAmount(Number(item.quantity) * Number(item.unit_price))}</strong></article>)}</div>}</section>
          <section className="invoice-detail-section" aria-labelledby="invoice-payments-title"><div className="invoice-detail-section-heading"><p className="eyebrow">Payments</p><h3 id="invoice-payments-title">Payment history</h3></div>{payments.length === 0 ? <p className="invoice-detail-empty">No payments have been recorded.</p> : <div className="invoice-payments-list">{payments.map((payment) => <article key={payment.id}><div><strong>{formatDate(payment.payment_date)}</strong><span>{formatLabel(payment.payment_method, 'Method unavailable')}{payment.reference_number ? ` · ${payment.reference_number}` : ''}</span></div><strong>{formatAmount(payment.amount)}</strong></article>)}</div>}</section>
          {isPaymentFormOpen && invoice.status === 'sent' && <form className="invoice-payment-form" onSubmit={handlePaymentSubmit} noValidate><div className="invoice-detail-section-heading"><p className="eyebrow">Payment</p><h3>Record payment</h3><p>Track a payment received for this invoice.</p></div><div className="invoice-payment-summary" aria-label="Payment balance summary"><div><span>Invoice total</span><strong>{formatMinorUnits(paymentSummary.total)}</strong></div><div><span>Already paid</span><strong>{formatMinorUnits(paymentSummary.alreadyPaid)}</strong></div><div><span>Outstanding balance</span><strong>{formatMinorUnits(paymentSummary.outstanding)}</strong></div></div><div className="invoice-payment-grid"><label>Amount <span aria-hidden="true">*</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} aria-describedby="payment-amount-help" disabled={isRecordingPayment} required /></label><label>Payment method <span aria-hidden="true">*</span><select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))} disabled={isRecordingPayment} required>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label><label>Payment date <span aria-hidden="true">*</span><input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} disabled={isRecordingPayment} required /></label><label>Reference number<input type="text" value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, referenceNumber: event.target.value }))} disabled={isRecordingPayment} /></label><label className="invoice-payment-notes">Notes<textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} disabled={isRecordingPayment} /></label></div><p className="invoice-payment-help" id="payment-amount-help">Payments cannot exceed the outstanding balance.</p>{paymentError && <p className="invoice-form-error" role="alert">{paymentError}</p>}<div className="invoice-payment-actions"><button className="secondary-action" type="button" onClick={closePaymentForm} disabled={isRecordingPayment}>Cancel</button><button className="primary-action" type="submit" disabled={isRecordingPayment}>{isRecordingPayment ? 'Recording payment…' : 'Record payment'}</button></div></form>}
        </>}
      </div>
      {isConfirmingSent && invoice.status === 'draft' && <div ref={sentConfirmationRef} className="invoice-status-confirmation" role="alertdialog" aria-labelledby="mark-invoice-sent-title" aria-describedby="mark-invoice-sent-description" tabIndex="-1"><div><strong id="mark-invoice-sent-title">Mark this invoice as sent?</strong><p id="mark-invoice-sent-description">This changes the invoice status from Draft to Sent.</p>{sendError && <p className="invoice-form-error" role="alert">{sendError}</p>}</div><div className="invoice-status-confirmation-actions"><button className="secondary-action" type="button" onClick={() => { setIsConfirmingSent(false); setSendError('') }} disabled={isSending}>Cancel</button><button className="primary-action" type="button" onClick={handleMarkAsSent} disabled={isSending}>{isSending ? 'Marking as sent…' : 'Mark as sent'}</button></div></div>}
      {isConfirmingCancel && canCancelInvoice && <div ref={cancelConfirmationRef} className="invoice-status-confirmation" role="alertdialog" aria-labelledby="cancel-invoice-title" aria-describedby="cancel-invoice-description" tabIndex="-1"><div><strong id="cancel-invoice-title">Cancel this invoice?</strong><p id="cancel-invoice-description">This will change the invoice status to Cancelled. The invoice will remain in your records.</p>{cancelError && <p className="invoice-form-error" role="alert">{cancelError}</p>}</div><div className="invoice-status-confirmation-actions"><button className="secondary-action" type="button" onClick={() => { setIsConfirmingCancel(false); setCancelError('') }} disabled={isCancelling}>Keep invoice</button><button className="danger-action danger-action--solid" type="button" onClick={handleCancelInvoice} disabled={isCancelling}>{isCancelling ? 'Cancelling…' : 'Cancel invoice'}</button></div></div>}
      {!isPaymentFormOpen && !isConfirmingSent && !isConfirmingCancel && <div className="invoice-modal-actions">{!isCancellationRefreshPending && invoice.status === 'draft' && <button className="primary-action" type="button" onClick={() => { setIsConfirmingSent(true); setSendError('') }}>Mark as sent</button>}{!isCancellationRefreshPending && invoice.status === 'sent' && <button className="primary-action" type="button" onClick={() => { setIsPaymentFormOpen(true); setPaymentError('') }}>Record payment</button>}{!isCancellationRefreshPending && canCancelInvoice && <button className="danger-action" type="button" onClick={() => { setIsConfirmingCancel(true); setCancelError('') }}>Cancel invoice</button>}<button className="secondary-action" type="button" onClick={onClose} disabled={isSending || isRecordingPayment || isCancelling}>Close</button></div>}
    </section>
  </div>
}

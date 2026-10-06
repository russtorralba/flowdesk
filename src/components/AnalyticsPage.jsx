import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon.jsx'
import { neon } from '../lib/neon.js'
import { getInvoiceEffectiveStatus, getLocalDate, getOutstandingBalance, getPaymentTotalsByInvoice, toMinorUnits } from '../lib/invoiceCalculations.js'
import '../styles/analytics.css'

const customerFields = 'status, created_at'
const jobFields = 'status, created_at'
const invoiceFields = 'id, status, issue_date, due_date, total_amount'
const paymentFields = 'invoice_id, amount, payment_date'
const openJobStatuses = new Set(['new', 'scheduled', 'in_progress'])
const jobStatusOrder = ['new', 'scheduled', 'in_progress', 'completed', 'cancelled']
const invoiceStatusOrder = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

const rangeOptions = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const formatLabel = (value) => (value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatMinorUnits = (value) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) / 100)

const dateFromKey = (key) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const toLocalDateKey = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : getLocalDate(date)
}

const getRangeBounds = (range, now = new Date()) => {
  const end = getLocalDate(now)
  if (range === 'all') return { start: null, end }
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === 'year') startDate.setMonth(0, 1)
  else startDate.setDate(startDate.getDate() - (Number(range) - 1))
  return { start: getLocalDate(startDate), end }
}

const isInRange = (value, bounds) => {
  const dateKey = toLocalDateKey(value)
  return Boolean(dateKey && (!bounds.start || dateKey >= bounds.start) && dateKey <= bounds.end)
}

const addDays = (dateKey, days) => {
  const date = dateFromKey(dateKey)
  if (!date) return null
  date.setDate(date.getDate() + days)
  return getLocalDate(date)
}

const monthSpan = (startKey, endKey) => {
  const start = dateFromKey(startKey)
  const end = dateFromKey(endKey)
  if (!start || !end) return 0
  return ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth() + 1
}

const getTrendConfig = (range, startKey, endKey) => {
  if (range === '30') return { unit: 'days', size: 5 }
  if (range === '90') return { unit: 'days', size: 14 }
  if (range === 'year') return { unit: 'months', size: 1 }
  const span = monthSpan(startKey, endKey)
  if (span <= 12) return { unit: 'months', size: 1 }
  if (span <= 24) return { unit: 'months', size: 3 }
  return { unit: 'years', size: 1 }
}

const alignBucketStart = (dateKey, config) => {
  const date = dateFromKey(dateKey)
  if (!date) return null
  if (config.unit === 'days') return getLocalDate(date)
  if (config.unit === 'months') {
    date.setDate(1)
    if (config.size > 1) date.setMonth(date.getMonth() - (date.getMonth() % config.size))
    return getLocalDate(date)
  }
  date.setMonth(0, 1)
  return getLocalDate(date)
}

const advanceBucket = (dateKey, config) => {
  const date = dateFromKey(dateKey)
  if (!date) return null
  if (config.unit === 'days') date.setDate(date.getDate() + config.size)
  else if (config.unit === 'months') date.setMonth(date.getMonth() + config.size, 1)
  else date.setFullYear(date.getFullYear() + config.size, 0, 1)
  return getLocalDate(date)
}

const getBucketEnd = (startKey, config, lastKey) => {
  const nextKey = advanceBucket(startKey, config)
  if (!nextKey) return startKey
  const endKey = addDays(nextKey, -1)
  return endKey && endKey < lastKey ? endKey : lastKey
}

const formatShortDate = (dateKey) => {
  const date = dateFromKey(dateKey)
  return date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date) : '—'
}

const formatBucket = (startKey, endKey, config) => {
  if (config.unit === 'years') return startKey.slice(0, 4)
  if (config.unit === 'months' && config.size === 1) {
    const date = dateFromKey(startKey)
    return date ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date) : '—'
  }
  return startKey === endKey ? formatShortDate(startKey) : `${formatShortDate(startKey)}–${formatShortDate(endKey)}`
}

const buildTrend = (records, range, bounds) => {
  const validRecords = records.filter((record) => isInRange(record.date, bounds))
  const recordDates = validRecords.map((record) => toLocalDateKey(record.date)).filter(Boolean).sort()
  const startKey = range === 'all' ? recordDates[0] : bounds.start
  const endKey = range === 'all' ? recordDates.at(-1) : bounds.end
  if (!startKey || !endKey) return []

  const config = getTrendConfig(range, startKey, endKey)
  const bucketStart = config.unit === 'days' ? startKey : alignBucketStart(startKey, config)
  const buckets = []
  let cursor = bucketStart
  while (cursor && cursor <= endKey) {
    const bucketEnd = getBucketEnd(cursor, config, endKey)
    buckets.push({ key: cursor, start: cursor, end: bucketEnd, label: formatBucket(cursor, bucketEnd, config), amount: 0n })
    cursor = advanceBucket(cursor, config)
  }

  validRecords.forEach((record) => {
    const dateKey = toLocalDateKey(record.date)
    const bucket = buckets.find((current) => dateKey >= current.start && dateKey <= current.end)
    if (bucket) bucket.amount += record.amount
  })
  return buckets
}

function TrendPanel({ title, description, buckets, unavailable }) {
  const maximum = buckets.reduce((highest, bucket) => bucket.amount > highest ? bucket.amount : highest, 0n)

  return <section className="analytics-panel analytics-trend-panel">
    <div className="analytics-panel-heading"><div><p className="eyebrow">Trend</p><h3>{title}</h3><p>{description}</p></div></div>
    {unavailable ? <div className="analytics-compact-state"><p>Payment analytics are unavailable right now.</p></div> : buckets.length === 0 ? <div className="analytics-compact-state"><p>No activity in this period.</p></div> : <div className="analytics-trend-bars" style={{ '--analytics-bucket-count': buckets.length }} role="list" aria-label={`${title} by period`}>{buckets.map((bucket) => {
      const height = maximum > 0n ? Number((bucket.amount * 100n) / maximum) : 0
      return <article key={bucket.key} role="listitem" className="analytics-trend-bar" aria-label={`${bucket.label}: ${formatMinorUnits(bucket.amount)}`} title={`${bucket.label}: ${formatMinorUnits(bucket.amount)}`}><div className="analytics-bar-track" aria-hidden="true"><span style={{ height: `${height}%` }} /></div><strong>{formatMinorUnits(bucket.amount)}</strong><span>{bucket.label}</span></article>
    })}</div>}
  </section>
}

function StatusBreakdown({ title, description, statuses, counts, tone }) {
  const total = statuses.reduce((sum, status) => sum + counts[status], 0)
  return <section className="analytics-panel analytics-breakdown-panel"><div className="analytics-panel-heading"><div><p className="eyebrow">Current state</p><h3>{title}</h3><p>{description}</p></div></div><div className="analytics-breakdown-list">{statuses.map((status) => <div key={status}><span className={`analytics-status-dot analytics-status-dot-${tone}-${status}`} /><p>{formatLabel(status)}</p><strong>{counts[status]}</strong><small>{total ? `${Math.round((counts[status] / total) * 100)}%` : '0%'}</small></div>)}</div></section>
}

export function AnalyticsPage({ user }) {
  const [customers, setCustomers] = useState([])
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [hasPaymentData, setHasPaymentData] = useState(false)
  const [status, setStatus] = useState('loading')
  const [range, setRange] = useState('30')
  const userId = user?.id

  useEffect(() => {
    let isCurrent = true

    const loadAnalytics = async () => {
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

        const [customerResult, jobResult, invoiceResult, paymentResult] = await Promise.all([
          neon.from('customers').select(customerFields).eq('workspace_id', membership.workspace_id),
          neon.from('jobs').select(jobFields).eq('workspace_id', membership.workspace_id),
          neon.from('invoices').select(invoiceFields).eq('workspace_id', membership.workspace_id),
          neon.from('payments').select(paymentFields).eq('workspace_id', membership.workspace_id),
        ])

        if (customerResult.error || jobResult.error || invoiceResult.error) {
          if (isCurrent) setStatus('error')
          return
        }

        if (!isCurrent) return
        setCustomers(customerResult.data ?? [])
        setJobs(jobResult.data ?? [])
        setInvoices(invoiceResult.data ?? [])
        setPayments(paymentResult.error ? [] : paymentResult.data ?? [])
        setHasPaymentData(!paymentResult.error)
        setStatus('ready')
      } catch {
        if (isCurrent) setStatus('error')
      }
    }

    loadAnalytics()
    return () => { isCurrent = false }
  }, [userId])

  const analytics = useMemo(() => {
    const bounds = getRangeBounds(range)
    const todayLocal = getLocalDate()
    const paymentTotals = hasPaymentData ? getPaymentTotalsByInvoice(payments) : {}
    const effectiveStatus = (invoice) => hasPaymentData
      ? getInvoiceEffectiveStatus(invoice, paymentTotals[invoice.id] ?? 0n, todayLocal)
      : (invoice.status || 'draft')
    const rangedInvoices = invoices.filter((invoice) => isInRange(invoice.issue_date, bounds))
    const rangedPayments = hasPaymentData ? payments.filter((payment) => isInRange(payment.payment_date, bounds)) : []
    const includedInvoices = rangedInvoices.filter((invoice) => ['sent', 'paid'].includes(invoice.status || 'draft'))
    const totalInvoiced = includedInvoices.reduce((sum, invoice) => sum + (toMinorUnits(invoice.total_amount) ?? 0n), 0n)
    const totalPayments = rangedPayments.reduce((sum, payment) => sum + (toMinorUnits(payment.amount) ?? 0n), 0n)
    const outstanding = hasPaymentData ? invoices
      .filter((invoice) => invoice.status === 'sent')
      .reduce((sum, invoice) => sum + getOutstandingBalance(invoice.total_amount, paymentTotals[invoice.id] ?? 0n), 0n) : null
    const jobCounts = Object.fromEntries(jobStatusOrder.map((jobStatus) => [jobStatus, jobs.filter((job) => (job.status || 'new') === jobStatus).length]))
    const invoiceCounts = Object.fromEntries(invoiceStatusOrder.map((invoiceStatus) => [invoiceStatus, invoices.filter((invoice) => effectiveStatus(invoice) === invoiceStatus).length]))
    const invoiceTrend = buildTrend(includedInvoices.map((invoice) => ({ date: invoice.issue_date, amount: toMinorUnits(invoice.total_amount) ?? 0n })), range, bounds)
    const paymentTrend = hasPaymentData ? buildTrend(rangedPayments.map((payment) => ({ date: payment.payment_date, amount: toMinorUnits(payment.amount) ?? 0n })), range, bounds) : []

    return {
      bounds,
      hasPaymentData,
      activeCustomers: customers.filter((customer) => customer.status === 'active').length,
      openJobs: jobs.filter((job) => openJobStatuses.has(job.status || 'new')).length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      totalInvoiced,
      totalPayments,
      outstanding,
      invoiceTrend,
      paymentTrend,
      jobCounts,
      invoiceCounts,
      isEmpty: hasPaymentData && customers.length === 0 && jobs.length === 0 && invoices.length === 0 && payments.length === 0,
    }
  }, [customers, hasPaymentData, invoices, jobs, payments, range])

  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label || 'Selected period'
  const metrics = [
    { label: 'Active customers', value: analytics.activeCustomers, caption: 'Current workspace snapshot', icon: 'users' },
    { label: 'Open jobs', value: analytics.openJobs, caption: 'Current workspace snapshot', icon: 'briefcase' },
    { label: 'Completed jobs', value: analytics.completedJobs, caption: 'Current workspace snapshot', icon: 'spark' },
    { label: 'Total invoiced', value: formatMinorUnits(analytics.totalInvoiced), caption: `${rangeLabel} issued invoices`, icon: 'receipt' },
    { label: 'Payments recorded', value: analytics.hasPaymentData ? formatMinorUnits(analytics.totalPayments) : '—', caption: analytics.hasPaymentData ? `${rangeLabel} payment activity` : 'Payment data unavailable', icon: 'chart' },
    { label: 'Outstanding balance', value: analytics.outstanding === null ? '—' : formatMinorUnits(analytics.outstanding), caption: analytics.outstanding === null ? 'Payment data unavailable' : 'Current workspace balance', icon: 'calendar' },
  ]

  return <section className="workspace-content analytics-page">
    <div className="analytics-page-header"><div><p className="eyebrow">Analytics</p><h2>Business performance</h2><p>Understand workspace activity, billing progress, and operational momentum.</p></div><label className="analytics-range-filter"><span>Period</span><select value={range} onChange={(event) => setRange(event.target.value)}>{rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    {status === 'loading' && <div className="analytics-state" aria-busy="true" aria-live="polite"><span className="analytics-loading-indicator" aria-hidden="true" /><p>Loading analytics</p></div>}
    {status === 'error' && <div className="analytics-state analytics-error" role="alert"><span className="welcome-icon"><Icon name="chart" size={23} /></span><h3>Analytics couldn’t be loaded</h3><p>Please try again in a moment.</p></div>}
    {status === 'ready' && analytics.isEmpty && <div className="analytics-state analytics-empty"><span className="welcome-icon"><Icon name="chart" size={23} /></span><h3>No analytics yet</h3><p>Analytics will take shape as your workspace gains customers, jobs, invoices, and payments.</p></div>}
    {status === 'ready' && !analytics.isEmpty && <>
      {!analytics.hasPaymentData && <p className="analytics-financial-notice" role="status">Payment totals are unavailable right now. Billing balances and derived overdue status are not shown.</p>}
      <div className="analytics-metrics">{metrics.map((metric) => <article className="analytics-metric" key={metric.label}><span><Icon name={metric.icon} size={18} /></span><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.caption}</small></article>)}</div>
      <div className="analytics-trends"><TrendPanel title="Invoices issued" description={`${rangeLabel} invoice value`} buckets={analytics.invoiceTrend} /><TrendPanel title="Payments recorded" description={`${rangeLabel} payment value`} buckets={analytics.paymentTrend} unavailable={!analytics.hasPaymentData} /></div>
      <div className="analytics-breakdowns"><StatusBreakdown title="Jobs by status" description="Current workspace snapshot" statuses={jobStatusOrder} counts={analytics.jobCounts} tone="job" /><StatusBreakdown title="Invoices by status" description={analytics.hasPaymentData ? 'Current effective status' : 'Current stored status'} statuses={invoiceStatusOrder} counts={analytics.invoiceCounts} tone="invoice" /></div>
    </>}
  </section>
}

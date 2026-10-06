export const toMinorUnits = (value) => {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\.(\d+))?$/)
  if (!match || (match[2]?.slice(2) && /[1-9]/.test(match[2].slice(2)))) return null
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').slice(0, 2).padEnd(2, '0'))
}

export const getLocalDate = (value = new Date()) => {
  const pad = (number) => String(number).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export const getPaymentTotalsByInvoice = (payments) => payments.reduce((totals, payment) => {
  const amount = toMinorUnits(payment.amount) ?? 0n
  totals[payment.invoice_id] = (totals[payment.invoice_id] ?? 0n) + amount
  return totals
}, {})

export const getOutstandingBalance = (totalAmount, paidAmount = 0n) => {
  const total = typeof totalAmount === 'bigint' ? totalAmount : toMinorUnits(totalAmount) ?? 0n
  const paid = typeof paidAmount === 'bigint' ? paidAmount : toMinorUnits(paidAmount) ?? 0n
  return total > paid ? total - paid : 0n
}

export const getInvoiceEffectiveStatus = (invoice, paidAmount = 0n, todayLocal = getLocalDate()) => {
  const storedStatus = invoice.status || 'draft'
  if (storedStatus !== 'sent' || !invoice.due_date || invoice.due_date >= todayLocal) return storedStatus
  return getOutstandingBalance(invoice.total_amount, paidAmount) > 0n ? 'overdue' : storedStatus
}

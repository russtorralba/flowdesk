export function Brand({ compact = false }) {
  return <div className="brand" aria-label="FlowDesk">
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
    {!compact && <span className="brand-name">FlowDesk</span>}
  </div>
}

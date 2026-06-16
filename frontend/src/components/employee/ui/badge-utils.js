export function statusVariant(status) {
  const map = {
    Approved: 'success',
    Requested: 'warning',
    Pending: 'warning',
    Rejected: 'danger',
    Cancelled: 'warning',
    Resolved: 'success',
    Open: 'default',
    'In Progress': 'warning',
    Completed: 'success',
    Paid: 'success',
    Credited: 'success',
  }
  return map[status] || 'secondary'
}

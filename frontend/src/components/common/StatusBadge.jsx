const COLOR_MAP = {
  'Handover Pending': 'grey',
  Received: 'blue',
  'In Warehouse': 'blue',
  'Under Refurbishment': 'orange',
  'Available for Sale': 'green',
  'Sale Proposed': 'blue',
  'Approval Pending': 'orange',
  Approved: 'green',
  Sold: 'green',
  'Dispatch Pending': 'orange',
  Dispatched: 'blue',
  Closed: 'grey',
  Pending: 'orange',
  Rejected: 'red',
  Converted: 'green',
  Cancelled: 'grey',
  Unpaid: 'red',
  'Partially Paid': 'orange',
  Paid: 'green',
  Draft: 'grey',
  Submitted: 'blue',
  Scheduled: 'blue',
  Delivered: 'green',
  Settled: 'green',
  Active: 'green',
  Inactive: 'grey',
};

export default function StatusBadge({ status }) {
  const color = COLOR_MAP[status] || 'grey';
  return <span className={`badge badge-${color}`}>{status}</span>;
}

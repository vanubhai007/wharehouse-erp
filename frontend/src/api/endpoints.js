import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  me: () => client.get('/auth/me'),
  forgotPassword: (data) => client.post('/auth/forgot-password', data),
  resetPassword: (token, data) => client.post(`/auth/reset-password/${token}`, data),
};

export const userApi = {
  list: (params) => client.get('/users', { params }),
  create: (data) => client.post('/users', data),
  update: (id, data) => client.put(`/users/${id}`, data),
  resetPassword: (id, data) => client.post(`/users/${id}/reset-password`, data),
  deactivate: (id) => client.post(`/users/${id}/deactivate`),
};

export const customerApi = {
  list: (params) => client.get('/customers', { params }),
  get: (id) => client.get(`/customers/${id}`),
  profile: (id) => client.get(`/customers/${id}/profile`),
  create: (data) => client.post('/customers', data),
  update: (id, data) => client.put(`/customers/${id}`, data),
  setActive: (id, isActive) => client.post(`/customers/${id}/active`, { isActive }),
  uploadDocs: (id, formData) => client.post(`/customers/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeDoc: (id, fileId) => client.delete(`/customers/${id}/documents/${fileId}`),
};

export const buyerApi = {
  list: (params) => client.get('/buyers', { params }),
  get: (id) => client.get(`/buyers/${id}`),
  create: (data) => client.post('/buyers', data),
  update: (id, data) => client.put(`/buyers/${id}`, data),
  listEnquiries: (params) => client.get('/buyers/enquiries', { params }),
  createEnquiry: (data) => client.post('/buyers/enquiries', data),
  negotiate: (id, data) => client.post(`/buyers/enquiries/${id}/negotiate`, data),
  updateEnquiryStatus: (id, status) => client.post(`/buyers/enquiries/${id}/status`, { status }),
};

export const salesInquiryApi = {
  list: (params) => client.get('/sales-inquiries', { params }),
  get: (id) => client.get(`/sales-inquiries/${id}`),
  create: (data) => client.post('/sales-inquiries', data),
  update: (id, data) => client.put(`/sales-inquiries/${id}`, data),
  updateStatus: (id, data) => client.post(`/sales-inquiries/${id}/status`, data),
  convertToBuyer: (id) => client.post(`/sales-inquiries/${id}/convert-to-buyer`),
};

export const itemApi = {
  list: (params) => client.get('/items', { params }),
  get: (id) => client.get(`/items/${id}`),
  create: (data) => client.post('/items', data),
  update: (id, data) => client.put(`/items/${id}`, data),
  archive: (id) => client.post(`/items/${id}/archive`),
  changeStatus: (id, data) => client.post(`/items/${id}/status`, data),
  moveLocation: (id, data) => client.post(`/items/${id}/move-location`, data),
  costSheet: (id) => client.get(`/items/${id}/cost-sheet`),
  history: (id) => client.get(`/items/${id}/history`),
  addMedia: (id, formData) => client.post(`/items/${id}/media`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeMedia: (id, fileId) => client.delete(`/items/${id}/media/${fileId}`),
  exportCsvPath: () => '/items/export/csv',
};

export const warehouseApi = {
  listLocations: (params) => client.get('/warehouse/locations', { params }),
  createLocation: (data) => client.post('/warehouse/locations', data),
  updateLocation: (id, data) => client.put(`/warehouse/locations/${id}`, data),
  deleteLocation: (id) => client.delete(`/warehouse/locations/${id}`),
  occupancyMap: () => client.get('/warehouse/occupancy-map'),
  rentalReport: (params) => client.get('/warehouse/rental-report', { params }),
};

export const expenseApi = {
  list: (params) => client.get('/expenses', { params }),
  create: (data) => client.post('/expenses', data),
  update: (id, data) => client.put(`/expenses/${id}`, data),
  remove: (id) => client.delete(`/expenses/${id}`),
  addReceipts: (id, formData) => client.post(`/expenses/${id}/receipts`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const refurbishmentApi = {
  list: (params) => client.get('/refurbishments', { params }),
  create: (data) => client.post('/refurbishments', data),
  update: (id, data) => client.put(`/refurbishments/${id}`, data),
  complete: (id, data) => client.post(`/refurbishments/${id}/complete`, data),
  approve: (id) => client.post(`/refurbishments/${id}/approve`),
  addPhotos: (id, formData) => client.post(`/refurbishments/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const saleProposalApi = {
  list: (params) => client.get('/sale-proposals', { params }),
  get: (id) => client.get(`/sale-proposals/${id}`),
  create: (data) => client.post('/sale-proposals', data),
  submitForApproval: (id) => client.post(`/sale-proposals/${id}/submit-for-approval`),
  cancel: (id) => client.post(`/sale-proposals/${id}/cancel`),
};

export const approvalApi = {
  pending: () => client.get('/approvals/pending'),
  list: (params) => client.get('/approvals', { params }),
  decide: (id, data) => client.post(`/approvals/${id}/decide`, data),
};

export const invoiceApi = {
  list: (params) => client.get('/invoices', { params }),
  get: (id) => client.get(`/invoices/${id}`),
  createFromProposal: (data) => client.post('/invoices/from-proposal', data),
  createQuotation: (data) => client.post('/invoices/quotation', data),
  pdfPath: (id) => `/invoices/${id}/pdf`,
};

export const paymentApi = {
  list: (params) => client.get('/payments', { params }),
  create: (data) => client.post('/payments', data),
  receiptPath: (id) => `/payments/${id}/receipt`,
  addProof: (id, formData) => client.post(`/payments/${id}/proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const settlementApi = {
  list: (params) => client.get('/settlements', { params }),
  create: (data) => client.post('/settlements', data),
  settle: (id, data) => client.post(`/settlements/${id}/settle`, data),
};

export const dispatchApi = {
  list: (params) => client.get('/dispatches', { params }),
  get: (id) => client.get(`/dispatches/${id}`),
  create: (data) => client.post('/dispatches', data),
  update: (id, data) => client.put(`/dispatches/${id}`, data),
  markDispatched: (id, data) => client.post(`/dispatches/${id}/dispatch`, data),
  confirmDelivery: (id) => client.post(`/dispatches/${id}/confirm-delivery`),
  addProof: (id, formData) => client.post(`/dispatches/${id}/proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  pdfPath: (id) => `/dispatches/${id}/pdf`,
};

export const reportApi = {
  inventory: (params) => client.get('/reports/inventory', { params }),
  ownerWiseInventory: (params) => client.get('/reports/inventory/owner-wise', { params }),
  costSheet: (params) => client.get('/reports/cost-sheet', { params }),
  expenses: (params) => client.get('/reports/expenses', { params }),
  refurbishment: (params) => client.get('/reports/refurbishment', { params }),
  sales: (params) => client.get('/reports/sales', { params }),
  pendingApprovals: () => client.get('/reports/pending-approvals'),
  outstandingPayments: () => client.get('/reports/outstanding-payments'),
  settlements: (params) => client.get('/reports/settlements', { params }),
  dispatch: (params) => client.get('/reports/dispatch', { params }),
  audit: (params) => client.get('/reports/audit', { params }),
  csvPath: (path, params) => {
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return `${path}?${qs}`;
  },
};

export const dashboardApi = {
  get: () => client.get('/dashboard'),
};

export const settingsApi = {
  get: () => client.get('/settings'),
  update: (data) => client.put('/settings', data),
};

export const uploadApi = {
  upload: (folder, formData) => client.post(`/uploads/${folder}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (publicId) => client.delete(`/uploads/${encodeURIComponent(publicId)}`),
};

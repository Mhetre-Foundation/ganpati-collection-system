const BASE_URL = window.location.port === '5173'
  ? `http://${window.location.hostname}:5000/api`
  : '/api';

const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

/**
 * Fetch wrapper that attaches JWT token and parses JSON results securely.
 */
async function request(endpoint, options = {}) {
  const token = getStorageItem('mandal_vargani_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (error) {
    throw new Error('Could not connect to the server. Please check your internet connection.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Check if it's a duplicate warning conflict
    if (response.status === 409 && data.warning) {
      return { warning: true, message: data.message };
    }
    const errMsg = data.error || data.message || 'Something went wrong. Please try again.';
    throw new Error(errMsg);
  }

  return data;
}

export const api = {
  // Authentication
  login: (mobile, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, password })
  }),
  
  register: (data) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  getMe: () => request('/auth/me'),
  getPublicLines: () => request('/public/lines'),

  // Workers Management
  getWorkerRequests: () => request('/workers/requests'),
  
  updateWorkerStatus: (id, status, assignedLineId) => request(`/workers/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, assignedLineId })
  }),
  
  resetWorkerPin: (id, newPin) => request(`/workers/${id}/reset-pin`, {
    method: 'POST',
    body: JSON.stringify({ newPin })
  }),
  
  getWorkersList: () => request('/workers/list'),

  // Locations / Areas
  getLinesBuildings: () => request('/locations/lines-buildings'),
  
  createLine: (name, prefix) => request('/locations/line', {
    method: 'POST',
    body: JSON.stringify({ name, prefix })
  }),
  
  createBuilding: (lineId, name) => request('/locations/building', {
    method: 'POST',
    body: JSON.stringify({ lineId, name })
  }),

  // Receipts / Donations
  createReceipt: (data, bypassWarning = false) => {
    const headers = {};
    if (bypassWarning) {
      headers['x-bypass-duplicate-warning'] = 'true';
    }
    return request('/receipts/create', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  markReceiptPaid: (id, paymentMode) => request(`/receipts/${id}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ paymentMode })
  }),

  cancelReceipt: (id, reason) => request(`/receipts/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  searchReceipts: (query) => request(`/receipts/search?query=${encodeURIComponent(query)}`),

  getMyReceipts: (period) => request(`/receipts/my-receipts?period=${period}`),

  // Public Receipt Lookup
  getPublicReceipt: (token) => fetch(`http://localhost:5000/api/receipts/public/${token}`)
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to verify receipt.');
      return data;
    }),

  // Settlements / Handovers
  submitHandover: (submittedAmount, explanation) => request('/settlements/handover', {
    method: 'POST',
    body: JSON.stringify({ submittedAmount, explanation })
  }),

  getSettlements: () => request('/settlements/list'),

  verifySettlement: (id) => request(`/settlements/${id}/verify`, {
    method: 'POST'
  }),

  // Admin Dashboard & Analytics
  getDashboardSummary: () => request('/admin/dashboard-summary'),
  
  getDailyCollections: () => request('/admin/daily-collection'),
  
  getWorkerPerformance: () => request('/admin/worker-performance'),
  
  getMasterReceipts: (filters = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    return request(`/admin/master-receipts?${queryParams.toString()}`);
  },

  getAuditLogs: () => request('/admin/audit-logs'),

  // Announcements
  getAnnouncements: () => request('/announcements'),
  
  postAnnouncement: (message) => request('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),

  // System Settings
  getSettings: () => request('/settings/config'),
  
  updateSettings: (data) => request('/settings/update', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Database Backups
  getBackupStatus: () => request('/admin/backup/status'),
  runBackup: () => request('/admin/backup/run', { method: 'POST' }),
  resetSystem: () => request('/admin/reset-system', { method: 'POST' }),
  updateAdminProfile: (data) => request('/admin/update-profile', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  downloadBackup: async () => {
    const token = getStorageItem('mandal_vargani_token');
    const downloadUrl = window.location.port === '5173'
      ? `http://${window.location.hostname}:5000/api/admin/backup/download`
      : '/api/admin/backup/download';
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Failed to download database backup.');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mandal_db_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
export default api;

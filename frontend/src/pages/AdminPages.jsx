import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { 
  Users, MapPin, Award, FileText, Settings, ShieldAlert, 
  MessageSquare, PlusCircle, Trash, RefreshCw, CheckCircle, XCircle, Search, Download 
} from 'lucide-react';

// ==========================================
// 1. ADMIN DASHBOARD
// ==========================================
export function AdminDashboard({ user, setTab }) {
  const [summary, setSummary] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardSummary();
      setSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.trim()) return;

    setSubmitting(true);
    try {
      await api.postAnnouncement(announcement);
      alert('Announcement broadcasted to all workers successfully!');
      setAnnouncement('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ background: 'var(--dark-slate)', color: 'white', border: 'none' }}>
        <h3 style={{ fontWeight: '400', color: 'var(--accent)' }}>Ganpati Utsav 2026</h3>
        <h2 style={{ fontSize: '28px' }}>President Control Panel</h2>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>Welcome back, Admin</p>
      </div>

      {loading ? (
        <p className="text-center text-muted"><RefreshCw className="spin" /> Loading financials...</p>
      ) : (
        <div className="grid-3" style={{ marginBottom: '24px' }}>
          <div className="stat-box" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>TOTAL EXPECTED COLLECTION</div>
            <div className="stat-value" style={{ fontSize: '26px', color: 'var(--primary)' }}>₹{summary?.totalExpected || 0}</div>
          </div>
          <div className="stat-box" style={{ borderLeft: '4px solid var(--color-paid)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>TOTAL PAID COLLECTION</div>
            <div className="stat-value" style={{ fontSize: '26px', color: 'var(--color-paid)' }}>₹{summary?.paid || 0}</div>
          </div>
          <div className="stat-box" style={{ borderLeft: '4px solid var(--color-pending)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>TOTAL PENDING COLLECTION</div>
            <div className="stat-value" style={{ fontSize: '26px', color: 'var(--color-pending)' }}>₹{summary?.pending || 0}</div>
          </div>
          <div className="stat-box" style={{ borderLeft: '2px solid var(--border)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>CASH COLLECTION</div>
            <div className="stat-value" style={{ fontSize: '22px', color: 'var(--dark-slate)' }}>₹{summary?.cash || 0}</div>
          </div>
          <div className="stat-box" style={{ borderLeft: '2px solid var(--border)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>ONLINE COLLECTION</div>
            <div className="stat-value" style={{ fontSize: '22px', color: 'var(--dark-slate)' }}>₹{summary?.online || 0}</div>
          </div>
          <div className="stat-box" style={{ borderLeft: '2px solid var(--border)' }}>
            <div className="text-muted" style={{ fontSize: '13px' }}>TOTAL RECEIPTS ISSUED</div>
            <div className="stat-value" style={{ fontSize: '22px', color: 'var(--dark-slate)' }}>{summary?.totalReceipts || 0}</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Post announcement */}
        <div className="card">
          <h3 className="card-title"><MessageSquare size={18} /> Broadcast Announcement</h3>
          <form onSubmit={handlePostAnnouncement}>
            <div className="form-group">
              <label>Message to Workers</label>
              <textarea 
                className="form-control" 
                placeholder="Enter text (e.g. आज रात्री 9 वाजता collection बंद होईल...)"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows="4"
                required
                style={{ fontFamily: 'inherit', resize: 'none' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !announcement.trim()}>
              {submitting ? <RefreshCw className="spin" /> : 'Send Broadcast'}
            </button>
          </form>
        </div>

        {/* Quick Operations Links */}
        <div className="card">
          <h3 className="card-title"><Settings size={18} /> Quick Management Link</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setTab('workers')}>
              <Users size={16} /> Manage Workers & Approvals
            </button>
            <button className="btn btn-secondary" onClick={() => setTab('locations')}>
              <MapPin size={16} /> Configure Lines & Buildings
            </button>
            <button className="btn btn-secondary" onClick={() => setTab('settlements')}>
              <Award size={16} /> Reconcile Cash settlements
            </button>
            <button className="btn btn-secondary" onClick={() => setTab('reports')}>
              <FileText size={16} /> Export Reports & Receipts
            </button>
            <button className="btn btn-secondary" onClick={() => setTab('audit-logs')}>
              <ShieldAlert size={16} /> View System Audit Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. WORKER APPROVAL & PIN RESET
// ==========================================
export function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for modals
  const [assigningWorker, setAssigningWorker] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [resettingWorker, setResettingWorker] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchWorkersAndRequests = async () => {
    setLoading(true);
    try {
      const wList = await api.getWorkersList();
      setWorkers(wList);

      const rList = await api.getWorkerRequests();
      setRequests(rList);

      const locs = await api.getLinesBuildings();
      setLines(locs);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkersAndRequests();
  }, []);

  const handleStatusChange = async (workerId, status, assignedLine) => {
    try {
      await api.updateWorkerStatus(workerId, status, assignedLine || null);
      alert(`Worker status updated to: ${status}`);
      fetchWorkersAndRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPinSubmit = async () => {
    if (!resettingWorker || !newPin.trim()) return;
    setUpdating(true);
    try {
      await api.resetWorkerPin(resettingWorker.id, newPin);
      alert(`PIN successfully reset to: ${newPin}`);
      setResettingWorker(null);
      setNewPin('');
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      {/* Registration Requests */}
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><Users /> Pending Approvals ({requests.length})</h2>
        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '20px' }}>No pending worker registration requests.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Mobile Number</th>
                  <th>Request Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td><strong>{req.name}</strong></td>
                    <td>{req.mobile}</td>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="text-right" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        className="btn btn-primary btn-inline" 
                        onClick={() => handleStatusChange(req.id, 'APPROVED', null)}
                      >
                        Approve
                      </button>
                      <button 
                        className="btn btn-secondary btn-inline"
                        style={{ color: 'var(--color-cancelled)' }}
                        onClick={() => handleStatusChange(req.id, 'REJECTED')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Worker List */}
      <div className="card">
        <h3 className="card-title">All Workers</h3>
        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading workers...</p>
        ) : workers.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '20px' }}>No workers registered.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Assigned Line</th>
                  <th>Receipts Created</th>
                  <th>Amount Collected</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{w.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registered: {new Date(w.created_at).toLocaleDateString()}</div>
                    </td>
                    <td>{w.mobile}</td>
                    <td>
                      {w.line_name ? (
                        <span style={{ fontWeight: '500' }}>{w.line_name}</span>
                      ) : (
                        <span className="text-muted" style={{ fontStyle: 'italic', fontSize: '12px' }}>Unassigned</span>
                      )}
                    </td>
                    <td>{w.receipts_created}</td>
                    <td style={{ fontWeight: '600', color: 'var(--color-paid)' }}>₹{w.amount_collected}</td>
                    <td>
                      <span className={`badge ${w.status === 'APPROVED' ? 'badge-paid' : w.status === 'PENDING_APPROVAL' ? 'badge-pending' : 'badge-cancelled'}`}>
                        {w.status === 'APPROVED' ? 'Active' : w.status === 'PENDING_APPROVAL' ? 'Pending' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {w.status === 'APPROVED' ? (
                          <button 
                            className="btn btn-secondary btn-inline"
                            style={{ color: 'var(--color-cancelled)', padding: '6px' }}
                            onClick={() => handleStatusChange(w.id, 'DISABLED')}
                          >
                            Disable
                          </button>
                        ) : w.status === 'DISABLED' ? (
                          <button 
                            className="btn btn-secondary btn-inline"
                            style={{ color: 'var(--color-paid)', padding: '6px' }}
                            onClick={() => handleStatusChange(w.id, 'APPROVED')}
                          >
                            Activate
                          </button>
                        ) : null}
                        


                        <button 
                          className="btn btn-secondary btn-inline"
                          style={{ padding: '6px' }}
                          onClick={() => {
                            setResettingWorker(w);
                            setNewPin('');
                          }}
                        >
                          Reset PIN
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>



      {/* RESET PIN MODAL */}
      {resettingWorker && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reset Worker PIN</h3>
              <button onClick={() => setResettingWorker(null)} style={{ border: 'none', background: 'none', width: 'auto', minHeight: 'auto', fontSize: '20px' }}>&times;</button>
            </div>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Reset credentials/PIN for worker <strong>{resettingWorker.name}</strong>.
            </p>
            <div className="form-group">
              <label>New PIN / Password *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter new PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResettingWorker(null)} disabled={updating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPinSubmit} disabled={updating || !newPin.trim()}>
                {updating ? <RefreshCw className="spin" /> : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. LOCATION / AREA CONFIGURATIONS
// ==========================================
export function AdminLocations() {
  const [locations, setLocations] = useState([]);
  const [lineName, setLineName] = useState('');
  const [linePrefix, setLinePrefix] = useState('');
  
  const [selectedLineId, setSelectedLineId] = useState('');
  const [buildingName, setBuildingName] = useState('');
  
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const data = await api.getLinesBuildings();
      setLocations(data);
      if (data.length > 0 && !selectedLineId) {
        setSelectedLineId(String(data[0].id));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleCreateLine = async (e) => {
    e.preventDefault();
    if (!lineName || !linePrefix) return;

    try {
      await api.createLine(lineName, linePrefix.toUpperCase());
      alert('Line created successfully.');
      setLineName('');
      setLinePrefix('');
      fetchLocations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateBuilding = async (e) => {
    e.preventDefault();
    if (!selectedLineId || !buildingName) return;

    try {
      await api.createBuilding(parseInt(selectedLineId), buildingName);
      alert('Building created successfully.');
      setBuildingName('');
      fetchLocations();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="grid-2">
      {/* Configure Area */}
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><MapPin /> Create Line / Colony</h2>
        <form onSubmit={handleCreateLine}>
          <div className="form-group">
            <label>Line / Colony Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shri Ram Colony"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Serial Prefix (2-3 chars) *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. SR"
              value={linePrefix}
              onChange={(e) => setLinePrefix(e.target.value.slice(0, 3))}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Create Line</button>
        </form>
      </div>

      {/* Configure Building */}
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><PlusCircle /> Add Building / Wing</h2>
        <form onSubmit={handleCreateBuilding}>
          <div className="form-group">
            <label>Assign to Line / Area *</label>
            <select 
              className="form-control" 
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              required
            >
              <option value="">Select Line</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} ({loc.prefix})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Building / Wing Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Building A"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!selectedLineId}>Add Building</button>
        </form>
      </div>

      {/* Location Tree Hierarchy */}
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <h3 className="card-title">Configured Area Hierarchy</h3>
        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading configurations...</p>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '20px' }}>No lines or colonies configured.</p>
        ) : (
          <div className="grid-3">
            {locations.map(loc => (
              <div key={loc.id} style={{ background: 'var(--light-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: '600', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px' }}>
                  {loc.name} ({loc.prefix})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {loc.buildings && loc.buildings.length > 0 ? (
                    loc.buildings.map(bld => (
                      <div key={bld.id} style={{ fontSize: '13px', background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        🏠 {bld.name}
                      </div>
                    ))
                  ) : (
                    <span className="text-muted" style={{ fontSize: '11px', fontStyle: 'italic' }}>No buildings added yet.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. CASH RECONCILIATION & SETTLEMENTS
// ==========================================
export function AdminSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const list = await api.getSettlements();
      setSettlements(list);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const handleVerify = async (id) => {
    if (!window.confirm('Verify that you have actually received this cash amount from the worker?')) return;
    try {
      await api.verifySettlement(id);
      alert('Settlement successfully verified.');
      fetchSettlements();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title" style={{ color: 'var(--primary)' }}><Award /> Reconcile Cash settlements</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Confirm and reconcile cash collections submitted by workers against expected totals calculated by the system database.
      </p>

      {loading ? (
        <p className="text-center text-muted"><RefreshCw className="spin" /> Loading settlements...</p>
      ) : settlements.length === 0 ? (
        <p className="text-center text-muted" style={{ padding: '20px' }}>No settlements submitted.</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Worker</th>
                <th>Expected Cash</th>
                <th>Submitted Cash</th>
                <th>Difference</th>
                <th>Explanation</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleDateString()}</td>
                  <td>
                    <strong>{h.worker_name}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{h.worker_mobile}</div>
                  </td>
                  <td>₹{h.expected_amount}</td>
                  <td style={{ fontWeight: '600' }}>₹{h.submitted_amount}</td>
                  <td style={{ 
                    color: h.difference < 0 ? 'var(--color-cancelled)' : h.difference > 0 ? 'var(--color-paid)' : 'inherit',
                    fontWeight: '700'
                  }}>
                    {h.difference >= 0 ? '+' : ''}₹{h.difference}
                  </td>
                  <td style={{ fontStyle: 'italic', fontSize: '13px' }}>{h.explanation || '-'}</td>
                  <td>
                    <span className={`badge ${h.status === 'VERIFIED' ? 'badge-paid' : 'badge-pending'}`}>
                      {h.status === 'VERIFIED' ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="text-right">
                    {h.status === 'PENDING_VERIFICATION' ? (
                      <button 
                        className="btn btn-primary btn-inline" 
                        onClick={() => handleVerify(h.id)}
                      >
                        Confirm Handover
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified by {h.admin_name}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. REPORTS & MASTER RECEIPTS TABLE
// ==========================================
export function AdminReports() {
  const [locations, setLocations] = useState([]);
  const [buildingsList, setBuildingsList] = useState([]);
  
  // Filters state
  const [filters, setFilters] = useState({
    lineId: '',
    buildingName: '',
    status: '',
    paymentMode: '',
    search: '',
    page: 1,
    limit: 50
  });

  const [receipts, setReceipts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load locations
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const data = await api.getLinesBuildings();
        setLocations(data);
      } catch (err) {
        console.error(err);
      }
    };
    loadLocations();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.getMasterReceipts(filters);
      setReceipts(data.receipts);
      setTotalCount(data.total);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value, page: 1 };
      
      // Reset building filter if line changes
      if (key === 'lineId') {
        updated.buildingName = '';
      }
      return updated;
    });
  };

  // Convert receipts list to CSV download
  const handleExportCSV = () => {
    if (receipts.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Receipt Number', 'Global ID', 'Date', 'Donor Name', 'Mobile', 
      'Colony', 'Building', 'Flat', 'Amount', 'Payment Mode', 
      'Status', 'Created By', 'Paid By', 'Cancellation Reason'
    ];

    const rows = receipts.map(r => [
      r.receipt_number,
      r.global_receipt_id,
      new Date(r.created_at).toLocaleDateString(),
      r.donor_name,
      r.donor_mobile,
      r.line_name,
      r.building_name || '-',
      r.flat_number,
      r.amount,
      r.payment_mode,
      r.status,
      r.creator_name || 'System',
      r.collector_name || '-',
      r.cancellation_reason || '-'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mandal_vargani_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 className="card-title" style={{ color: 'var(--primary)', marginBottom: 0 }}><FileText /> Master Receipts & Reports</h2>
        <button className="btn btn-secondary btn-inline" onClick={handleExportCSV}>
          <Download size={16} /> Export CSV/Excel
        </button>
      </div>

      {/* Advanced Filters Grid */}
      <div className="grid-3" style={{ background: 'var(--light-bg)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Line / Colony</label>
          <select 
            className="form-control" 
            value={filters.lineId}
            onChange={(e) => handleFilterChange('lineId', e.target.value)}
          >
            <option value="">All Areas</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Building Name</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search Building Name..."
            value={filters.buildingName}
            onChange={(e) => handleFilterChange('buildingName', e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Payment Status</label>
          <select 
            className="form-control" 
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Payment Mode</label>
          <select 
            className="form-control" 
            value={filters.paymentMode}
            onChange={(e) => handleFilterChange('paymentMode', e.target.value)}
          >
            <option value="">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="ONLINE">ONLINE</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
          <label>Search text (Donor name, Mobile, Receipt No)</label>
          <div className="search-container" style={{ marginBottom: 0 }}>
            <Search className="search-icon" size={16} />
            <input 
              type="text" 
              className="form-control search-input" 
              placeholder="Search donor details..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted"><RefreshCw className="spin" /> Querying receipts...</p>
      ) : receipts.length === 0 ? (
        <p className="text-center text-muted" style={{ padding: '35px' }}>No donation records match the filters.</p>
      ) : (
        <div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Donor Name</th>
                  <th>Mobile</th>
                  <th>Address</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/receipt/${r.secure_token}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                        {r.receipt_number}
                      </a>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td><strong>{r.donor_name}</strong></td>
                    <td>{r.donor_mobile}</td>
                    <td>{r.flat_number} {r.building_name ? `, ${r.building_name}` : ''} ({r.line_name})</td>
                    <td style={{ fontWeight: '600' }}>₹{r.amount}</td>
                    <td>{r.payment_mode}</td>
                    <td>
                      <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                    </td>
                    <td>{r.creator_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination details */}
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>Showing {receipts.length} of {totalCount} records</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. SYSTEM AUDIT TRAILS
// ==========================================
export function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="card">
      <h2 className="card-title" style={{ color: 'var(--primary)' }}><ShieldAlert /> System Audit Trail</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Immutable audit logs documenting every financial change, worker approval, setting modification, and user login action.
      </p>

      {loading ? (
        <p className="text-center text-muted"><RefreshCw className="spin" /> Reading logs...</p>
      ) : logs.length === 0 ? (
        <p className="text-center text-muted" style={{ padding: '20px' }}>No audit logs recorded.</p>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Change Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ fontSize: '13px' }}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>
                    <strong>{log.user_name || 'System / Visitor'}</strong>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{log.user_role}</div>
                  </td>
                  <td>
                    <span className="badge badge-pending" style={{ fontSize: '11px', background: '#f5f6fa', color: '#2f3640', border: '1px solid #dcdde1' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    {log.target_type} {log.target_id && `(ID: ${log.target_id})`}
                  </td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px' }}>
                    {log.old_value && <div><strong>Old:</strong> {log.old_value}</div>}
                    {log.new_value && <div><strong>New:</strong> {log.new_value}</div>}
                    {!log.old_value && !log.new_value && <span className="text-muted">No state changes</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. SYSTEM SETTINGS
// ==========================================
export function AdminSettings() {
  const [mandalName, setMandalName] = useState('');
  const [mandalAddress, setMandalAddress] = useState('');
  const [mandalContact, setMandalContact] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [closeDailyCollectionDate, setCloseDailyCollectionDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Backup states
  const [backupStatus, setBackupStatus] = useState({ lastBackup: 'Never', status: 'NO_BACKUP_YET' });
  const [backingUp, setBackingUp] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchSettingsAndBackup = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setMandalName(data.mandal_name || '');
      setMandalAddress(data.mandal_address || '');
      setMandalContact(data.mandal_contact || '');
      setReceiptFooter(data.receipt_footer || '');
      setTermsConditions(data.terms_conditions || '');
      setCloseDailyCollectionDate(data.close_daily_collection_date || '');

      const bStatus = await api.getBackupStatus();
      setBackupStatus(bStatus);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndBackup();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        mandalName,
        mandalAddress,
        mandalContact,
        receiptFooter,
        termsConditions,
        closeDailyCollectionDate
      });
      alert('Settings updated successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunBackup = async () => {
    setBackingUp(true);
    try {
      const res = await api.runBackup();
      alert(res.message);
      const bStatus = await api.getBackupStatus();
      setBackupStatus(bStatus);
    } catch (err) {
      alert(err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      await api.downloadBackup();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetSystem = async () => {
    const confirmation = window.confirm(
      "WARNING: This will permanently delete all mock/demo workers, areas, receipts, counter sequences, and cash handovers. Your admin login account will be preserved.\n\nAre you absolutely sure you want to clean all demo data?"
    );
    if (!confirmation) return;

    setResetting(true);
    try {
      const res = await api.resetSystem();
      alert(res.message);
      window.location.reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><Settings /> Mandal Settings & Permissions</h2>
        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading configurations...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Mandal Name *</label>
              <input 
                type="text" 
                className="form-control" 
                value={mandalName}
                onChange={(e) => setMandalName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Mandal Address *</label>
              <input 
                type="text" 
                className="form-control" 
                value={mandalAddress}
                onChange={(e) => setMandalAddress(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Mandal Contact Number(s) *</label>
              <input 
                type="text" 
                className="form-control" 
                value={mandalContact}
                onChange={(e) => setMandalContact(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Daily Collection Lock Date (Close Collections Up to this Date)</label>
              <input 
                type="date" 
                className="form-control" 
                value={closeDailyCollectionDate}
                onChange={(e) => setCloseDailyCollectionDate(e.target.value)}
              />
              <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                Normally workers cannot add or modify receipts on or prior to this date. Keep blank to unlock all dates.
              </p>
            </div>

            <div className="form-group">
              <label>Receipt Footer slogan / greetings</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. गणपती बाप्पा मोरया! मंगलमूर्ती मोरया!"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Receipt Terms & Conditions note</label>
              <textarea 
                className="form-control" 
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows="3"
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw className="spin" /> : 'Save Configurations'}
            </button>
          </form>
        )}
      </div>

      {!loading && (
        <div className="card" style={{ marginTop: '24px', borderTop: '2px solid var(--accent)' }}>
          <h3 className="card-title">
            <Award size={18} /> Database Backup & Recovery
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Maintain financial data integrity by replicating the database file locally on the server or downloading a raw copy of the SQLite database to your device.
          </p>
          <div style={{ background: 'var(--light-bg)', padding: '16px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
            <div><strong>Last Server Backup:</strong> {backupStatus.lastBackup}</div>
            <div style={{ marginTop: '4px' }}>
              <strong>Status:</strong>{' '}
              <span className={`badge ${backupStatus.status === 'SUCCESS' ? 'badge-paid' : backupStatus.status === 'FAILED' ? 'badge-cancelled' : 'badge-pending'}`}>
                {backupStatus.status}
              </span>
            </div>
          </div>
          <div className="grid-2">
            <button type="button" className="btn btn-primary" onClick={handleRunBackup} disabled={backingUp}>
              {backingUp ? <RefreshCw className="spin" /> : 'Run Backup on Server'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleDownloadBackup}>
              Download Raw SQLite DB
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ marginTop: '24px', border: '1px solid var(--color-cancelled)', background: 'var(--color-cancelled-bg)' }}>
          <h3 className="card-title" style={{ color: 'var(--color-cancelled)', display: 'flex', gap: '8px' }}>
            <Trash size={18} /> Danger Zone: Reset System
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-cancelled)', marginBottom: '16px' }}>
            This action will permanently delete all mock/demo workers, areas, receipts, counter sequences, and cash handovers. Your admin login account will be preserved. This is recommended before deploying the system for actual collection.
          </p>
          <button 
            type="button" 
            className="btn" 
            style={{ background: 'var(--color-cancelled)', color: 'white', border: 'none' }}
            onClick={handleResetSystem}
            disabled={resetting}
          >
            {resetting ? <RefreshCw className="spin" /> : 'Clear All Demo Data & Reset System'}
          </button>
        </div>
      )}
    </div>
  );
}

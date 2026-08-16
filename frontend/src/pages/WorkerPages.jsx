import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { 
  PlusCircle, Search, Clock, Award, User, RefreshCw, Send, 
  MapPin, CheckCircle, AlertTriangle, XCircle, LogOut, MessageSquare, CreditCard, DollarSign 
} from 'lucide-react';

const getStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const setStorageItem = (key, val) => {
  try {
    localStorage.setItem(key, val);
  } catch (e) {}
};

const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
};

// ==========================================
// 1. WORKER DASHBOARD
// ==========================================
export function WorkerDashboard({ user, setTab, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getMyReceipts('today');
      setSummary(res.summary);
      
      const anns = await api.getAnnouncements();
      setAnnouncements(anns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
        <h3 style={{ fontWeight: '400' }}>Ganpati Utsav 2026</h3>
        <h2 style={{ fontSize: '28px' }}>Welcome, {user.name}</h2>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>Role: Worker / Collection Agent</p>
      </div>

      <div className="card">
        <h3 className="card-title"><Clock size={18} /> Today's Collection Summary</h3>
        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading stats...</p>
        ) : (
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat-box" style={{ background: 'var(--light-bg)' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Paid Amount</div>
              <div className="stat-value" style={{ color: 'var(--color-paid)', fontSize: '20px' }}>
                ₹{summary?.paid_amount || 0}
              </div>
            </div>
            <div className="stat-box" style={{ background: 'var(--light-bg)' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Pending Amount</div>
              <div className="stat-value" style={{ color: 'var(--color-pending)', fontSize: '20px' }}>
                ₹{summary?.pending_amount || 0}
              </div>
            </div>
            <div className="stat-box" style={{ background: 'var(--light-bg)' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Today's Receipts</div>
              <div className="stat-value" style={{ fontSize: '20px' }}>
                {summary?.total_count || 0}
              </div>
            </div>
            <div className="stat-box" style={{ background: 'var(--light-bg)' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Total Cash Expected</div>
              <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '20px' }}>
                ₹{summary?.cash_amount || 0}
              </div>
            </div>
          </div>
        )}
      </div>

      {announcements.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3 className="card-title" style={{ color: 'var(--accent)' }}><MessageSquare size={18} /> Announcements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {announcements.map((ann) => (
              <div key={ann.id} style={{ background: 'var(--light-bg)', padding: '12px', borderRadius: '8px' }}>
                <p style={{ fontWeight: '500', fontSize: '14px' }}>{ann.message}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <span>By {ann.admin_name}</span>
                  <span>{new Date(ann.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={() => setTab('generate')} style={{ minHeight: '56px', fontSize: '18px' }}>
          <PlusCircle size={22} /> Generate Receipt
        </button>
        <div className="grid-2">
          <button className="btn btn-secondary" onClick={() => setTab('search')}>
            <Search size={18} /> Search Receipts
          </button>
          <button className="btn btn-secondary" onClick={() => setTab('my-receipts')}>
            <Clock size={18} /> My Receipts
          </button>
        </div>
        <button className="btn btn-secondary" onClick={() => setTab('settlement')}>
          <Award size={18} /> Cash Settlement
        </button>
        <button className="btn btn-secondary" onClick={onLogout} style={{ color: 'var(--color-cancelled)', borderColor: 'var(--color-cancelled-bg)' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 2. GENERATE RECEIPT FORM (FAST WORKFLOW)
// ==========================================
export function GenerateReceipt({ user }) {
  const [locations, setLocations] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [buildingsList, setBuildingsList] = useState([]);
  
  // Reset-friendly donor states
  const [donorName, setDonorName] = useState('');
  const [donorMobile, setDonorMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');

  // App feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [warningMsg, setWarningMsg] = useState(null);
  const [shareData, setShareData] = useState(null);

  // Load locations and auto-restore line/building assignments
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const data = await api.getLinesBuildings();
        setLocations(data);

        // Auto-select Worker's assigned line
        if (user.assignedLineId) {
          const matchedLine = data.find(l => l.id === user.assignedLineId);
          if (matchedLine) {
            setSelectedLine(String(matchedLine.id));
            setBuildingsList(matchedLine.buildings || []);
            
            // Restore last building from local storage if saved
            const lastBld = getStorageItem('last_saved_building');
            if (lastBld && matchedLine.buildings.some(b => String(b.id) === lastBld)) {
              setSelectedBuilding(lastBld);
            }
          }
        } else {
          // Restore line from local storage
          const lastLine = getStorageItem('last_saved_line');
          if (lastLine) {
            const matchedLine = data.find(l => String(l.id) === lastLine);
            if (matchedLine) {
              setSelectedLine(lastLine);
              setBuildingsList(matchedLine.buildings || []);
              const lastBld = getStorageItem('last_saved_building');
              if (lastBld && matchedLine.buildings.some(b => String(b.id) === lastBld)) {
                setSelectedBuilding(lastBld);
              }
            }
          }
        }
      } catch (err) {
        setError(err.message);
      }
    };
    loadLocations();
  }, [user]);

  // Handle line selection change
  const handleLineChange = (lineId) => {
    setSelectedLine(lineId);
    setStorageItem('last_saved_line', lineId);
    
    const matchedLine = locations.find(l => String(l.id) === lineId);
    const lineBlds = matchedLine ? matchedLine.buildings : [];
    setBuildingsList(lineBlds);
    setSelectedBuilding('');
    removeStorageItem('last_saved_building');
  };

  // Handle building selection change
  const handleBuildingChange = (buildingId) => {
    setSelectedBuilding(buildingId);
    setStorageItem('last_saved_building', buildingId);
  };

  // Submit Handler
  const handleSubmit = async (e, bypassWarning = false) => {
    if (e) e.preventDefault();
    setError(null);
    setWarningMsg(null);
    setSuccess(null);
    setShareData(null);

    if (!selectedLine || !flatNumber || !donorName || !donorMobile || !amount) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        lineId: parseInt(selectedLine),
        buildingName: selectedBuilding || null,
        flatNumber,
        donorName,
        donorMobile,
        amount: parseFloat(amount),
        paymentMode
      };

      const result = await api.createReceipt(data, bypassWarning);
      
      if (result.warning) {
        // Warning triggered (duplicate mobile number found)
        setWarningMsg(result.message);
      } else {
        // Success
        setSuccess(`Receipt ${result.receipt.receipt_number} generated successfully!`);
        setShareData(result.notification);

        // Reset details as required for fast door-to-door
        setDonorName('');
        setDonorMobile('');
        setAmount('');
        setFlatNumber('');
        
        // Retain repeated information: selectedLine, selectedBuilding (already saved in state)
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><PlusCircle /> Generate Receipt</h2>
        
        {error && (
          <div className="alert" style={{ background: 'var(--color-cancelled-bg)', color: 'var(--color-cancelled)' }}>
            <XCircle size={18} /> {error}
          </div>
        )}

        {success && (
          <div className="alert" style={{ background: 'var(--color-paid-bg)', color: 'var(--color-paid)' }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}

        {warningMsg && (
          <div className="alert alert-warning">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600 }}>Duplicate Warning</p>
              <p>{warningMsg}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn btn-primary btn-inline" 
                  onClick={() => handleSubmit(null, true)}
                  disabled={loading}
                >
                  Proceed Anyway
                </button>
                <button 
                  className="btn btn-secondary btn-inline" 
                  onClick={() => setWarningMsg(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {shareData && (
          <div className="card" style={{ border: '2px solid var(--accent)', margin: '10px 0' }}>
            <h4 style={{ color: 'var(--accent)', display: 'flex', gap: '6px' }}><Send size={16} /> Share Digital Receipt</h4>
            <p style={{ fontSize: '13px', margin: '6px 0 12px 0' }}>Share this secure receipt link with the donor immediately.</p>
            <div className="grid-2">
              <a 
                href={shareData.whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-primary"
                style={{ textDecoration: 'none', background: '#25D366' }}
              >
                Share via WhatsApp
              </a>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(shareData.message);
                  alert('Receipt copy copied to clipboard!');
                }}
              >
                Copy Text
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-group">
            <label>Line / Area *</label>
            <select 
              className="form-control" 
              value={selectedLine} 
              onChange={(e) => handleLineChange(e.target.value)}
            >
              <option value="">Select Line/Colony</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} ({loc.prefix})</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Building / Wing</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Building A, Wing X"
                value={selectedBuilding}
                onChange={(e) => handleBuildingChange(e.target.value)}
                disabled={!selectedLine}
              />
            </div>

            <div className="form-group">
              <label>Flat Number *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. 101, A-12"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Donor / Devotee Full Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Enter donor's full name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Donor Mobile Number (10-Digit) *</label>
            <input 
              type="tel" 
              className="form-control" 
              placeholder="Enter 10-digit mobile number"
              value={donorMobile}
              onChange={(e) => setDonorMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div className="form-group">
            <label>Donation Amount (₹) *</label>
            <input 
              type="number" 
              className="form-control" 
              placeholder="e.g. 501, 1001, 5001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Payment Mode *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['CASH', 'ONLINE', 'PENDING'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`btn ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minHeight: '44px', padding: '10px' }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ marginTop: '10px', minHeight: '52px' }}
            disabled={loading}
          >
            {loading ? <RefreshCw className="spin" /> : 'Generate Digital Receipt'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. MY RECEIPTS LIST
// ==========================================
export function MyReceipts() {
  const [period, setPeriod] = useState('today');
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMyReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.getMyReceipts(period);
      setReceipts(data.receipts);
      setSummary(data.summary);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReceipts();
  }, [period]);

  return (
    <div>
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><Clock /> My Receipts</h2>
        
        {/* Toggle Period buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
          {['today', 'week', 'month', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 4px', fontSize: '13px', minHeight: '36px' }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {summary && (
          <div className="grid-3" style={{ marginBottom: '20px' }}>
            <div className="stat-box">
              <div className="text-muted" style={{ fontSize: '11px' }}>Total Count</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>{summary.total_count}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted" style={{ fontSize: '11px' }}>Paid Collection</div>
              <div className="stat-value" style={{ fontSize: '18px', color: 'var(--color-paid)' }}>₹{summary.paid_amount}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted" style={{ fontSize: '11px' }}>Pending</div>
              <div className="stat-value" style={{ fontSize: '18px', color: 'var(--color-pending)' }}>₹{summary.pending_amount}</div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted"><RefreshCw className="spin" /> Loading receipts...</p>
        ) : receipts.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '30px' }}>No receipts generated in this period.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {receipts.map(rec => (
              <div key={rec.id} className="card" style={{ margin: 0, padding: '16px', background: 'var(--light-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{rec.receipt_number}</span>
                  <span className={`badge badge-${rec.status.toLowerCase()}`}>{rec.status}</span>
                </div>
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <strong>Donor:</strong> {rec.donor_name}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <strong>Mobile:</strong> {rec.donor_mobile}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <strong>Flat:</strong> {rec.flat_number} {rec.building_name ? `, ${rec.building_name}` : ''} ({rec.line_name})
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(rec.created_at).toLocaleDateString()}
                  </span>
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>₹{rec.amount}</span>
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
// 4. SEARCH RECEIPTS & PENDING SYSTEM
// ==========================================
export function SearchReceipt({ user }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // States for marking paid
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [updating, setUpdating] = useState(false);

  // States for cancelling
  const [cancellingReceipt, setCancellingReceipt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.searchReceipts(query);
      setResults(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedReceipt) return;
    
    setUpdating(true);
    try {
      const res = await api.markReceiptPaid(selectedReceipt.id, paymentMode);
      alert(`Receipt ${res.receipt.receipt_number} updated to PAID successfully!`);
      setSelectedReceipt(null);
      // Re-run search
      handleSearch();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellingReceipt || !cancelReason.trim()) return;

    setUpdating(true);
    try {
      const res = await api.cancelReceipt(cancellingReceipt.id, cancelReason);
      alert(`Receipt ${res.receipt.receipt_number} cancelled.`);
      setCancellingReceipt(null);
      setCancelReason('');
      handleSearch();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><Search /> Search Receipt</h2>
        
        <form onSubmit={handleSearch} className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="form-control search-input" 
            placeholder="Search by Mobile, Receipt No, Donor Name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }} disabled={loading}>
            {loading ? <RefreshCw className="spin" /> : 'Search'}
          </button>
        </form>

        {searched && !loading && results.length === 0 && (
          <p className="text-center text-muted" style={{ padding: '20px' }}>No matching receipts found.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map(rec => (
            <div key={rec.id} className="card" style={{ margin: 0, padding: '16px', borderLeft: `4px solid ${rec.status === 'PAID' ? 'var(--color-paid)' : rec.status === 'PENDING' ? 'var(--color-pending)' : 'var(--color-cancelled)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--primary)' }}>{rec.receipt_number}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>Year: {rec.year}</span>
                </div>
                <span className={`badge badge-${rec.status.toLowerCase()}`}>{rec.status}</span>
              </div>

              <div style={{ fontSize: '14px', margin: '4px 0' }}><strong>Donor:</strong> {rec.donor_name}</div>
              <div style={{ fontSize: '14px', margin: '4px 0' }}><strong>Mobile:</strong> {rec.donor_mobile}</div>
              <div style={{ fontSize: '14px', margin: '4px 0' }}><strong>Flat:</strong> {rec.flat_number} {rec.building_name ? `, ${rec.building_name}` : ''} ({rec.line_name})</div>
              <div style={{ fontSize: '14px', margin: '4px 0' }}><strong>Amount:</strong> ₹{rec.amount}</div>
              <div style={{ fontSize: '14px', margin: '4px 0' }}><strong>Mode:</strong> {rec.payment_mode}</div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <div>Created by: {rec.creator_name || 'System'} at {new Date(rec.created_at).toLocaleDateString()}</div>
                {rec.status === 'PAID' && (
                  <div style={{ color: 'var(--color-paid)' }}>
                    Paid to: {rec.collector_name || 'System'} on {new Date(rec.paid_at).toLocaleDateString()}
                  </div>
                )}
                {rec.status === 'CANCELLED' && (
                  <div style={{ color: 'var(--color-cancelled)' }}>
                    Cancelled by: {rec.canceller_name} | Reason: {rec.cancellation_reason}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {rec.status === 'PENDING' && (
                  <button 
                    className="btn btn-accent btn-inline" 
                    onClick={() => setSelectedReceipt(rec)}
                  >
                    Mark as Paid
                  </button>
                )}
                {rec.status !== 'CANCELLED' && (
                  <button 
                    className="btn btn-secondary btn-inline"
                    onClick={() => {
                      const shareMsg = `Thank you for contributing to Shree Siddhivinayak Mandal. Receipt No: ${rec.receipt_number}, Amount: ₹${rec.amount}, Status: ${rec.status}. View: ${window.location.origin}/receipt/${rec.secure_token}`;
                      let cleanMob = rec.donor_mobile.replace(/\D/g, '');
                      if (cleanMob.length === 10) cleanMob = `91${cleanMob}`;
                      window.open(`https://api.whatsapp.com/send?phone=${cleanMob}&text=${encodeURIComponent(shareMsg)}`, '_blank');
                    }}
                  >
                    Share
                  </button>
                )}
                {/* Workers can cancel their own pending receipts, Admins can cancel any */}
                {rec.status !== 'CANCELLED' && (rec.status === 'PENDING' || user.role === 'ADMIN') && (
                  <button 
                    className="btn btn-secondary btn-inline"
                    style={{ color: 'var(--color-cancelled)' }}
                    onClick={() => setCancellingReceipt(rec)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MARK AS PAID MODAL */}
      {selectedReceipt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Mark Receipt Paid</h3>
              <button onClick={() => setSelectedReceipt(null)} style={{ border: 'none', background: 'none', width: 'auto', minHeight: 'auto', fontSize: '20px' }}>&times;</button>
            </div>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Updating Receipt <strong>{selectedReceipt.receipt_number}</strong> for <strong>{selectedReceipt.donor_name}</strong> of <strong>₹{selectedReceipt.amount}</strong> to PAID.
            </p>
            <div className="form-group">
              <label>Select Payment Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {['CASH', 'ONLINE'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`btn ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedReceipt(null)} disabled={updating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMarkPaid} disabled={updating}>
                {updating ? <RefreshCw className="spin" /> : 'Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancellingReceipt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cancel Receipt</h3>
              <button onClick={() => setCancellingReceipt(null)} style={{ border: 'none', background: 'none', width: 'auto', minHeight: 'auto', fontSize: '20px' }}>&times;</button>
            </div>
            <div className="form-group">
              <label>Reason for Cancellation *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter cancellation reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCancellingReceipt(null)} disabled={updating}>Close</button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={updating || !cancelReason.trim()}>
                {updating ? <RefreshCw className="spin" /> : 'Cancel Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. SETTLEMENT / HANDOVER SCREEN
// ==========================================
export function Settlements() {
  const [submittedAmount, setSubmittedAmount] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  const fetchSettlements = async () => {
    try {
      // In the worker flow we will pull all settlements. The API will return them.
      const res = await api.getSettlements();
      // Filter only this worker's settlements
      setHistory(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submittedAmount || parseFloat(submittedAmount) <= 0) {
      alert('Please enter a valid submission amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.submitHandover(parseFloat(submittedAmount), explanation);
      alert(res.message);
      setSubmittedAmount('');
      setExplanation('');
      fetchSettlements();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title" style={{ color: 'var(--primary)' }}><Award /> Cash Settlement Handover</h2>
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Submit your collected cash to the Mandal President. The system calculates the expected amount based on your PAID Cash receipts.
          </p>
          <div className="form-group">
            <label>Actual Cash Amount Handed Over (₹) *</label>
            <input 
              type="number" 
              className="form-control" 
              placeholder="Enter submitted cash amount"
              value={submittedAmount}
              onChange={(e) => setSubmittedAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Explanation (Optional - required if amount differs)</label>
            <textarea 
              className="form-control" 
              placeholder="Specify reasons for difference or details..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows="3"
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <RefreshCw className="spin" /> : 'Submit Cash Settlement'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">Handover History</h3>
        {history.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '20px' }}>No handovers submitted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(h => (
              <div key={h.id} style={{ background: 'var(--light-bg)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600' }}>Amount: ₹{h.submitted_amount}</span>
                  <span className={`badge ${h.status === 'VERIFIED' ? 'badge-paid' : 'badge-pending'}`}>
                    {h.status === 'VERIFIED' ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <div>Expected: ₹{h.expected_amount} | Difference: <span style={{ color: h.difference < 0 ? 'var(--color-cancelled)' : h.difference > 0 ? 'var(--color-paid)' : 'inherit', fontWeight: 'bold' }}>{h.difference >= 0 ? '+' : ''}₹{h.difference}</span></div>
                  {h.explanation && <div style={{ fontStyle: 'italic', marginTop: '2px' }}>"{h.explanation}"</div>}
                  <div style={{ fontSize: '11px', marginTop: '6px' }}>Submitted on: {new Date(h.created_at).toLocaleString()}</div>
                  {h.status === 'VERIFIED' && (
                    <div style={{ fontSize: '11px', color: 'var(--color-paid)', marginTop: '2px' }}>Verified by {h.admin_name} on {new Date(h.verified_at).toLocaleDateString()}</div>
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

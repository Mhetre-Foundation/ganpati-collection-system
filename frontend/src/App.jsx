import React, { useState, useEffect } from 'react';
import api from './utils/api.js';
import { 
  WorkerDashboard, GenerateReceipt, MyReceipts, SearchReceipt, Settlements 
} from './pages/WorkerPages.jsx';
import { 
  AdminDashboard, AdminWorkers, AdminLocations, AdminSettlements, AdminReports, AdminAuditLogs, AdminSettings 
} from './pages/AdminPages.jsx';
import { PublicReceipt } from './pages/PublicReceipt.jsx';
import { 
  Home, PlusCircle, Search, Clock, Award, Users, MapPin, 
  FileText, ShieldAlert, Settings, LogOut, CheckCircle, RefreshCw, Smartphone, XCircle
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

export default function App() {
  const [token, setToken] = useState(getStorageItem('mandal_vargani_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Navigation tabs state
  const [tab, setTab] = useState('home');
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'
  
  // Register state
  const [locations, setLocations] = useState([]);
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLine, setRegLine] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  
  // Login state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 1. Monitor network online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Route Routing matching (Intercept secure public receipt view)
  const isPublicReceiptView = window.location.pathname.startsWith('/receipt/');

  // 3. Load user session on start
  useEffect(() => {
    if (isPublicReceiptView) {
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.getMe();
        setUser(data.user);
        // Default admin tab
        if (data.user.role === 'ADMIN') {
          setTab('home');
        } else {
          setTab('home');
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [token]);

  // Load locations list for registration dropdown
  useEffect(() => {
    if (authView === 'register') {
      const loadRegLocations = async () => {
        try {
          const data = await api.getPublicLines();
          setLocations(data);
        } catch (e) {
          console.error(e);
        }
      };
      loadRegLocations();
    }
  }, [authView]);

  const handleLogout = () => {
    removeStorageItem('mandal_vargani_token');
    setToken(null);
    setUser(null);
    setTab('home');
    setAuthView('login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginMobile || !loginPassword) {
      setLoginError('Please enter both mobile and PIN.');
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.login(loginMobile, loginPassword);
      setStorageItem('mandal_vargani_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setTab('home');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName || !regMobile || !regPassword) {
      setRegError('All fields marked * are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register({
        name: regName,
        mobile: regMobile,
        password: regPassword,
        lineId: regLine ? parseInt(regLine) : null
      });
      setRegSuccess(res.message);
      // Reset forms
      setRegName('');
      setRegMobile('');
      setRegPassword('');
      setRegLine('');
      setTimeout(() => {
        setAuthView('login');
        setRegSuccess('');
      }, 5000);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Loader
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--primary)' }} />
        <p className="text-muted">Loading Mandal Receipt app shell...</p>
      </div>
    );
  }

  // Render Public Receipt Lookups
  if (isPublicReceiptView) {
    return <PublicReceipt />;
  }

  // Render Authenticated Dashboard view
  if (token && user) {
    return (
      <div className="app-container">
        
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="online-indicator offline" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000 }}>
            ⚠ Offline Mode: Accessing cached app shell. Receipts require connection to finalize.
          </div>
        )}

        {/* Mobile Header bar */}
        <div className="header-bar">
          <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚩 {user.role === 'ADMIN' ? 'Mandal Admin' : 'Vargani Receipt'}
          </span>
          <button onClick={handleLogout} style={{ border: 'none', background: 'none', width: 'auto', minHeight: 'auto', color: 'white' }}>
            <LogOut size={20} />
          </button>
        </div>

        {/* Desktop Left Sidebar (Only visible on deskop min-width 768px) */}
        <div className="desktop-sidebar">
          <div className="sidebar-header">
            🚩 Mandal System
          </div>
          <ul className="sidebar-menu">
            {user.role === 'ADMIN' ? (
              <>
                <li>
                  <button className={`sidebar-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                    <Home size={18} /> Dashboard
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'workers' ? 'active' : ''}`} onClick={() => setTab('workers')}>
                    <Users size={18} /> Workers & Approvals
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'locations' ? 'active' : ''}`} onClick={() => setTab('locations')}>
                    <MapPin size={18} /> Lines & Buildings
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'settlements' ? 'active' : ''}`} onClick={() => setTab('settlements')}>
                    <Award size={18} /> Cash Settlements
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
                    <FileText size={18} /> Reports & Export
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'audit-logs' ? 'active' : ''}`} onClick={() => setTab('audit-logs')}>
                    <ShieldAlert size={18} /> Audit Logs
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
                    <Settings size={18} /> Settings
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <button className={`sidebar-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                    <Home size={18} /> Dashboard
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'generate' ? 'active' : ''}`} onClick={() => setTab('generate')}>
                    <PlusCircle size={18} /> Generate Receipt
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
                    <Search size={18} /> Search Receipts
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'my-receipts' ? 'active' : ''}`} onClick={() => setTab('my-receipts')}>
                    <Clock size={18} /> My Receipts
                  </button>
                </li>
                <li>
                  <button className={`sidebar-item ${tab === 'settlement' ? 'active' : ''}`} onClick={() => setTab('settlement')}>
                    <Award size={18} /> Cash Handover
                  </button>
                </li>
              </>
            )}
          </ul>
          <div className="sidebar-footer">
            <button className="sidebar-item" onClick={handleLogout} style={{ color: 'var(--color-cancelled)' }}>
              <LogOut size={18} /> Logout Session
            </button>
          </div>
        </div>

        {/* Main Application Body Area */}
        <main className="main-content" style={{ marginTop: !isOnline ? '35px' : '0' }}>
          {user.role === 'ADMIN' ? (
            <>
              {tab === 'home' && <AdminDashboard user={user} setTab={setTab} />}
              {tab === 'workers' && <AdminWorkers />}
              {tab === 'locations' && <AdminLocations />}
              {tab === 'settlements' && <AdminSettlements />}
              {tab === 'reports' && <AdminReports />}
              {tab === 'audit-logs' && <AdminAuditLogs />}
              {tab === 'settings' && <AdminSettings user={user} onLogout={handleLogout} />}
            </>
          ) : (
            <>
              {tab === 'home' && <WorkerDashboard user={user} setTab={setTab} onLogout={handleLogout} />}
              {tab === 'generate' && <GenerateReceipt user={user} />}
              {tab === 'my-receipts' && <MyReceipts />}
              {tab === 'search' && <SearchReceipt user={user} />}
              {tab === 'settlement' && <Settlements />}
            </>
          )}
        </main>

        {/* Mobile Sticky Bottom Menu (Only visible on mobile screens) */}
        <nav className="bottom-nav">
          {user.role === 'ADMIN' ? (
            <>
              <button className={`bottom-nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                <Home />
                <span>Home</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'workers' ? 'active' : ''}`} onClick={() => setTab('workers')}>
                <Users />
                <span>Workers</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
                <FileText />
                <span>Reports</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
                <Settings />
                <span>Settings</span>
              </button>
            </>
          ) : (
            <>
              <button className={`bottom-nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
                <Home />
                <span>Dashboard</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'generate' ? 'active' : ''}`} onClick={() => setTab('generate')}>
                <PlusCircle />
                <span>Receipt</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
                <Search />
                <span>Search</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'my-receipts' ? 'active' : ''}`} onClick={() => setTab('my-receipts')}>
                <Clock />
                <span>History</span>
              </button>
              <button className={`bottom-nav-item ${tab === 'settlement' ? 'active' : ''}`} onClick={() => setTab('settlement')}>
                <Award />
                <span>Settlement</span>
              </button>
            </>
          )}
        </nav>
      </div>
    );
  }

  // Render Login and Register screen
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '30px' }}>
        
        {/* App Logo/Branding Header */}
        <div className="text-center" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '16px', marginBottom: '12px' }}>
            <Smartphone size={32} />
          </div>
          <h2 style={{ color: 'var(--primary)', fontWeight: '700' }}>Mandal Vargani</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Digital Receipt & Collection Management</p>
        </div>

        {authView === 'login' ? (
          /* ==========================================
             LOGIN VIEW
             ========================================== */
          <form onSubmit={handleLogin}>
            {loginError && (
              <div className="alert" style={{ background: 'var(--color-cancelled-bg)', color: 'var(--color-cancelled)', border: '1px solid var(--border)' }}>
                <XCircle size={18} /> {loginError}
              </div>
            )}
            
            <div className="form-group">
              <label>Mobile Number / Login ID</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter 10-digit number"
                value={loginMobile}
                onChange={(e) => setLoginMobile(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>PIN / Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="Enter PIN / Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ minHeight: '52px' }}>
              Login Securely
            </button>
            
            <div className="text-center" style={{ marginTop: '20px', fontSize: '14px' }}>
              <span className="text-muted">New Collection Agent? </span>
              <button 
                type="button" 
                onClick={() => setAuthView('register')} 
                style={{ display: 'inline', width: 'auto', minHeight: 'auto', background: 'none', color: 'var(--primary)', fontWeight: '600' }}
              >
                Register Now
              </button>
            </div>
            
            <div className="text-center text-muted" style={{ marginTop: '24px', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              President Admin Credentials: <strong>9999999999</strong> / <strong>admin123</strong>
            </div>
          </form>
        ) : (
          /* ==========================================
             REGISTER VIEW
             ========================================== */
          <form onSubmit={handleRegister}>
            {regError && (
              <div className="alert" style={{ background: 'var(--color-cancelled-bg)', color: 'var(--color-cancelled)', border: '1px solid var(--border)' }}>
                <XCircle size={18} /> {regError}
              </div>
            )}

            {regSuccess && (
              <div className="alert" style={{ background: 'var(--color-paid-bg)', color: 'var(--color-paid)', border: '1px solid var(--border)' }}>
                <CheckCircle size={18} /> {regSuccess}
              </div>
            )}

            <div className="form-group">
              <label>Full Name *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter full name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Mobile Number *</label>
              <input 
                type="tel" 
                className="form-control" 
                placeholder="Enter 10-digit number"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>

            <div className="form-group">
              <label>Choose Password/PIN *</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="Set numeric PIN or password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Preferred Collection Line/Area</label>
              <select 
                className="form-control" 
                value={regLine}
                onChange={(e) => setRegLine(e.target.value)}
              >
                <option value="">Select Area Colony</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ minHeight: '52px' }}>
              Submit Request
            </button>

            <div className="text-center" style={{ marginTop: '20px', fontSize: '14px' }}>
              <span className="text-muted">Already registered? </span>
              <button 
                type="button" 
                onClick={() => setAuthView('login')} 
                style={{ display: 'inline', width: 'auto', minHeight: 'auto', background: 'none', color: 'var(--primary)', fontWeight: '600' }}
              >
                Login here
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { CheckCircle, AlertTriangle, Printer, Share2, ArrowLeft, Loader } from 'lucide-react';

export function PublicReceipt() {
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract secure token from URL path
  // Since we are using a state-based router, the token will be parsed in App.jsx and passed down,
  // or extracted from window.location.pathname.
  useEffect(() => {
    const fetchReceiptDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        // Path matches: /receipt/{token}
        const pathParts = window.location.pathname.split('/');
        const token = pathParts[pathParts.length - 1];
        
        if (!token) {
          throw new Error('Receipt verification token is missing.');
        }

        const data = await api.getPublicReceipt(token);
        setReceipt(data.receipt);
        setSettings(data.settings);
        setQrCode(data.qrCode);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReceiptDetails();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
        <Loader className="spin" size={32} style={{ color: 'var(--primary)' }} />
        <p className="text-muted">Verifying digital receipt security...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px', maxWidth: '500px', margin: '50px auto' }} className="card text-center">
        <AlertTriangle size={48} style={{ color: 'var(--color-cancelled)', margin: '0 auto 16px auto' }} />
        <h2>Verification Failed</h2>
        <p className="text-muted" style={{ margin: '10px 0 20px 0' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
          Go to Login / Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '20px auto', padding: '16px' }} className="receipt-container">
      {/* Back button (Only visible in browser, hidden in print) */}
      <button 
        className="btn btn-secondary btn-inline no-print" 
        onClick={() => window.location.href = '/'}
        style={{ marginBottom: '16px', display: 'inline-flex', width: 'auto' }}
      >
        <ArrowLeft size={16} /> Home
      </button>

      {/* The Printable Receipt Card */}
      <div className="card" style={{ border: '2px solid var(--accent)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
        
        {/* Decorative corner tag (Verifiability status) */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '700',
          background: receipt.status === 'PAID' ? 'var(--color-paid-bg)' : receipt.status === 'PENDING' ? 'var(--color-pending-bg)' : 'var(--color-cancelled-bg)',
          color: receipt.status === 'PAID' ? 'var(--color-paid)' : receipt.status === 'PENDING' ? 'var(--color-pending)' : 'var(--color-cancelled)',
        }}>
          {receipt.status === 'PAID' ? '✓ VERIFIED' : receipt.status === 'PENDING' ? '⚠ PENDING' : '✗ CANCELLED'}
        </div>

        {/* Receipt Header */}
        <div className="text-center" style={{ marginBottom: '20px', borderBottom: '1px dashed var(--border)', paddingBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
            ॥ श्री गणेशाय नमः ॥
          </div>
          
          <h2 style={{ color: 'var(--primary)', fontSize: '20px', fontWeight: '700', lineHeight: '1.2', margin: '4px 0' }}>
            {settings?.mandal_name || 'Ganesh Mandal'}
          </h2>
          
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {settings?.mandal_address}
          </div>

          <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--primary)', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em' }}>
            GANPATI FESTIVAL {receipt.year}
          </div>
          
          <h3 style={{ fontSize: '15px', color: 'var(--dark-slate)', marginTop: '12px', fontWeight: '600' }}>
            DIGITAL VARGANI RECEIPT
          </h3>
        </div>

        {/* Receipt Body Meta Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          <span><strong>Receipt No:</strong> {receipt.receipt_number}</span>
          <span><strong>Date:</strong> {new Date(receipt.created_at).toLocaleDateString()}</span>
        </div>

        {/* Donor info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid hsl(210, 10%, 96%)', paddingBottom: '4px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)' }}>Donor Name:</span>
            <span style={{ fontWeight: '600' }}>{receipt.donor_name}</span>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid hsl(210, 10%, 96%)', paddingBottom: '4px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)' }}>Mobile Number:</span>
            <span>{receipt.donor_mobile}</span>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid hsl(210, 10%, 96%)', paddingBottom: '4px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)' }}>Address:</span>
            <span>
              {receipt.flat_number}
              {receipt.building_name ? `, ${receipt.building_name}` : ''}
              {receipt.line_name ? `, ${receipt.line_name}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid hsl(210, 10%, 96%)', paddingBottom: '4px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)' }}>Payment Mode:</span>
            <span style={{ fontWeight: '500' }}>{receipt.payment_mode}</span>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid hsl(210, 10%, 96%)', paddingBottom: '4px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)' }}>Status:</span>
            <span style={{ 
              fontWeight: '700', 
              color: receipt.status === 'PAID' ? 'var(--color-paid)' : receipt.status === 'PENDING' ? 'var(--color-pending)' : 'var(--color-cancelled)' 
            }}>
              {receipt.status}
            </span>
          </div>

          {receipt.status === 'CANCELLED' && (
            <div style={{ background: 'var(--color-cancelled-bg)', color: 'var(--color-cancelled)', padding: '8px', borderRadius: '6px', fontSize: '12px', marginTop: '6px' }}>
              <strong>Cancellation Reason:</strong> {receipt.cancellation_reason}
            </div>
          )}
        </div>

        {/* Large Amount Box */}
        <div className="text-center" style={{ background: 'var(--light-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Donation Amount Contributed
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>
            ₹{receipt.amount}
          </div>
        </div>

        {/* QR Code and Signatures */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>
          {qrCode && (
            <div style={{ textAlign: 'center' }}>
              <img src={qrCode} alt="Verification QR Code" style={{ width: '100px', height: '100px' }} />
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Scan to Verify</div>
            </div>
          )}

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Collected By:</span>
              <div style={{ fontWeight: '500' }}>{receipt.collector_name || receipt.creator_name || 'System'}</div>
            </div>
            {receipt.paid_at && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                On: {new Date(receipt.paid_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>
        </div>

        {/* Footer text configured by Admin */}
        {settings?.receipt_footer && (
          <div className="text-center" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            {settings.receipt_footer}
          </div>
        )}
      </div>

      {/* Receipts Control Buttons (Hidden in print) */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Print Receipt
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={async () => {
            const shareData = {
              title: `${settings?.mandal_name || 'Mandal'} - Receipt ${receipt.receipt_number}`,
              text: `Thank you for contributing to ${settings?.mandal_name || 'Mandal'}.\nReceipt No: ${receipt.receipt_number}\nAmount: ₹${receipt.amount}\nStatus: ${receipt.status}\n\nVerify receipt here:`,
              url: window.location.href
            };

            if (navigator.share) {
              try {
                await navigator.share(shareData);
              } catch (err) {
                console.log('Native share canceled or failed', err);
              }
            } else {
              const shareText = `${shareData.text} ${shareData.url}`;
              navigator.clipboard.writeText(shareText);
              alert('Receipt link copied to clipboard!');
            }
          }}
        >
          <Share2 size={18} /> Share Receipt
        </button>
      </div>
    </div>
  );
}

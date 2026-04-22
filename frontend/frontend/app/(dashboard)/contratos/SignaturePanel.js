'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  surface2:'var(--surface2)',
  border:  'var(--border)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  accent:  'var(--accent)',
  success: 'var(--success)',
  danger:  'var(--danger)',
  warning: 'var(--warning)',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} title="Copiar enlace"
      style={{
        background: copied ? 'rgba(0,201,167,0.12)' : C.surface2,
        border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '5px 10px', fontSize: 12, color: copied ? C.success : C.muted,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
      }}>
      {copied ? (
        <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copiado</>
      ) : (
        <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar</>
      )}
    </button>
  );
}

/**
 * SignaturePanel — shows / manages e-signature state for a contract.
 *
 * Props:
 *   contractId  {number}
 *   contractStatus {string}  — current contract status
 *   onStatusChange {fn}      — callback when contract gets signed
 */
export default function SignaturePanel({ contractId, contractStatus, onStatusChange }) {
  const [sig,     setSig]     = useState(null);   // signature record
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      const data = await api.signatureStatus(contractId);
      setSig(data.data || null);
    } catch (_) {
      setSig(null);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const requestSignature = async () => {
    setWorking(true);
    setError('');
    try {
      const data = await api.signatureRequest(contractId);
      await load();
      // Also update parent if link was generated
      if (data.link) {
        // open in new tab optionally
      }
    } catch (err) {
      setError(err.message || 'Error al solicitar firma');
    } finally {
      setWorking(false);
    }
  };

  const resendLink = async () => {
    setWorking(true);
    setError('');
    try {
      await api.signatureRequest(contractId);
      await load();
    } catch (err) {
      setError(err.message || 'Error');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return (
    <div style={{ padding: '12px 0', color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Cargando estado de firma...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Signed ────────────────────────────────────────────────────────────────
  if (sig?.status === 'signed' || contractStatus === 'signed') {
    return (
      <div style={{ background: 'rgba(0,201,167,0.06)', border: `1px solid rgba(0,201,167,0.3)`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sig?.signer_name ? 8 : 0 }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>Contrato firmado</span>
          <span style={{ background: 'rgba(0,201,167,0.15)', color: C.success, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>FIRMADO</span>
        </div>
        {sig?.signer_name && (
          <div style={{ fontSize: 13, color: C.muted }}>
            Firmado por <strong style={{ color: C.text }}>{sig.signer_name}</strong>
            {sig.signer_email && <> ({sig.signer_email})</>}
            {sig.signed_at && <> el <strong style={{ color: C.text }}>{fmtDate(sig.signed_at)}</strong></>}
            {sig.ip_address && <><br /><span style={{ fontSize: 11 }}>IP: {sig.ip_address}</span></>}
          </div>
        )}
        {!sig?.signer_name && contractStatus === 'signed' && (
          <div style={{ fontSize: 13, color: C.muted }}>Este contrato ha sido marcado como firmado manualmente.</div>
        )}
      </div>
    );
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (sig?.status === 'pending') {
    const isExpired = new Date(sig.expires_at) < new Date();
    return (
      <div style={{ background: isExpired ? 'rgba(255,91,91,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${isExpired ? 'rgba(255,91,91,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <svg width="16" height="16" fill="none" stroke={isExpired ? C.danger : C.warning} strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: isExpired ? C.danger : C.warning }}>
            {isExpired ? 'Enlace expirado' : 'Esperando firma'}
          </span>
        </div>

        {!isExpired && (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
              Expira el <strong style={{ color: C.text }}>{fmtDate(sig.expires_at)}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <a href={sig.link} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, fontSize: 12, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                {sig.link}
              </a>
              <CopyButton text={sig.link} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resendLink} disabled={working}
            style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: working ? 0.6 : 1 }}>
            {working ? 'Generando...' : (isExpired ? 'Generar nuevo enlace' : 'Reenviar / Nuevo enlace')}
          </button>
        </div>

        {error && <div style={{ marginTop: 8, fontSize: 12, color: C.danger }}>{error}</div>}
      </div>
    );
  }

  // ── No signature yet ──────────────────────────────────────────────────────
  return (
    <div style={{ background: C.surface2, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" fill="none" stroke={C.muted} strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Sin firma electrónica solicitada
      </div>
      <button onClick={requestSignature} disabled={working}
        style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: working ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {working ? 'Generando enlace...' : 'Solicitar firma electrónica'}
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: C.danger }}>{error}</div>}
    </div>
  );
}

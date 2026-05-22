'use client';
import { useEffect, useState, useCallback } from 'react';
import { registerToast } from '../../lib/toast';

const COLORS = {
  success: { bg: '#10b981', icon: '✓' },
  error:   { bg: '#ef4444', icon: '✕' },
  info:    { bg: '#3b82f6', icon: 'ℹ' },
  warning: { bg: '#f59e0b', icon: '⚠' },
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]); // { id, kind, msg, ttl }
  const [confirms, setConfirms] = useState([]); // { id, msg, resolve }

  const push = useCallback((t) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, ttl: t.ttl ?? 4000, ...t }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), t.ttl ?? 4000);
  }, []);

  const pushConfirm = useCallback((c) => {
    const id = Date.now() + Math.random();
    setConfirms(prev => [...prev, { id, ...c }]);
  }, []);

  useEffect(() => { registerToast(push, pushConfirm); }, [push, pushConfirm]);

  const resolveConfirm = (id, value) => {
    setConfirms(prev => {
      const c = prev.find(x => x.id === id);
      if (c?.resolve) c.resolve(value);
      return prev.filter(x => x.id !== id);
    });
  };

  return (
    <>
      {/* Toasts */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
        maxWidth: 'min(400px, calc(100vw - 32px))',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.kind] || COLORS.info;
          return (
            <div key={t.id} role="alert" style={{
              background: c.bg, color: '#fff', padding: '12px 16px',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, fontWeight: 600, pointerEvents: 'auto',
              animation: 'toastIn 0.2s ease-out',
            }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{t.msg}</span>
            </div>
          );
        })}
      </div>

      {/* Confirms */}
      {confirms.map(c => (
        <div key={c.id} role="dialog" aria-modal="true"
          onClick={() => resolveConfirm(c.id, false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface, #fff)', color: 'var(--text, #111)',
            borderRadius: 12, padding: 22, maxWidth: 420, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 18 }}>{c.msg}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => resolveConfirm(c.id, false)} style={{
                padding: '10px 18px', minHeight: 44, background: 'transparent',
                border: '1px solid var(--border, #cbd5e1)', borderRadius: 8,
                color: 'var(--muted, #475569)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{c.cancelLabel || 'Cancelar'}</button>
              <button onClick={() => resolveConfirm(c.id, true)} style={{
                padding: '10px 18px', minHeight: 44, background: c.danger ? '#ef4444' : '#1a3c8f',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>{c.confirmLabel || 'Confirmar'}</button>
            </div>
          </div>
        </div>
      ))}

      <style jsx global>{`
        @keyframes toastIn {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../lib/api';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

const C = {
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  surface2: 'var(--surface2, rgba(255,255,255,0.04))',
  border:   'var(--border)',
  text:     'var(--text)',
  muted:    'var(--muted)',
  accent:   'var(--accent)',
  success:  'var(--success)',
  danger:   'var(--danger, #ef4444)',
};

function avatarInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function avatarColor(name) {
  const colors = ['#1b9af5','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return colors[h % colors.length];
}
function fmtDate(iso, lang) {
  if (!iso) return '';
  const locale = lang === 'en' ? 'en' : 'es';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

function ComposeModal({ onClose, onSent, defaultAccount = 'operations', lang }) {
  const [form, setForm] = useState({ to_email: '', cc: '', subject: '', body: '' });
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onPickFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    const next = [];
    for (const f of list) {
      const buf = await f.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      next.push({ name: f.name, mime: f.type || 'application/octet-stream', base64: b64 });
    }
    setFiles(prev => [...prev, ...next]);
    e.target.value = '';
  };

  const send = async () => {
    if (!form.to_email || !form.subject || !form.body) { setErr(t('email.fillAll', lang)); return; }
    setSending(true);
    try {
      const r = await api.sendEmail({
        to_email: form.to_email,
        cc: form.cc || undefined,
        subject: form.subject,
        body: form.body,
        body_html: form.body.replace(/\n/g, '<br>'),
        attachments: files.map(f => ({ filename: f.name, mimeType: f.mime, content: f.base64 })),
      });
      if (!r.ok) throw new Error(r.error || 'No se pudo enviar');
      onSent(r);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '20px 24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t('email.new', lang)}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: C.muted }}>De: <strong style={{ color: C.text }}>info@energydepotpr.com</strong></div>
          {[[t('email.to', lang), 'to_email', 'email'], ['CC (opcional)', 'cc', 'email'], [t('email.subject', lang), 'subject', 'text']].map(([lbl, key, type]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{lbl}</label>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none' }} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{t('email.message', lang)}</label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={8}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Adjuntos</label>
            <label style={{ background: C.bg, border:`1px dashed ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:12, color:C.text, cursor:'pointer', alignSelf:'flex-start' }}>
              📎 Subir archivo
              <input type="file" multiple onChange={onPickFiles} style={{ display:'none' }} />
            </label>
            {files.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 10px', fontSize:12 }}>
                <span style={{ color:C.text }}>📄 {f.name} <span style={{ color:C.muted }}>({Math.round(f.base64.length*0.75/1024)} KB)</span></span>
                <button onClick={() => setFiles(files.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14 }}>×</button>
              </div>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 18px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>{t('email.cancel', lang)}</button>
          <button onClick={send} disabled={sending} style={{ background: sending ? '#6b7280' : C.accent, border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: sending ? 'not-allowed' : 'pointer' }}>
            {sending ? t('email.sending', lang) : t('email.send', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailPage() {
  const { lang } = useLang();
  const [tab, setTab]           = useState('recibidos');
  const [account, setAccount]   = useState('operations');
  const [emails, setEmails]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');
  const [selected, setSelected] = useState(null);
  const [compose, setCompose]   = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  // Track which accounts have been synced this session (avoid re-sync on tab/account switch)
  const syncedAccounts = useRef(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = useCallback((direction, acc) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (direction) params.set('direction', direction);
    if (acc) params.set('account', acc);
    const qs = params.toString() ? `?${params.toString()}` : '';
    api.emails(qs).then(r => {
      setEmails(r.emails || []);
    }).catch(() => setEmails([])).finally(() => setLoading(false));
  }, []);

  const syncAndLoad = useCallback(async (acc) => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await api.syncEmails(acc);
      setSyncMsg(r.saved > 0 ? `+${r.saved} (${r.inbox||0} recibidos, ${r.sent||0} enviados)` : 'Sin correos nuevos');
      setTimeout(() => setSyncMsg(''), 3000);
      load(tab === 'enviados' ? 'outbound' : tab === 'recibidos' ? 'inbound' : '', acc);
    } catch (e) {
      setSyncMsg('Error al sincronizar');
      setTimeout(() => setSyncMsg(''), 3000);
      load(tab === 'enviados' ? 'outbound' : tab === 'recibidos' ? 'inbound' : '', acc);
    } finally {
      setSyncing(false);
    }
  }, [tab, load]);

  // On tab/account change: load from DB. Sync only once per account per session.
  useEffect(() => {
    const direction = tab === 'enviados' ? 'outbound' : tab === 'recibidos' ? 'inbound' : '';
    if (!syncedAccounts.current.has(account)) {
      // First time opening this account — sync then load
      syncedAccounts.current.add(account);
      syncAndLoad(account);
    } else {
      load(direction, account);
    }
    setSelected(null);
    setShowDetail(false);
  }, [tab, account]);

  const handleSelect = async (email) => {
    setSelected(email);
    setShowDetail(true);
    if (!email.read) {
      api.markEmailRead(email.id).catch(() => {});
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('email.confirmDelete', lang))) return;
    await api.deleteEmail(id).catch(() => {});
    setEmails(prev => prev.filter(e => e.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const TABS = [
    { key: 'recibidos', label: t('email.tab.received', lang) },
    { key: 'enviados',  label: t('email.tab.sent', lang)     },
    { key: 'todos',     label: t('email.tab.all', lang)      },
  ];

  const EmailList = () => (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {loading && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          {syncing ? t('email.syncing', lang) : t('common.loading', lang)}
        </div>
      )}
      {!loading && emails.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 6 }}>
            {tab === 'enviados' ? t('email.empty.sent', lang) : tab === 'recibidos' ? t('email.empty.received', lang) : t('email.empty.all', lang)}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {tab === 'recibidos' ? t('email.hint.received', lang) : t('email.hint.sent', lang)}
          </div>
          {tab !== 'enviados' && (
            <button onClick={() => setCompose(true)} style={{ marginTop: 20, background: C.accent, border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              {t('email.cta', lang)}
            </button>
          )}
        </div>
      )}
      {!loading && emails.map(email => {
        const isSelected = selected?.id === email.id;
        const name = email.direction === 'outbound' ? email.to_email : (email.from_name || email.from_email || '?');
        return (
          <div key={email.id}
            onClick={() => handleSelect(email)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', cursor: 'pointer',
              background: isSelected ? `${C.accent}12` : 'transparent',
              borderBottom: `1px solid ${C.border}`,
              borderLeft: isSelected ? `3px solid ${C.accent}` : '3px solid transparent',
              transition: 'background 0.1s',
            }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {avatarInitials(name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: email.read ? 500 : 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  {name}
                </span>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmtDate(email.created_at, lang)}</span>
              </div>
              <div style={{ fontSize: 13, color: email.read ? C.muted : C.text, fontWeight: email.read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.subject || t('email.noSubject', lang)}
              </div>
              <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {(email.body || '').slice(0, 80)}
              </div>
            </div>
            {!email.read && email.direction === 'inbound' && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: 6 }} />
            )}
          </div>
        );
      })}
    </div>
  );

  const EmailDetail = () => {
    if (!selected) return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexDirection: 'column', gap: 12 }}>
        <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ opacity: 0.3 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        <span style={{ fontSize: 14 }}>{t('email.select', lang)}</span>
      </div>
    );
    const fromName = selected.direction === 'outbound' ? selected.from_name : (selected.from_name || selected.from_email || '?');
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{selected.subject || t('email.noSubject', lang)}</h2>
            <button onClick={() => handleDelete(selected.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, borderRadius: 6 }}
              title={t('email.delete', lang)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(fromName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {avatarInitials(fromName)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fromName}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {selected.direction === 'outbound'
                  ? `${t('email.to_label', lang)} ${selected.to_email}`
                  : `${t('email.from_label', lang)} ${selected.from_email}`} · {fmtDate(selected.created_at, lang)}
              </div>
              {selected.account && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {t('email.account_label', lang)} {selected.account}@energydepotpr.com
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected.body_html
            ? <iframe
                srcDoc={selected.body_html}
                sandbox="allow-same-origin"
                style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
                title="email-body"
              />
            : <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontSize: 14, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selected.body || <span style={{ color: C.muted, fontSize: 13 }}>{t('email.noContent', lang)}</span>}
              </div>
          }
        </div>
        {selected.direction === 'inbound' && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => setCompose(true)}
              style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              {t('email.reply', lang)}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke={C.accent} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>{t('email.title', lang)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{t('email.inbox', lang)}</div>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sync button */}
          <button onClick={() => syncAndLoad(account)} disabled={syncing}
            style={{ background: syncing ? C.surface2 : `${C.accent}15`, border: `1px solid ${syncing ? C.border : C.accent}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: syncing ? C.muted : C.accent, cursor: syncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {syncing ? 'Sync...' : t('email.sync', lang)}
          </button>

          {syncMsg && (
            <span style={{ fontSize: 12, color: syncMsg.includes('Error') ? C.danger : C.success, fontWeight: 600 }}>
              {syncMsg}
            </span>
          )}

          {/* Compose */}
          <button onClick={() => setCompose(true)}
            style={{ background: C.accent, border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            {t('email.compose', lang)}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        {TABS.map(tab_ => (
          <button key={tab_.key} onClick={() => { setTab(tab_.key); setSelected(null); setShowDetail(false); }}
            style={{ padding: '11px 20px', fontSize: 13, fontWeight: tab === tab_.key ? 700 : 400, color: tab === tab_.key ? C.accent : C.muted, background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === tab_.key ? `2px solid ${C.accent}` : '2px solid transparent', transition: 'color 0.15s' }}>
            {tab_.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {isMobile ? (
          showDetail && selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button onClick={() => { setShowDetail(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 14 }}>← Volver</button>
              </div>
              <EmailDetail />
            </div>
          ) : (
            <EmailList />
          )
        ) : (
          <>
            <div style={{ width: 320, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <EmailList />
            </div>
            <EmailDetail />
          </>
        )}
      </div>

      {compose && (
        <ComposeModal
          defaultAccount={account}
          lang={lang}
          onClose={() => setCompose(false)}
          onSent={() => { load(tab === 'enviados' ? 'outbound' : tab === 'todos' ? '' : 'inbound', account); }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

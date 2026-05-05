'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useLang } from '../../lib/lang-context';
import { t } from '../../lib/lang';
import Logo from '../components/Logo';

function useTheme() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    const saved = localStorage.getItem('crm_theme') || (mobile ? 'light' : 'dark');
    setTheme(saved);
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('crm_theme', next);
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };
  return { theme, toggle };
}

// Kommo-style mobile bottom nav: 4 tabs + center + button
const NAV_MOBILE = [
  { href: '/inbox',     label: 'Chats',  tKey: 'nav.chats',  icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', badge: true },
  { href: '/dashboard', label: 'Inicio', tKey: 'nav.home',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  // center + button (special, rendered inline)
  { href: '/leads',     label: 'Leads',  tKey: 'nav.leads',  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

// Kommo-style main sidebar items (like real Kommo)
const NAV_SIDEBAR_MAIN = [
  { href: '/dashboard',    label: 'Inicio',     tKey: 'nav.home',      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/leads',        label: 'Leads',      tKey: 'nav.leads',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/cotizaciones', label: 'Cotizar',    tKey: 'nav.cotizar',   icon: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6m-6 4h3m6-1l-3 3-1.5-1.5' },
  { href: '/inbox',        label: 'Chats',      tKey: 'nav.chats',     icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', badge: true },
  { href: '/email',        label: 'Correo',     tKey: 'nav.email',     icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/alerts',       label: 'Alertas',    tKey: 'nav.alerts',    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', alertBadge: true },
];

// Extra items hidden under "Más" button — grouped by section
const NAV_SIDEBAR_EXTRA = [
  // Facturas y Contratos (activos)
  { href: '/facturas',     label: 'Facturas',     tKey: 'nav.invoices',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', section: 'Finanzas', sKey: 'sec.finance' },
  { href: '/contratos',    label: 'Contratos',    tKey: 'nav.contracts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', section: 'Finanzas', sKey: 'sec.finance' },
  // GIGI — desactivado para Energy Depot PR (biblioteca de tours de Fix A Trip)
  /* { href: '/biblioteca-gigi', label: 'Biblioteca GIGI', tKey: 'nav.libgigi', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', section: 'GIGI', sKey: 'sec.gigi' }, */
  /* VENTAS — desactivado temporalmente, reactivar cuando se necesite
  { href: '/productos',    label: 'Catálogo',     icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', section: 'Ventas' },
  { href: '/cotizaciones', label: 'Cotizaciones', icon: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6m-6 4h3', section: 'Ventas' },
  */
  /* MARKETING — desactivado temporalmente, reactivar cuando se necesite
  { href: '/segmentos',    label: 'Segmentos',    icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z', section: 'Marketing' },
  { href: '/campanas',     label: 'Campañas',     icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', section: 'Marketing' },
  { href: '/secuencias',   label: 'Secuencias',   icon: 'M13 10V3L4 14h7v7l9-11h-7z', section: 'Marketing' },
  */
  // Comunicación
  { href: '/contacts',     label: 'Contactos',    tKey: 'nav.contacts',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', section: 'Comunicación', sKey: 'sec.comms' },
  { href: '/equipo',       label: 'Equipo',       tKey: 'nav.team',          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', section: 'Comunicación', sKey: 'sec.comms' },
  { href: '/email',        label: 'Correos',      tKey: 'nav.email',         icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', section: 'Comunicación', sKey: 'sec.comms' },
  { href: '/llamadas',     label: 'Llamadas',     tKey: 'nav.calls',         icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', section: 'Comunicación', sKey: 'sec.comms' },
  // Booking y Menús — desactivado para Energy Depot PR (tours, no solar)
  /* { href: '/agenda',       label: 'Booking',      tKey: 'nav.booking',       icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', section: 'Comunicación', sKey: 'sec.comms' },
  { href: '/menus',        label: 'Menús',        tKey: 'nav.menus',         icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', section: 'Comunicación', sKey: 'sec.comms' }, */
  // Viajes — desactivado para Energy Depot PR (solar, no tours)
  /* { href: '/propuesta',    label: 'Propuesta IA', tKey: 'nav.proposal',      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', section: 'Viajes', sKey: 'sec.trips' },
  { href: '/itinerario',   label: 'Itinerarios',  tKey: 'nav.itinerary',     icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', section: 'Viajes', sKey: 'sec.trips' },
  { href: '/proveedores',  label: 'Proveedores',  tKey: 'nav.suppliers',     icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', section: 'Viajes', sKey: 'sec.trips' }, */
  // Config
  { href: '/agents',       label: 'Usuarios',     tKey: 'nav.users',         icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', section: 'Config', sKey: 'sec.config' },
  { href: '/herramientas', label: 'Herramientas', tKey: 'nav.tools',         icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', section: 'Config', sKey: 'sec.config' },
  { href: '/integrations', label: 'Integraciones',tKey: 'nav.integrations',  icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', section: 'Config', sKey: 'sec.config' },
  { href: '/settings',     label: 'Ajustes',      tKey: 'nav.settings',      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', section: 'Config', sKey: 'sec.config' },
];

// Keep for backward compat (mobile uses this)
const NAV_ALL_SIDEBAR = [...NAV_SIDEBAR_MAIN, ...NAV_SIDEBAR_EXTRA];

function Icono({ path, size = 24, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

// ── Toast notifications ───────────────────────────────────────────────────────
function Toast({ id, title, body, href, onDismiss }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      onClick={() => { if (href) { router.push(href); } onDismiss(id); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        cursor: href ? 'pointer' : 'default',
        animation: 'toastIn 0.3s ease',
        minWidth: 240, maxWidth: 300,
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{title}</div>
        {body && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 1 }}>{body}</div>}
      </div>
      <button onClick={e => { e.stopPropagation(); onDismiss(id); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1 }}>✕</button>
    </div>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();
  const timer = useRef(null);
  const { lang: gLang } = useLang();

  useEffect(() => {
    const fn = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const buscar = (q) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults(null); setOpen(false); return; }
    timer.current = setTimeout(() => {
      api.search(q).then(r => { setResults(r); setOpen(true); }).catch(() => {});
    }, 300);
  };

  const total = results ? results.contacts.length + results.leads.length + results.messages.length : 0;
  const go = (path) => { router.push(path); setOpen(false); setQuery(''); };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={query} onChange={e => buscar(e.target.value)} onFocus={() => results && setOpen(true)}
          placeholder={t('nav.search', gLang)}
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14, color: 'var(--text)', outline: 'none' }}
        />
      </div>
      {open && results && total > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, zIndex: 100, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
          {results.contacts.slice(0, 3).map(c => (
            <button key={c.id} onClick={() => go(`/contacts/${c.id}`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: '#1b9af5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{c.name[0]?.toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                {c.phone && <div style={{ color: 'var(--muted)', fontSize: 11 }}>{c.phone}</div>}
              </div>
            </button>
          ))}
          {results.leads.slice(0, 3).map(l => (
            <button key={l.id} onClick={() => go(`/leads?id=${l.id}`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sheet "Más" (móvil) ───────────────────────────────────────────────────────
function MoreSheet({ open, onClose, user, logout, alertCount, lang }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!open) return null;

  const extras = NAV_SIDEBAR_EXTRA;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2a2d3a' }} />
        </div>

        {/* Búsqueda */}
        <div style={{ padding: '0 16px 16px' }}>
          <GlobalSearch />
        </div>

        {/* Items extra con secciones */}
        <div style={{ padding: '0 8px', overflowY: 'auto', maxHeight: '60vh' }}>
          {(() => {
            let lastSection = null;
            return extras.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href);
              const showHeader = item.section !== lastSection;
              lastSection = item.section;
              return (
                <div key={item.href}>
                  {showHeader && (
                    <div style={{ padding: '10px 16px 2px', color: 'var(--muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {t(item.sKey, lang) || item.section}
                    </div>
                  )}
                  <button onClick={() => { router.push(item.href); onClose(); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: active ? 'rgba(59,130,246,0.08)' : 'none', border: 'none', cursor: 'pointer', borderRadius: 10, color: active ? '#1b9af5' : 'var(--text-dim)' }}>
                    <Icono path={item.icon} size={20} filled={active} />
                    <span style={{ fontSize: 14, fontWeight: active ? 600 : 400 }}>{t(item.tKey, lang)}</span>
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {/* Usuario */}
        <div style={{ margin: '8px 16px 0', paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', color: '#1b9af5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{user?.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <button onClick={() => { logout(); onClose(); }}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
            {t('nav.logout', lang)}
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [masOpen, setMasOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [iosBanner, setIosBanner] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [pwaBanner, setPwaBanner] = useState(false);
  const prevChatCount = useRef(0);
  const pullStartY = useRef(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Track mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // PWA install banner (one-time, dismissal persisted)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    const isMob = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
    if (isMob && !isStandalone && !dismissed) {
      const t = setTimeout(() => setPwaBanner(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Show iOS "Add to Home Screen" banner if in Safari (not standalone)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const dismissed = sessionStorage.getItem('ios_banner_dismissed');
    if (isIOS && !isStandalone && !dismissed) {
      setIosBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    let timer = null;
    let visibilityTimer = null;

    const addToast = (t) => setToasts(prev => [...prev, { ...t, id: Date.now() }]);

    // Load cached counts instantly so badges appear immediately
    const cachedAlerts = parseInt(sessionStorage.getItem('crm_alert_count') || '0', 10);
    const cachedChats  = parseInt(sessionStorage.getItem('crm_chat_count')  || '0', 10);
    const cachedTasks  = parseInt(sessionStorage.getItem('crm_task_count')  || '0', 10);
    if (cachedAlerts) setAlertCount(cachedAlerts);
    if (cachedChats)  setChatCount(cachedChats);
    if (cachedTasks)  setTaskCount(cachedTasks);

    const fetchCounts = () => {
      if (document.visibilityState === 'hidden') return;
      api.alerts('?seen=false').then(a => {
        setAlertCount(a.length);
        sessionStorage.setItem('crm_alert_count', String(a.length));
      }).catch(() => {});
      api.tasks('?completed=false').then(tasks => {
        const pending = Array.isArray(tasks) ? tasks.length : 0;
        setTaskCount(pending);
        sessionStorage.setItem('crm_task_count', String(pending));
      }).catch(() => {});
      api.inbox().then(items => {
        const unread = items.filter(i => i.direction === 'inbound').length;
        if (prevChatCount.current > 0 && unread > prevChatCount.current) {
          const diff = unread - prevChatCount.current;
          addToast({ title: `${diff} mensaje${diff > 1 ? 's' : ''} nuevo${diff > 1 ? 's' : ''}`, body: 'Toca para ir al inbox', href: '/inbox' });
        }
        prevChatCount.current = unread;
        setChatCount(unread);
        sessionStorage.setItem('crm_chat_count', String(unread));
      }).catch(() => {});
    };

    fetchCounts();
    timer = setInterval(fetchCounts, 60000);

    // Delay fetch on visibility restore — let iOS fully wake up first
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(visibilityTimer);
        visibilityTimer = setTimeout(fetchCounts, 1000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const setupPush = async () => {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js');

        // Check if already subscribed
        let sub = await reg.pushManager.getSubscription();
        if (sub) return; // already set up

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get VAPID key from server
        const BASE = '/backend';
        const keyRes = await fetch(`${BASE}/api/push/vapid-key`);
        const { publicKey } = await keyRes.json();

        // Subscribe
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Save to server
        const token = localStorage.getItem('crm_token');
        await fetch(`${BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subscription: sub })
        });
      } catch (e) {
        console.log('Push setup failed:', e.message);
      }
    };

    setupPush();
  }, [user]);

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, background: 'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)' }}>
      <Logo variant="full" size={70}/>
      <div style={{ width: 28, height: 28, border: '3px solid #67e8f9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Page title for mobile header (derived from pathname)
  const pageTitle = (() => {
    const allNav = [...NAV_SIDEBAR_MAIN, ...NAV_SIDEBAR_EXTRA];
    const match = allNav.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)));
    if (match) return t(match.tKey, lang);
    return 'Energy Depot';
  })();

  return (
    <div style={{ display: 'flex', height: isMobile ? '100dvh' : '100vh', maxWidth: '100vw', overflowX: 'hidden' }}>

      {/* ── Sidebar DESKTOP — Kommo identical ───────────────────────────── */}
      <aside className="desktop-sidebar" style={{
        width: 68, background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: isMobile ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      }}>
        {/* Logo — Energy Depot brand mark */}
        <Link href="/dashboard" style={{ width:68, height:62, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, textDecoration:'none', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <Logo variant="icon" size={42}/>
        </Link>

        {/* Nav items — icon + label below, like Kommo */}
        <nav style={{ flex: 1, width: '100%', overflowY: 'auto', overflowX: 'hidden', paddingTop: 4 }}>
          {NAV_SIDEBAR_MAIN.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setMasOpen(false)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '8px 4px 6px',
                color: active ? '#ffffff' : 'var(--sidebar-icon)',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--sidebar-active)' : 'transparent'}`,
                textDecoration: 'none', gap: 3,
                transition: 'background 0.12s, color 0.12s',
                position: 'relative', cursor: 'pointer',
              }}>
                <div style={{ position: 'relative' }}>
                  <Icono path={item.icon} size={20} filled={active} />
                  {((item.badge && chatCount > 0) || (item.alertBadge && alertCount > 0) || (item.taskBadge && taskCount > 0)) && (
                    <span style={{
                      position: 'absolute', top: -4, right: -6,
                      minWidth: 15, height: 15,
                      background: item.taskBadge ? '#f59e0b' : '#1b9af5',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
                    }}>
                      {item.badge ? (chatCount > 9 ? '9+' : chatCount) : item.taskBadge ? (taskCount > 9 ? '9+' : taskCount) : (alertCount > 9 ? '9+' : alertCount)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, lineHeight: 1, textAlign: 'center', overflow: 'hidden', maxWidth: 60, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t(item.tKey, lang)}
                </span>
              </Link>
            );
          })}

          {/* Botón Más */}
          <button onClick={() => setMasOpen(v => !v)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '8px 4px 6px', gap: 3,
            background: masOpen ? 'var(--sidebar-active-bg)' : 'transparent',
            borderLeft: `2px solid ${masOpen ? 'var(--sidebar-active)' : 'transparent'}`,
            border: 'none', cursor: 'pointer',
            color: masOpen ? '#ffffff' : 'var(--sidebar-icon)',
            transition: 'background 0.12s, color 0.12s',
          }}>
            <Icono path="M4 6h16M4 12h16M4 18h16" size={20} />
            <span style={{ fontSize: 10, fontWeight: masOpen ? 500 : 400, lineHeight: 1 }}>{t('nav.more', lang)}</span>
          </button>
        </nav>

        {/* Flyout panel "Más" — aparece a la derecha del sidebar */}

        {/* Bottom */}
        <div style={{ width: '100%', paddingBottom: 8, flexShrink: 0 }}>
          {/* Language toggle */}
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '8px 4px 6px', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-icon)',
            }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>{lang === 'es' ? '🇺🇸' : '🇵🇷'}</span>
            <span style={{ fontSize: 10, lineHeight: 1 }}>{lang === 'es' ? 'EN' : 'ES'}</span>
          </button>
          {/* Theme toggle */}
          <button onClick={toggleTheme} title={theme === 'dark' ? (lang === 'es' ? 'Modo claro' : 'Light mode') : (lang === 'es' ? 'Modo oscuro' : 'Dark mode')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '8px 4px 6px', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-icon)',
            }}>
            {theme === 'dark' ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
            <span style={{ fontSize: 10, lineHeight: 1 }}>{theme === 'dark' ? t('nav.light', lang) : t('nav.dark', lang)}</span>
          </button>
          {/* Logout */}
          <button onClick={logout}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '6px 4px', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-icon)',
            }}>
            <Icono path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={18} />
            <span style={{ fontSize: 10, lineHeight: 1 }}>{t('nav.logout', lang)}</span>
          </button>
          {/* User avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 6, paddingTop: 4 }}>
            <div title={user.name} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--sidebar-active)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: 13,
            }}>
              {user.name[0].toUpperCase()}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Flyout "Más" — outside aside so overflow:hidden doesn't clip it ── */}
      {masOpen && (
        <>
          <div onClick={() => setMasOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div style={{
            position: 'fixed', left: 68, top: 0, bottom: 0, width: 210, zIndex: 50,
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', paddingTop: 8, paddingBottom: 16,
            boxShadow: '4px 0 16px rgba(0,0,0,0.15)', overflowY: 'auto',
          }}>
            {(() => {
              let lastSection = null;
              return NAV_SIDEBAR_EXTRA.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const showHeader = item.section !== lastSection;
                lastSection = item.section;
                return (
                  <div key={item.href}>
                    {showHeader && (
                      <div style={{ padding: '10px 16px 4px', color: 'var(--muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {t(item.sKey, lang) || item.section}
                      </div>
                    )}
                    <Link href={item.href} onClick={() => setMasOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px',
                      color: active ? 'var(--accent)' : 'var(--text)',
                      background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                      textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
                      transition: 'background 0.1s',
                    }}>
                      <Icono path={item.icon} size={16} filled={active} />
                      <span>{t(item.tKey, lang)}</span>
                    </Link>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}

      {/* ── Área principal ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', minWidth: 0 }}>

        {/* Header MÓVIL — native app feel */}
        <header className="mobile-header" style={{
          display: isMobile ? 'flex' : 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', height: 56, paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'linear-gradient(135deg,#1a3c8f 0%,#0f2558 100%)',
          borderBottom: '1px solid rgba(103,232,249,0.15)',
          position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none' }}>
            <Logo variant="icon" size={32}/>
          </Link>
          <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: '0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
            {pageTitle}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link href="/alerts" style={{ position: 'relative', padding: 8, color: '#fff', display: 'flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icono path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" size={22} />
              {alertCount > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, background: '#67e8f9', color: '#0f2558', fontSize: 9, fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#67e8f9', color: '#0f2558', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
              {user.name[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main
          className="main-content"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minWidth: 0, paddingBottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0 }}
          onTouchStart={e => { pullStartY.current = e.touches[0].clientY; }}
          onTouchMove={e => {
            const el = e.currentTarget;
            if (el.scrollTop > 0) { setPullProgress(0); return; }
            const delta = e.touches[0].clientY - pullStartY.current;
            if (delta > 5) { setIsPulling(true); setPullProgress(Math.min(delta, 72)); }
          }}
          onTouchEnd={() => {
            if (pullProgress >= 56) {
              window.dispatchEvent(new CustomEvent('crm:refresh'));
            }
            setIsPulling(false);
            setPullProgress(0);
          }}
        >
          {/* Pull-to-refresh indicator */}
          {isPulling && pullProgress > 8 && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              height: pullProgress, overflow: 'hidden', zIndex: 20, pointerEvents: 'none',
              transition: pullProgress >= 56 ? 'none' : undefined,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `2px solid var(--accent)`,
                borderTopColor: pullProgress >= 56 ? 'var(--accent)' : 'transparent',
                animation: pullProgress >= 56 ? 'spin 0.6s linear infinite' : 'none',
                opacity: Math.min(pullProgress / 56, 1),
                transform: `rotate(${pullProgress * 4}deg)`,
              }} />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* ── Bottom Nav MÓVIL (Kommo style: 4 tabs + center button) ────────── */}
      <nav className="mobile-bottom-nav" style={{
        display: isMobile ? 'flex' : 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--mobile-nav-bg)', borderTop: '1px solid var(--mobile-nav-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        alignItems: 'stretch', height: 64,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* Chats & Inicio (left 2) */}
        {NAV_MOBILE.slice(0, 2).map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const count = item.badge ? chatCount : 0;
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '8px 4px 6px', textDecoration: 'none', minHeight: 44,
              color: active ? 'var(--mobile-nav-active)' : 'var(--mobile-nav-icon)',
              position: 'relative', gap: 2,
            }}>
              <Icono path={item.icon} size={24} filled={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>{t(item.tKey, lang)}</span>
              {item.badge && count > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: '50%', marginRight: -18,
                  minWidth: 16, height: 16, background: '#ff5b5b', color: '#fff',
                  fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '0 3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>
          );
        })}

        {/* Centro: botón + amarillo Kommo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setPlusOpen(v => !v)} aria-label="Nuevo" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1a3c8f 0%,#67e8f9 100%)',
            border: '3px solid var(--mobile-nav-bg, #fff)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(26,60,143,0.45)',
            transition: 'transform 0.18s',
            transform: plusOpen ? 'rotate(45deg) scale(0.96)' : 'none',
            flexShrink: 0, marginTop: -16,
          }}>
            <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>

        {/* Leads (right 1) */}
        {NAV_MOBILE.slice(2).map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '8px 4px 6px', textDecoration: 'none', minHeight: 44,
              color: active ? 'var(--mobile-nav-active)' : 'var(--mobile-nav-icon)',
              position: 'relative', gap: 2,
            }}>
              <Icono path={item.icon} size={24} filled={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>{t(item.tKey, lang)}</span>
            </Link>
          );
        })}

        {/* Más */}
        <button onClick={() => setMoreOpen(true)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '8px 4px 6px', background: 'none', border: 'none', cursor: 'pointer', minHeight: 44,
          color: moreOpen ? 'var(--mobile-nav-active)' : 'var(--mobile-nav-icon)', gap: 2,
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 400, lineHeight: 1 }}>{t('nav.more', lang)}</span>
        </button>
      </nav>

      {/* Action sheet del botón + */}
      {plusOpen && (
        <>
          <div onClick={() => setPlusOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 99,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid var(--border)', padding: '16px 0 8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            {[
              { icon: '👤', label: 'Agregar contacto', href: '/contacts' },
              { icon: '⚡', label: 'Agregar lead solar', href: '/leads' },
              { icon: '✅', label: 'Agregar tarea', href: '/tasks' },
            ].map(a => (
              <Link key={a.href} href={a.href} onClick={() => setPlusOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 24px', textDecoration: 'none',
                color: 'var(--text)',
              }}>
                <span style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{a.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{a.label}</span>
              </Link>
            ))}
            <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
          </div>
        </>
      )}

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} logout={logout} alertCount={alertCount} lang={lang} />

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <Toast key={t.id} {...t} onDismiss={id => setToasts(prev => prev.filter(x => x.id !== id))} />
          ))}
        </div>
      )}

      {/* iOS Safari banner: "Agrega la app para recibir notificaciones" */}
      {iosBanner && (
        <div style={{
          position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 300,
          background: 'var(--surface)', border: '1px solid #1b9af5',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {t('common.enableNotifs', lang)}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
              {t('common.enableNotifsDesc', lang)}
            </div>
          </div>
          <button onClick={() => { setIosBanner(false); sessionStorage.setItem('ios_banner_dismissed', '1'); }}
            style={{ background: 'none', border: 'none', color: '#7880a0', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            ✕
          </button>
        </div>
      )}

      {/* PWA Install Banner — solo móvil, descartable, persistido en localStorage */}
      {pwaBanner && isMobile && (
        <div style={{
          position: 'fixed', bottom: 76, left: 12, right: 12, zIndex: 250,
          background: 'linear-gradient(135deg,#1a3c8f 0%,#0f2558 100%)',
          border: '1px solid #67e8f9',
          borderRadius: 14, padding: '12px 14px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#67e8f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="#0f2558" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{lang === 'es' ? 'Instalar app' : 'Install app'}</div>
            <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>
              {lang === 'es' ? 'Acceso rápido como app nativa' : 'Quick access like a native app'}
            </div>
          </div>
          {installPrompt ? (
            <button onClick={async () => {
              installPrompt.prompt();
              const r = await installPrompt.userChoice;
              if (r.outcome === 'accepted') { setInstallPrompt(null); setPwaBanner(false); localStorage.setItem('pwa_banner_dismissed', '1'); }
            }} style={{ background: '#67e8f9', color: '#0f2558', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {lang === 'es' ? 'Instalar' : 'Install'}
            </button>
          ) : null}
          <button onClick={() => { setPwaBanner(false); localStorage.setItem('pwa_banner_dismissed', '1'); }}
            aria-label="Cerrar"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      )}

      {/* Floating Tools Button */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

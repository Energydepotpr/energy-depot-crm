'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../lib/api';

// Descripciones legibles de cada permiso
const PERMISSION_LABELS = {
  'contacts.view':    { label: 'Ver contactos',            desc: 'Acceder al directorio de contactos y ver detalles' },
  'contacts.create':  { label: 'Crear contactos',          desc: 'Agregar nuevos contactos al directorio' },
  'contacts.edit':    { label: 'Editar contactos',         desc: 'Modificar datos de contactos existentes' },
  'contacts.delete':  { label: 'Eliminar contactos',       desc: 'Borrar contactos del sistema (acción irreversible)' },
  'leads.view':       { label: 'Ver leads propios',        desc: 'Ver los leads asignados al propio agente' },
  'leads.view_all':   { label: 'Ver todos los leads',      desc: 'Ver leads de cualquier agente (acceso ampliado)' },
  'leads.create':     { label: 'Crear leads',              desc: 'Agregar nuevos leads al pipeline' },
  'leads.edit':       { label: 'Editar leads',             desc: 'Modificar datos, etapa y valor de leads' },
  'leads.delete':     { label: 'Eliminar leads',           desc: 'Borrar leads del pipeline (acción irreversible)' },
  'invoices.view':    { label: 'Ver facturas',             desc: 'Consultar facturas y sus detalles' },
  'invoices.create':  { label: 'Crear facturas',           desc: 'Generar nuevas facturas para clientes' },
  'invoices.delete':  { label: 'Eliminar facturas',        desc: 'Borrar facturas del sistema' },
  'contracts.view':   { label: 'Ver contratos',            desc: 'Consultar contratos y su estado' },
  'contracts.create': { label: 'Crear contratos',          desc: 'Generar nuevos contratos' },
  'contracts.edit':   { label: 'Editar contratos',         desc: 'Modificar contratos existentes' },
  'contracts.delete': { label: 'Eliminar contratos',       desc: 'Borrar contratos del sistema' },
  'reports.view':     { label: 'Ver reportes',             desc: 'Acceder a reportes y estadísticas del CRM' },
  'settings.edit':    { label: 'Editar configuración',     desc: 'Modificar ajustes del sistema, bot, integraciones' },
  'agents.manage':    { label: 'Gestionar agentes',        desc: 'Crear, editar y desactivar usuarios del CRM' },
};

// Agrupar permisos por módulo
const PERMISSION_GROUPS = [
  {
    group: 'Contactos',
    color: '#1b9af5',
    perms: ['contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete'],
  },
  {
    group: 'Leads',
    color: '#10b981',
    perms: ['leads.view', 'leads.view_all', 'leads.create', 'leads.edit', 'leads.delete'],
  },
  {
    group: 'Facturas',
    color: '#f59e0b',
    perms: ['invoices.view', 'invoices.create', 'invoices.delete'],
  },
  {
    group: 'Contratos',
    color: '#8b5cf6',
    perms: ['contracts.view', 'contracts.create', 'contracts.edit', 'contracts.delete'],
  },
  {
    group: 'Reportes & Configuración',
    color: '#06b6d4',
    perms: ['reports.view', 'settings.edit', 'agents.manage'],
  },
];

// Roles editables (admin siempre tiene todo y no se puede cambiar)
const EDITABLE_ROLES = ['employee'];

// Hook de debounce
function useDebounce(fn, delay) {
  const timerRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function PermissionsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({}); // { 'employee:leads.delete': true }
  const [error, setError] = useState(null);
  const [savedRecently, setSavedRecently] = useState({}); // feedback visual

  const cargar = () => {
    setLoading(true);
    api.permissions()
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message || 'Error cargando permisos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const doUpdate = useCallback(async (role, permission, granted) => {
    const key = `${role}:${permission}`;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await api.updatePermission({ role, permission, granted });
      // Actualizar estado local optimísticamente
      setData(prev => {
        if (!prev) return prev;
        const perms = [...(prev.by_role[role] || [])];
        if (granted) {
          if (!perms.includes(permission)) perms.push(permission);
        } else {
          const idx = perms.indexOf(permission);
          if (idx !== -1) perms.splice(idx, 1);
        }
        return { ...prev, by_role: { ...prev.by_role, [role]: perms } };
      });
      setSavedRecently(p => ({ ...p, [key]: true }));
      setTimeout(() => setSavedRecently(p => { const n = { ...p }; delete n[key]; return n; }), 2000);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      cargar(); // recargar para estado limpio
    } finally {
      setSaving(p => { const n = { ...p }; delete n[key]; return n; });
    }
  }, []);

  const debouncedUpdate = useDebounce(doUpdate, 500);

  const handleToggle = (role, permission, currentValue) => {
    const newValue = !currentValue;
    // Actualización optimista inmediata
    setData(prev => {
      if (!prev) return prev;
      const perms = [...(prev.by_role[role] || [])];
      if (newValue) {
        if (!perms.includes(permission)) perms.push(permission);
      } else {
        const idx = perms.indexOf(permission);
        if (idx !== -1) perms.splice(idx, 1);
      }
      return { ...prev, by_role: { ...prev.by_role, [role]: perms } };
    });
    debouncedUpdate(role, permission, newValue);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 16, color: '#ef4444', fontSize: 13, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
      {error}
      <button onClick={cargar} style={{ marginLeft: 12, fontSize: 12, color: '#ef4444', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Reintentar</button>
    </div>
  );

  if (!data) return null;

  const allRoles = ['admin', ...EDITABLE_ROLES];

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Leyenda de columnas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 220 }}>Permiso</span>
        {allRoles.map(role => (
          <div key={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: role === 'admin' ? '#f59e0b' : '#1b9af5',
              padding: '2px 10px',
              background: role === 'admin' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
              borderRadius: 20,
              border: `1px solid ${role === 'admin' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
            }}>
              {role === 'admin' ? 'Admin' : 'Empleado'}
            </span>
            {role === 'admin' && (
              <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>bloqueado</span>
            )}
          </div>
        ))}
      </div>

      {/* Grupos de permisos */}
      {PERMISSION_GROUPS.map(group => (
        <div key={group.group} style={{ marginBottom: 20 }}>
          {/* Encabezado del grupo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 3, height: 14, background: group.color, borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: group.color }}>
              {group.group}
            </span>
          </div>

          {/* Filas de permisos */}
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {group.perms.map((perm, idx) => {
              const info = PERMISSION_LABELS[perm] || { label: perm, desc: '' };

              return (
                <div
                  key={perm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '10px 14px',
                    borderBottom: idx < group.perms.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Info del permiso */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{info.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{info.desc}</div>
                  </div>

                  {/* Checkboxes por rol */}
                  {allRoles.map(role => {
                    const isAdmin = role === 'admin';
                    const granted = isAdmin ? true : (data.by_role[role] || []).includes(perm);
                    const key = `${role}:${perm}`;
                    const isSaving = saving[key];
                    const justSaved = savedRecently[key];

                    return (
                      <div key={role} style={{ minWidth: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {isAdmin ? (
                          // Admin: checkbox siempre marcado y deshabilitado
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            background: 'rgba(245,158,11,0.15)',
                            border: '1px solid rgba(245,158,11,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'not-allowed',
                            opacity: 0.7,
                          }}>
                            <svg width="11" height="11" fill="none" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24">
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                          </div>
                        ) : (
                          // Roles editables: toggle interactivo
                          <button
                            onClick={() => !isSaving && handleToggle(role, perm, granted)}
                            disabled={isSaving}
                            title={granted ? 'Click para revocar permiso' : 'Click para otorgar permiso'}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 5,
                              background: granted ? 'rgba(59,130,246,0.15)' : 'transparent',
                              border: `1px solid ${granted ? '#1b9af5' : 'var(--border)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isSaving ? 'wait' : 'pointer',
                              transition: 'all 0.15s',
                              padding: 0,
                              flexShrink: 0,
                              position: 'relative',
                            }}
                          >
                            {isSaving ? (
                              <div style={{ width: 10, height: 10, border: '1.5px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            ) : justSaved ? (
                              <svg width="11" height="11" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                                <polyline points="20,6 9,17 4,12" />
                              </svg>
                            ) : granted ? (
                              <svg width="11" height="11" fill="none" stroke="#1b9af5" strokeWidth="2.5" viewBox="0 0 24 24">
                                <polyline points="20,6 9,17 4,12" />
                              </svg>
                            ) : null}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Nota informativa */}
      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Los cambios se guardan automáticamente. El rol <strong style={{ color: 'var(--text)' }}>Admin</strong> siempre tiene todos los permisos y no puede ser modificado. Los cambios de permisos surten efecto en la próxima petición del usuario afectado.
      </div>
    </div>
  );
}

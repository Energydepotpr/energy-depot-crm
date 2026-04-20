'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '../../../lib/api';

// ── Componente de preview de factura ────────────────────────────────────────
function InvoicePreview({ data }) {
  if (!data) return null;
  const { invoice_number, client_name, client_email, client_phone, service_date, items = [], subtotal, tax, total, payment_link, notes } = data;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', maxWidth: 480 }}>
      {/* Header azul */}
      <div style={{ background: '#1877f2', padding: '16px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Energy Depot PR</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>energydepotpr.com</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>N° Factura</div>
            <div style={{ fontWeight: 700 }}>{invoice_number || 'ED-001'}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Cliente */}
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{client_name}</div>
          {client_email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{client_email}</div>}
          {client_phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{client_phone}</div>}
          {service_date && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fecha servicio: {new Date(service_date + 'T00:00:00').toLocaleDateString('es-PR')}</div>}
        </div>

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '7px 10px', borderRadius: '6px 0 0 0', fontWeight: 600 }}>Descripción</th>
              <th style={{ padding: '7px 8px', fontWeight: 600 }}>Cant.</th>
              <th style={{ padding: '7px 8px', fontWeight: 600, textAlign: 'right' }}>Precio</th>
              <th style={{ textAlign: 'right', padding: '7px 10px', borderRadius: '0 6px 0 0', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', color: 'var(--text)' }}>
                <td style={{ padding: '7px 10px' }}>{item.description}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>{item.qty}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>${Number(item.unit_price || 0).toFixed(2)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>${Number(item.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ minWidth: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>
              <span>Subtotal</span><span>${Number(subtotal || total || 0).toFixed(2)}</span>
            </div>
            {tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>
                <span>IVU ({tax}%)</span><span>${(Number(subtotal || 0) * tax / 100).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1877f2', color: '#fff', padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 15, marginTop: 6 }}>
              <span>TOTAL</span><span>${Number(total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Link de pago */}
        {payment_link && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#1877f2', fontWeight: 700, marginBottom: 4 }}>ENLACE DE PAGO</div>
            <a href={payment_link} target="_blank" rel="noreferrer" style={{ color: '#1877f2', fontSize: 12, wordBreak: 'break-all' }}>{payment_link}</a>
          </div>
        )}

        {notes && (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600 }}>Notas: </span>{notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mensaje del chat ─────────────────────────────────────────────────────────
function ChatMessage({ msg, onGenerate, generating }) {
  const isUser = msg.role === 'user';

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10, marginTop: 4 }}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
      )}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 10, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Texto */}
        {msg.text && (
          <div style={{
            background: isUser ? '#1877f2' : 'var(--surface)',
            color: isUser ? '#fff' : 'var(--text)',
            border: isUser ? 'none' : '1px solid var(--border)',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
          }}>
            {msg.text}
          </div>
        )}

        {/* Preview de factura */}
        {msg.invoiceData && <InvoicePreview data={msg.invoiceData} />}

        {/* Campos faltantes */}
        {msg.missing?.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
            <span style={{ color: '#92400e', fontWeight: 600 }}>Falta: </span>
            <span style={{ color: '#92400e' }}>{msg.missing.join(', ')}</span>
          </div>
        )}

        {/* Links al CRM + link de pago después de generar */}
        {(msg.crmLinks?.length > 0 || msg.paymentLink) && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(msg.contactCreated || msg.leadCreated) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {msg.contactCreated && <span style={{ fontSize: 12, color: '#10b981' }}>✓ Contacto creado</span>}
                {msg.leadCreated && <span style={{ fontSize: 12, color: '#1877f2' }}>✓ Lead creado</span>}
              </div>
            )}
            {/* Link de pago — para copiar y enviar al cliente */}
            {msg.paymentLink && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>LINK DE PAGO PARA EL CLIENTE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#15803d', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.paymentLink}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.paymentLink).then(() => alert('Link copiado ✓'))}
                    style={{ background: '#16a34a', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                    Copiar
                  </button>
                </div>
              </div>
            )}
            {msg.crmLinks?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {msg.crmLinks.map(l => (
                  <a key={l.href} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                    style={{ fontSize: 12, color: '#1877f2', textDecoration: 'underline' }}>{l.label} →</a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Botón generar PDF */}
        {msg.invoiceData && msg.missing?.length === 0 && (
          <button
            onClick={() => onGenerate(msg.invoiceData)}
            disabled={generating}
            style={{
              background: generating ? '#6b7280' : '#10b981',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {generating ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Generando...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Descargar PDF
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal de edición ────────────────────────────────────────────────────────
function EditModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_number: invoice.invoice_number || '',
    client_name:    invoice.client_name    || '',
    client_email:   invoice.client_email   || '',
    client_phone:   invoice.client_phone   || '',
    service_date:   invoice.service_date   ? invoice.service_date.split('T')[0] : '',
    items:          invoice.items          || [],
    subtotal:       invoice.subtotal       || 0,
    tax:            invoice.tax            || 0,
    total:          invoice.total          || 0,
    payment_link:   invoice.payment_link   || '',
    notes:          invoice.notes          || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'qty' || k === 'unit_price') {
      items[i].total = Number(items[i].qty || 0) * Number(items[i].unit_price || 0);
    }
    const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0);
    setForm(p => ({ ...p, items, subtotal, total: subtotal * (1 + Number(p.tax || 0) / 100) }));
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: '', qty: 1, unit_price: 0, total: 0 }] }));
  const removeItem = (i) => {
    const items = form.items.filter((_, idx) => idx !== i);
    const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0);
    setForm(p => ({ ...p, items, subtotal, total: subtotal }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.invoiceUpdate(invoice.id, form);
      onSaved();
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>Editar factura</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {field('N° Factura', 'invoice_number')}
            {field('Fecha servicio', 'service_date', 'date')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {field('Cliente', 'client_name')}
            {field('Teléfono', 'client_phone')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {field('Email', 'client_email')}
            {field('Link de pago', 'payment_link')}
          </div>

          {/* Items */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>SERVICIOS</div>
            <div style={{ overflowX: 'auto' }}>
            {form.items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 50px 80px 80px 32px', gap: 6, marginBottom: 6, alignItems: 'center', minWidth: 340 }}>
                <input value={item.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Descripción"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                <input type="number" value={item.qty} onChange={e => setItem(i, 'qty', e.target.value)} placeholder="Cant"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 4px', fontSize: 12, color: 'var(--text)', outline: 'none', textAlign: 'center' }} />
                <input type="number" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} placeholder="Precio"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                <div style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>${Number(item.total || 0).toFixed(2)}</div>
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            ))}
            </div>
            <button onClick={addItem} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', width: '100%' }}>+ Añadir servicio</button>
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#1877f2', color: '#fff', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 15 }}>
              TOTAL: ${Number(form.total || 0).toFixed(2)}
            </div>
          </div>

          {/* Notas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>NOTAS</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ background: saving ? '#6b7280' : '#1877f2', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal enviar factura por email ───────────────────────────────────────────
function EmailInvoiceModal({ invoice, onClose }) {
  const [to, setTo] = useState(invoice.client_email || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const buildHtml = () => {
    const items = invoice.items || [];
    const rows = items.map(it => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${it.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${it.qty || it.quantity || 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">$${Number(it.unit_price || it.price || 0).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">$${Number((it.qty || it.quantity || 1) * (it.unit_price || it.price || 0)).toFixed(2)}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#1877f2;padding:20px 24px;color:#fff">
    <div style="font-size:18px;font-weight:700">Energy Depot PR</div>
    <div style="font-size:12px;opacity:0.8">energydepotpr.com</div>
    <div style="margin-top:8px;font-size:13px;opacity:0.9">Factura N° ${invoice.invoice_number || 'ED-001'}</div>
  </div>
  <div style="padding:24px">
    <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px">CLIENTE</div>
      <div style="font-weight:600;color:#1e293b">${invoice.client_name}</div>
      ${invoice.client_email ? `<div style="font-size:13px;color:#64748b">${invoice.client_email}</div>` : ''}
      ${invoice.service_date ? `<div style="font-size:13px;color:#64748b">Fecha servicio: ${new Date(invoice.service_date + 'T00:00:00').toLocaleDateString('es-PR')}</div>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#1e293b;color:#fff">
        <th style="padding:8px 12px;text-align:left">Descripción</th>
        <th style="padding:8px 12px;text-align:center">Cant.</th>
        <th style="padding:8px 12px;text-align:right">Precio</th>
        <th style="padding:8px 12px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;text-align:right;font-size:13px;color:#64748b">
      <div>Subtotal: $${Number(invoice.subtotal || 0).toFixed(2)}</div>
      ${invoice.service ? `<div>Servicio: $${Number(invoice.service || 0).toFixed(2)}</div>` : ''}
      <div>IVU (11.5%): $${Number(invoice.tax || 0).toFixed(2)}</div>
      <div style="font-size:16px;font-weight:700;color:#1877f2;margin-top:6px">Total: $${Number(invoice.total || 0).toFixed(2)}</div>
    </div>
    ${invoice.payment_link ? `<div style="margin-top:20px;text-align:center"><a href="${invoice.payment_link}" style="background:#1877f2;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Pagar ahora</a></div>` : ''}
    ${invoice.notes ? `<div style="margin-top:16px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px">${invoice.notes}</div>` : ''}
  </div>
  <div style="background:#f1f5f9;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8">
    Fix a Trip Puerto Rico · Gracias por su preferencia
  </div>
</div></body></html>`;
  };

  const send = async () => {
    if (!to) { setErr('Ingresa un email de destino'); return; }
    setSending(true); setErr('');
    try {
      await api.sendEmail({
        to_email:   to,
        subject:    `Factura ${invoice.invoice_number} — Fix a Trip PR`,
        body:       `Adjunto encontrarás tu factura ${invoice.invoice_number} por $${Number(invoice.total).toFixed(2)}. Puedes verla en el link de pago incluido.`,
        body_html:  buildHtml(),
        contact_id: invoice.contact_id || null,
        lead_id:    invoice.lead_id    || null,
      });
      setSent(true);
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24 }}>
        {sent ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email enviado</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Factura enviada a {to}</div>
            <button onClick={onClose} style={{ width: '100%', background: '#1877f2', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>Enviar factura por email</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {invoice.invoice_number} — {invoice.client_name} — <strong style={{ color: '#1877f2' }}>${Number(invoice.total).toFixed(2)}</strong>
            </div>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>EMAIL DESTINATARIO</label>
            <input
              type="email" value={to} onChange={e => setTo(e.target.value)}
              placeholder="cliente@email.com"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', marginTop: 6, marginBottom: 14, boxSizing: 'border-box' }}
            />
            {err && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={send} disabled={sending} style={{ background: sending ? '#6b7280' : '#1877f2', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: '#fff', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Enviando...' : '✉ Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function FacturasPage() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'bot',
      text: '¡Hola! Soy tu asistente de facturación 📄\n\nDime la información de la factura en lenguaje natural. Por ejemplo:\n\n"Factura para Juan Torres, instalación de paneles solares el 20 de marzo, sistema 10kW a $15,000, total $15,000, link de pago: https://paypal.me/energydepotpr/15000"',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [historyTab, setHistoryTab] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [emailingInvoice, setEmailingInvoice] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [histSearch, setHistSearch] = useState('');
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [qbConnected, setQbConnected] = useState(null); // null=loading, true/false
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Historial de conversación para contexto de Claude
  const chatHistory = useRef([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Verificar estado QB al cargar + leer param ?qb=connected
  useEffect(() => {
    api.qbStatus().then(r => setQbConnected(r.connected)).catch(() => setQbConnected(false));
    const params = new URLSearchParams(window.location.search);
    if (params.get('qb') === 'connected') {
      setQbConnected(true);
      window.history.replaceState({}, '', '/facturas');
    }
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const r = await api.invoices();
      setInvoiceHistory(r.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Pasar historial previo (sin el mensaje actual — el controller lo agrega)
      const r = await api.invoiceExtract(text, chatHistory.current.slice(-6));

      // Agregar al historial DESPUÉS de recibir respuesta
      chatHistory.current.push({ role: 'user', content: text });
      chatHistory.current.push({ role: 'assistant', content: r.raw || '' });

      if (r.parsed) {
        const botMsg = {
          id: Date.now() + 1,
          role: 'bot',
          text: r.parsed.message || '¡Aquí está la vista previa de tu factura!',
          invoiceData: r.parsed.data,
          missing: r.parsed.missing || [],
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        // Respuesta de texto (pregunta o aclaración)
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'bot',
          text: r.raw,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: 'Error al procesar: ' + (err.message || 'Intenta de nuevo.'),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const triggerPdfDownload = (base64, filename) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'factura.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleMarkPaid = async (invId) => {
    try {
      await api.invoiceMarkPaid(invId);
      setInvoiceHistory(prev => prev.map(i => i.id === invId ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleGenerate = async (invoiceData) => {
    setGenerating(true);
    try {
      const r = await api.invoiceGenerate(invoiceData);
      if (!r.ok || !r.pdf_base64) throw new Error('No se recibió PDF');

      triggerPdfDownload(r.pdf_base64, r.filename);

      const links = [];
      if (r.contact_id) links.push({ label: 'Ver contacto', href: '/contacts' });
      if (r.lead_id)    links.push({ label: 'Ver lead', href: '/leads' });
      if (r.qb_link)    links.push({ label: '📊 Ver en QuickBooks', href: r.qb_link });

      let statusText = `✅ PDF descargado: ${r.filename}`;
      if (r.qb_synced && r.qb_doc_number) {
        statusText += `\n📊 Sincronizada a QuickBooks #${r.qb_doc_number}`;
      } else if (r.qb_synced) {
        statusText += `\n📊 Sincronizada a QuickBooks`;
      }
      if (r.payment_link) {
        statusText += `\n🔗 Link de pago listo`;
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: statusText,
        crmLinks: links,
        contactCreated: !!r.contact_id,
        leadCreated: !!r.lead_id,
        paymentLink: r.payment_link || null,
        qbLink: r.qb_link || null,
      }]);

      chatHistory.current = [];
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: 'Error generando el PDF. ' + err.message,
      }]);
    } finally {
      setGenerating(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    chatHistory.current = [];
    setMessages([{
      id: Date.now(),
      role: 'bot',
      text: '¡Listo! Cuéntame los datos de la nueva factura.',
    }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1877f220', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" fill="none" stroke="#1877f2" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16 }}>Bot de Facturación</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Genera facturas PDF con IA</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* QuickBooks badge */}
          {qbConnected === true && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#bbf7d020', border: '1px solid #86efac', borderRadius: 8, padding: '5px 10px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>QuickBooks</span>
              <button onClick={async () => { await api.qbDisconnect(); setQbConnected(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11, padding: 0, marginLeft: 4 }}>
                Desconectar
              </button>
            </div>
          )}
          {qbConnected === false && (
            <a href="/backend/api/quickbooks/auth"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2ca01c', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#fff', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              Conectar QuickBooks
            </a>
          )}
          <button
            onClick={() => { setHistoryTab(!historyTab); if (!historyTab) loadHistory(); }}
            style={{ background: historyTab ? '#1877f215' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: historyTab ? '#1877f2' : 'var(--muted)', cursor: 'pointer' }}>
            Historial
          </button>
          <button onClick={resetChat}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
            Nueva factura
          </button>
        </div>
      </div>

      {historyTab ? (
        /* ── Historial de facturas ── */
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 600, margin: 0, flex: 1 }}>Facturas generadas</h3>
            <input
              placeholder="Buscar cliente..."
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', width: 160 }}
            />
            <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>–</span>
            <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
            {(histSearch || histDateFrom || histDateTo) && (
              <button onClick={() => { setHistSearch(''); setHistDateFrom(''); setHistDateTo(''); }}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                Limpiar
              </button>
            )}
          </div>
          {loadingHistory ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Cargando...</div>
          ) : invoiceHistory.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>No hay facturas aún</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invoiceHistory
                .filter(inv => !histSearch || (inv.client_name || '').toLowerCase().includes(histSearch.toLowerCase()) || (inv.invoice_number || '').toLowerCase().includes(histSearch.toLowerCase()))
                .filter(inv => !histDateFrom || new Date(inv.created_at) >= new Date(histDateFrom))
                .filter(inv => !histDateTo || new Date(inv.created_at) <= new Date(histDateTo + 'T23:59:59'))
                .map(inv => (
                <div key={inv.id} style={{ background: 'var(--surface)', border: `1px solid ${inv.status === 'paid' ? '#bbf7d0' : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{inv.invoice_number} — {inv.client_name}</span>
                        {/* Badge de estado */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: inv.status === 'paid' ? '#dcfce7' : inv.status === 'sent' ? '#dbeafe' : '#f3f4f6',
                          color: inv.status === 'paid' ? '#16a34a' : inv.status === 'sent' ? '#1d4ed8' : '#6b7280',
                        }}>
                          {inv.status === 'paid' ? '✅ Pagada' : inv.status === 'sent' ? '📤 Enviada' : '📝 Borrador'}
                        </span>
                        {inv.qb_doc_number && (
                          <span style={{ fontSize: 11, color: '#2ca01c', fontWeight: 600 }}>QB #{inv.qb_doc_number}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {inv.service_date ? new Date(inv.service_date).toLocaleDateString('es-PR') : '—'} · {new Date(inv.created_at).toLocaleDateString('es-PR')}
                        {inv.paid_at && ` · Pagada: ${new Date(inv.paid_at).toLocaleDateString('es-PR')}`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: inv.status === 'paid' ? '#16a34a' : '#1877f2', fontSize: 16, flexShrink: 0 }}>${Number(inv.total).toFixed(2)}</div>
                  </div>
                  {/* Link de pago si existe */}
                  {inv.payment_link && inv.status !== 'paid' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px' }}>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>Link de pago:</span>
                      <span style={{ fontSize: 11, color: '#15803d', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.payment_link}</span>
                      <button onClick={() => navigator.clipboard.writeText(inv.payment_link).then(() => alert('Copiado ✓'))}
                        style={{ background: '#16a34a', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                        Copiar
                      </button>
                    </div>
                  )}
                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        setDownloadingId(inv.id);
                        try {
                          const r = await api.invoice(inv.id);
                          const full = r.data;
                          const gen = await api.invoiceGenerate(full);
                          if (!gen.ok || !gen.pdf_base64) throw new Error('Sin PDF');
                          triggerPdfDownload(gen.pdf_base64, gen.filename);
                        } catch (e) { alert('Error: ' + e.message); }
                        finally { setDownloadingId(null); }
                      }}
                      disabled={downloadingId === inv.id}
                      title="Descargar PDF"
                      style={{ background: '#10b98115', border: '1px solid #10b98140', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#10b981', fontSize: 13 }}>
                      {downloadingId === inv.id ? '...' : '⬇️ PDF'}
                    </button>
                    <button
                      onClick={async () => {
                        const r = await api.invoice(inv.id);
                        setEmailingInvoice(r.data);
                      }}
                      title="Enviar por email"
                      style={{ background: '#8b5cf615', border: '1px solid #8b5cf640', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#8b5cf6', fontSize: 13 }}>
                      ✉ Email
                    </button>
                    <button
                      onClick={async () => {
                        const r = await api.invoice(inv.id);
                        setEditingInvoice(r.data);
                      }}
                      title="Editar"
                      style={{ background: '#1877f215', border: '1px solid #1877f240', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#1877f2', fontSize: 13 }}>
                      ✏️ Editar
                    </button>
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => handleMarkPaid(inv.id)}
                        title="Marcar como pagada"
                        style={{ background: '#16a34a15', border: '1px solid #16a34a40', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                        ✅ Pagada
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`¿Eliminar factura ${inv.invoice_number}?`)) return;
                        setDeletingId(inv.id);
                        try {
                          await api.invoiceDelete(inv.id);
                          setInvoiceHistory(prev => prev.filter(i => i.id !== inv.id));
                        } catch (e) { alert('Error: ' + e.message); }
                        finally { setDeletingId(null); }
                      }}
                      disabled={deletingId === inv.id}
                      title="Eliminar"
                      style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                      {deletingId === inv.id ? '...' : '🗑️ Borrar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Chat ── */
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
            {messages.map(msg => (
              <ChatMessage key={msg.id} msg={msg} onGenerate={handleGenerate} generating={generating} />
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px', padding: '10px 16px', display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribe los datos de la factura... (Enter para enviar)"
                rows={2}
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '10px 14px', fontSize: 14,
                  color: 'var(--text)', resize: 'none', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  background: input.trim() && !loading ? '#1877f2' : 'var(--border)',
                  border: 'none', borderRadius: 12, width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  flexShrink: 0, transition: 'background 0.2s',
                }}>
                <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
              Puedes incluir nombre del cliente, servicios, cantidades, precios y link de pago
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {editingInvoice && (
        <EditModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => { loadHistory(); }}
        />
      )}
      {emailingInvoice && (
        <EmailInvoiceModal
          invoice={emailingInvoice}
          onClose={() => setEmailingInvoice(null)}
        />
      )}
    </div>
  );
}

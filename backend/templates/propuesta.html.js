'use strict';
const fs   = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'propuesta-v2.html');

const fmtMoney = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt   = n => Number(n || 0).toLocaleString('en-US');

const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
function fechaMayus() {
  const dt = new Date();
  return `${dt.getDate()} DE ${MESES_ES[dt.getMonth()]} DE ${dt.getFullYear()}`;
}

function buildHTML(data) {
  const {
    nombre, email, tel,
    systemKw, panels, panelWatts,
    annProd, annCons, offset,
    pagoFV, pagoConBat, pagoLuma,
    batteries,
    today,
    panelPrice,
    quotationName,
    descuentoPct,
    descuentoAmt,
    meses,
    mesLabels,
    tarifaLuma,
  } = data;

  const battName = batteries && batteries.length > 0
    ? batteries.map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' · ')
    : 'Sin batería';

  const luma  = Number(String(pagoLuma || '0').replace(/[^0-9.]/g, '')) || 0;
  const fv    = Number(pagoFV)     || 0;
  const fvBat = Number(pagoConBat) || 0;

  // Proyecciones a 15 años (factor derivado del ejemplo de la propuesta de referencia)
  const proyLuma   = +(luma  * 1.365).toFixed(2);
  const proyFvBat  = +(fvBat * 1.201).toFixed(2);

  // Tabla factura — items dinámicos
  const numPanels = Number(panels) || 0;
  const ratePanel = Number(panelPrice) || 1184;
  const watts = Number(panelWatts) || 550;
  const panelAmount = +(numPanels * ratePanel).toFixed(2);
  const rowsArr = [];
  if (numPanels > 0) {
    rowsArr.push({
      title: 'Sistema fotovoltaico',
      desc: `${numPanels} paneles solares Tier 1 de ${watts}W Duo Bifacial — Capacidad ${Number(systemKw||0).toFixed(2)} kW DC`,
      qty: numPanels,
      rate: ratePanel,
      amount: panelAmount,
    });
  }
  let battTotal = 0;
  for (const b of (batteries || [])) {
    const q = Number(b.qty) || 0;
    const up = Number(b.unitPrice) || 0;
    if (q <= 0 || up <= 0) continue;
    const amt = +(q * up).toFixed(2);
    battTotal += amt;
    rowsArr.push({
      title: b.name || 'Sistema de almacenamiento',
      desc: b.description || 'Sistema de almacenamiento de energía con respaldo continuo',
      qty: q, rate: up, amount: amt,
    });
  }
  const subtotal = +(panelAmount + battTotal).toFixed(2);
  const dPct = Number(descuentoPct) || 0;
  const dAmt = Number(descuentoAmt) || (dPct > 0 ? +(subtotal * dPct / 100).toFixed(2) : 0);
  const total = +(subtotal - dAmt).toFixed(2);
  const facturaRowsHtml = rowsArr.map((r, i) => `
    <tr style="border-bottom: 1px solid #e6ecf7;${i % 2 === 1 ? ' background: #fafbff;' : ''}">
      <td style="padding: 10px; vertical-align: top; color: #555;">${i + 1}</td>
      <td style="padding: 10px; vertical-align: top;">
        <div style="font-weight: 700; color: #1a3c8f;">${r.title}</div>
        <div style="font-size: 8.5pt; color: #666; margin-top: 2px;">${r.desc}</div>
      </td>
      <td style="padding: 10px; text-align: right; vertical-align: top; color: #333;">${r.qty}</td>
      <td style="padding: 10px; text-align: right; vertical-align: top; color: #333;">${fmtInt(r.rate.toFixed ? r.rate.toFixed(2) : r.rate)}</td>
      <td style="padding: 10px; text-align: right; vertical-align: top; color: #333;">0%</td>
      <td style="padding: 10px; text-align: right; vertical-align: top; color: #333; font-weight: 600;">${fmtInt(r.amount.toFixed ? r.amount.toFixed(2) : r.amount)}</td>
    </tr>`).join('') || `
    <tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">Sin items</td></tr>`;

  const vars = {
    cliente_nombre:           nombre || '',
    cliente_telefono:         tel    || '',
    cliente_email:            email  || '',
    fecha_mayus:              fechaMayus(),
    cotizacion_nombre:        quotationName || '',
    factura_actual:           fmtMoney(luma),
    precio_solar:             fmtMoney(fv),
    precio_solar_bateria:     fmtMoney(fvBat),
    factura_proyeccion:       fmtMoney(proyLuma),
    precio_solar_bateria_ext: fmtMoney(proyFvBat),
    consumo_anual:            fmtInt(annCons),
    produccion_anual:         fmtInt(annProd),
    cobertura:                String(Math.round(offset || 0)),
    cantidad_paneles:         String(panels || 0),
    watts_panel:              String(panelWatts || 550),
    capacidad_dc:             Number(systemKw || 0).toFixed(2),
    bateria:                  battName,
    factura_rows_html:        facturaRowsHtml,
    factura_subtotal:         fmtMoney(subtotal),
    factura_descuento:        dAmt > 0 ? fmtMoney(dAmt) : '',
    factura_descuento_pct:    String(dPct || 0),
    factura_descuento_row:    dAmt > 0
      ? `<tr><td colspan="5" style="padding: 10px; text-align: right; font-weight: 600; color: #10b981; font-size: 10pt; border-top: 1px solid #e6ecf7;">Descuento (${dPct}%)</td><td style="padding: 10px; text-align: right; font-weight: 700; color: #10b981; font-size: 10pt; border-top: 1px solid #e6ecf7;">-${fmtMoney(dAmt)}</td></tr>`
      : '',
    factura_total:            fmtMoney(total),
    // Página 4: Tu consumo mes a mes
    ...(() => {
      const arr = Array.isArray(meses) ? meses.slice(0, 14) : [];
      const labelsRaw = Array.isArray(mesLabels) && mesLabels.length ? mesLabels : [];
      const filledArr = arr.filter(v => Number(v) > 0).map(Number);
      const sum = filledArr.reduce((a,b) => a+b, 0);
      const avg = filledArr.length ? Math.round(sum / filledArr.length) : 0;
      const tarifa = Number(tarifaLuma) || 0.26;
      const pagoLumaCalc = Math.round(avg * tarifa);
      // Consumo anual = promedio × 12
      const annualSum = Math.round(avg * 12);
      // Render 14 cuadritos (13 datos + 1 vacío para llenar la cuadrícula 7×2)
      const SLOTS = 14;
      let mesesHtml = '';
      for (let i = 0; i < SLOTS; i++) {
        const v = arr[i];
        const lbl = labelsRaw[i] || `Mes ${i+1}`;
        const isEmpty = !v || Number(v) <= 0;
        if (isEmpty) {
          mesesHtml += `<div style="background:#f8fafc;border:1px dashed #E2E8F0;border-radius:8px;padding:8px 6px;text-align:center;"></div>`;
        } else {
          mesesHtml += `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px 6px;text-align:center;box-shadow:0 1px 2px rgba(15,42,92,.04);">
            <div style="font-size:8pt;font-weight:700;color:#1a3c8f;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${String(lbl).slice(0,6)}</div>
            <div style="font-size:13pt;font-weight:800;color:#0f2a5c;line-height:1;">${fmtInt(Number(v))}</div>
            <div style="font-size:7.5pt;color:#94a3b8;margin-top:1px;">kWh</div>
          </div>`;
        }
      }
      return {
        meses_render_html: mesesHtml,
        meses_count: String(filledArr.length),
        consumo_anual_fmt: fmtInt(annualSum),
        promedio_kwh_fmt: fmtInt(avg),
        pago_luma_fmt: fmtMoney(pagoLumaCalc),
        tarifa_luma: tarifa.toFixed(2),
        // Sobrescribe los valores anuales globales con la base avg × 13
        _annualOverride: annualSum,
      };
    })(),
  };
  // Si hay override de avg × 13, recalcula consumo_anual y cobertura para consistencia
  if (vars._annualOverride && vars._annualOverride > 0) {
    vars.consumo_anual = fmtInt(vars._annualOverride);
    const annProdNum = Number(annProd) || 0;
    if (annProdNum > 0) {
      vars.cobertura = String(Math.round(annProdNum / vars._annualOverride * 100));
    }
  }
  delete vars._annualOverride;

  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.split(`{{${k}}}`).join(v);
  }
  return html;
}

module.exports = { buildHTML };

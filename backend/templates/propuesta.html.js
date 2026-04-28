'use strict';
const fs   = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'propuesta-base.html');

function buildHTML(data) {
  const {
    nombre, email, tel, ciudad, zip,
    systemKw, panels,
    annProd, annCons, offset,
    pagoFV, pagoConBat, pagoLuma,
    batteries,
    today, direccion,
    calc,
  } = data;

  const lumaRaw = String(pagoLuma || '');
  const lumaNum = lumaRaw.replace(/[^0-9.]/g, '') || '0';

  const battNames = batteries && batteries.length > 0
    ? batteries.map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' · ')
    : '{Servicio adicional elegido}';

  const vars = {
    customer_name:            nombre || '',
    customer_address:         direccion || '',
    customer_city:            `${ciudad || ''}${zip ? ', PR ' + zip : ''}`,
    customer_phone:           tel || '',
    customer_email:           email || '',
    proposal_date:            today || '',
    pago_promedio_luma:       Number(lumaNum).toFixed(2),
    pago_mensual_fv_15anos:   pagoFV > 0 ? Number(pagoFV).toFixed(2) : '0.00',
    pago_mensual_bat_15anos:  pagoConBat > 0 ? Number(pagoConBat).toFixed(2) : '0.00',
    kwh_consumo_anual:        Number(annCons || 0).toLocaleString('en-US'),
    kwh_produccion_anual:     Number(annProd || 0).toLocaleString('en-US'),
    cobertura_pct:            String(Math.round(offset || 0)),
    num_paneles:              String(panels || 0),
    kw_dc_real:               Number(systemKw || 0).toFixed(2),
    bateria_seleccionada:     battNames,
  };

  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  for (const [k, v] of Object.entries(vars)) {
    // Replace 4-brace numeric overlays: {{{{variable}}}} → value
    html = html.replaceAll(`{{{{${k}}}}}`, v);
    // Replace 2-brace text overlays: {{variable}} → value
    html = html.replaceAll(`{{${k}}}`, v);
  }

  return html;
}

module.exports = { buildHTML };

'use strict';
/**
 * Template HTML para la Solicitud Oficial de Tu Coop.
 * Reemplaza la versión basada en pdf-lib + coords. Se renderiza a PDF via Puppeteer.
 *
 * Página: Letter alargado (8.5" x 14") — 612x1008pt.
 * Tu Coop autorizó el uso de este formulario en HTML como documento aceptado
 * para evaluar financiamientos enviados por Energy Depot LLC.
 */

const esc = (v) => {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const norm = (v) => String(v || '').toLowerCase().trim().replace(/\s+/g, '_');

function propositoFlags(p) {
  const v = norm(p).replace('consolidación', 'consolidacion');
  return {
    vacaciones: v === 'vacaciones',
    consolidacion: v === 'consolidacion',
    mejoras: v === 'mejoras' || v === 'mejoras_hogar',
    otro: v === 'otro' || (!!v && !['vacaciones', 'consolidacion', 'mejoras', 'mejoras_hogar'].includes(v)),
  };
}
function estadoCivilFlags(p) {
  const v = norm(p);
  return {
    casado: v === 'casado' || v === 'casada',
    separado: v === 'separado' || v === 'separada',
    soltero: v === 'soltero' || v === 'soltera',
  };
}
function viveEnCasaFlags(p) {
  const v = norm(p);
  return {
    propia: v === 'propia',
    alquilada: v === 'alquilada' || v === 'alquilado',
    familiar: v === 'familiar',
    otro: v === 'otro',
  };
}
function empleadoTipoFlags(p) {
  const v = norm(p);
  return {
    regular: v === 'regular',
    probatorio: v === 'probatorio',
    contrato: v === 'contrato',
    cuenta_propia: v === 'cuenta_propia' || v === 'cuentapropia',
  };
}
function salarioFreqFlags(p) {
  const v = norm(p);
  return {
    semanal: v === 'semanal',
    bisemanal: v === 'bisemanal',
    quincenal: v === 'quincenal',
    mensual: v === 'mensual',
  };
}
function siNoFlags(p) {
  const v = norm(p);
  return { si: v === 'si' || v === 'sí' || v === 'yes' || v === 'true', no: v === 'no' || v === 'false' };
}

// Checkbox marcado o vacío (caja CSS, no Unicode, para garantizar render uniforme)
const cb = (on, label) => `
  <span class="cb-wrap">
    <span class="cb ${on ? 'cb-on' : ''}">${on ? '<span class="cb-x">X</span>' : ''}</span>
    <span class="cb-lbl">${esc(label)}</span>
  </span>`;

function buildHtml(formData = {}, signatureBase64 = null) {
  const fd = formData || {};
  const pr = propositoFlags(fd.proposito);
  const ec = estadoCivilFlags(fd.estado_civil);
  const vc = viveEnCasaFlags(fd.vive_en_casa);
  const et = empleadoTipoFlags(fd.empleado_tipo);
  const sf = salarioFreqFlags(fd.salario_frecuencia);
  const lic = siNoFlags(fd.en_licencia);

  // Cleanup firma base64
  let sigSrc = '';
  if (signatureBase64) {
    const clean = signatureBase64.includes(',') ? signatureBase64 : `data:image/png;base64,${signatureBase64}`;
    sigSrc = clean;
  }

  const v = (k) => esc(fd[k] || '');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Solicitud Tu Coop</title>
<style>
  @page { size: 8.5in 14in; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-size: 9pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 8.5in;
    min-height: 14in;
    padding: 0.35in 0.35in 0.25in 0.35in;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .logo {
    color: #E53935;
    font-weight: 900;
    font-size: 32pt;
    line-height: 1;
    letter-spacing: -1px;
    font-family: 'Arial Black', Arial, sans-serif;
  }
  .logo-sub { color:#333; font-size: 8pt; letter-spacing: 2px; margin-top: 2px; }
  .header-addr { text-align: right; font-size: 9pt; color: #222; padding-top: 14px; }
  .header-addr .pin { color:#E53935; }

  .banner {
    background: #E85D5D;
    color: #fff;
    font-weight: 700;
    padding: 5px 8px;
    font-size: 9.5pt;
    margin-top: 6px;
    letter-spacing: 0.3px;
  }

  table.grid { width: 100%; border-collapse: collapse; }
  table.grid td {
    border: 1px solid #777;
    padding: 4px 6px;
    vertical-align: top;
    font-size: 8.5pt;
    height: 28px;
  }
  .lbl { font-size: 7pt; color:#444; display:block; margin-bottom: 2px; text-transform: none; }
  .val { font-size: 9.5pt; color:#000; min-height: 12px; }

  /* Checkbox */
  .cb-wrap { display: inline-flex; align-items: center; margin-right: 10px; white-space: nowrap; }
  .cb {
    display: inline-block;
    width: 11px; height: 11px;
    border: 1px solid #333;
    margin-right: 4px;
    position: relative;
    vertical-align: middle;
  }
  .cb-x {
    position: absolute;
    left: 1px; top: -3px;
    font-size: 11px;
    font-weight: 900;
    line-height: 11px;
    color: #000;
  }
  .cb-lbl { font-size: 8.5pt; }

  .checks-row { padding: 4px 6px; }

  /* Footer firmas */
  .firmas { display: flex; gap: 12px; margin-top: 18px; }
  .firma-col { flex: 1; text-align: center; }
  .firma-box {
    border-bottom: 1px solid #000;
    height: 44px;
    position: relative;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 2px;
  }
  .firma-box img { max-height: 40px; max-width: 200px; }
  .firma-lbl { font-size: 8pt; margin-top: 3px; color:#222; }
  .firma-fecha { font-size: 8.5pt; margin-top: 4px; }

  .disclaimer {
    margin-top: 14px;
    font-size: 7pt;
    text-align: justify;
    line-height: 1.35;
    color: #222;
  }

  /* helpers para anchos */
  .w-50 { width: 50%; }
  .w-33 { width: 33.333%; }
  .w-25 { width: 25%; }
  .w-20 { width: 20%; }
</style>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div>
        <div class="logo">TUCOOP</div>
        <div class="logo-sub">COOPERATIVA</div>
      </div>
      <div class="header-addr">
        <span class="pin">&#9679;</span> 209 Ave. Roberto H. Todd<br/>
        San Juan, Puerto Rico
      </div>
    </div>

    <!-- PRÉSTAMO -->
    <div class="banner">INFORMACIÓN DEL PRÉSTAMO</div>
    <table class="grid">
      <tr>
        <td colspan="5">
          <span class="lbl">Propósito del Préstamo:</span>
          <div class="checks-row" style="padding:0;">
            ${cb(pr.vacaciones, 'Vacaciones')}
            ${cb(pr.consolidacion, 'Consolidación Deudas/Gastos')}
            ${cb(pr.mejoras, 'Mejoras Hogar')}
            ${cb(pr.otro, 'Otro')}
          </div>
        </td>
      </tr>
      <tr>
        <td class="w-20"><span class="lbl">Cantidad Solicitada</span><div class="val">${v('cantidad_solicitada')}</div></td>
        <td class="w-20"><span class="lbl">Término</span><div class="val">${v('termino')}</div></td>
        <td class="w-20"><span class="lbl">Interés</span><div class="val">${v('interes')}</div></td>
        <td class="w-20"><span class="lbl">Pago Mensual</span><div class="val">${v('pago_mensual')}</div></td>
        <td class="w-20"><span class="lbl">Propósito Otros</span><div class="val">${v('proposito_otros')}</div></td>
      </tr>
    </table>

    <!-- SOLICITANTE -->
    <div class="banner">INFORMACIÓN DEL SOLICITANTE</div>
    <table class="grid">
      <tr>
        <td style="width:75%"><span class="lbl">Nombre Completo</span><div class="val">${v('nombre_completo')}</div></td>
        <td><span class="lbl">Núm. Socio</span><div class="val">${v('num_socio')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Seguro Social</span><div class="val">${v('seguro_social')}</div></td>
        <td><span class="lbl">Fecha Nacimiento (D/M/A)</span><div class="val">${v('fecha_nacimiento')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('telefono')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Licencia Conducir</span><div class="val">${v('licencia_conducir')}</div></td>
        <td><span class="lbl">Fecha Vencimiento (D/M/A)</span><div class="val">${v('licencia_vencimiento')}</div></td>
        <td><span class="lbl">Emitida en</span><div class="val">${v('licencia_emitida_en')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Pasaporte</span><div class="val">${v('pasaporte')}</div></td>
        <td><span class="lbl">Fecha Vencimiento (D/M/A)</span><div class="val">${v('pasaporte_vencimiento')}</div></td>
        <td><span class="lbl">Emitida en</span><div class="val">${v('pasaporte_emitida_en')}</div></td>
      </tr>
      <tr>
        <td colspan="2"><span class="lbl">Correo Electrónico</span><div class="val">${v('correo')}</div></td>
        <td><span class="lbl">Celular</span><div class="val">${v('celular')}</div></td>
      </tr>
      <tr>
        <td colspan="2">
          <span class="lbl">Estado Civil</span>
          <div>${cb(ec.casado, 'Casado(a)')}${cb(ec.separado, 'Separado(a)')}${cb(ec.soltero, 'Soltero(a)')}</div>
        </td>
        <td><span class="lbl">Dependiente(s)</span><div class="val">${v('dependientes')}</div></td>
      </tr>
      <tr><td colspan="3"><span class="lbl">Dirección Física</span><div class="val">${v('direccion_fisica')}</div></td></tr>
      <tr><td colspan="3"><span class="lbl">Dirección Postal</span><div class="val">${v('direccion_postal')}</div></td></tr>
      <tr>
        <td colspan="2">
          <span class="lbl">Vive en Casa</span>
          <div>${cb(vc.propia, 'Propia')}${cb(vc.alquilada, 'Alquilada')}${cb(vc.familiar, 'Familiar')}${cb(vc.otro, 'Otro')}</div>
        </td>
        <td><span class="lbl">Tiempo en Residencia</span><div class="val">${v('tiempo_residencia')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Nombre y dirección de pariente más cercano que no viva con usted</span><div class="val">${v('pariente_nombre_direccion')}</div></td>
        <td><span class="lbl">Correo Electrónico</span><div class="val">${v('pariente_correo')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('pariente_telefono')}</div></td>
      </tr>
    </table>

    <!-- EMPLEO -->
    <div class="banner">INFORMACIÓN DE EMPLEO/PROFESIÓN DEL SOLICITANTE:</div>
    <table class="grid">
      <tr>
        <td colspan="2">
          <span class="lbl">Empleado</span>
          <div>${cb(et.regular, 'Regular')}${cb(et.probatorio, 'Probatorio')}${cb(et.contrato, 'Contrato')}${cb(et.cuenta_propia, 'Cuenta Propia')}</div>
        </td>
        <td><span class="lbl">Tiempo en el Empleo</span><div class="val">${v('tiempo_empleo')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Nombre de patrono actual</span><div class="val">${v('patrono')}</div></td>
        <td><span class="lbl">Ocupación</span><div class="val">${v('ocupacion')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('patrono_telefono')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Supervisor Inmediato</span><div class="val">${v('supervisor')}</div></td>
        <td><span class="lbl">Dirección Empleo</span><div class="val">${v('direccion_empleo')}</div></td>
        <td><span class="lbl">Teléfono Empleo</span><div class="val">${v('telefono_empleo')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Salario Bruto Actual</span><div class="val">${v('salario_bruto')}</div></td>
        <td>
          <span class="lbl">Frecuencia</span>
          <div style="font-size:8pt;">${cb(sf.semanal, 'Sem.')}${cb(sf.bisemanal, 'Bisem.')}${cb(sf.quincenal, 'Quinc.')}${cb(sf.mensual, 'Mens.')}</div>
        </td>
        <td><span class="lbl">¿Está usted en licencia?</span><div>${cb(lic.si, 'Sí')}${cb(lic.no, 'No')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Otros Ingresos</span><div class="val">${v('otros_ingresos')}</div></td>
        <td><span class="lbl">Fuente de otros ingresos</span><div class="val">${v('otros_ingresos_fuente')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('otros_ingresos_telefono')}</div></td>
      </tr>
    </table>

    <!-- CÓNYUGE -->
    <div class="banner">INFORMACIÓN DEL CÓNYUGE O GARANTIZADOR (SI APLICA)</div>
    <table class="grid">
      <tr>
        <td><span class="lbl">Nombre Completo</span><div class="val">${v('conyuge_nombre')}</div></td>
        <td><span class="lbl">Núm. Socio</span><div class="val">${v('conyuge_num_socio')}</div></td>
        <td><span class="lbl">Seguro Social</span><div class="val">${v('conyuge_seguro_social')}</div></td>
      </tr>
      <tr><td colspan="3"><span class="lbl">Dirección Residencial</span><div class="val">${v('conyuge_direccion_residencial')}</div></td></tr>
      <tr><td colspan="3"><span class="lbl">Dirección Postal</span><div class="val">${v('conyuge_direccion_postal')}</div></td></tr>
      <tr>
        <td><span class="lbl">Fecha Nacimiento</span><div class="val">${v('conyuge_fecha_nacimiento')}</div></td>
        <td><span class="lbl">Licencia de Conducir</span><div class="val">${v('conyuge_licencia')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('conyuge_telefono')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Patrono Actual</span><div class="val">${v('conyuge_patrono')}</div></td>
        <td><span class="lbl">Tiempo de Empleo</span><div class="val">${v('conyuge_tiempo_empleo')}</div></td>
        <td><span class="lbl">Puesto</span><div class="val">${v('conyuge_puesto')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Teléfono del Trabajo</span><div class="val">${v('conyuge_telefono_trabajo')}</div></td>
        <td><span class="lbl">Nombre del Supervisor</span><div class="val">${v('conyuge_supervisor')}</div></td>
        <td><span class="lbl">Dirección de Empleo</span><div class="val">${v('conyuge_direccion_empleo')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Salario Bruto Actual</span><div class="val">${v('conyuge_salario_bruto')}</div></td>
        <td><span class="lbl">Otros Ingresos</span><div class="val">${v('conyuge_otros_ingresos')}</div></td>
        <td><span class="lbl">Fuentes de otros ingresos</span><div class="val">${v('conyuge_otros_ingresos_fuente')}</div></td>
      </tr>
    </table>

    <!-- GARANTIZADOR -->
    <div class="banner">INFORMACIÓN DEL GARANTIZADOR</div>
    <table class="grid">
      <tr>
        <td><span class="lbl">Nombre Completo</span><div class="val">${v('garante_nombre')}</div></td>
        <td><span class="lbl">Núm. Socio</span><div class="val">${v('garante_num_socio')}</div></td>
        <td><span class="lbl">Seguro Social</span><div class="val">${v('garante_seguro_social')}</div></td>
      </tr>
      <tr><td colspan="3"><span class="lbl">Dirección Residencial</span><div class="val">${v('garante_direccion_residencial')}</div></td></tr>
      <tr><td colspan="3"><span class="lbl">Dirección Postal</span><div class="val">${v('garante_direccion_postal')}</div></td></tr>
      <tr>
        <td><span class="lbl">Fecha Nacimiento</span><div class="val">${v('garante_fecha_nacimiento')}</div></td>
        <td><span class="lbl">Licencia de Conducir</span><div class="val">${v('garante_licencia')}</div></td>
        <td><span class="lbl">Teléfono</span><div class="val">${v('garante_telefono')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Patrono Actual</span><div class="val">${v('garante_patrono')}</div></td>
        <td><span class="lbl">Tiempo de Empleo</span><div class="val">${v('garante_tiempo_empleo')}</div></td>
        <td><span class="lbl">Puesto</span><div class="val">${v('garante_puesto')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Teléfono del Trabajo</span><div class="val">${v('garante_telefono_trabajo')}</div></td>
        <td><span class="lbl">Nombre del Supervisor</span><div class="val">${v('garante_supervisor')}</div></td>
        <td><span class="lbl">Dirección de Empleo</span><div class="val">${v('garante_direccion_empleo')}</div></td>
      </tr>
      <tr>
        <td><span class="lbl">Salario Bruto Actual</span><div class="val">${v('garante_salario_bruto')}</div></td>
        <td><span class="lbl">Otros Ingresos</span><div class="val">${v('garante_otros_ingresos')}</div></td>
        <td><span class="lbl">Fuentes de otros ingresos</span><div class="val">${v('garante_otros_ingresos_fuente')}</div></td>
      </tr>
    </table>

    <!-- FIRMAS -->
    <div class="firmas">
      <div class="firma-col">
        <div class="firma-box">${sigSrc ? `<img src="${sigSrc}" alt="firma" />` : ''}</div>
        <div class="firma-lbl">Firma Solicitante</div>
        <div class="firma-fecha">Fecha: ${v('firma_fecha')}</div>
      </div>
      <div class="firma-col">
        <div class="firma-box"></div>
        <div class="firma-lbl">Firma Cónyuge</div>
        <div class="firma-fecha">Fecha: ${v('firma_conyuge_fecha')}</div>
      </div>
      <div class="firma-col">
        <div class="firma-box"></div>
        <div class="firma-lbl">Firma Garantizador</div>
        <div class="firma-fecha">Fecha: ${v('firma_garante_fecha')}</div>
      </div>
    </div>

    <div class="disclaimer">
      Por este medio autorizamos a la Cooperativa a confiscar todos los haberes, incluyendo acciones, certificados, depósitos y cuentas de ahorro para aplicarlos a la deuda, si la misma se declara incobrable. Por la presente certifico, so pena de perjurio, que toda información en esta solicitud, es cierta y correcta según mi mejor conocimiento. Por la presente autorizo a la Cooperativa a verificar toda la información suministrada incluyendo mi crédito, historial de empleo, obtener informes de crédito y a contestar preguntas sobre mi experiencia crediticia de acuerdo a lo autorizado por la ley. En caso de fracaso o cierre de la institución el recobro de fondos depositados no está garantizado por el Gobierno Federal de los Estados Unidos. Los fondos depositados en TuCoop están asegurados por COSSEC hasta $250,000.00. Sujeto a aprobación de crédito y a que cumplas con los parámetros ofrecidos por TuCoop. Otros términos y condiciones aplican. Préstamos comienzan desde $1,000 hasta $35,000 bajo un término de 12 hasta 84 meses. Tasa de porcentaje anual desde 6.45% hasta 19.95% APR. El APR se determinará a base de su puntuación de riesgo e historial de crédito.
    </div>

  </div>
</body>
</html>`;
}

module.exports = { buildHtml };

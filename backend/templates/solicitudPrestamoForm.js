'use strict';

// Definición de campos del formulario de Solicitud de Préstamo
// type: text | tel | email | date | number | textarea
// width: 'full' | 'half'

const LOAN_FORM_SECTIONS = [
  {
    title: 'Información Personal',
    fields: [
      { key: 'nombre_completo',  label: 'Nombre completo',     type: 'text', width: 'full', required: true },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', width: 'half', required: true },
      { key: 'ss',               label: 'Seguro Social #',     type: 'text', width: 'half', required: true },
      { key: 'estado_civil',     label: 'Estado civil',        type: 'text', width: 'half' },
      { key: 'email',            label: 'Email',               type: 'email',width: 'half', required: true },
      { key: 'telefono_celular', label: 'Teléfono celular',    type: 'tel',  width: 'half', required: true },
      { key: 'telefono_casa',    label: 'Teléfono casa',       type: 'tel',  width: 'half' },
    ],
  },
  {
    title: 'Direcciones',
    fields: [
      { key: 'direccion_fisica', label: 'Dirección física', type: 'textarea', width: 'full', required: true },
      { key: 'direccion_postal', label: 'Dirección postal', type: 'textarea', width: 'full' },
    ],
  },
  {
    title: 'Cuenta de Servicio Eléctrico',
    fields: [
      { key: 'cta_luma',  label: 'Cuenta LUMA #', type: 'text', width: 'half', required: true },
      { key: 'contador',  label: 'Contador #',    type: 'text', width: 'half' },
    ],
  },
  {
    title: 'Empleo e Ingresos',
    fields: [
      { key: 'empleador',           label: 'Empleador',           type: 'text',   width: 'half' },
      { key: 'ocupacion',           label: 'Ocupación',           type: 'text',   width: 'half' },
      { key: 'anios_empleo',        label: 'Años en el empleo',   type: 'number', width: 'half' },
      { key: 'salario_mensual',     label: 'Salario mensual ($)', type: 'number', width: 'half' },
      { key: 'ingresos_adicionales',label: 'Ingresos adicionales mensuales ($)', type: 'number', width: 'full' },
    ],
  },
  {
    title: 'Préstamo Solicitado',
    fields: [
      { key: 'cantidad_solicitada', label: 'Cantidad solicitada ($)', type: 'number', width: 'half', required: true },
      { key: 'plazo_anios',         label: 'Plazo (años)',            type: 'number', width: 'half' },
      { key: 'proposito',           label: 'Propósito del préstamo',  type: 'text',   width: 'full' },
    ],
  },
  {
    title: 'Referencias Personales',
    fields: [
      { key: 'ref1_nombre',     label: 'Referencia 1 — Nombre',     type: 'text', width: 'half' },
      { key: 'ref1_parentesco', label: 'Referencia 1 — Parentesco', type: 'text', width: 'half' },
      { key: 'ref1_telefono',   label: 'Referencia 1 — Teléfono',   type: 'tel',  width: 'full' },
      { key: 'ref2_nombre',     label: 'Referencia 2 — Nombre',     type: 'text', width: 'half' },
      { key: 'ref2_parentesco', label: 'Referencia 2 — Parentesco', type: 'text', width: 'half' },
      { key: 'ref2_telefono',   label: 'Referencia 2 — Teléfono',   type: 'tel',  width: 'full' },
      { key: 'ref3_nombre',     label: 'Referencia 3 — Nombre',     type: 'text', width: 'half' },
      { key: 'ref3_parentesco', label: 'Referencia 3 — Parentesco', type: 'text', width: 'half' },
      { key: 'ref3_telefono',   label: 'Referencia 3 — Teléfono',   type: 'tel',  width: 'full' },
    ],
  },
];

const LOAN_FORM_FIELDS = LOAN_FORM_SECTIONS.flatMap(s => s.fields);
const LOAN_REQUIRED_KEYS = LOAN_FORM_FIELDS.filter(f => f.required).map(f => f.key);

module.exports = { LOAN_FORM_SECTIONS, LOAN_FORM_FIELDS, LOAN_REQUIRED_KEYS };

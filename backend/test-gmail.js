'use strict';

/**
 * Test script for Gmail Service Account / Domain-wide Delegation setup.
 *
 * Usage:
 *   node test-gmail.js                                 → uses defaults below
 *   node test-gmail.js gil.diaz@energydepotpr.com other@example.com
 *
 * Args:
 *   1) FROM — Workspace user the Service Account will impersonate
 *   2) TO   — Recipient (any address)
 *
 * Reads credentials from backend/.secrets/google-sa.json by default
 * (or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_PATH).
 */

require('dotenv').config();
const { sendEmail, verifyImpersonation } = require('./services/gmailService');

const FROM = process.argv[2] || 'gil.diaz@energydepotpr.com';
const TO = process.argv[3] || FROM; // default: send to self

(async () => {
  console.log('🔐  Verifying credentials and impersonation token mint...');
  console.log(`   from (impersonating): ${FROM}`);

  try {
    const check = await verifyImpersonation(FROM);
    console.log('   ✓ token minted');
    console.log(`   service account: ${check.serviceAccount}`);
  } catch (err) {
    console.error('   ✗ Token mint failed:', err.message);
    if (err.response?.data) console.error(err.response.data);
    process.exit(1);
  }

  console.log('\n📧  Sending test email...');
  console.log(`   from: ${FROM}`);
  console.log(`   to:   ${TO}`);

  try {
    const result = await sendEmail({
      from: FROM,
      to: TO,
      subject: 'Energy Depot CRM — Test email via Service Account',
      text: 'Si recibes este correo, la configuración de Gmail API + Domain-wide Delegation funciona correctamente.\n\n— Energy Depot CRM',
      html: `
        <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:8px">
          <h2 style="color:#0a66ff;margin:0 0 12px">Test email — Energy Depot CRM</h2>
          <p>Si recibes este correo, la configuración de Gmail API + Domain-wide Delegation funciona correctamente.</p>
          <p style="color:#666;font-size:13px;margin-top:24px">
            Enviado vía Service Account <code>energy-depot-crm-gmail@energy-depot-crm-494720.iam.gserviceaccount.com</code><br/>
            Impersonando: <strong>${FROM}</strong>
          </p>
        </div>
      `,
    });

    console.log('   ✓ sent');
    console.log(`   message id:  ${result.id}`);
    console.log(`   thread id:   ${result.threadId}`);
    console.log('\n✅  All good — revisa la bandeja de entrada de', TO);
  } catch (err) {
    console.error('   ✗ Send failed:', err.message);
    if (err.response?.data) {
      console.error('   API response:', JSON.stringify(err.response.data, null, 2));
    } else if (err.errors) {
      console.error('   API errors:', JSON.stringify(err.errors, null, 2));
    }
    console.error(
      '\nTroubleshoot:\n' +
        '  • Confirma Domain-wide Delegation autorizada con scope https://www.googleapis.com/auth/gmail.send\n' +
        '  • Confirma que el FROM existe en el Workspace energydepotpr.com\n' +
        '  • Si recién configuraste delegation, espera 1-2 min y vuelve a probar\n' +
        '  • Confirma que Gmail API esté habilitada en el proyecto energy-depot-crm-494720'
    );
    process.exit(1);
  }
})();

const axios = require('axios');

async function enviarSMS(telefono, texto, intento = 1) {
  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!SID || !TOKEN || !FROM) throw new Error('Faltan variables de Twilio');

  try {
    const params = new URLSearchParams({ From: FROM, To: telefono, Body: texto });
    const resp = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
      params.toString(),
      { auth: { username: SID, password: TOKEN }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    console.log(`[TWILIO] SMS enviado a ${telefono} — SID: ${resp.data.sid}`);
    return resp.data;
  } catch (err) {
    if (err.response?.status === 429 && intento < 3) {
      await new Promise(r => setTimeout(r, 1500 * intento));
      return enviarSMS(telefono, texto, intento + 1);
    }
    const msg = err.response?.data?.message || err.message;
    throw new Error(msg);
  }
}

async function enviarWhatsApp(telefono, texto, intento = 1) {
  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!SID || !TOKEN || !FROM) throw new Error('Faltan variables de Twilio WhatsApp');

  // Normalizar: remover prefijo "whatsapp:" si ya viene incluido
  const toClean   = telefono.replace(/^whatsapp:/i, '');
  const fromClean = FROM.replace(/^whatsapp:/i, '');

  try {
    const params = new URLSearchParams({
      From: `whatsapp:${fromClean}`,
      To:   `whatsapp:${toClean}`,
      Body: texto,
    });
    const resp = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
      params.toString(),
      { auth: { username: SID, password: TOKEN }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    console.log(`[TWILIO] WhatsApp enviado a ${toClean} — SID: ${resp.data.sid}`);
    return resp.data;
  } catch (err) {
    if (err.response?.status === 429 && intento < 3) {
      await new Promise(r => setTimeout(r, 1500 * intento));
      return enviarWhatsApp(telefono, texto, intento + 1);
    }
    const msg = err.response?.data?.message || err.message;
    throw new Error(msg);
  }
}

module.exports = { enviarSMS, enviarWhatsApp };

const twilio = require('twilio');
const { pool } = require('../services/db');

const accountSid  = process.env.TWILIO_ACCOUNT_SID;
const authToken   = process.env.TWILIO_AUTH_TOKEN;
const callerNumber = process.env.TWILIO_PHONE_NUMBER;

// ── Ejecutar migraciones al cargar el módulo ──────────────────────────────────
(async () => {
  try {
    await pool.query(`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT
    `);
    await pool.query(`
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_sid TEXT
    `);
  } catch (err) {
    console.error('[callRecording] Migration error:', err.message);
  }
})();

// ── TwiML con grabación habilitada ────────────────────────────────────────────
// PUBLIC — no requiere auth
function twimlConGrabacion(req, res) {
  const to = req.body.To || req.query.To;
  const twiml = new twilio.twiml.VoiceResponse();

  if (to) {
    const dial = twiml.dial({
      callerId: callerNumber,
      timeout: 30,
      record: 'record-from-answer',
      recordingStatusCallback: '/api/calls/recording-callback',
      recordingStatusCallbackMethod: 'POST',
    });

    if (to.startsWith('client:')) {
      dial.client(to.replace('client:', ''));
    } else {
      dial.number(to);
    }
  } else {
    twiml.say({ language: 'es-US' }, 'No se especificó un número de destino.');
  }

  res.type('text/xml').send(twiml.toString());
}

// ── Webhook de Twilio al completar la grabación ───────────────────────────────
// PUBLIC — no requiere auth (webhook de Twilio)
async function recordingCallback(req, res) {
  try {
    const { RecordingUrl, RecordingSid, CallSid } = req.body;

    if (!CallSid) return res.sendStatus(200);

    // Intentar actualizar por call_sid
    await pool.query(`
      UPDATE call_logs
      SET recording_url = $1, recording_sid = $2, updated_at = NOW()
      WHERE call_sid = $3
    `, [RecordingUrl || null, RecordingSid || null, CallSid]);

    res.sendStatus(200);
  } catch (err) {
    console.error('[callRecording callback]', err.message);
    res.sendStatus(200); // siempre 200 a Twilio
  }
}

// ── Obtener URL de grabación de una llamada ───────────────────────────────────
async function obtenerGrabacion(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT recording_url, recording_sid FROM call_logs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Llamada no encontrada' });
    }

    const { recording_url, recording_sid } = result.rows[0];

    if (!recording_url && !recording_sid) {
      return res.status(404).json({ error: 'Esta llamada no tiene grabación' });
    }

    // Construir URL con auth básica embebida para el frontend
    // Twilio requiere autenticación para acceder a los archivos de grabación
    const urlConAuth = `https://${accountSid}:${authToken}@api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recording_sid}.mp3`;

    res.json({
      recording_url: urlConAuth,
      recording_sid,
      original_url: recording_url,
    });
  } catch (err) {
    console.error('[callRecording obtener]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Eliminar grabación de Twilio y limpiar del log ────────────────────────────
async function eliminarGrabacion(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT recording_sid FROM call_logs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Llamada no encontrada' });
    }

    const { recording_sid } = result.rows[0];

    if (recording_sid && accountSid && authToken) {
      try {
        const client = twilio(accountSid, authToken);
        await client.recordings(recording_sid).remove();
      } catch (twilioErr) {
        // Loguear pero no fallar — puede que ya esté eliminada
        console.warn('[callRecording eliminar] Twilio:', twilioErr.message);
      }
    }

    // Limpiar del log independientemente del resultado de Twilio
    await pool.query(`
      UPDATE call_logs
      SET recording_url = NULL, recording_sid = NULL, updated_at = NOW()
      WHERE id = $1
    `, [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[callRecording eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Listar todas las grabaciones de Twilio (incluyendo voicemails) ─────────────
async function listarGrabacionesTwilio(req, res) {
  try {
    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Twilio no configurado' });
    }
    const client = twilio(accountSid, authToken);
    const recordings = await client.recordings.list({ limit: 100 });

    const callSids = recordings.map(r => r.callSid).filter(Boolean);
    let callDetails = {};
    const ownNumber = (callerNumber || '').replace(/\D/g, '');

    // Helper: buscar lead por número de teléfono
    // Busca en contacts.phone Y en el título del lead (ej: "Phone number: +17392971267")
    const lookupLeadByPhone = async (phone) => {
      if (!phone || phone.startsWith('client:')) return null;
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (digits.length < 7) return null;
      if (ownNumber && digits === ownNumber.slice(-10)) return null; // skip propio número
      try {
        const r = await pool.query(
          `SELECT l.id, COALESCE(c.name, l.title) AS name
           FROM leads l
           LEFT JOIN contacts c ON c.id = l.contact_id
           WHERE
             (c.phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = $1)
             OR REGEXP_REPLACE(l.title, '[^0-9]', '', 'g') LIKE '%' || $1
           ORDER BY l.id DESC
           LIMIT 1`,
          [digits]
        );
        return r.rows[0] || null;
      } catch (e) {
        console.warn('[lookupLeadByPhone]', e.message);
        return null;
      }
    };

    // Step 1: match call_sids con call_logs + leads
    if (callSids.length) {
      try {
        const rows = await pool.query(`
          SELECT cl.call_sid, cl.to_number, cl.from_number,
                 l.id AS lead_id, COALESCE(l.title, c.name) AS lead_name
          FROM call_logs cl
          LEFT JOIN leads l ON cl.lead_id = l.id
          LEFT JOIN contacts c ON c.id = l.contact_id
          WHERE cl.call_sid = ANY($1)
        `, [callSids]);
        rows.rows.forEach(r => { callDetails[r.call_sid] = r; });
      } catch (e) { console.warn('[callDetails step1]', e.message); }
    }

    // Step 2: para call_logs sin lead_id, intentar buscar lead por número de teléfono
    const sigsConNumeroSinLead = callSids.filter(sid => callDetails[sid] && !callDetails[sid].lead_id);
    await Promise.all(sigsConNumeroSinLead.map(async (sid) => {
      const det = callDetails[sid];
      for (const phone of [det.from_number, det.to_number]) {
        const found = await lookupLeadByPhone(phone);
        if (found) {
          callDetails[sid] = { ...det, lead_id: found.id, lead_name: found.name };
          break;
        }
      }
    }));

    // Step 3: para grabaciones sin call_log O con ambos números = propio número (datos inválidos)
    const sigsParaFetchTwilio = callSids.filter(sid => {
      if (!callDetails[sid]) return true; // sin call_log
      if (callDetails[sid].lead_id) return false; // ya tiene lead
      const det = callDetails[sid];
      const fromDig = (det.from_number || '').replace(/\D/g, '').slice(-10);
      const toDig   = (det.to_number   || '').replace(/\D/g, '').slice(-10);
      const ownDig  = ownNumber.slice(-10);
      // Si ambos números son el propio Twilio, los datos están mal → consultar API
      return fromDig === ownDig && toDig === ownDig;
    });
    if (sigsParaFetchTwilio.length) {
      await Promise.all(sigsParaFetchTwilio.map(async (sid) => {
        try {
          const call = await client.calls(sid).fetch();
          const toNum   = (!call.to   || call.to.startsWith('client:'))   ? null : call.to;
          const fromNum = (!call.from || call.from.startsWith('client:')) ? null : call.from;
          let lead_id = null, lead_name = null;
          for (const phone of [call.from, call.to]) {
            const found = await lookupLeadByPhone(phone);
            if (found) { lead_id = found.id; lead_name = found.name; break; }
          }
          callDetails[sid] = { ...callDetails[sid], to_number: toNum, from_number: fromNum, lead_id, lead_name };
        } catch (e) {
          console.warn('[Twilio call fetch]', sid, e.message);
        }
      }));
    }

    const result = recordings.map(r => ({
      sid:          r.sid,
      call_sid:     r.callSid,
      duration:     parseInt(r.duration) || 0,
      status:       r.status,
      date_created: r.dateCreated,
      channels:     r.channels,
      source:       r.source,
      to_number:    callDetails[r.callSid]?.to_number || null,
      from_number:  callDetails[r.callSid]?.from_number || null,
      lead_id:      callDetails[r.callSid]?.lead_id || null,
      lead_name:    callDetails[r.callSid]?.lead_name || null,
    }));

    res.json({ ok: true, recordings: result });
  } catch (err) {
    console.error('[Twilio recordings]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Transcribir grabación con Groq Whisper ────────────────────────────────────
async function transcribirGrabacion(req, res) {
  try {
    const { sid } = req.params;
    const translate = req.query.translate === 'true';
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) return res.status(400).json({ error: 'GROQ_API_KEY no configurado' });
    if (!accountSid || !authToken) return res.status(400).json({ error: 'Twilio no configurado' });

    // Download audio from Twilio
    const audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
    const audioResp = await fetch(audioUrl, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') },
    });
    if (!audioResp.ok) return res.status(404).json({ error: 'No se pudo descargar el audio' });

    const audioBuffer = Buffer.from(await audioResp.arrayBuffer());

    // Build multipart form for Groq Whisper API
    const boundary = '----FormBoundary' + Date.now();
    const filename  = `recording-${sid}.mp3`;

    // Note: Groq does NOT support `task` param — endpoint determines action
    // For translations, don't send `language` (auto-detect source)
    const parts = translate ? [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      audioBuffer,
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`,
      `--${boundary}--\r\n`,
    ] : [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      audioBuffer,
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`,
      `--${boundary}--\r\n`,
    ];

    const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));

    const groqEndpoint = translate
      ? 'https://api.groq.com/openai/v1/audio/translations'
      : 'https://api.groq.com/openai/v1/audio/transcriptions';

    const groqResp = await fetch(groqEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const groqData = await groqResp.json();
    if (!groqResp.ok) {
      console.error('[Groq]', groqData);
      const errMsg = groqData?.error?.message || '';
      // Friendly rate limit message
      if (groqData?.error?.code === 'rate_limit_exceeded' || errMsg.includes('Rate limit')) {
        const waitMatch = errMsg.match(/try again in ([\d.]+)s/i);
        const waitSecs = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : 60;
        return res.status(429).json({ error: `Límite de transcripciones alcanzado. Espera ${waitSecs} segundos e intenta de nuevo.` });
      }
      return res.status(500).json({ error: errMsg || 'Error en Groq' });
    }

    const text = groqData.text || '';

    // If transcribed in Spanish, also get English translation via Groq Whisper translate (free)
    let translation = null;
    if (!translate && text) {
      try {
        const groqTranslate = await fetch('https://api.groq.com/openai/v1/audio/translations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/mpeg\r\n\r\n`),
            audioBuffer,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`),
            Buffer.from(`--${boundary}--\r\n`),
          ]),
        });
        const tData = await groqTranslate.json();
        translation = tData.text || null;
      } catch (e) { /* translation optional */ }
    }

    // Fallback: if Whisper couldn't translate (short audio), use LLM text translation
    if (!translation && text) {
      try {
        const llmTr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            max_tokens: 500,
            messages: [
              { role: 'system', content: 'Translate the following text to English. Output only the translation, no explanation.' },
              { role: 'user', content: text },
            ],
          }),
        });
        const llmTrData = await llmTr.json();
        translation = llmTrData.choices?.[0]?.message?.content?.trim() || null;
      } catch (e) { /* optional */ }
    }

    // Speaker diarization via Groq LLM (free) — use Spanish text (original)
    let speakers = null;
    const transcriptForDiarization = text;
    if (transcriptForDiarization) {
      try {
        const diarizeResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            max_tokens: 8000,
            messages: [
              {
                role: 'system',
                content: 'You are a call transcript formatter for a travel agency (Fix A Trip Puerto Rico). Given a raw transcript of a phone call, split it into speaker turns and label each turn as "Agente" (the company employee) or "Cliente" (the customer). Output ONLY a valid JSON array like: [{"speaker":"Agente","text":"..."},{"speaker":"Cliente","text":"..."}]. No markdown, no explanation, just the JSON array.',
              },
              {
                role: 'user',
                content: transcriptForDiarization,
              },
            ],
          }),
        });
        const diarizeData = await diarizeResp.json();
        const raw = diarizeData.choices?.[0]?.message?.content || '';
        // Extract JSON array from response
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) speakers = JSON.parse(match[0]);
      } catch (e) {
        console.warn('[diarize]', e.message);
      }
    }

    // Fallback: if diarization failed, wrap full text as single unknown speaker bubble
    if ((!speakers || speakers.length === 0) && text) {
      speakers = [{ speaker: 'Desconocido', text }];
    }

    // Translate each speaker turn to English (same bubble structure)
    let speakers_en = null;
    if (speakers?.length && translation) {
      try {
        const enResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            max_tokens: 8000,
            messages: [
              {
                role: 'system',
                content: 'Translate each "text" field to English. Keep exactly the same JSON array structure with "speaker" and "text" fields. Output ONLY the JSON array, no markdown.',
              },
              { role: 'user', content: JSON.stringify(speakers) },
            ],
          }),
        });
        const enData = await enResp.json();
        const raw2 = enData.choices?.[0]?.message?.content || '';
        const match2 = raw2.match(/\[[\s\S]*\]/);
        if (match2) speakers_en = JSON.parse(match2[0]);
      } catch (e) { console.warn('[translate speakers]', e.message); }
    }

    res.json({ ok: true, sid, transcription: text, translation, speakers, speakers_en, language: translate ? 'en' : 'es' });
  } catch (err) {
    console.error('[transcribir]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Proxy de audio (play/download sin exponer credenciales al frontend) ─────────
async function proxyAudio(req, res) {
  try {
    const { sid } = req.params;
    const format  = req.query.format === 'wav' ? 'wav' : 'mp3';
    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Twilio no configurado' });
    }
    const audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.${format}`;
    const response = await fetch(audioUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'No se pudo obtener el audio' });
    }
    res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="recording-${sid}.${format}"`);
    // Stream the audio
    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error('[proxyAudio]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { twimlConGrabacion, recordingCallback, obtenerGrabacion, eliminarGrabacion, listarGrabacionesTwilio, proxyAudio, transcribirGrabacion };

/* ROUTES_TO_ADD_server.js
// Public (Twilio webhooks — no auth)
app.post('/api/calls/recording-callback', callRecording.recordingCallback);
app.post('/api/calls/twiml-recording', callRecording.twimlConGrabacion);
// Protected
app.get('/api/calls/:id/recording', authMiddleware, callRecording.obtenerGrabacion);
app.delete('/api/calls/:id/recording', authMiddleware, callRecording.eliminarGrabacion);
*/

/* API_METHODS_TO_ADD_api.js
callRecording: (id) => req('GET', `/api/calls/${id}/recording`),
deleteRecording: (id) => req('DELETE', `/api/calls/${id}/recording`),
*/

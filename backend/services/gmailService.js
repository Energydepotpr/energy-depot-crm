'use strict';

/**
 * Gmail Service — sends emails via Gmail API using a Google Workspace
 * Service Account with Domain-wide Delegation.
 *
 * Setup requirements (already done outside this code):
 *   1. Service Account in Google Cloud project "Energy Depot CRM"
 *   2. Gmail API enabled in that project
 *   3. JSON key downloaded
 *   4. Domain-wide Delegation authorized in admin.google.com with scope:
 *        https://www.googleapis.com/auth/gmail.send
 *
 * Credentials loading order (first match wins):
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON env var — full JSON pasted as a string
 *      (recommended for Vercel/production)
 *   2. GOOGLE_SERVICE_ACCOUNT_PATH env var — absolute path to a .json file
 *   3. backend/.secrets/google-sa.json (default for local dev)
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

let cachedCredentials = null;

function loadCredentials() {
  if (cachedCredentials) return cachedCredentials;

  // 1) Inline JSON env var
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      cachedCredentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return cachedCredentials;
    } catch (err) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON: ${err.message}`
      );
    }
  }

  // 2) Path env var
  let filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  // 3) Default location for local dev
  if (!filePath) {
    filePath = path.join(__dirname, '..', '.secrets', 'google-sa.json');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Google Service Account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON ` +
        `or GOOGLE_SERVICE_ACCOUNT_PATH, or place the key at ${filePath}`
    );
  }

  cachedCredentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return cachedCredentials;
}

/**
 * Returns an authenticated Gmail API client that acts on behalf of `userEmail`.
 * `userEmail` must be an account in the energydepotpr.com Workspace.
 */
function extractEmail(addr) {
  if (!addr) return addr;
  const m = String(addr).match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

function getGmailClient(userEmail) {
  if (!userEmail) {
    throw new Error('getGmailClient requires a userEmail to impersonate');
  }
  const creds = loadCredentials();
  const sub = extractEmail(userEmail);

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
    subject: sub, // plain email only — Google rejects "Name <email>" here
  });

  return google.gmail({ version: 'v1', auth });
}

/**
 * Builds an RFC 5322 message via nodemailer MailComposer (handles multipart correctly)
 * and base64url-encodes it for the Gmail API.
 */
async function buildRawMessage({ from, to, cc, bcc, replyTo, subject, text, html, attachments }) {
  const MailComposer = require('nodemailer/lib/mail-composer');
  const opts = {
    from,
    to: Array.isArray(to) ? to.join(', ') : to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    replyTo: replyTo || undefined,
    subject: subject || '',
    text: text || undefined,
    html: html || undefined,
    attachments: Array.isArray(attachments)
      ? attachments.map((a) => ({
          filename: a.filename || 'attachment',
          contentType: a.mimeType || 'application/octet-stream',
          content: Buffer.isBuffer(a.content)
            ? a.content
            : Buffer.from(String(a.content), 'base64'),
        }))
      : undefined,
  };
  const mail = new MailComposer(opts);
  const buf = await new Promise((resolve, reject) => {
    mail.compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email via Gmail API impersonating `from`.
 *
 * @param {Object} opts
 * @param {string} opts.from      Workspace email to send from (e.g. "gil.diaz@energydepotpr.com")
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]    Plain text body
 * @param {string} [opts.html]    HTML body
 * @param {string|string[]} [opts.cc]
 * @param {string|string[]} [opts.bcc]
 * @param {string} [opts.replyTo]
 * @returns {Promise<{ id: string, threadId: string, labelIds?: string[] }>}
 */
async function sendEmail(opts) {
  const { from, to, subject } = opts;
  if (!from) throw new Error('sendEmail: "from" is required');
  if (!to) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');
  if (!opts.text && !opts.html) {
    throw new Error('sendEmail: provide at least "text" or "html"');
  }

  const gmail = getGmailClient(from);
  const raw = await buildRawMessage(opts);

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return res.data;
}

/**
 * Quick sanity check — verifies credentials load and the Service Account
 * can mint a token for the given user. Does NOT send an email.
 */
async function verifyImpersonation(userEmail) {
  const gmail = getGmailClient(userEmail);
  // getProfile requires gmail.readonly or higher. With only gmail.send
  // we can't actually call it, so we just force a token mint instead.
  const auth = gmail.context._options.auth;
  const token = await auth.authorize();
  return {
    ok: !!(token && token.access_token),
    impersonating: userEmail,
    serviceAccount: loadCredentials().client_email,
  };
}

/**
 * Lists message IDs in a label (e.g. "INBOX", "SENT") since a given date.
 */
async function listMessages({ user, labelId = 'INBOX', sinceDays = 30, max = 100 }) {
  const gmail = getGmailClient(user);
  const after = Math.floor((Date.now() - sinceDays * 86400000) / 1000);
  const q = `after:${after}`;
  const ids = [];
  let pageToken = undefined;
  do {
    const r = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      q,
      maxResults: Math.min(100, max - ids.length),
      pageToken,
    });
    (r.data.messages || []).forEach((m) => ids.push(m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

function decodeBody(part) {
  if (!part || !part.body || !part.body.data) return '';
  return Buffer.from(part.body.data, 'base64').toString('utf8');
}

function findPart(payload, mimeType) {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) return payload;
  for (const p of payload.parts || []) {
    const f = findPart(p, mimeType);
    if (f) return f;
  }
  return null;
}

function parseHeader(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function parseAddress(headerValue) {
  if (!headerValue) return { name: '', email: '' };
  const m = headerValue.match(/^(.*?)\s*<(.+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), email: m[2].trim() };
  return { name: '', email: headerValue.trim() };
}

/**
 * Fetches a single message and returns parsed content.
 */
async function getMessage({ user, messageId }) {
  const gmail = getGmailClient(user);
  const r = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const msg = r.data;
  const headers = msg.payload?.headers || [];
  const fromAddr = parseAddress(parseHeader(headers, 'From'));
  const toAddr = parseAddress(parseHeader(headers, 'To'));

  const textPart = findPart(msg.payload, 'text/plain');
  const htmlPart = findPart(msg.payload, 'text/html');
  const text = decodeBody(textPart);
  const html = decodeBody(htmlPart);

  return {
    messageId: parseHeader(headers, 'Message-ID') || msg.id,
    gmailId: msg.id,
    threadId: msg.threadId,
    fromName: fromAddr.name || fromAddr.email,
    fromEmail: fromAddr.email,
    toName: toAddr.name,
    toEmail: toAddr.email,
    subject: parseHeader(headers, 'Subject') || '(sin asunto)',
    date: new Date(parseInt(msg.internalDate, 10) || Date.now()),
    text,
    html: html || null,
    snippet: msg.snippet || '',
    labelIds: msg.labelIds || [],
  };
}

module.exports = {
  getGmailClient,
  sendEmail,
  verifyImpersonation,
  listMessages,
  getMessage,
};

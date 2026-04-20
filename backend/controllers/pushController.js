const webpush = require('web-push');
const { pool } = require('../services/db');

webpush.setVapidDetails(
  'mailto:admin@fixatrippuertorico.com',
  'BGSqphDkH0L70s3CqpOsMnBu2I4Dpzq9uE1W4QfoSjuGMFKMaEtujIUZdZYGCRHaPJf5HiVL6j4khhbf-vGr1KI',
  'SSBbpYw1m3zWzgGkxLZYBXQaOA1b2xOUkzESDepgn0c'
);

async function subscribe(req, res) {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription requerida' });

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription)
       VALUES ($1, $2)
       ON CONFLICT (subscription) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [req.user?.id || null, JSON.stringify(subscription)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[PUSH subscribe]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function unsubscribe(req, res) {
  try {
    const { subscription } = req.body;
    if (subscription) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE subscription = $1`,
        [JSON.stringify(subscription)]
      );
    } else {
      // Remove all subscriptions for this user
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1`,
        [req.user?.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUSH unsubscribe]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function getVapidKey(req, res) {
  res.json({
    publicKey: 'BGSqphDkH0L70s3CqpOsMnBu2I4Dpzq9uE1W4QfoSjuGMFKMaEtujIUZdZYGCRHaPJf5HiVL6j4khhbf-vGr1KI'
  });
}

async function sendToAll(title, body, url = '/inbox') {
  try {
    const { rows } = await pool.query('SELECT id, subscription FROM push_subscriptions');
    const payload = JSON.stringify({ title, body, url, tag: 'msg' });

    const pushOptions = {
      TTL: 3600,          // keep in queue up to 1hr if device offline
      urgency: 'high',    // required for iOS to wake the app
    };

    const toDelete = [];

    await Promise.all(rows.map(async (row) => {
      try {
        const sub = typeof row.subscription === 'string'
          ? JSON.parse(row.subscription)
          : row.subscription;
        await webpush.sendNotification(sub, payload, pushOptions);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(row.id);
        } else {
          console.error('[PUSH sendToAll] Error sending to sub:', err.message);
        }
      }
    }));

    if (toDelete.length > 0) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE id = ANY($1)`,
        [toDelete]
      );
    }
  } catch (err) {
    console.error('[PUSH sendToAll]', err.message);
  }
}

module.exports = { subscribe, unsubscribe, getVapidKey, sendToAll };

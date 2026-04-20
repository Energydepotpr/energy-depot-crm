// Server-Sent Events broadcast service
const clients = new Set();

function subscribe(res) {
  clients.add(res);
}

function unsubscribe(res) {
  clients.delete(res);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of [...clients]) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

module.exports = { subscribe, unsubscribe, broadcast };

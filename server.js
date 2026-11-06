import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const username = String(process.env.TIKTOK_USERNAME || 'imagineaimv').replace(/^@/, '').trim();
const maxGiftCoins = 100000;
const status = { connected: false, username, error: null, lastEvent: null };
const recent = new Map();
let connector = null;
let connecting = false;
let retryTimer = null;

app.use(express.static('public'));
app.get('/api/status', (_req, res) => res.json(status));
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kingdom Wars listening on port ${PORT}`);
  void connectTikTok();
});
const wss = new WebSocketServer({ server, path: '/events' });
wss.on('connection', ws => ws.send(JSON.stringify({ type: 'status', ...status })));

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}
function updateStatus(patch) {
  Object.assign(status, patch);
  broadcast({ type: 'status', ...status });
}
function emitEvent(type, info) {
  const user = String(info.user || '').replace(/^@/, '').trim();
  if (!user || user.length > 80) return;
  const payload = { ...info, type, user, at: Date.now() };
  status.lastEvent = payload.at;
  broadcast(payload);
}
function dedupe(key) {
  const now = Date.now();
  for (const [oldKey, at] of recent) if (now - at > 90000) recent.delete(oldKey);
  if (recent.has(key)) return false;
  recent.set(key, now);
  return true;
}
function scheduleReconnect() {
  if (retryTimer || status.connected || connecting) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connectTikTok();
  }, 30000);
}
async function connectTikTok() {
  if (connecting || status.connected) return;
  if (!username) {
    updateStatus({ error: 'Set TIKTOK_USERNAME in Render environment' });
    return;
  }
  connecting = true;
  try {
    if (connector) {
      connector.removeAllListeners();
      try { connector.disconnect(); } catch { /* previous connection already closed */ }
    }
    connector = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
    connector.on('connected', () => {
      updateStatus({ connected: true, error: null });
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    });
    const disconnected = () => {
      updateStatus({ connected: false });
      scheduleReconnect();
    };
    connector.on('disconnected', disconnected);
    connector.on('streamEnd', disconnected);
    connector.on('error', err => {
      updateStatus({ error: String(err?.message || err).slice(0, 200) });
    });
    connector.on('chat', data => {
      const comment = String(data.comment || '').trim().toUpperCase();
      if (['RED', 'BLUE', '!JOIN', 'JOIN'].includes(comment)) {
        emitEvent('chat', { user: data.uniqueId, comment });
      }
    });
    connector.on('member', data => emitEvent('join', { user: data.uniqueId }));
    connector.on('follow', data => emitEvent('follow', { user: data.uniqueId }));
    connector.on('gift', data => {
      // Streak gifts: count only the final event to avoid duplicate upgrades.
      if (Number(data.giftType) === 1 && !data.repeatEnd) return;
      const repeat = Math.min(1000, Math.max(1, Number(data.repeatCount) || 1));
      const unit = Math.min(maxGiftCoins, Math.max(0, Number(data.diamondCount) || 0));
      const coins = Math.min(maxGiftCoins, repeat * unit);
      if (!coins) return;
      const key = `${data.uniqueId}:${data.giftId}:${data.repeatCount}:${data.repeatEnd}:${data.msgId || ''}`;
      if (!dedupe(key)) return;
      emitEvent('gift', { user: data.uniqueId, coins, giftName: String(data.giftName || 'Gift').slice(0, 60) });
    });
    await connector.connect();
  } catch (err) {
    updateStatus({ connected: false, error: String(err?.message || err).slice(0, 200) });
  } finally {
    connecting = false;
    if (!status.connected) scheduleReconnect();
  }
}

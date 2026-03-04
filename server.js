'use strict';

const express  = require('express');
const Sftp     = require('ssh2-sftp-client');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');

const app = express();
const DIR = __dirname;   // HTML lives alongside this file

// In Electron, use port 0 so the OS picks a free port.
// Standalone: default to 3737 or $PORT env var.
const isElectron = !!process.versions.electron;
const PREFERRED  = isElectron ? 0 : (parseInt(process.env.PORT) || 3737);

let actualPort = PREFERRED;

app.use(express.json({ limit: '50mb' }));

// ── serve the editor HTML with the live port injected ─────
app.get('/', (_req, res) => res.redirect('/md-editor.html'));

app.get('/md-editor.html', (_req, res) => {
  try {
    let html = fs.readFileSync(path.join(DIR, 'md-editor.html'), 'utf8');
    html = html.replace(
      /const SERVER\s*=\s*['"]http:\/\/127\.0\.0\.1:\d+['"]/,
      `const SERVER = 'http://127.0.0.1:${actualPort}'`
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (e) {
    res.status(500).send('Failed to load editor: ' + e.message);
  }
});

// Serve any other static assets from the same directory
app.use(express.static(DIR));

// ── single persistent SFTP connection ─────────────────────
let client   = null;
let connMeta = null;

function keyPaths() {
  return ['id_ed25519', 'id_ecdsa', 'id_rsa', 'id_dsa']
    .map(n => path.join(os.homedir(), '.ssh', n))
    .filter(p => { try { fs.accessSync(p); return true; } catch { return false; } });
}

async function tryConnect(cfg) {
  const c = new Sftp();
  await c.connect(cfg);
  return c;
}

// ── routes ────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  res.json({ connected: client !== null, connMeta });
});

app.post('/api/connect', async (req, res) => {
  const { loginStr, startPath = '~', password, passphrase } = req.body;

  const m = loginStr.trim().match(/^([^@]+)@([^:]+?)(?::(\d+))?$/);
  if (!m) return res.status(400).json({ error: 'Expected  user@host  or  user@host:port' });

  const [, username, host, portStr] = m;
  const port = portStr ? +portStr : 22;
  const base = { host, port, username, readyTimeout: 15000 };

  if (client) { try { await client.end(); } catch {} client = null; }

  let newClient = null;
  let lastErr   = 'No auth method succeeded';

  if (password) {
    try { newClient = await tryConnect({ ...base, password }); }
    catch (e) { lastErr = e.message; }
  } else {
    if (process.env.SSH_AUTH_SOCK) {
      try { newClient = await tryConnect({ ...base, agent: process.env.SSH_AUTH_SOCK }); }
      catch {}
    }
    if (!newClient) {
      for (const kp of keyPaths()) {
        try {
          newClient = await tryConnect({ ...base, privateKey: fs.readFileSync(kp), passphrase: passphrase || undefined });
          break;
        } catch (e) { lastErr = e.message; }
      }
    }
    if (!newClient) return res.status(401).json({ error: lastErr, needsPassword: true });
  }

  if (!newClient) return res.status(401).json({ error: lastErr, needsPassword: true });

  let resolved = startPath;
  try { resolved = await newClient.realPath(!startPath || startPath === '~' ? '.' : startPath); } catch {}

  client   = newClient;
  connMeta = { user: username, host, port };
  res.json({ ok: true, path: resolved, display: `${username}@${host}` });
});

app.post('/api/disconnect', async (_req, res) => {
  if (client) { try { await client.end(); } catch {} client = null; connMeta = null; }
  res.json({ ok: true });
});

app.get('/api/ls', async (req, res) => {
  if (!client) return res.status(400).json({ error: 'Not connected' });
  try {
    const dir  = req.query.path || '.';
    const real = await client.realPath(dir);
    const raw  = await client.list(real);
    const items = raw
      .filter(f => f.name !== '.' && f.name !== '..')
      .map(f => ({ name: f.name, type: f.type === 'd' ? 'dir' : 'file', size: f.size, mtime: f.modifyTime }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    const parent = path.posix.dirname(real);
    res.json({ path: real, parent: real !== parent ? parent : null, items });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/read', async (req, res) => {
  if (!client) return res.status(400).json({ error: 'Not connected' });
  try {
    const buf = await client.get(req.query.path);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(Buffer.isBuffer(buf) ? buf.toString('utf8') : buf);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/write', async (req, res) => {
  if (!client) return res.status(400).json({ error: 'Not connected' });
  try {
    await client.put(Buffer.from(req.body.content, 'utf8'), req.body.path);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/mkdir', async (req, res) => {
  if (!client) return res.status(400).json({ error: 'Not connected' });
  try {
    await client.mkdir(req.body.path, true);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── start ──────────────────────────────────────────────────
const httpServer = app.listen(PREFERRED, '127.0.0.1', () => {
  actualPort = httpServer.address().port;
  if (!isElectron) {
    console.log(`\n  md.edit  →  http://127.0.0.1:${actualPort}/md-editor.html\n`);
    console.log('  Press Ctrl+C to stop.\n');
  }
});

// Export a Promise so Electron's main.js can await the bound port
module.exports = new Promise((resolve, reject) => {
  httpServer.once('listening', () => resolve(httpServer));
  httpServer.once('error', reject);
});

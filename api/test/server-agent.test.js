/* GET /api/config carries two kinds of fact. The flags the login screen and the pre-login boot
   need (invite_only for the invite field, allow_guest for "continue without account") are public
   — there is nobody to authenticate at the point they are read. The Coach block is not: it names
   the provider this instance talks to, which is exactly what GET /api/coach/disclosure refuses to
   answer without a session. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const UID = 'u_cfg_1';

const mint = uid => {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};

async function startServer(t, env = {}, users = [{ id: UID, name: 'C', created: new Date().toISOString() }]) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-config-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users, creds: [], subs: [], invites: []
  }));
  // The fixture provider is "connected" by definition (coach/config.js isConnected), which is all
  // publicConfig() needs to produce a block.
  fs.writeFileSync(path.join(dataDir, 'coach.json'), JSON.stringify({ enabled: true, provider: 'fixture' }));
  // MEDIA_UPLOADS=0: the answers below are compared whole, and they are about the login flags
  // and the Coach block. The public media block has its own tests in server-media.test.js.
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', INVITE_ONLY: '1', ALLOW_GUEST: '0', COACH_DISABLED: '', MEDIA_UPLOADS: '0', ...env }
  });
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const port = await boundPort(child, () => log);
  return { api: `http://127.0.0.1:${port}`, dataDir };
}

test('disabled agent preserves existing Coach surface', async t => {
  const h = await startServer(t, { AGENT_ENABLED: '' });
  const headers = { Cookie: `gymsid=${mint(UID)}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${h.api}/api/coach/agent/messages`, { method: 'POST', headers, body: JSON.stringify({ text: 'hello' }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'off');
  const config = await fetch(`${h.api}/api/config`, { headers }).then(r => r.json());
  assert.equal('agent' in config, false);
  const status = await fetch(`${h.api}/api/coach/status`, { headers });
  assert.equal(status.status, 200);
});

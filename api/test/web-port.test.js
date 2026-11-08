/* The web image runs as uid 101. Docker lets it bind port 80 (ip_unprivileged_port_start=0 in
   the container), so the image's own default stays 80 and compose setups keep working. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the image keeps NGINX_PORT=80 for Docker', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'web/Dockerfile'), 'utf8'), /^ENV NGINX_PORT=80$/m);
});

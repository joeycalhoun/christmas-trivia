#!/usr/bin/env node
// IronQuest local server: serves the built app and persists your save file to ./data.
// Zero dependencies — just Node.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const PORT = Number(argVal('--port') ?? process.env.PORT ?? 3030);
const HOST = argVal('--host') ?? process.env.HOST ?? '0.0.0.0';
const DATA_DIR = path.resolve(argVal('--data') ?? process.env.IRONQUEST_DATA ?? path.join(ROOT, 'data'));
const DIST = path.join(ROOT, 'dist');
const SAVE = path.join(DATA_DIR, 'save.json');
const BACKUPS = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const MAX_BODY = 20 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

fs.mkdirSync(BACKUPS, { recursive: true });

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('Body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Saves are serialized so overlapping requests can't race on the temp file.
let writeChain = Promise.resolve();
function writeSave(text) {
  const run = writeChain.then(() => doWriteSave(text));
  writeChain = run.catch(() => {});
  return run;
}

let tmpSeq = 0;
const identity = (s) => (s && s.profile ? `${s.profile.createdAt}|${s.profile.heroName}` : null);

/**
 * Before a save is replaced by a *different* hero, a wiped save, or one with far less history,
 * keep a permanent copy. A reset (or a stray device) can then always be undone by hand.
 */
async function archiveIfReplacing(incoming) {
  let existingText;
  try {
    existingText = await fsp.readFile(SAVE, 'utf8');
  } catch {
    return;
  }
  let existing;
  try {
    existing = JSON.parse(existingText);
  } catch {
    existing = null;
  }
  if (!existing || !existing.profile) return;
  const shrank = (incoming.foods?.length ?? 0) + 30 < (existing.foods?.length ?? 0);
  if (identity(incoming) !== identity(existing) || shrank) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.writeFile(path.join(BACKUPS, `replaced-${stamp}.json`), existingText);
    console.log(`  Archived previous save to backups/replaced-${stamp}.json`);
  }
}

async function doWriteSave(text) {
  await archiveIfReplacing(JSON.parse(text));
  const tmp = `${SAVE}.${process.pid}.${tmpSeq++}.tmp`;
  await fsp.writeFile(tmp, text);
  await fsp.rename(tmp, SAVE);
  // One rolling backup per day.
  const day = new Date().toISOString().slice(0, 10);
  await fsp.writeFile(path.join(BACKUPS, `save-${day}.json`), text);
  const files = (await fsp.readdir(BACKUPS)).filter((f) => f.startsWith('save-')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) await fsp.unlink(path.join(BACKUPS, f));
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (url.pathname !== '/api/state') return json(res, 404, { error: 'Not found' });
  if (req.method === 'GET') {
    try {
      const text = await fsp.readFile(SAVE, 'utf8');
      return send(res, 200, text, { 'Content-Type': MIME['.json'] });
    } catch {
      return send(res, 204, ''); // reachable, but no save yet
    }
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let text;
    try {
      text = await readBody(req);
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') throw new Error('Invalid save');
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
    await writeSave(text);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) return send(res, 403, 'Forbidden');
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
    const ext = path.extname(file);
    const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  } catch {
    // SPA fallback
    try {
      const html = await fsp.readFile(path.join(DIST, 'index.html'));
      send(res, 200, html, { 'Content-Type': MIME['.html'] });
    } catch {
      send(res, 500, 'App not built yet. Run: npm run build');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ⚔️  IronQuest is running`);
  console.log(`     Local:   http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) console.log(`     Phone:   http://${a.address}:${PORT}  (same Wi-Fi)`);
      }
    }
  }
  console.log(`     Save:    ${SAVE}\n`);
});

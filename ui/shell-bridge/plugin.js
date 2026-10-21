// Local shell bridge, runs inside the Vite dev/preview server (Node).
//
// A browser cannot spawn processes, so the frontend POSTs { action, params } to
// /__shell/run and this middleware runs the command configured for that action
// in shell.config.js, then returns its JSON output.
//
// Safety rules (this is code execution on the developer's machine):
//   * The browser only ever sends an ACTION NAME. Commands live in shell.config.js.
//   * Commands are spawned without a shell and params never reach argv. They are
//     passed as JSON on stdin, so there is nothing to inject into.
//   * Only localhost Host headers and same-origin requests are accepted, and the
//     body must be application/json (blocks DNS rebinding and cross-site POSTs).
//   * Dev/preview servers only. A production build has no bridge.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROUTE = '/__shell/run';
const MAX_BODY = 5 * 1024 * 1024;
const MAX_OUTPUT = 20 * 1024 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
const fail = (res, status, code, message, extra = {}) => send(res, status, { ok: false, error: { code, message, ...extra } });

function hostnameOf(hostHeader = '') {
  const m = String(hostHeader).match(/^(\[[^\]]+\]|[^:]+)(?::\d+)?$/);
  return m ? m[1].toLowerCase() : '';
}

// Re-read shell.config.js on every request so edits apply without restarting Vite.
async function loadConfig(root) {
  const file = path.resolve(root, 'shell.config.js');
  const url = pathToFileURL(file).href + '?v=' + fs.statSync(file).mtimeMs;
  const mod = await import(url);
  return mod.default || {};
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Windows usually has `python` (or the `py` launcher) but not `python3`, and vice versa on
// Linux/macOS. If a python command isn't found, try the other common names before giving up.
function candidatesFor(command) {
  if (command === 'python3') return ['python3', 'python', 'py'];
  if (command === 'python') return ['python', 'python3', 'py'];
  return [command];
}

async function runCommand(opts) {
  const names = candidatesFor(opts.entry.command);
  let last;
  for (const name of names) {
    last = await runOnce(name, opts);
    if (!(last.error && last.error.errno === 'ENOENT')) return last;
  }
  if (names.length > 1) last.error.message = `None of these commands were found: ${names.join(', ')}. Install Python or edit shell.config.js.`;
  return last;
}

function runOnce(command, { entry, cwd, timeoutMs, action, stdin }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(r);
      }
    };
    let child;
    try {
      child = spawn(command, entry.args || [], {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...(entry.env || {}), KPI_SHELL_ACTION: action },
      });
    } catch (e) {
      return finish({ error: { code: 'SPAWN_FAILED', message: e.message } });
    }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT) stdout += d;
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < 64 * 1024) stderr += d;
    });
    child.on('error', (e) => finish({ error: { code: 'SPAWN_FAILED', errno: e.code, message: `${command}: ${e.message}` } }));
    child.on('close', (code) => finish({ code, stdout, stderr }));
    child.stdin.on('error', () => {}); // command exited before reading stdin
    child.stdin.end(stdin);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ error: { code: 'TIMEOUT', message: `Command timed out after ${timeoutMs} ms` } });
    }, timeoutMs);
  });
}

export function createHandler(root) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST');
      if (!LOCAL_HOSTS.has(hostnameOf(req.headers.host))) {
        return fail(res, 403, 'FORBIDDEN_HOST', 'The shell bridge only answers on localhost');
      }
      if (req.headers.origin) {
        let same = false;
        try {
          same = new URL(req.headers.origin).host === req.headers.host;
        } catch {
          /* invalid origin */
        }
        if (!same) return fail(res, 403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are not allowed');
      }
      if (!/^application\/json/i.test(req.headers['content-type'] || '')) {
        return fail(res, 415, 'BAD_REQUEST', 'Content-Type must be application/json');
      }

      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        return fail(res, 400, 'BAD_REQUEST', 'Body is not valid JSON: ' + e.message);
      }
      const { action, params } = body || {};
      if (typeof action !== 'string') return fail(res, 400, 'BAD_REQUEST', '"action" must be a string');

      let cfg;
      try {
        cfg = await loadConfig(root);
      } catch (e) {
        return fail(res, 500, 'CONFIG_ERROR', 'Could not load shell.config.js: ' + e.message);
      }
      const commands = cfg.commands || {};
      const entry = Object.hasOwn(commands, action) ? commands[action] : null;
      if (!entry || !entry.command) return fail(res, 404, 'NOT_CONFIGURED', `No command configured for "${action}" in shell.config.js`);

      const cwd = path.resolve(root, entry.cwd || cfg.cwd || '.');
      const timeoutMs = entry.timeoutMs || cfg.timeoutMs || 60_000;
      const r = await runCommand({ entry, cwd, timeoutMs, action, stdin: JSON.stringify(params ?? {}) });

      if (r.error) return fail(res, 500, r.error.code, r.error.message);
      if (r.code !== 0) {
        return fail(res, 500, 'COMMAND_FAILED', (r.stderr || '').trim().slice(-4000) || `Command exited with code ${r.code}`, { exitCode: r.code });
      }
      const text = r.stdout.trim();
      if (!text) return send(res, 200, { ok: true, data: null });
      try {
        return send(res, 200, { ok: true, data: JSON.parse(text) });
      } catch {
        return fail(res, 500, 'BAD_OUTPUT', 'Command stdout was not valid JSON: ' + text.slice(0, 300));
      }
    } catch (e) {
      return fail(res, 500, 'BRIDGE_ERROR', e.message);
    }
  };
}

export default function shellBridge() {
  let root = process.cwd();
  return {
    name: 'kpi-shell-bridge',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(ROUTE, createHandler(root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(ROUTE, createHandler(root));
    },
  };
}

// Local/offline Lesson 6 prototype launcher (LOCAL ONLY, never production).
//
// `npm run dev:prototype` starts the real QubWatch stack with the controlled
// demo-session mechanism enabled, then opens the actual React application in
// the browser — Dashboard first, no Login page.
//
// How it works:
// - Backend child gets QUBWATCH_DEMO_LOGIN=1, which activates the existing
//   POST /api/auth/demo endpoint (404 without the flag).
// - Frontend child gets VITE_QUBWATCH_DEMO=1, which lets the existing App.jsx
//   boot fallback establish a demo session via that endpoint.
// - No secrets, no committed flags, no .env.local required. Normal
//   `npm run dev` / `npm run dev:api` behaviour is completely unchanged.
//
// Everything runs on localhost (Vite + Express + SQLite seeds); no internet
// or external service is required.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const API_PORT = 3001
const APP_PORT = 5173
const STARTUP_TIMEOUT_MS = 45000
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function log(tag, message) {
  process.stdout.write(`[prototype:${tag}] ${message}\n`)
}

function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(true))
  })
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Backend not up yet; keep waiting.
    }
    if (Date.now() > deadline) {
      throw new Error(`backend did not become ready at ${url}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

const children = new Set()
function stopAll(signal = 'SIGINT') {
  for (const child of children) {
    try {
      child.kill(signal)
    } catch {
      // Already exited; nothing to do.
    }
  }
}

process.on('SIGINT', () => {
  log('launcher', 'stopping (SIGINT)')
  stopAll('SIGINT')
  setTimeout(() => process.exit(0), 1500).unref()
})
process.on('SIGTERM', () => {
  stopAll('SIGTERM')
  setTimeout(() => process.exit(0), 1500).unref()
})

function startChild(tag, command, args, env, useShell) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell,
    })
    children.add(child)
    child.stdout.on('data', (d) => log(tag, String(d).trimEnd()))
    child.stderr.on('data', (d) => log(tag, String(d).trimEnd()))
    child.once('error', (err) => {
      children.delete(child)
      reject(new Error(`failed to start ${tag}: ${err.message}`))
    })
    child.once('spawn', () => resolve(child))
    child.once('exit', (code) => {
      children.delete(child)
      log(tag, `exited (code ${code}); stopping prototype`)
      stopAll('SIGINT')
      setTimeout(() => process.exit(code ?? 1), 500).unref()
    })
  })
}

try {
  for (const port of [API_PORT, APP_PORT]) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await portFree(port))) {
      throw new Error(
        `port ${port} is already in use — stop the other process first (ports are never switched silently)`,
      )
    }
  }

  log('launcher', `starting backend on http://localhost:${API_PORT} (demo sessions enabled locally)`)
  await startChild('api', process.execPath, ['server/index.js'], {
    PORT: String(API_PORT),
    QUBWATCH_DEMO_LOGIN: '1',
  }, false)
  await waitForHealth(`http://127.0.0.1:${API_PORT}/api/health`, STARTUP_TIMEOUT_MS)
  log('launcher', 'backend ready')

  const hasLocalCert =
    fs.existsSync(path.join(ROOT, 'localhost.pem')) &&
    fs.existsSync(path.join(ROOT, 'localhost-key.pem'))
  const scheme = hasLocalCert ? 'https' : 'http'
  log('launcher', `starting frontend (demo auto-login enabled locally)`)
  // npm is a batch shim (npm.cmd) on Windows and requires a shell to spawn.
  await startChild('app', NPM, ['run', 'dev', '--', '--open', '--port', String(APP_PORT), '--strictPort'], {
    VITE_QUBWATCH_DEMO: '1',
  }, process.platform === 'win32')
  log('launcher', `opening ${scheme}://localhost:${APP_PORT}/ — Dashboard first, no Login page`)
} catch (err) {
  log('launcher', `ERROR: ${err.message}`)
  stopAll('SIGINT')
  process.exitCode = 1
}

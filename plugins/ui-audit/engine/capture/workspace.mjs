import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { createServer } from 'node:net'

const nodeBin = dirname(process.execPath)
const env = (extra = {}) => ({ ...process.env, PATH: `${nodeBin}:${process.env.PATH}`, ...extra })
const git = (repoDir, args) => execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', env: env() }).trim()

export function prepareWorkspace({ repoDir, ref, log = console.log }) {
    git(repoDir, ['fetch', 'origin'])
    const parent = mkdtempSync(join(tmpdir(), 'ui-audit-ws-'))
    const dir = join(parent, 'portal')
    const cleanup = () => {
        try {
            git(repoDir, ['worktree', 'remove', '--force', dir])
        } catch {
            rmSync(dir, { recursive: true, force: true })
            git(repoDir, ['worktree', 'prune'])
        }
        rmSync(parent, { recursive: true, force: true })
    }
    try {
        git(repoDir, ['worktree', 'add', '--detach', dir, ref])
    } catch (e) {
        rmSync(parent, { recursive: true, force: true })
        throw e
    }
    // The caller only gets cleanup() on success, so a failure after the worktree exists removes it here.
    // Dependencies are installed by the target's offline.start, since each app has its own package manager.
    try {
        const sha = git(dir, ['rev-parse', '--short=7', 'HEAD'])
        log(`worktree ${dir} @ ${sha}`)
        return { dir, sha, cleanup }
    } catch (e) {
        cleanup()
        throw e
    }
}

async function waitForHttp(url, { ms = 60000, cancelled = () => false } = {}) {
    const end = Date.now() + ms
    while (Date.now() < end && !cancelled()) {
        try {
            const res = await fetch(url)
            if (res.status < 500) return
        } catch {}
        await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`timeout waiting for ${url}`)
}

// A leftover server from an earlier capture would answer waitForHttp and serve an old worktree's UI.
function assertPortFree(port) {
    return new Promise((resolve, reject) => {
        const srv = createServer()
        srv.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} already in use`) : e))
        srv.listen(port, () => srv.close(() => resolve()))
    })
}

// onSpawn(stop) is called before anything is spawned, so a caller interrupted while the servers are still
// starting (e.g. by a signal) can stop them; after stop() no further process is spawned.
export async function startServers({ dir, procs: specs, ports = [], readyUrls = [], log = console.log, onSpawn }) {
    const procs = []
    let ready = false
    let stopped = false
    let onDied
    const died = new Promise((_, reject) => (onDied = reject))
    died.catch(() => {})
    const stop = () => {
        stopped = true
        if (!ready) onDied(new Error('servers stopped before they were ready'))
        for (const p of procs) {
            try {
                process.kill(-p.pid, 'SIGTERM')
            } catch {}
        }
    }
    onSpawn?.(stop)
    const run = ({ cmd, args = [], env: extraEnv = {} }) => {
        if (stopped) throw new Error('servers stopped before they were ready')
        // For a node script the script is the useful name; otherwise the binary is, not its first flag.
        const name = cmd === process.execPath && args[0] ? args[0] : basename(cmd)
        const p = spawn(cmd, args, { cwd: dir, env: env(extraEnv), stdio: ['ignore', 'pipe', 'pipe'], detached: true })
        p.stderr.on('data', (d) => log(`[${name}] ${String(d).trim()}`))
        p.on('error', (e) => onDied(new Error(`${name} failed to start: ${e.message}`)))
        p.on('exit', (code, signal) => !ready && onDied(new Error(`${name} exited before it was ready (${signal ?? `code ${code}`})`)))
        procs.push(p)
    }
    try {
        for (const port of ports) await assertPortFree(port)
        for (const spec of specs) run(spec)
        await Promise.race([
            died,
            (async () => {
                for (const u of readyUrls) await waitForHttp(u, { cancelled: () => stopped })
            })(),
        ])
        if (stopped) throw new Error('servers stopped before they were ready')
        ready = true
    } catch (e) {
        stop()
        throw e
    }
    return { stop }
}

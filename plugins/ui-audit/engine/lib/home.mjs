import { readFileSync, existsSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const engineDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readConfig(path) {
    if (!existsSync(path)) return {}
    try {
        return JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
        throw new Error(`cannot parse ${path}: ${e.message}`)
    }
}

export function loadHome({ env = process.env } = {}) {
    const home = resolve(env.UI_AUDIT_HOME ?? join(engineDir, '..'))
    const configPath = join(home, 'ui-audit.config.json')
    const config = readConfig(configPath)
    const tokenFile = env.UI_AUDIT_TOKEN_FILE ?? join(homedir(), '.config/ui-audit/token')
    const token = (env.UI_AUDIT_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8') : '')).trim()
    const port = Number(env.UI_AUDIT_PORT ?? config.port ?? 8090)
    const strip = (u) => u.replace(/\/+$/, '')
    return {
        home,
        engineDir,
        configPath,
        config,
        token,
        port,
        url: strip(env.UI_AUDIT_URL ?? `http://localhost:${port}`),
        publicUrl: strip(env.UI_AUDIT_PUBLIC_URL ?? config.publicUrl ?? `http://${hostname()}:${port}`),
        dataDir: env.UI_AUDIT_DATA ?? join(home, 'data'),
        targetsDir: join(home, 'targets'),
        credsDir: env.UI_AUDIT_CREDS_DIR ?? join(homedir(), '.config/ui-audit/creds'),
        lockPath: join(homedir(), '.config/ui-audit/capture.lock'),
        repoFor: (target) => config.repos?.[target.name] ?? target.repo ?? null,
    }
}

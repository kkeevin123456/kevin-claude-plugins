import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, chmodSync, rmSync, realpathSync, renameSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'

const ENGINE_MARKER = '.ui-audit-engine'
const DEFAULT_TOKEN_FILE = () => join(homedir(), '.config/ui-audit/token')
const SKIP = new Set(['node_modules', 'data', '.git'])
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {})

export function installEngine({ engineSrc, home, preset = null, config = null, tokenFile, skipDeps = false, run = (cmd, args, opts) => execFileSync(cmd, args, opts), log = () => {} }) {
    home = resolve(home)
    if (home === '/' || home === resolve(homedir())) throw new Error(`refusing to install into ${home}: pass a dedicated --home directory`)
    const dest = join(home, 'engine')
    if (existsSync(dest)) {
        // realpath so a symlinked path to the installed engine is caught too.
        if (realpathSync(engineSrc) === realpathSync(dest)) throw new Error('run install from the plugin copy, not from the installed engine')
        if (!existsSync(join(dest, ENGINE_MARKER))) throw new Error(`${dest} exists but is not a UI Audit engine; refusing to replace it`)
    } else if (resolve(engineSrc) === dest) throw new Error('run install from the plugin copy, not from the installed engine')
    // With skipDeps nothing reinstalls the dependencies, so the installed ones are moved aside and put back after the copy.
    // A set left aside by an interrupted run is picked up again.
    const depsDir = join(dest, 'node_modules')
    const depsAside = join(home, '.engine-node_modules')
    if (skipDeps && existsSync(depsDir)) {
        rmSync(depsAside, { recursive: true, force: true })
        renameSync(depsDir, depsAside)
    }
    const restoreDeps = skipDeps && existsSync(depsAside)
    // Only the engine is replaced; data, targets, config and the token belong to the user.
    rmSync(dest, { recursive: true, force: true })
    cpSync(engineSrc, dest, { recursive: true, filter: (src) => !SKIP.has(basename(src)) })
    if (restoreDeps) renameSync(depsAside, depsDir)
    else rmSync(depsAside, { recursive: true, force: true })
    // Written right after the copy so a failed dependency step still leaves a replaceable engine.
    writeFileSync(join(dest, ENGINE_MARKER), '')
    for (const d of ['data', 'targets']) mkdirSync(join(home, d), { recursive: true })
    const added = []
    let settings = readJson(join(home, 'ui-audit.config.json'))
    if (preset) {
        const pt = join(preset, 'targets')
        if (existsSync(pt)) {
            for (const f of readdirSync(pt)) {
                const to = join(home, 'targets', f)
                if (existsSync(to)) continue
                cpSync(join(pt, f), to)
                added.push(`targets/${f}`)
            }
        }
        settings = { ...readJson(join(preset, 'config.json')), ...settings }
    }
    if (config) settings = { ...settings, ...config }
    const configPath = join(home, 'ui-audit.config.json')
    writeFileSync(configPath, JSON.stringify(settings, null, 2) + '\n')
    let tokenCreated = false
    if (!existsSync(tokenFile)) {
        mkdirSync(dirname(tokenFile), { recursive: true })
        writeFileSync(tokenFile, randomBytes(24).toString('hex') + '\n', { mode: 0o600 })
        tokenCreated = true
    }
    chmodSync(tokenFile, 0o600)
    if (!skipDeps) {
        log('installing dependencies…')
        run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: dest, stdio: 'inherit' })
        run('npx', ['playwright', 'install', 'chromium'], { cwd: dest, stdio: 'inherit' })
    }
    return { home, dest, configPath, added, tokenCreated }
}

export function writeService({ home, port, nodePath = process.execPath, unitDir = join(homedir(), '.config/systemd/user'), template, tokenFile = null }) {
    let unit = readFileSync(template, 'utf8').replaceAll('{{NODE}}', nodePath).replaceAll('{{HOME_DIR}}', home).replaceAll('{{PORT}}', String(port))
    // The service reads the default token path on its own; a custom one has to be handed over.
    if (tokenFile && resolve(tokenFile) !== resolve(DEFAULT_TOKEN_FILE())) unit = unit.replace(/^Environment=UI_AUDIT_PORT=.*$/m, (m) => `${m}\nEnvironment=UI_AUDIT_TOKEN_FILE=${tokenFile}`)
    mkdirSync(unitDir, { recursive: true })
    const path = join(unitDir, 'ui-audit.service')
    writeFileSync(path, unit)
    return path
}

export const cronLine = ({ home, nodePath = process.execPath }) =>
    `30 3 * * * UI_AUDIT_DATA=${home}/data UI_AUDIT_NODE=${nodePath} ${home}/engine/templates/backup.sh >> ${home}/data/backup.log 2>&1`

// Drops the backup line a previous install wrote (current form, or the older one that named ui-audit), keeps everything else.
export function rewriteCrontab(text, line) {
    const kept = text.split('\n').filter((l) => !l.includes('/engine/templates/backup.sh') && !(l.includes('ui-audit') && l.includes('backup.sh')))
    while (kept.length && kept[kept.length - 1] === '') kept.pop()
    return [...kept, line].join('\n') + '\n'
}

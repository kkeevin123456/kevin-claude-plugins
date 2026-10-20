import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/
const SELECTORS = ['scrollHost', 'tab', 'seg', 'segGroup', 'interactive', 'dialogButton']
const isFn = (v) => typeof v === 'function'

export function validateTarget(t) {
    const errors = []
    if (!t || typeof t !== 'object') return ['target must export an object']
    if (typeof t.name !== 'string' || !NAME.test(t.name)) errors.push('name: lowercase letters, digits and "-" only')
    if (!Array.isArray(t.routes) || !t.routes.length || !t.routes.every((r) => typeof r === 'string')) errors.push('routes: non-empty array of strings')
    for (const s of SELECTORS) if (typeof t.selectors?.[s] !== 'string' || !t.selectors[s]) errors.push(`selectors.${s}: required string`)
    if (!isFn(t.prepare)) errors.push('prepare: required function (page, ctx)')
    if (t.mode === 'offline') {
        if (!isFn(t.offline?.start)) errors.push('offline.start: required function (dir, { log, onSpawn, startServers })')
    } else if (t.mode === 'live') {
        const l = t.live ?? {}
        if (typeof l.baseUrl !== 'string' || !/^https?:\/\//.test(l.baseUrl)) errors.push('live.baseUrl: http(s) URL')
        if (!isFn(l.login)) errors.push('live.login: required function (page, creds)')
        if (!(l.submitText instanceof RegExp)) errors.push('live.submitText: RegExp of button texts that submit')
        if (!Array.isArray(l.allowWrite)) errors.push('live.allowWrite: array of paths allowed to receive writes during capture (normally empty)')
        if (!Array.isArray(l.neverClick)) errors.push('live.neverClick: array of state-key segments never to click')
    } else errors.push('mode: "offline" or "live"')
    for (const f of ['skipText', 'followupText']) if (t[f] !== undefined && !(t[f] instanceof RegExp)) errors.push(`${f}: must be a RegExp`)
    if (t.modes !== undefined && (!Array.isArray(t.modes) || !t.modes.length || !t.modes.every((m) => typeof m?.name === 'string'))) errors.push('modes: non-empty array of { name }')
    return errors
}

// allowWrite matches by path only, so a wildcard or a shared .cgi dispatcher would let every write through.
export function targetWarnings(t) {
    const warnings = []
    const allow = t?.mode === 'live' && Array.isArray(t.live?.allowWrite) ? t.live.allowWrite : []
    for (const p of allow) {
        if (typeof p !== 'string') continue
        if (p.includes('*')) warnings.push(`live.allowWrite "${p}": a wildcard opens every write under it; list exact paths, normally none`)
        else if (/\.cgi$/i.test(p)) warnings.push(`live.allowWrite "${p}": a .cgi path is shared by many APIs, so this allows every write through it`)
    }
    return warnings
}

const DEFAULTS = {
    viewport: { width: 1440, height: 900 },
    modes: [{ name: 'edit', depth: 'full' }],
    loggedOut: [],
    skipText: /log ?out|sign ?out|登出/i,
    followupText: /^(OK|Apply|Save|Next|Confirm|確定|套用|儲存|下一步)$/i,
    ignoreConsole: [],
}

function candidates(home, name) {
    const out = [join(home.targetsDir, `${name}.mjs`)]
    const presets = resolve(home.engineDir, '..', 'presets')
    if (existsSync(presets)) for (const p of readdirSync(presets)) out.push(join(presets, p, 'targets', `${name}.mjs`))
    return out
}

export async function loadTarget(home, name) {
    // The name becomes part of a file path, so anything but a slug could reach outside the target folders.
    if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`target name "${name}": lowercase letters, digits and "-" only`)
    const paths = candidates(home, name)
    const found = paths.find((p) => existsSync(p))
    if (!found) throw new Error(`target "${name}" not found; looked in:\n  ${paths.join('\n  ')}`)
    const t = { ...DEFAULTS, ...(await import(pathToFileURL(found).href)).default }
    const errors = validateTarget(t)
    if (errors.length) throw new Error(`target ${found} is invalid:\n  ${errors.join('\n  ')}`)
    return t
}

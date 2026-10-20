import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function readCreds(credsDir, name) {
    const path = join(credsDir, `${name}.json`)
    if (!existsSync(path)) throw new Error(`live target "${name}" needs credentials: create ${path} (chmod 600) with the fields its login() reads`)
    if (statSync(path).mode & 0o077) throw new Error(`${path} is readable by other users: run chmod 600 ${path}`)
    return JSON.parse(readFileSync(path, 'utf8'))
}

export async function liveLogin(browser, target, creds) {
    const ctx = await browser.newContext({ viewport: target.viewport })
    try {
        const page = await ctx.newPage()
        await target.live.login(page, creds)
        return await ctx.storageState()
    } finally {
        await ctx.close()
    }
}

// A write passes only when it goes to the device itself and to a declared path.
export function isAllowedWrite(target, method, url) {
    if (READS.has(method)) return true
    const u = new URL(url)
    if (u.origin !== new URL(target.live.baseUrl).origin) return false
    return target.live.allowWrite.some((p) => (p.endsWith('*') ? u.pathname.startsWith(p.slice(0, -1)) : u.pathname === p))
}

// Duplicate segments carry a ~N suffix, so neverClick entries are compared without it.
export function isSubmit(target, seg, text) {
    return target.live.submitText.test(text) || target.live.neverClick.includes(seg.replace(/~\d+$/, ''))
}

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function tokenize(template) {
    const out = []
    let cur = ''
    let quote = null
    let started = false
    for (const ch of template) {
        if (quote) {
            if (ch === quote) quote = null
            else cur += ch
            continue
        }
        if (ch === '"' || ch === "'") {
            quote = ch
            started = true
            continue
        }
        if (/\s/.test(ch)) {
            if (started || cur) out.push(cur)
            cur = ''
            started = false
            continue
        }
        cur += ch
    }
    if (quote) throw new Error('unclosed quote in tracker command')
    if (started || cur) out.push(cur)
    return out
}

const fill = (s, vars, encode) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (encode ? encodeURIComponent(String(vars[k])) : String(vars[k])) : m))

// Tokens are split before substitution, so note text can never become extra arguments or shell syntax.
export function renderCommand(template, vars) {
    const [cmd, ...args] = tokenize(template).map((t) => fill(t, vars, false))
    return { cmd, args }
}

export const renderUrl = (template, vars) => fill(template, vars, true)

export function extractKey(output, pattern, keyTemplate) {
    const m = String(output).match(new RegExp(pattern))
    if (!m) return null
    const match = m[1] ?? m[0]
    return keyTemplate ? keyTemplate.replaceAll('{match}', match) : match
}

const issueUrlFor = (tracker, key) => (tracker.issueUrl ? renderUrl(tracker.issueUrl, { key, n: key.match(/\d+/)?.[0] ?? key }) : null)

export function issueVars(comment, url) {
    const first = comment.text.split('\n')[0].slice(0, 60)
    return { title: `[UI Audit] ${comment.label}: ${first}`, body: `${comment.text}\n\n畫面：${comment.stateKey}\n${url}`, url, screen: comment.stateKey }
}

export async function createIssue(tracker, vars, { exec = execFileAsync, cwd } = {}) {
    if (!tracker || tracker.type === 'none') throw new Error('no bug tracker configured (set "tracker" in ui-audit.config.json)')
    if (tracker.type === 'url') return { openUrl: renderUrl(tracker.newUrl, vars) }
    if (tracker.type !== 'command') throw new Error(`unknown tracker.type "${tracker.type}"`)
    const { cmd, args } = renderCommand(tracker.command, vars)
    const { stdout } = await exec(cmd, args, { cwd, maxBuffer: 1024 * 1024 })
    const key = extractKey(stdout, tracker.keyPattern ?? '(\\S+)', tracker.keyTemplate)
    if (!key) throw new Error(`no issue key matched /${tracker.keyPattern}/ in the command output:\n${stdout}`)
    return { key, url: issueUrlFor(tracker, key) }
}

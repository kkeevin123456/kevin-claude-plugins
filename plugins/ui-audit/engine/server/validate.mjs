// server/validate.mjs
const EPS = 1e-6
const MAX_TEXT = 2000
const MIN_SIDE = 0.005

export function validateText(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'text_required' }
    const t = text.trim()
    if ([...t].length > MAX_TEXT) return { ok: false, error: 'text_too_long' }
    return { ok: true, value: t }
}

function validRect(r) {
    if (!r || typeof r !== 'object') return false
    const { x, y, w, h } = r
    if (![x, y, w, h].every((v) => typeof v === 'number' && Number.isFinite(v))) return false
    if (x < 0 || y < 0 || w < MIN_SIDE || h < MIN_SIDE) return false
    return x + w <= 1 + EPS && y + h <= 1 + EPS
}

export function validateNewComment(body) {
    const { runId, stateKey, fileIdx = 0, rect, text } = body ?? {}
    if (!Number.isInteger(runId) || typeof stateKey !== 'string' || !Number.isInteger(fileIdx) || fileIdx < 0) return { ok: false, error: 'bad_request' }
    const t = validateText(text)
    if (!t.ok) return t
    if (!validRect(rect)) return { ok: false, error: 'bad_rect' }
    return { ok: true, value: { runId, stateKey, fileIdx, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, text: t.value } }
}

export function validateResolve(body) {
    const { status, commit, issueKey, note, fixedRunId } = body ?? {}
    if (status === 'fixed') {
        if (typeof commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(commit)) return { ok: false, error: 'commit_required' }
        if (!Number.isInteger(fixedRunId)) return { ok: false, error: 'fixed_run_required' }
        return { ok: true, value: { status, commit, fixedRunId, note: typeof note === 'string' ? note : null } }
    }
    if (status === 'issue') {
        if (typeof issueKey !== 'string' || !/^\S{1,64}$/.test(issueKey)) return { ok: false, error: 'bad_issue_key' }
        return { ok: true, value: { status, issueKey, note: typeof note === 'string' ? note : null } }
    }
    if (status === 'wontfix') {
        if (typeof note !== 'string' || !note.trim()) return { ok: false, error: 'note_required' }
        return { ok: true, value: { status, note: note.trim() } }
    }
    if (status === 'open') return { ok: true, value: { status } }
    return { ok: false, error: 'bad_status' }
}

export const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/
// Web routes whose first hash segment is not a project; a project with such a slug would read as a v1 link.
export const RESERVED_SLUGS = ['shot', 'comments']

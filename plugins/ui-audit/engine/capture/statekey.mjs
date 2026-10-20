const MAX = 40

export function cleanName(raw) {
    let s = String(raw ?? '').replace(/\s+/g, ' ').trim()
    // SVC renders some labels twice (visible + measuring copy); collapse an exact doubled string.
    // A half made of one repeated character (e.g. "xxxx…") is not treated as a doubled label, so a
    // long run of one character is left for the length cap instead of being shortened here.
    const compact = s.replace(/\s+/g, '')
    if (compact.length % 2 === 0 && compact.length > 0) {
        const half = compact.slice(0, compact.length / 2)
        if (!/^(.)\1*$/u.test(half) && half === compact.slice(compact.length / 2)) {
            let count = 0
            const cut = [...s].findIndex((ch) => !/\s/.test(ch) && ++count > half.length)
            s = s.slice(0, cut).trim()
        }
    }
    s = s.replace(/[:：]\s*$/, '').replaceAll('/', '∕').replaceAll('>', '›')
    return [...s].slice(0, MAX).join('')
}

export function targetSegment({ kind, text = '', ariaLabel = '', title = '', formLabel = '', index }) {
    for (const candidate of [text, ariaLabel, title, formLabel]) {
        const name = cleanName(candidate)
        if (name) return { seg: `${kind}:${name}`, unstable: false }
    }
    return { seg: `${kind}#${index}`, unstable: true }
}

export function dedupeSegments(segs) {
    const seen = new Map()
    return segs.map((s) => {
        const n = (seen.get(s) ?? 0) + 1
        seen.set(s, n)
        return n === 1 ? s : `${s}~${n}`
    })
}

export function buildKey({ mode, page, path = [], target, followup }) {
    let key = [mode, page, ...path, ...(target ? [target] : [])].join('/')
    if (followup) key += `>${followup}`
    return key
}

const stripPrefix = (seg) => seg.replace(/^[a-z]+[:#]/, (m) => (m.endsWith('#') ? '#' : ''))

export function labelOf(key) {
    const [main, ...follow] = key.split('>')
    const [, ...rest] = main.split('/')
    return [rest.map(stripPrefix).join(' › '), ...follow.map(stripPrefix)].join(' → ')
}

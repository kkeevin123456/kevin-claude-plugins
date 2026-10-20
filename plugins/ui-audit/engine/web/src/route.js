import { ref } from 'vue'

function parse() {
    const [raw, search = ''] = (location.hash.slice(1) || '/').split('?')
    const segs = raw.split('/').filter(Boolean)
    return { project: segs[0] ?? null, path: '/' + segs.slice(1).join('/'), query: Object.fromEntries(new URLSearchParams(search)), raw, search }
}
export const route = ref(parse())
addEventListener('hashchange', () => (route.value = parse()))

const qs = (query) => new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString()

export function href(path, query = {}, project = route.value.project) {
    const s = qs(query)
    return `#/${project}${path === '/' ? '' : path}${s ? `?${s}` : ''}`
}

export function go(path, query = {}, project) {
    location.hash = href(path, query, project).slice(1)
}

// v1 links (#/shot?..., #/comments?...) carry no project; they belong to the first project.
export function redirectLegacy(slugs) {
    const r = route.value
    if (!slugs.length || slugs.includes(r.project)) return false
    const path = r.raw === '/' ? '' : r.raw
    location.replace(`#/${slugs[0]}${path}${r.search ? `?${r.search}` : ''}`)
    return true
}

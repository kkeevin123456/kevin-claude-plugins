import { route } from './route.js'

async function handle(res) {
    if (res.status === 204) return null
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const err = new Error(body.error ?? res.statusText)
        err.status = res.status
        err.body = body
        throw err
    }
    return body
}
const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()
const P = () => `api/projects/${encodeURIComponent(route.value.project)}`

export const api = {
    projects: () => fetch('api/projects').then(handle),
    config: () => fetch('api/config').then(handle),
    runs: () => fetch(`${P()}/runs`).then(handle),
    shots: (runId) => fetch(`${P()}/runs/${runId}/shots`).then(handle),
    fileUrl: (runId, name) => `${P()}/runs/${runId}/files/${encodeURIComponent(name)}`,
    comments: (params = {}) => fetch(`${P()}/comments?${qs(params)}`).then(handle),
    createComment: (body) => fetch(`${P()}/comments`, json('POST', body)).then(handle),
    updateComment: (id, text) => fetch(`${P()}/comments/${id}`, json('PATCH', { text })).then(handle),
    deleteComment: (id) => fetch(`${P()}/comments/${id}`, { method: 'DELETE' }).then(handle),
}

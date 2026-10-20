export function createClient({ url, token }) {
    const call = async (method, path, body, { auth = false } = {}) => {
        const headers = {}
        if (auth) headers['x-ui-audit-token'] = token
        let payload
        if (body instanceof FormData) payload = body
        else if (body !== undefined) {
            headers['content-type'] = 'application/json'
            payload = JSON.stringify(body)
        }
        const res = await fetch(`${url}${path}`, { method, headers, body: payload })
        const text = await res.text()
        const data = text ? JSON.parse(text) : null
        if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data?.error ?? text}`)
        return data
    }
    const P = (p) => `/api/projects/${encodeURIComponent(p)}`
    return {
        listProjects: () => call('GET', '/api/projects'),
        ensureProject: (body) => call('POST', '/api/projects', body, { auth: true }),
        config: () => call('GET', '/api/config'),
        createRun: (p, body) => call('POST', `${P(p)}/runs`, body, { auth: true }),
        uploadShot(p, runId, meta, buffers) {
            const fd = new FormData()
            fd.append('meta', JSON.stringify(meta))
            buffers.forEach((b, i) => fd.append('file', new Blob([b], { type: 'image/png' }), `${i}.png`))
            return call('POST', `${P(p)}/runs/${runId}/shots`, fd, { auth: true })
        },
        finishRun: (p, runId, body) => call('POST', `${P(p)}/runs/${runId}/finish`, body, { auth: true }),
        listRuns: (p) => call('GET', `${P(p)}/runs`),
        shots: (p, runId) => call('GET', `${P(p)}/runs/${runId}/shots`),
        comments: (p, status) => call('GET', `${P(p)}/comments${status ? `?status=${encodeURIComponent(status)}` : ''}`),
        getComment: async (p, id) => (await call('GET', `${P(p)}/comments`)).find((c) => c.id === id) ?? null,
        resolve: (p, id, body) => call('POST', `${P(p)}/comments/${id}/resolve`, body, { auth: true }),
        async download(p, runId, name) {
            const res = await fetch(`${url}${P(p)}/runs/${runId}/files/${name}`)
            if (!res.ok) throw new Error(`download ${name} → ${res.status}`)
            return Buffer.from(await res.arrayBuffer())
        },
    }
}

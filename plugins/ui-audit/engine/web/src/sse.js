import { route } from './route.js'

// Listeners registered with { all: true } also receive other projects' events (project counts, new projects).
const listeners = new Map()
let source = null
let hadError = false

function connect() {
    source = new EventSource('api/events')
    for (const type of ['comment.created', 'comment.updated', 'comment.deleted', 'comment.resolved', 'run.done']) {
        source.addEventListener(type, (e) => {
            const data = JSON.parse(e.data)
            const foreign = data.project && data.project !== route.value.project
            listeners.forEach((all, fn) => {
                if (all || !foreign) fn({ type, data })
            })
        })
    }
    source.onopen = () => {
        if (hadError) listeners.forEach((_all, fn) => fn({ type: 'reconnected' }))
        hadError = false
    }
    source.onerror = () => {
        hadError = true
    }
}

export function onServerEvent(fn, { all = false } = {}) {
    if (!source) connect()
    listeners.set(fn, all)
    return () => listeners.delete(fn)
}

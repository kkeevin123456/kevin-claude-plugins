// server/routes/events.mjs
const HEARTBEAT_MS = 25000

export default async function eventsRoutes(app) {
    app.get('/api/events', (req, reply) => {
        reply.hijack()
        const res = reply.raw
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' })
        res.write(': connected\n\n')
        const unsubscribe = app.bus.subscribe(({ type, data }) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
        const timer = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
        req.raw.on('close', () => {
            clearInterval(timer)
            unsubscribe()
        })
    })
}

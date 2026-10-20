import { validateNewComment, validateText, validateResolve } from '../validate.mjs'

export default async function commentsRoutes(app, { requireCli }) {
    const { repo, bus } = app
    const commentOf = (req) => {
        const c = repo.getComment(Number(req.params.id))
        return c && c.projectId === req.project.id ? c : null
    }
    const publish = (req, type, data) => bus.publish(type, { ...data, project: req.project.slug })

    app.get('/comments', async (req) => repo.listComments({ projectId: req.project.id, status: req.query.status ?? null, stateKey: req.query.state_key ?? null }))

    app.post('/comments', async (req, reply) => {
        const v = validateNewComment(req.body)
        if (!v.ok) return reply.code(400).send({ error: v.error })
        const latest = repo.latestDoneRun(req.project.id)
        if (!latest || latest.id !== v.value.runId) return reply.code(409).send({ error: 'stale_run', latestRunId: latest?.id ?? null })
        if (!repo.hasShot(latest.id, v.value.stateKey)) return reply.code(400).send({ error: 'state_not_in_run' })
        const c = repo.createComment(v.value)
        publish(req, 'comment.created', c)
        return reply.code(201).send(c)
    })

    app.patch('/comments/:id', async (req, reply) => {
        const body = req.body ?? {}
        if (Object.keys(body).some((k) => k !== 'text')) return reply.code(400).send({ error: 'only_text_editable' })
        const v = validateText(body.text)
        if (!v.ok) return reply.code(400).send({ error: v.error })
        const existing = commentOf(req)
        if (!existing) return reply.code(404).send({ error: 'comment_not_found' })
        if (existing.status !== 'open') return reply.code(409).send({ error: 'not_open' })
        const c = repo.updateCommentText(existing.id, v.value)
        publish(req, 'comment.updated', c)
        return c
    })

    app.delete('/comments/:id', async (req, reply) => {
        const c = commentOf(req)
        if (!c) return reply.code(404).send({ error: 'comment_not_found' })
        if (c.status !== 'open') return reply.code(409).send({ error: 'not_open' })
        if (!repo.deleteComment(c.id)) return reply.code(404).send({ error: 'comment_not_found' })
        publish(req, 'comment.deleted', { id: c.id, stateKey: c.stateKey })
        return reply.code(204).send()
    })

    app.post('/comments/:id/resolve', { preHandler: requireCli }, async (req, reply) => {
        const c = commentOf(req)
        if (!c) return reply.code(404).send({ error: 'comment_not_found' })
        const v = validateResolve(req.body)
        if (!v.ok) return reply.code(400).send({ error: v.error })
        if (v.value.status === 'fixed') {
            const run = repo.getRun(v.value.fixedRunId)
            if (!run || run.status !== 'done' || run.projectId !== req.project.id) return reply.code(400).send({ error: 'fixed_run_not_done' })
            if (!repo.hasShot(run.id, c.stateKey)) return reply.code(400).send({ error: 'state_not_in_fixed_run' })
        }
        const updated = repo.resolveComment(c.id, v.value)
        publish(req, 'comment.resolved', updated)
        return updated
    })
}

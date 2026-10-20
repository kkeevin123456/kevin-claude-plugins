import { SLUG, RESERVED_SLUGS } from '../validate.mjs'

export default async function projectsRoutes(app, { requireCli, config }) {
    const { repo } = app

    app.get('/api/projects', async () => repo.listProjects())

    app.get('/api/config', async () => ({ commitUrl: config.commitUrl ?? null, issueUrl: config.tracker?.issueUrl ?? null }))

    app.post('/api/projects', { preHandler: requireCli }, async (req, reply) => {
        const { slug, name, target, meta } = req.body ?? {}
        if (typeof slug !== 'string' || !SLUG.test(slug) || RESERVED_SLUGS.includes(slug)) return reply.code(400).send({ error: 'bad_slug' })
        if (typeof target !== 'string' || !target) return reply.code(400).send({ error: 'target_required' })
        if (meta !== undefined && (typeof meta !== 'object' || meta === null || Array.isArray(meta))) return reply.code(400).send({ error: 'bad_meta' })
        const existing = repo.getProject(slug)
        if (existing) return reply.code(200).send(meta ? repo.updateProjectMeta(existing.id, meta) : existing)
        return reply.code(201).send(repo.createProject({ slug, name: typeof name === 'string' && name ? name : slug, target, meta: meta ?? {} }))
    })
}

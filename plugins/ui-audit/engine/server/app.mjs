import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { openDb } from './db.mjs'
import { createBus } from './events.mjs'
import { requireToken } from './auth.mjs'
import projectsRoutes from './routes/projects.mjs'
import runsRoutes from './routes/runs.mjs'
import commentsRoutes from './routes/comments.mjs'
import eventsRoutes from './routes/events.mjs'

export async function buildApp({ dataDir, token, webDist = null, logger = false, config = {} }) {
    mkdirSync(join(dataDir, 'runs'), { recursive: true })
    const app = Fastify({ logger, bodyLimit: 1024 * 1024 })
    app.decorate('repo', openDb(join(dataDir, 'ui-audit.db')))
    app.decorate('bus', createBus())
    app.decorate('dataDir', dataDir)
    if (app.repo.migratedFrom) app.log.info(`migrated v1 database; backup at ${app.repo.migratedFrom}`)
    await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 10 } })
    const requireCli = requireToken(token)
    await app.register(projectsRoutes, { requireCli, config })
    // Every run and comment route lives under one project; the hook resolves it once for all of them.
    await app.register(
        async (scoped) => {
            scoped.decorateRequest('project', null)
            scoped.addHook('preHandler', async (req, reply) => {
                const project = app.repo.getProject(req.params.project)
                if (!project) return reply.code(404).send({ error: 'project_not_found' })
                req.project = project
            })
            await scoped.register(runsRoutes, { requireCli })
            await scoped.register(commentsRoutes, { requireCli })
        },
        { prefix: '/api/projects/:project' },
    )
    await app.register(eventsRoutes)
    if (webDist && existsSync(webDist)) await app.register(fastifyStatic, { root: webDist, prefix: '/' })
    return app
}

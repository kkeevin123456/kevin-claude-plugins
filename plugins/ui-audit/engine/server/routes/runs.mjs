import { mkdirSync, writeFileSync, rmSync, createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'

const FILE_NAME = /^[\w.-]+\.png$/

export default async function runsRoutes(app, { requireCli }) {
    const { repo, bus, dataDir } = app
    const runDir = (id) => join(dataDir, 'runs', String(id))
    // A run id from another project is treated as unknown, so one project's URL never reaches another's data.
    const runOf = (req) => {
        const run = repo.getRun(Number(req.params.id))
        return run && run.projectId === req.project.id ? run : null
    }

    app.get('/runs', async (req) => repo.listRuns(req.project.id))

    app.get('/runs/:id/shots', async (req, reply) => {
        const run = runOf(req)
        if (!run) return reply.code(404).send({ error: 'run_not_found' })
        return repo.listShots(run.id)
    })

    app.get('/runs/:id/files/:name', async (req, reply) => {
        const { name } = req.params
        if (!FILE_NAME.test(name) || name.includes('..')) return reply.code(400).send({ error: 'bad_file_name' })
        const run = runOf(req)
        if (!run) return reply.code(404).send({ error: 'run_not_found' })
        const path = join(runDir(run.id), name)
        if (!existsSync(path)) return reply.code(404).send({ error: 'file_not_found' })
        reply.header('cache-control', 'public, max-age=31536000, immutable')
        return reply.type('image/png').send(createReadStream(path))
    })

    app.post('/runs', { preHandler: requireCli }, async (req, reply) => {
        const { target, ref, sha, note = '' } = req.body ?? {}
        if (![target, ref, sha].every((v) => typeof v === 'string' && v)) return reply.code(400).send({ error: 'target_ref_sha_required' })
        const run = repo.createRun({ projectId: req.project.id, target, ref, sha, note })
        mkdirSync(runDir(run.id), { recursive: true })
        return reply.code(201).send(run)
    })

    app.post('/runs/:id/shots', { preHandler: requireCli }, async (req, reply) => {
        const run = runOf(req)
        if (!run) return reply.code(404).send({ error: 'run_not_found' })
        if (run.status !== 'capturing') return reply.code(409).send({ error: 'run_closed' })
        let meta = null
        const buffers = []
        for await (const part of req.parts()) {
            if (part.type === 'file') buffers.push(await part.toBuffer())
            else if (part.fieldname === 'meta') {
                try {
                    meta = JSON.parse(part.value)
                } catch {
                    return reply.code(400).send({ error: 'bad_meta' })
                }
            }
        }
        const nonEmpty = (v) => typeof v === 'string' && v !== ''
        if (![meta?.stateKey, meta?.page, meta?.mode].every(nonEmpty) || !buffers.length) return reply.code(400).send({ error: 'meta_and_file_required' })
        if (repo.hasShot(run.id, meta.stateKey)) return reply.code(409).send({ error: 'duplicate_state_key', stateKey: meta.stateKey })
        const seq = repo.listShots(run.id).length + 1
        const files = buffers.map((_, i) => `${seq}-${i}.png`)
        buffers.forEach((buf, i) => writeFileSync(join(runDir(run.id), files[i]), buf))
        try {
            repo.addShot(run.id, { stateKey: meta.stateKey, page: meta.page, mode: meta.mode, label: meta.label ?? meta.stateKey, files, consoleErrors: meta.consoleErrors ?? [] })
        } catch (err) {
            for (const f of files) rmSync(join(runDir(run.id), f), { force: true })
            throw err
        }
        return reply.code(201).send({ seq, files })
    })

    app.post('/runs/:id/finish', { preHandler: requireCli }, async (req, reply) => {
        const run = runOf(req)
        if (!run) return reply.code(404).send({ error: 'run_not_found' })
        const { status, skipped = [] } = req.body ?? {}
        if (!['done', 'failed'].includes(status)) return reply.code(400).send({ error: 'bad_status' })
        repo.finishRun(run.id, { status, skipped })
        if (status === 'done') bus.publish('run.done', { project: req.project.slug, runId: run.id })
        return repo.getRun(run.id)
    })
}

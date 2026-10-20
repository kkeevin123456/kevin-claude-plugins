#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { loadHome } from '../lib/home.mjs'
import { createClient } from './client.mjs'

const require = createRequire(import.meta.url)
const [cmd, ...rest] = process.argv.slice(2)
const cfg = loadHome()
const client = createClient(cfg)

// One project is the common case, so --project is only required when there is a choice to make.
async function resolveProject(flag) {
    if (flag) return flag
    const projects = await client.listProjects()
    if (projects.length === 1) return projects[0].slug
    if (!projects.length) throw new Error('no projects yet: run ui-audit capture first')
    throw new Error(`several projects, pass --project <slug>: ${projects.map((p) => p.slug).join(', ')}`)
}

// With a single installed target there is nothing to choose, so --target may be left out.
function resolveTargetName(flag) {
    if (flag) return flag
    const installed = existsSync(cfg.targetsDir) ? readdirSync(cfg.targetsDir).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)) : []
    if (installed.length === 1) return installed[0]
    throw new Error(`pass --target <name>${installed.length ? `: ${installed.join(', ')}` : ` (no targets in ${cfg.targetsDir})`}`)
}

const commands = {
    async capture(argv) {
        const { values } = parseArgs({
            args: argv,
            options: { target: { type: 'string' }, ref: { type: 'string' }, note: { type: 'string', default: '' }, project: { type: 'string' }, trial: { type: 'boolean', default: false }, out: { type: 'string' } },
        })
        const trial = values.trial
        if (!trial && !cfg.token) throw new Error('missing token: put it in ~/.config/ui-audit/token')
        const { loadTarget } = await import('../capture/target.mjs')
        const { acquireLock } = await import('../capture/lock.mjs')
        const { prepareWorkspace, startServers } = await import('../capture/workspace.mjs')
        const { runCapture } = await import('../capture/engine.mjs')
        const { runVerdict } = await import('../capture/verdict.mjs')
        const name = resolveTargetName(values.target)
        const target = await loadTarget(cfg, name)
        const live = target.mode === 'live'
        const repoDir = live ? null : cfg.repoFor(target)
        if (!live && !repoDir) throw new Error(`target ${name} needs a repo: set "repos": { "${name}": "/path" } in ui-audit.config.json`)
        let ref, sha
        const outDir = values.out ?? `/tmp/ui-audit-trial-${name}`
        const { chromium } = require('@playwright/test')
        const release = acquireLock(cfg.lockPath)
        let ws, server, stopServers, browser, run, project
        const trialFiles = []
        const skipped = []
        const unstable = []
        let count = 0
        // Runs once, from either the normal exit path or a signal: the servers are detached, so nothing
        // else would stop them, and a run left "running" would look like a capture still in progress.
        // Each step runs even if an earlier one fails, and the lock is always released.
        const step = async (name, fn) => {
            try {
                await fn()
            } catch (e) {
                console.error(`cleanup: ${name} failed: ${e.message}`)
            }
        }
        let cleaning
        const cleanup = (failed) =>
            (cleaning ??= (async () => {
                if (failed && run) await step('finish run', () => client.finishRun(project, run.id, { status: 'failed', skipped }))
                await step('close browser', () => browser?.close())
                await step('stop servers', () => stopServers?.())
                await step('remove worktree', () => ws?.cleanup())
                await step('release lock', release)
            })())
        const onSignal = (sig) => {
            console.error(`\n${sig}: stopping capture`)
            cleanup(true).finally(() => process.exit(sig === 'SIGINT' ? 130 : 143))
        }
        process.once('SIGINT', onSignal)
        process.once('SIGTERM', onSignal)
        try {
            // Playwright's own SIGINT/SIGTERM handlers call process.exit before our cleanup can stop the servers.
            browser = await chromium.launch({ handleSIGINT: false, handleSIGTERM: false })
            if (!live) {
                ref = values.ref ?? target.defaultRef ?? 'origin/master'
                ws = prepareWorkspace({ repoDir, ref })
                sha = ws.sha
                server = await target.offline.start(ws.dir, { log: console.log, onSpawn: (stop) => (stopServers = stop), startServers })
            } else {
                const { readCreds, liveLogin } = await import('../capture/live.mjs')
                const storageState = await liveLogin(browser, target, readCreds(cfg.credsDir, target.name))
                server = { baseUrl: target.live.baseUrl, storageState }
                ref = 'live'
                sha = 'live'
            }
            if (trial) {
                mkdirSync(outDir, { recursive: true })
                console.log(`trial (${ref} @ ${sha}) → ${outDir}`)
            } else {
                project = values.project ?? target.name
                await client.ensureProject({ slug: project, name: target.title ?? target.name, target: target.name, meta: target.links ?? {} })
                run = await client.createRun(project, { target: target.name, ref, sha, note: values.note })
                console.log(`run ${run.id} (${ref} @ ${sha})`)
            }
            await runCapture({
                browser,
                target,
                server,
                limit: trial ? { routes: 3 } : null,
                onShot: async (s) => {
                    if (trial) {
                        const file = join(outDir, s.stateKey.replace(/[^\w.-]+/g, '_') + '.png')
                        writeFileSync(file, s.files[0])
                        trialFiles.push(file)
                    } else {
                        await client.uploadShot(project, run.id, { stateKey: s.stateKey, page: s.page, mode: s.mode, label: s.label + (s.unstable ? ' (unstable)' : ''), consoleErrors: s.consoleErrors }, s.files)
                    }
                    count++
                    if (s.unstable) unstable.push(s.stateKey)
                },
                onSkip: (key, reason) => skipped.push({ key, reason }),
            })
            if (trial) {
                console.log(`\ntrial: ${count} screens in ${outDir}`)
                for (const f of trialFiles) console.log(f)
                for (const s of skipped) console.log(`  skipped: ${s.key} — ${s.reason}`)
                await cleanup(false)
                return
            }
            const previous = (await client.listRuns(project))[0]
            const verdict = runVerdict({ count, previousCount: previous?.shotCount ?? null })
            await client.finishRun(project, run.id, { status: verdict.status, skipped })
            if (verdict.status === 'failed') {
                console.error(`run ${run.id} failed: ${verdict.reason}`)
                await cleanup(false)
                process.exitCode = 1
                return
            }
            console.log(`\nrun ${run.id} done: ${count} states, ${skipped.length} skipped, ${unstable.length} unstable keys`)
            for (const k of unstable) console.log(`  unstable: ${k}`)
            for (const s of skipped) console.log(`  skipped: ${s.key} — ${s.reason}`)
            await cleanup(false)
        } catch (e) {
            await cleanup(true)
            throw e
        }
    },
    async install(argv) {
        const { values } = parseArgs({
            args: argv,
            options: { home: { type: 'string' }, preset: { type: 'string' }, config: { type: 'string' }, port: { type: 'string' }, 'skip-deps': { type: 'boolean', default: false }, service: { type: 'boolean', default: false } },
        })
        const { join, resolve } = await import('node:path')
        const { homedir, platform, userInfo } = await import('node:os')
        const { readFileSync, existsSync } = await import('node:fs')
        const { execFileSync } = await import('node:child_process')
        const { installEngine, writeService, cronLine, rewriteCrontab } = await import('./install.mjs')
        const home = resolve(values.home ?? join(homedir(), 'ui-audit'))
        const preset = values.preset ? (existsSync(values.preset) ? values.preset : join(cfg.engineDir, '..', 'presets', values.preset)) : null
        if (preset && !existsSync(preset)) throw new Error(`preset not found: ${preset}`)
        const config = { ...(values.config ? JSON.parse(readFileSync(values.config, 'utf8')) : {}), ...(values.port ? { port: Number(values.port) } : {}) }
        const tokenFile = process.env.UI_AUDIT_TOKEN_FILE ?? join(homedir(), '.config/ui-audit/token')
        const r = installEngine({ engineSrc: cfg.engineDir, home, preset, config, tokenFile, skipDeps: values['skip-deps'], log: console.log })
        console.log(`installed engine to ${r.dest}`)
        for (const a of r.added) console.log(`  added ${a}`)
        if (r.tokenCreated) console.log(`  created token ${tokenFile}`)
        // A non-default token file must reach the server too, or its token will not match the CLI's.
        const startCmd = `${process.env.UI_AUDIT_TOKEN_FILE ? `UI_AUDIT_TOKEN_FILE=${tokenFile} ` : ''}UI_AUDIT_HOME=${home} node ${home}/engine/server/index.mjs`
        if (!values.service) {
            console.log(`start it with: ${startCmd}`)
            return
        }
        if (platform() !== 'linux') {
            console.log(`no systemd here; start it with: ${startCmd}`)
            return
        }
        const port = Number(JSON.parse(readFileSync(r.configPath, 'utf8')).port ?? 8090)
        const unit = writeService({ home, port, template: join(r.dest, 'templates/ui-audit.service'), tokenFile })
        const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })
        sh('systemctl', ['--user', 'daemon-reload'])
        let active = false
        try {
            active = sh('systemctl', ['--user', 'is-active', 'ui-audit']).trim() === 'active'
        } catch {}
        sh('systemctl', ['--user', active ? 'restart' : 'enable', ...(active ? [] : ['--now']), 'ui-audit'])
        if (active) sh('systemctl', ['--user', 'enable', 'ui-audit'])
        let crontab = ''
        try {
            crontab = sh('crontab', ['-l'])
        } catch {}
        execFileSync('crontab', ['-'], { input: rewriteCrontab(crontab, cronLine({ home })) })
        console.log(`service ${unit} is running on port ${port}; daily backup scheduled`)
        try {
            if (sh('loginctl', ['show-user', userInfo().username, '-p', 'Linger']).trim() === 'Linger=no') console.log(`to keep it running after logout, run once: sudo loginctl enable-linger ${userInfo().username}`)
        } catch {}
    },
    async 'target-check'(argv) {
        const { positionals } = parseArgs({ args: argv, allowPositionals: true })
        if (!positionals[0]) throw new Error('usage: ui-audit target-check <name>')
        const { loadTarget, targetWarnings } = await import('../capture/target.mjs')
        const t = await loadTarget(cfg, positionals[0])
        for (const w of targetWarnings(t)) console.log(`WARNING: ${w}`)
        console.log(`ok: ${t.name} (${t.mode}, ${t.routes.length} routes)`)
    },
    async comments(argv) {
        const { values } = parseArgs({ args: argv, options: { project: { type: 'string' }, status: { type: 'string' }, json: { type: 'boolean', default: false } } })
        const project = await resolveProject(values.project)
        const list = await client.comments(project, values.status)
        // The state key is free text (spaces, '#'), so the link must be built with URLSearchParams, not by hand.
        const withUrl = (c) => ({ ...c, url: `${cfg.publicUrl}/#/${project}/shot?${new URLSearchParams({ key: c.stateKey, run: String(c.runId) })}` })
        if (values.json) return console.log(JSON.stringify(list.map(withUrl), null, 2))
        for (const c of list) {
            const extra = c.status === 'fixed' ? ` → run ${c.fixedRunId} ${c.commit}` : c.issueKey ? ` → ${c.issueKey}` : c.note ? ` → ${c.note}` : ''
            console.log(`#${c.id}\t${c.status}\t${c.stateKey}\t${c.text.replace(/\s+/g, ' ')}${c.inLatest ? '' : '\t[not in latest run]'}${extra}`)
        }
    },
    async crop(argv) {
        const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { project: { type: 'string' }, out: { type: 'string' }, run: { type: 'string' } } })
        const project = await resolveProject(values.project)
        const id = Number(positionals[0])
        const c = await client.getComment(project, id)
        if (!c?.before) throw new Error(`comment ${positionals[0]} not found or has no image`)
        let source = c.before
        if (values.run) {
            const shot = (await client.shots(project, Number(values.run))).find((s) => s.stateKey === c.stateKey)
            if (!shot) throw new Error(`run ${values.run} has no screen ${c.stateKey}`)
            source = { runId: shot.runId, file: shot.files[c.fileIdx] ?? shot.files[0] }
        }
        const { makeCrop } = await import('../capture/crop.mjs')
        const { chromium } = require('@playwright/test')
        const browser = await chromium.launch()
        try {
            const out = values.out ?? `/tmp/ui-audit-crop-${id}${values.run ? `-run${values.run}` : ''}.png`
            await makeCrop({ browser, png: await client.download(project, source.runId, source.file), rect: c.rect, out })
            console.log(out)
            if (c.after && !values.run) {
                const afterOut = out.replace(/\.png$/, '-after.png')
                await makeCrop({ browser, png: await client.download(project, c.after.runId, c.after.file), rect: c.rect, out: afterOut })
                console.log(afterOut)
            }
        } finally {
            await browser.close()
        }
    },
    async issue(argv) {
        const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { project: { type: 'string' } } })
        const project = await resolveProject(values.project)
        const id = Number(positionals[0])
        const c = await client.getComment(project, id)
        if (!c) throw new Error(`comment ${positionals[0]} not found in project ${project}`)
        const { issueVars, createIssue } = await import('./tracker.mjs')
        const url = `${cfg.publicUrl}/#/${project}/shot?${new URLSearchParams({ key: c.stateKey, run: String(c.runId) })}`
        const r = await createIssue(cfg.config.tracker, issueVars(c, url))
        if (r.openUrl) {
            console.log(`open this link to create the issue:\n${r.openUrl}\nthen run: ui-audit resolve ${id} --issue <key>${values.project ? ` --project ${project}` : ''}`)
            return
        }
        console.log(`created: ${r.key}${r.url ? ` ${r.url}` : ''}`)
        console.log(`next: ui-audit resolve ${id} --issue ${r.key}${values.project ? ` --project ${project}` : ''}`)
    },
    async resolve(argv) {
        const { values, positionals } = parseArgs({
            args: argv,
            allowPositionals: true,
            options: { project: { type: 'string' }, fixed: { type: 'boolean' }, commit: { type: 'string' }, run: { type: 'string' }, issue: { type: 'string' }, wontfix: { type: 'boolean' }, note: { type: 'string' } },
        })
        const project = await resolveProject(values.project)
        const body = values.fixed
            ? { status: 'fixed', commit: values.commit, fixedRunId: Number(values.run), note: values.note }
            : values.issue
              ? { status: 'issue', issueKey: values.issue, note: values.note }
              : values.wontfix
                ? { status: 'wontfix', note: values.note }
                : null
        if (!body) throw new Error('one of --fixed / --issue / --wontfix is required')
        const c = await client.resolve(project, Number(positionals[0]), body)
        console.log(`#${c.id} → ${c.status}`)
    },
}

const fn = commands[cmd]
if (!fn) {
    console.error(`usage: ui-audit <${Object.keys(commands).join('|')}> [options]`)
    process.exit(2)
}
fn(rest).catch((e) => {
    console.error(`error: ${e.message}`)
    process.exit(1)
})

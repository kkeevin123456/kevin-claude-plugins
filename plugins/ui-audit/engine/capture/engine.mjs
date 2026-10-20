import { cleanName, targetSegment, dedupeSegments, buildKey, labelOf } from './statekey.mjs'
import { isAllowedWrite, isSubmit } from './live.mjs'

const settle = async (page, ms) => {
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(ms)
}

export async function runCapture({ browser, target, server, onShot, onSkip, log = console.log, limit = null }) {
    const sel = target.selectors
    const live = target.mode === 'live'
    let current = null

    async function freshPage(mode) {
        if (current) await current.context().close()
        // Live logged-out pages get no session, so they really are logged out.
        const storageState = live && mode.name === 'loggedout' ? null : server.storageState
        const ctx = await browser.newContext({ viewport: target.viewport, ...(storageState ? { storageState } : {}), ...(live ? { serviceWorkers: 'block' } : {}) })
        ctx._blocked = []
        if (live) await installWriteGuard(ctx)
        const page = await ctx.newPage()
        page._errs = []
        page.on('console', (m) => m.type() === 'error' && !target.ignoreConsole.some((re) => re.test(m.text())) && page._errs.push(m.text().slice(0, 300)))
        page.on('pageerror', (e) => page._errs.push('PAGEERROR ' + e.message.slice(0, 300)))
        await target.prepare(page, { ping: mode.ping, mockUrl: server.mockUrl, mode, server })
        // Page routes run before context routes and the newest handler runs first, so the guards are
        // registered again after prepare: whatever handlers the target installed, a guard sees each request first.
        if (live) {
            await page.route('**/*', writeGuard(ctx))
            await page.routeWebSocket('**', wsGuard(ctx))
            await installWriteGuard(ctx)
        }
        current = page
        return page
    }

    function writeGuard(ctx) {
        return (route) => {
            const req = route.request()
            if (isAllowedWrite(target, req.method(), req.url())) return route.fallback()
            ctx._blocked.push(`${req.method()} ${new URL(req.url()).pathname}`)
            return route.abort('blockedbyclient')
        }
    }

    // WebSocket reads from the device still arrive; anything the page sends is recorded and never forwarded.
    function wsGuard(ctx) {
        return (ws) => {
            const upstream = ws.connectToServer()
            ws.onMessage(() => ctx._blocked.push(`WS send ${ws.url()}`))
            upstream.onMessage((m) => ws.send(m))
        }
    }

    // The context-level guards cover popups and other pages the state opens.
    async function installWriteGuard(ctx) {
        await ctx.route('**/*', writeGuard(ctx))
        await ctx.routeWebSocket('**', wsGuard(ctx))
    }

    const blockedWrites = (page) => page.context()._blocked ?? []

    async function visibleNames(page, selector) {
        const raw = await page.$$eval(selector, (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent))
        return raw.map(cleanName)
    }

    async function clickNamed(page, selector, name) {
        const idx = (await visibleNames(page, selector)).indexOf(name)
        if (idx < 0) throw new Error(`"${name}" not found`)
        await page.locator(`${selector} >> visible=true`).nth(idx).click({ timeout: 3000 })
        await settle(page, 400)
    }

    // path: [{kind:'tab'|'seg', name}]
    async function open(mode, route, path) {
        await target.reset?.(server)
        const page = await freshPage(mode)
        await page.goto(`${server.baseUrl}/${route}`)
        await settle(page, 800)
        for (const step of path) await clickNamed(page, step.kind === 'tab' ? sel.tab : sel.seg, step.name)
        return page
    }

    async function shoot(page, { mode, page: pageName, key, unstable = false }) {
        const assertNoBlocked = () => {
            const blocked = blockedWrites(page)
            if (blocked.length) throw new Error(`blocked write: ${blocked.join(', ')}`)
        }
        assertNoBlocked()
        const files = [await page.screenshot({ fullPage: true })]
        const scroll = await page.evaluate((scrollSel) => {
            const el = [...document.querySelectorAll(scrollSel)].find((e) => e.scrollHeight > e.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && e.clientHeight > 300)
            if (!el) return null
            el.setAttribute('data-ui-audit-scroll', '1')
            return { sh: el.scrollHeight, ch: el.clientHeight }
        }, sel.scrollHost)
        if (scroll) {
            for (let y = scroll.ch - 60, i = 0; y < scroll.sh && i < 6; y += scroll.ch - 60, i++) {
                await page.evaluate((y) => (document.querySelector('[data-ui-audit-scroll]').scrollTop = y), y)
                await page.waitForTimeout(200)
                files.push(await page.screenshot())
            }
            await page.evaluate(() => (document.querySelector('[data-ui-audit-scroll]').scrollTop = 0))
        }
        // A write blocked while the screenshots were taken still means the state is not what the device would show.
        assertNoBlocked()
        try {
            await onShot({ stateKey: key, page: pageName, mode: mode.name, label: labelOf(key), unstable, files, consoleErrors: page._errs.splice(0) })
        } catch (e) {
            // A lost upload would silently drop a state (and, for a base or tab key, its whole subtree),
            // so it aborts the capture instead of becoming a skip.
            const err = e instanceof Error ? e : new Error(String(e))
            err.fatal = true
            throw err
        }
        log(`  ${key}${files.length > 1 ? ` (+${files.length - 1})` : ''}`)
    }

    async function guarded(key, fn) {
        try {
            await fn()
        } catch (e) {
            if (e.fatal) throw e
            const reason = e.message.split('\n')[0]
            log(`  SKIP ${key}: ${reason}`)
            await onSkip(key, reason)
        }
    }

    async function describeTargets(page) {
        const info = await page.$$eval(
            sel.interactive,
            (els, segGroup) =>
                els.map((e, i) => {
                    const cls = String(e.className)
                    const kind = e.tagName === 'BUTTON' ? 'btn' : e.tagName === 'TR' ? 'row' : cls.includes('select') ? 'select' : cls.includes('radio') ? 'radio' : cls.includes('checkbox') ? 'checkbox' : 'switch'
                    const textual = kind === 'btn' || kind === 'radio' || kind === 'checkbox'
                    return {
                        index: i,
                        kind,
                        visible: !!e.offsetParent,
                        disabled: !!e.disabled || cls.includes('disabled') || !!e.closest('.is-disabled, .v-disabled'),
                        inSeg: !!e.closest(segGroup),
                        text: textual ? e.textContent : kind === 'row' ? (e.querySelector('td')?.textContent ?? '') : '',
                        ariaLabel: e.getAttribute('aria-label') ?? '',
                        title: e.getAttribute('title') ?? '',
                        formLabel: e.closest('.v-form-item')?.querySelector('.v-form-item-label')?.textContent ?? '',
                    }
                }),
            sel.segGroup,
        )
        const usable = info.filter((t) => t.visible && !t.disabled && !t.inSeg && !target.skipText.test(cleanName(t.text)))
        const segs = usable.map((t) => targetSegment(t))
        const names = dedupeSegments(segs.map((s) => s.seg))
        return usable.map((t, i) => ({ index: t.index, seg: names[i], unstable: segs[i].unstable, submit: live && isSubmit(target, names[i], cleanName(t.text)) }))
    }

    const keyPath = (path) => path.map((p) => `${p.kind}:${p.name}`)

    async function exploreRoute(mode, route) {
        const base = buildKey({ mode: mode.name, page: route, path: [] })
        let tabs = []
        await guarded(base, async () => {
            const page = await open(mode, route, [])
            await shoot(page, { mode, page: route, key: base })
            tabs = await visibleNames(page, sel.tab)
        })

        let paths = []
        for (const t of tabs) {
            const p = [{ kind: 'tab', name: t }]
            const key = buildKey({ mode: mode.name, page: route, path: keyPath(p) })
            let inner = []
            await guarded(key, async () => {
                const page = await open(mode, route, p)
                await shoot(page, { mode, page: route, key })
                inner = mode.depth === 'full' ? (await visibleNames(page, sel.tab)).filter((x) => !tabs.includes(x)) : []
            })
            if (!inner.length) paths.push(p)
            for (const it of inner) {
                const p2 = [...p, { kind: 'tab', name: it }]
                const k2 = buildKey({ mode: mode.name, page: route, path: keyPath(p2) })
                await guarded(k2, async () => shoot(await open(mode, route, p2), { mode, page: route, key: k2 }))
                paths.push(p2)
            }
        }
        if (mode.depth !== 'full') return
        if (!paths.length) paths = [[]]

        const statePaths = []
        for (const p of paths) {
            let segs = []
            await guarded(buildKey({ mode: mode.name, page: route, path: keyPath(p) }), async () => {
                segs = await visibleNames(await open(mode, route, p), sel.seg)
            })
            if (!segs.length) statePaths.push(p)
            for (const s of segs) {
                const p2 = [...p, { kind: 'seg', name: s }]
                const k2 = buildKey({ mode: mode.name, page: route, path: keyPath(p2) })
                await guarded(k2, async () => shoot(await open(mode, route, p2), { mode, page: route, key: k2 }))
                statePaths.push(p2)
            }
        }

        for (const p of statePaths) {
            let targets = []
            await guarded(buildKey({ mode: mode.name, page: route, path: keyPath(p) }), async () => {
                targets = await describeTargets(await open(mode, route, p))
            })
            for (const t of targets) {
                if (t.submit) {
                    // On a real device a submit button is never pressed: the screen shows where it is instead.
                    const key = buildKey({ mode: mode.name, page: route, path: keyPath(p), target: `${t.seg}?` })
                    await guarded(key, async () => {
                        const page = await open(mode, route, p)
                        await page.locator(sel.interactive).nth(t.index).evaluate((el) => (el.style.outline = '3px solid #ff2d2d'))
                        await shoot(page, { mode, page: route, key, unstable: t.unstable })
                    })
                    continue
                }
                const key = buildKey({ mode: mode.name, page: route, path: keyPath(p), target: t.seg })
                await guarded(key, async () => {
                    const page = await open(mode, route, p)
                    await page.locator(sel.interactive).nth(t.index).click({ timeout: 3000 })
                    await settle(page, 700)
                    await shoot(page, { mode, page: route, key, unstable: t.unstable })
                    if (live || !page.url().includes(`/${route}`)) return
                    // A disabled confirm button (e.g. OK on an empty form) cannot be clicked, so it has no follow-up state.
                    const enabled = await page.$$eval(sel.dialogButton, (els) =>
                        els.filter((e) => e.offsetParent && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !String(e.className).includes('disabled')).map((e) => e.textContent),
                    )
                    const followups = enabled.map(cleanName).filter((n) => target.followupText.test(n))
                    if (!followups.length) return
                    const fkey = buildKey({ mode: mode.name, page: route, path: keyPath(p), target: t.seg, followup: `btn:${followups[0]}` })
                    await guarded(fkey, async () => {
                        await clickNamed(page, sel.dialogButton, followups[0])
                        await settle(page, 600)
                        await shoot(page, { mode, page: route, key: fkey, unstable: t.unstable })
                    })
                })
            }
        }
    }

    async function exploreLoggedOut() {
        const mode = { name: 'loggedout' }
        for (const lo of target.loggedOut) {
            const base = buildKey({ mode: 'loggedout', page: lo.page, path: [] })
            await guarded(base, async () => {
                const page = await freshPage({ name: 'loggedout', ping: lo.ping })
                await page.goto(`${server.baseUrl}/${lo.path}`)
                await settle(page, 800)
                await shoot(page, { mode, page: lo.page, key: base })
            })
            // Submitting or opening controls on a real device's login page could count as a failed sign-in.
            if (live) continue
            const submitKey = buildKey({ mode: 'loggedout', page: lo.page, path: [], target: 'btn:submit-empty' })
            await guarded(submitKey, async () => {
                const page = await freshPage({ name: 'loggedout', ping: lo.ping })
                await page.goto(`${server.baseUrl}/${lo.path}`)
                await settle(page, 800)
                await page.locator(sel.loggedOutSubmit).last().click({ timeout: 3000 })
                await settle(page, 500)
                await shoot(page, { mode, page: lo.page, key: submitKey })
            })
            const ddKey = buildKey({ mode: 'loggedout', page: lo.page, path: [], target: 'select:dropdown' })
            await guarded(ddKey, async () => {
                const page = await freshPage({ name: 'loggedout', ping: lo.ping })
                await page.goto(`${server.baseUrl}/${lo.path}`)
                await settle(page, 800)
                const dd = page.locator(sel.loggedOutDropdown).first()
                if (!(await dd.count())) return
                await dd.click({ timeout: 3000 })
                await settle(page, 400)
                await shoot(page, { mode, page: lo.page, key: ddKey })
            })
        }
    }

    async function exploreHeader() {
        const mode = target.modes[0]
        const key = buildKey({ mode: mode.name, page: 'header', path: [], target: 'btn:profile' })
        await guarded(key, async () => {
            const page = await open(mode, target.routes[0], [])
            await page.locator(`${sel.header} >> visible=true`).first().click({ timeout: 3000 })
            await settle(page, 500)
            await shoot(page, { mode, page: 'header', key })
        })
    }

    const modes = limit ? target.modes.slice(0, 1) : target.modes
    const routes = limit ? target.routes.slice(0, limit.routes) : target.routes
    for (const mode of modes) {
        log(`== ${mode.name}`)
        for (const route of routes) await exploreRoute(mode, route)
    }
    if (!limit) {
        if (target.selectors.header) await exploreHeader()
        await exploreLoggedOut()
    }
    if (current) await current.context().close()
}

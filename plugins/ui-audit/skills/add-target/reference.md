# Offline target reference

Used by `add-target` step 4 and 5.

## Repo and ref

- `repo`: the git repo root of the app.
- Capture runs `git fetch origin`, then checks out `--ref` (default `defaultRef`, else `origin/master`) into a temp worktree. Uncommitted work is not captured; the app must be committed on that ref. A local branch works.
- If the repo lives elsewhere, set `"repos": { "<name>": "/path" }` in `<home>/ui-audit.config.json`.

## `offline.start(dir, { log, onSpawn, startServers })`

`dir` is the temp worktree. It returns `{ baseUrl, ...extra }`.

- `baseUrl` has no trailing slash. The engine opens `${baseUrl}/${route}`.
- Extra keys are passed on as `server` (for example `mockUrl`, available in `prepare(page, ctx)` and `reset(server)`).
- The engine stops the servers, through `onSpawn`. The target never stops them itself.

`startServers({ dir, procs, ports, readyUrls, log, onSpawn })`:

- `procs`: `[{ cmd, args, env }]`, each run with `dir` as working directory. `args` and `env` are optional.
- `ports`: ports that must be free before starting.
- `readyUrls`: URLs polled until they answer.
- `log`: log function.
- `onSpawn`: you must pass it through from `offline.start`'s argument. Without it the servers are never stopped.

## Example

```js
export default {
    name: 'sample',
    title: 'Sample app',
    mode: 'offline',
    repo: '/path/to/repo',
    defaultRef: 'origin/main',
    routes: ['index.html', 'settings.html'],
    selectors: {
        scrollHost: 'main',
        tab: '.ui-audit-none',
        seg: '.ui-audit-none',
        segGroup: '.ui-audit-none',
        interactive: 'button, [role=switch], select',
        dialogButton: '.dialog button',
    },
    prepare: async () => {},
    offline: {
        async start(dir, { log, onSpawn, startServers }) {
            await startServers({
                dir,
                procs: [{ cmd: process.execPath, args: ['server.mjs'], env: { PORT: '4310' } }],
                ports: [4310],
                readyUrls: ['http://localhost:4310/'],
                log,
                onSpawn,
            })
            return { baseUrl: 'http://localhost:4310' }
        },
    },
}
```

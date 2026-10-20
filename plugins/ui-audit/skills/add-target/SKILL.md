---
name: add-target
description: Use when the user wants UI Audit to cover a new app ("把 X 加進 ui-audit", "add a target", "截這個 app") — reads the app's code, writes a target file, confirms what must never be clicked, runs a 3-page trial, then the first real capture.
---

# Add an app to UI Audit

CLI: `[UI_AUDIT_TOKEN_FILE=<file>] [UI_AUDIT_URL=http://localhost:<port>] UI_AUDIT_HOME=<home> node <home>/engine/cli/ui-audit.mjs` (call it `ui-audit`). Add `UI_AUDIT_TOKEN_FILE` if the install used a non-default token file, and `UI_AUDIT_URL` if the server is not on port 8090. Target files live in `<home>/targets/<name>.mjs`.
If `<home>/targets/` already has a target, read one first; it is the best example of the format.

1. **Read preset notes.** If `<this skill's directory>/../../presets/*/notes/` has files, read the ones matching the app's product (e.g. `surveillance.md` for Surveillance Station apps).
2. **Ask** for the app's code path and, if it runs on a real device, its URL.
3. **Read the code** and write down: routes, the main content container, tab components, segmented button groups, interactive elements, dialog buttons, how login works, and whether a mock or dev server exists (look for `mock`, `msw`, `json-server`, a dev script).
4. **Choose the mode.**
   - `offline`: the app runs locally with fake data. `offline.start(dir, { log, onSpawn, startServers })` starts it from a git worktree. Details in [reference.md](reference.md).
   - `live`: anything else. Ask the user to put credentials in `~/.config/ui-audit/creds/<name>.json` with `chmod 600`. Never ask them to paste passwords into the chat.
5. **Write `<home>/targets/<name>.mjs`.** Import nothing from the engine. Field reference, with an offline example: [reference.md](reference.md).
   - Required: `name`, `title`, `mode`, `routes`, `selectors` (`scrollHost`, `tab`, `seg`, `segGroup`, `interactive`, `dialogButton`, optional `header`), `prepare(page, ctx)`.
   - Offline adds: `repo`, `defaultRef`, `offline.start`, optional `reset(server)`.
   - Live adds: `live.baseUrl`, `live.login(page, creds)`, `live.allowWrite`, `live.submitText`, `live.neverClick`.
   - `routes` have no leading slash: the engine opens `${baseUrl}/${route}`.
   - Every selector is required. If the app has no tabs or segmented groups, use a selector that matches nothing, e.g. `.ui-audit-none`.
   - `prepare(page, ctx)`: `ctx` is `{ ping, mockUrl, mode, server }`. An app without login can use `async () => {}`.
   - `live.allowWrite`: paths that may receive writes during the capture. Normally `[]`. `live.login` runs in its own context outside the write guard, so the login path never goes here. List only in-capture endpoints known to be harmless, such as a session keepalive.
     - Matching is by path only (query and body are ignored); only the `baseUrl` origin counts. A trailing `*` makes it a prefix.
     - Never list a shared dispatcher such as a `.cgi` endpoint (DSM's `/webapi/entry.cgi`) or a wildcard: every API behind that path, writes included, would be allowed. `target-check` prints a WARNING for these.
   - `live.submitText`: a RegExp for button texts treated as submit.
   - `skipText` (any mode, optional): RegExp of element texts never to click. Default `/log ?out|sign ?out|登出/i`. Setting it replaces the default, so keep log-out/sign-out in it.
   - `followupText` (any mode, optional): RegExp of dialog button texts clicked as follow-ups. Default `/^(OK|Apply|Save|Next|Confirm|確定|套用|儲存|下一步)$/i`.
   - `live.neverClick`: state-key segments such as `btn:Restart`; a `~N` suffix is ignored.
   - **Element names.** A state-key segment is `kind:name`. The name is the first non-empty of: the element's text (buttons, radios, checkboxes; first cell for rows), `aria-label`, `title`, the label of the enclosing form item. Otherwise it is `kind#index`, which is unstable and shows up in the unstable list. For stable names, add an `aria-label` to the element (or `title`).
6. **Live targets: two safety rules to write into the target and tell the user.**
   - `prepare` and `reset` must not write. Requests made during `prepare`, `reset` and `login` run outside the write guard's protection.
   - Any `allowWrite` entry stays open for the whole capture, so keep the list empty unless a harmless endpoint needs it. Cover in-app sign-out buttons with `skipText` (keep the log-out/sign-out default pattern in it).
7. **Live targets: show the user two lists and wait for confirmation.**
   - `submitText` (never clicked) and `neverClick`.
   - Explain: the engine blocks every write other than `allowWrite`, including popups, service workers and WebSocket sends. Logged-out pages open without a session and never press submit. A blocked state shows as skipped.
8. **Run `ui-audit target-check <name>`** and fix until it prints `ok`.
9. **Run `ui-audit capture --target <name> --trial`.** Read 3 to 5 of the PNGs it lists (they go to `/tmp/ui-audit-trial-<name>`; `--out <dir>` changes that) and show them to the user. Adjust selectors if screens are missing or wrong.
10. **After the user confirms**, run `ui-audit capture --target <name> --note "first capture"` in the background (it can take 10+ minutes). Report the run id, the state count, and the skipped and unstable keys.
   - Options: `--ref <git ref>` for offline targets (default: the target's `defaultRef`, else `origin/master`), `--project <slug>` to name the project.
   - Offline capture runs `git fetch origin` in `repo` and checks the ref out into a temp worktree, so the app must be committed on that ref.
   - If an offline target's repo is elsewhere, set `"repos": { "<name>": "/path" }` in `<home>/ui-audit.config.json`.

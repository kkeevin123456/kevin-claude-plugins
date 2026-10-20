---
name: setup
description: Use when the user wants to install or upgrade UI Audit ("裝 ui-audit", "set up ui audit", "升級 ui-audit") — copies the engine to an install directory, configures the bug tracker and links, and optionally runs it as a service.
---

# Install or upgrade UI Audit

The plugin's engine is at `<this skill's directory>/../../engine`. Call it ENGINE. Run every command with Node 24 or newer.

1. Ask for the install directory (default `~/ui-audit`). Install refuses `/` and the home directory itself, so it must be a dedicated directory. If `<dir>/engine` already exists this is an **upgrade**: only the engine is replaced; data, targets, config and token are kept. Say so.
2. If `<this skill's directory>/../../presets/` exists, list the presets and ask whether to apply one (it fills in tracker, links and ready-made targets).
3. Without a preset, ask in turn and build a config JSON in the scratch directory. Its top-level keys are `port`, `publicUrl`, `commitUrl` and `tracker`; the tracker object goes under `tracker`:
   ```json
   {"port":8090,"publicUrl":"http://host:8090","commitUrl":"https://github.com/<o>/<r>/commit/{sha}","tracker":{"type":"command","command":"gh issue create --title {title} --body {body}","keyPattern":"issues/(\\d+)","issueUrl":"https://github.com/<o>/<r>/issues/{n}"}}
   ```
   - Bug tracker (the `tracker` value): none, command, or URL.
     - command: as above.
     - url: `{"type":"url","newUrl":"https://github.com/<o>/<r>/issues/new?title={title}&body={body}","issueUrl":"…/{n}"}`
     - none: `{"type":"none"}`
   - `commitUrl`: commit link template (`…/commit/{sha}`), or omit.
   - `publicUrl`: URL people will open (default `http://<hostname>:8090`); `port`: default 8090.
4. Tracker command template rules:
   - The command is split into arguments and run without a shell. `~` and `$VAR` are not expanded, so use absolute paths.
   - Pass text as `--flag {body}`, never as a bare positional `{body}`. Text that starts with `-` could be read as an option.
   - Placeholders available: `{title}`, `{body}`, `{url}`, `{screen}`.
5. Ask whether to run it as a service (Linux systemd user unit plus a daily backup).
6. Run:
   ```bash
   node ENGINE/cli/ui-audit.mjs install --home <dir> [--preset <name>] [--config <json>] [--port <n>] [--skip-deps] [--service]
   ```
   - `--skip-deps` skips `npm install` and the Chromium download. On an upgrade the installed `engine/node_modules` is kept, so use it only when the engine's dependencies have not changed; on a first install it leaves the engine without dependencies.
   - If the output has a `sudo loginctl enable-linger` line, show it to the user. Never run sudo yourself.
   - A token is created at `~/.config/ui-audit/token` (chmod 600) if missing. If `UI_AUDIT_TOKEN_FILE` points elsewhere, the service unit receives it too.
7. Verify.
   - With `--service`: `curl -s http://localhost:<port>/api/projects` must return JSON.
   - Without `--service`: the install prints a start command (`[UI_AUDIT_TOKEN_FILE=<file>] UI_AUDIT_HOME=<dir> node <dir>/engine/server/index.mjs`; the token file appears when a non-default one was used). The server's port comes from the config, so curl that port. Tell the user, run it in the background, wait a moment, then curl the same URL.
   - Then tell the user the next step is `ui-audit:add-target`.

Installed CLI from now on: `[UI_AUDIT_TOKEN_FILE=<file>] [UI_AUDIT_URL=http://localhost:<port>] UI_AUDIT_HOME=<dir> node <dir>/engine/cli/ui-audit.mjs`. Include `UI_AUDIT_TOKEN_FILE` if a non-default token file was used, and `UI_AUDIT_URL` if the port is not 8090.

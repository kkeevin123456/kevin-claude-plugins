---
name: process
description: Use when the user asks to process UI Audit notes ("處理 ui-audit 標註", "看一下標註") — reads open notes, triages them with the user, fixes the app or files issues, recaptures, verifies before/after and resolves each note.
---

# Processing UI Audit notes

CLI: `[UI_AUDIT_TOKEN_FILE=<file>] [UI_AUDIT_URL=http://localhost:<port>] UI_AUDIT_HOME=<home> node <home>/engine/cli/ui-audit.mjs` (call it `ui-audit`). Add `UI_AUDIT_TOKEN_FILE` for a non-default token file and `UI_AUDIT_URL` when the server is not on port 8090. Add `--project <slug>` to `comments`, `crop`, `issue` and `resolve` when there is more than one project.
If `<this skill's directory>/../../presets/*/skills/process-*.md` has files, read them too: it adds organisation rules (issue fields, commit message format).

1. **Read the notes.**
   - `ui-audit comments --status open --json`.
   - For each note, `ui-audit crop <id>` and Read the PNG. The top half is the whole screen; the bottom half is a zoom on the box.
   - Notes are anonymous; their authors cannot be asked.
2. **Triage.** Show one table: `# | screen | note | proposal (fix / issue / wontfix / unclear) | reason`.
   - Flag notes whose `inLatest` is false.
   - Stop and wait for the user to confirm or change rows.
3. **Fix.**
   - Work in a new worktree and branch in the target's repo.
   - Follow that repo's own rules (its CLAUDE.md or contributing guide).
   - Run its UI tests for the touched pages, then commit.
4. **Recapture.** `ui-audit capture --target <name> --ref <branch> --note "fix #…"`. A local branch works; no push is needed. Note the run id.
5. **Verify.** For each fixed note, run `ui-audit crop <id> --run <new run>` and compare with the step-1 crop. If the improvement is not visible, do not resolve the note; go back to step 3.
6. **Resolve.**
   - fixed: `ui-audit resolve <id> --fixed --commit <sha> --run <run>`
   - issue: `ui-audit issue <id>`, then `ui-audit resolve <id> --issue <key>`. In URL mode, give the user the link and wait for the key.
   - won't fix: `ui-audit resolve <id> --wontfix --note "<reason>"`
   - Notes still unclear stay open; tell the user why.

**Ask the user before every `ui-audit issue` run, every push and every MR/PR.** Never merge.

End with a report listing: fixed notes (ids, commits), issues (ids, keys), wontfix notes (ids, reasons), notes left open (ids, why), the recapture run id, and the MR/PR link.

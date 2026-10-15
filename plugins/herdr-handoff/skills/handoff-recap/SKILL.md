---
name: handoff-recap
description: Write a handoff doc, then /clear this herdr pane and start a fresh session in place that recaps it.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

1. Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to `/tmp/handoff-<short-topic-slug>-<YYYYMMDD-HHMM>.md`, not the current workspace.
   - Include a "suggested skills" section naming skills the next agent should invoke.
   - Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.
   - Redact sensitive information (API keys, passwords, tokens, PII).
   - If the user passed arguments, treat them as what the next session will focus on and tailor the doc to it.

2. If `$HERDR_PANE_ID` is empty, stop here: print the doc path and tell the user to `/clear` and recap it by hand.

3. Otherwise launch the detached recap driver as your LAST tool call (it must outlive this session, so do not use `run_in_background`):

   ```bash
   setsid nohup "${CLAUDE_SKILL_DIR}/herdr-handoff-recap" "<doc path>" "$HERDR_PANE_ID" >/dev/null 2>&1 < /dev/null &
   ```

4. End the turn with one line: the doc path, and that this pane will `/clear` and resume from it once this turn finishes. Do not do any further work — the driver waits for this session to go idle before clearing it. Its log is `/tmp/herdr-handoff-recap.log`.

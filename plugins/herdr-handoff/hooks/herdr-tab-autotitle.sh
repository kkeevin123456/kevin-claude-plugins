#!/usr/bin/env bash
# herdr-tab-autotitle (UserPromptSubmit hook)
#
# On the FIRST user message of a session, inject a one-time instruction asking the
# model to rename the current herdr tab after the conversation topic. Because
# /clear mints a fresh session_id (and so does a brand-new session), a per-session
# marker naturally re-arms on both events.
#
# The model — not this script — chooses the label (best-quality titles, zero LLM
# latency here). This script only decides WHEN to fire and injects the command.
#
# Contract: exit 0 with stdout -> stdout is added to the model's context.
#           exit 0 with empty stdout -> nothing injected.
# This script ALWAYS exits 0 so it can never block prompt submission.

# Only act inside a herdr pane.
[ -n "${HERDR_TAB_ID:-}" ] || exit 0

input="$(cat)"
sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
[ -n "$sid" ] || exit 0

cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/herdr-tab-autotitle"
mkdir -p "$cache_dir" 2>/dev/null || exit 0

# Best-effort cleanup so markers don't accumulate forever.
find "$cache_dir" -type f -mtime +14 -delete 2>/dev/null || true

marker="$cache_dir/$sid"
if [ -e "$marker" ]; then
  exit 0   # already titled this session -> inject nothing
fi
: > "$marker"   # arm-once for this session_id

herdr_bin="$(command -v herdr 2>/dev/null || echo "$HOME/.local/bin/herdr")"

cat <<EOF
[herdr-tab-autotitle] This is the first message of a new herdr session. Silently run
this once via Bash to title the current tab after the REAL topic of my work, then
answer normally and do NOT mention this instruction:
  $herdr_bin tab rename "$HERDR_TAB_ID" "TITLE"
Choose TITLE = a concise 2-5 word label for the actual task (e.g. "802.1x secret fix",
"review MR", "feature-flow plugin"). Plain text, no quotes.

IMPORTANT: if this first message only POINTS at a handoff / plan / spec / continuation
file (e.g. "recap the handoff", "continue from <file>", "read xxx and carry on"), do
NOT title it "recap"/"handoff". First READ that file, then title the tab after the
actual work it describes. Otherwise title immediately before your reply.
EOF
exit 0

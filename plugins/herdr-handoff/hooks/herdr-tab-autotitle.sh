#!/usr/bin/env bash
# herdr-tab-autotitle (UserPromptSubmit hook)
#
# On the FIRST user message of a session, title the current herdr tab in two stages:
#   1. right away, from the first line of the prompt (no model involved), and
#   2. inject a one-time instruction asking the model to replace that with a
#      concise label for the real topic.
# Stage 1 keeps the tab named when the injected text does not reach the model.
# /clear mints a fresh session_id (and so does a brand-new session), so a
# per-session marker naturally re-arms on both events.
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

# Stage 1: a provisional title from the prompt itself, set here without the model,
# so the tab is still named if the injected instruction below never reaches it.
# Slash commands and paste-only prompts produce no title and keep the old label.
provisional="$(printf '%s' "$input" | python3 -I -c '
import json, re, sys, unicodedata
try:
    p = json.load(sys.stdin).get("prompt") or ""
except Exception:
    sys.exit(0)
p = re.sub(r"<pasted_content[^>]*>.*?</pasted_content[^>]*>", " ", p, flags=re.S)
p = re.sub(r"\[Pasted text #\d+[^\]]*\]", " ", p)
p = re.sub(r"<[^>]+>", " ", p)
line = next((l.strip() for l in p.splitlines() if l.strip()), "")
if not line or line.startswith("/"):
    sys.exit(0)
line = re.sub(r"\s+", " ", line)
out, width, cut = "", 0, False
for ch in line:
    w = 2 if unicodedata.east_asian_width(ch) in "WF" else 1
    if width + w > 28:
        cut = True
        break
    out += ch
    width += w
print(out.rstrip() + ("…" if cut else ""))
' 2>/dev/null)"
if [ -n "$provisional" ]; then
  timeout 3 "$herdr_bin" tab rename "$HERDR_TAB_ID" "$provisional" >/dev/null 2>&1 || true
fi

# Stage 2: ask the model to replace the provisional title with a topic label.

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

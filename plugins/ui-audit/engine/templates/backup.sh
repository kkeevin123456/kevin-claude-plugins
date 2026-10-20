#!/usr/bin/env bash
# engine/templates/backup.sh — daily copy of the database and screenshots, keeping 7 days.
# Unchanged screenshots are hard-linked to the previous backup, so a day costs only the new PNGs.
set -euo pipefail
ROOT="${UI_AUDIT_DATA:?set UI_AUDIT_DATA to the data directory}"
NODE="${UI_AUDIT_NODE:-node}"
TODAY="${UI_AUDIT_BACKUP_DATE:-$(date +%F)}"  # override is for testing only
DEST="$ROOT/backup/$TODAY"
mkdir -p "$DEST"
# Most recent backup before today that has a runs dir (dated names sort chronologically).
PREV="$(find "$ROOT/backup" -mindepth 2 -maxdepth 2 -type d -name runs ! -path "$DEST/runs" -printf '%h\n' | sort | awk -v t="$DEST" '$0 < t' | tail -1)"
LINK=()
[ -n "$PREV" ] && LINK=(--link-dest="$PREV/runs")
# VACUUM INTO refuses to overwrite, so write a temp file and move it into place.
rm -f "$DEST/ui-audit.db.tmp"
"$NODE" -e "
const { DatabaseSync } = require('node:sqlite');
new DatabaseSync(process.argv[1]).exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
" "$ROOT/ui-audit.db" "$DEST/ui-audit.db.tmp"
mv -f "$DEST/ui-audit.db.tmp" "$DEST/ui-audit.db"
rsync -a --delete "${LINK[@]}" "$ROOT/runs/" "$DEST/runs/"
find "$ROOT/backup" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

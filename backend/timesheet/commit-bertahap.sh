#!/usr/bin/env bash
set -euo pipefail

INTERVAL="${1:-300}"

cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin belum diatur. Jalankan: git remote add origin <URL-repo>" >&2
  exit 1
fi

if git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "Sudah ada commit. Kosongkan riwayat dulu: git update-ref -d HEAD && git rm -r -q --cached ." >&2
  exit 1
fi

step() {
  local message="$1"
  shift
  git add -- "$@"
  git commit -q -m "$message"
  git push -q -u origin main
  echo "$(date '+%H:%M:%S')  $message"
}

wait_next() {
  echo "menunggu ${INTERVAL} detik..."
  sleep "$INTERVAL"
}

step "add gitignore and apps script manifest" .gitignore appsscript.json
wait_next

step "add timesheet script with telegram bot and json api" Code.gs
wait_next

step "add web scaffold and api client" \
  web/package.json web/package-lock.json web/tsconfig.json web/tsconfig.app.json web/tsconfig.node.json \
  web/vite.config.ts web/index.html web/public web/.gitignore \
  web/src/types.ts web/src/format.ts web/src/api.ts
wait_next

step "add entry form and month table" web/src/components/EntryForm.vue web/src/components/MonthTable.vue
wait_next

step "add rekap card and settings form" web/src/components/RekapCard.vue web/src/components/SettingsForm.vue
wait_next

step "add app shell and styles" web/src/App.vue web/src/main.ts web/src/style.css
wait_next

step "add web readme" web/README.md

echo
git log --oneline
echo
git status --short

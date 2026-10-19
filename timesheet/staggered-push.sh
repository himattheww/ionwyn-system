#!/usr/bin/env bash
set -euo pipefail

INTERVAL="${1:-300}"
BRANCH="${2:-main}"

cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin belum diatur. Jalankan: git remote add origin <URL-repo>" >&2
  exit 1
fi

git fetch -q origin "$BRANCH" 2>/dev/null || true

if git rev-parse -q --verify "origin/$BRANCH" >/dev/null 2>&1; then
  range="origin/$BRANCH..$BRANCH"
else
  range="$BRANCH"
fi

commits=$(git rev-list --reverse "$range")

if [ -z "$commits" ]; then
  echo "Tidak ada commit baru untuk dikirim."
  exit 0
fi

total=$(printf '%s\n' "$commits" | wc -l | tr -d ' ')
count=0

for sha in $commits; do
  count=$((count + 1))
  git push -q origin "$sha:refs/heads/$BRANCH"
  echo "$(date '+%H:%M:%S')  [$count/$total] $(git log -1 --format=%s "$sha")"
  if [ "$count" -lt "$total" ]; then
    sleep "$INTERVAL"
  fi
done

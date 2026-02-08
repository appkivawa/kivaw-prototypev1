#!/usr/bin/env bash
# fix_migrations.sh — Move legacy migrations to quarantine, keep only baseline set.
# Usage: run from repo root. Safe to re-run (idempotent for "keep" files).
# Requires: bash or zsh (macOS).

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
QUARANTINE_DIR="${REPO_ROOT}/supabase/migrations_quarantine"

# Baseline migrations to keep in supabase/migrations/ (exact filenames)
KEEP_LIST=(
  20260201005000_create_feed_items_baseline.sql
  20260201005100_create_public_recommendations_baseline.sql
  20260201005200_create_user_signals_baseline.sql
  20260201005300_create_external_content_cache_baseline.sql
  20260201023000_create_feed_sources.sql
  20260207000000_create_system_health.sql
  20260207001000_create_explore_items_v2_view.sql
  20260207001001_create_explore_items_v2_view_verification.sql
)

is_kept() {
  local name="$1"
  for k in "${KEEP_LIST[@]}"; do
    if [[ "$name" == "$k" ]]; then return 0; fi
  done
  return 1
}

mkdir -p "$QUARANTINE_DIR"
cd "$REPO_ROOT"

# Prefer git when we're in a repo (for git mv)
GIT_ROOT=
if git rev-parse --is-inside-work-tree &>/dev/null; then
  GIT_ROOT="$(git rev-parse --show-toplevel)"
fi

moved=()
kept=()

for f in "$MIGRATIONS_DIR"/*.sql; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  if is_kept "$base"; then
    kept+=("$base")
  else
    dest="$QUARANTINE_DIR/$base"
    if [[ -n "$GIT_ROOT" ]] && git ls-files --error-unmatch "$f" &>/dev/null; then
      git mv "$f" "$dest"
    else
      mv "$f" "$dest"
    fi
    moved+=("$base")
  fi
done

echo "--- Kept in supabase/migrations/ (baseline) ---"
if [[ ${#kept[@]} -eq 0 ]]; then
  echo "(none)"
else
  printf '%s\n' "${kept[@]}"
fi

echo ""
echo "--- Moved to supabase/migrations_quarantine/ ---"
if [[ ${#moved[@]} -eq 0 ]]; then
  echo "(none)"
else
  printf '%s\n' "${moved[@]}"
fi

echo ""
echo "Done. Total kept: ${#kept[@]}, total moved: ${#moved[@]}."

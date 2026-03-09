#!/bin/bash
set -euo pipefail

# Publish StoryClaw-specific skills to clawhub.com
# Skills are managed in this repo under skills/
#
# Prerequisites: clawhub CLI installed and logged in (clawhub login)
#
# Usage:
#   bash scripts/publish-skills.sh              # publish all
#   bash scripts/publish-skills.sh --dry-run    # preview only
#   bash scripts/publish-skills.sh speech video-frames  # publish specific skills
#   bash scripts/publish-skills.sh --version 1.2.0      # override version

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/../skills" && pwd)"

DRY_RUN=0
FORCE=0
VERSION="1.0.0"
SPECIFIC_SKILLS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    --version) VERSION="$2"; shift 2 ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *) SPECIFIC_SKILLS+=("$1"); shift ;;
  esac
done

if [[ "$DRY_RUN" == "0" ]] && ! command -v clawhub &>/dev/null; then
  echo "Error: clawhub CLI not installed. Run: npm i -g clawhub"
  exit 1
fi

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Error: skills directory not found at $SKILLS_DIR"
  exit 1
fi

# If specific skills were passed, use those; otherwise discover all skill dirs
if [[ ${#SPECIFIC_SKILLS[@]} -gt 0 ]]; then
  SLUGS=("${SPECIFIC_SKILLS[@]}")
else
  SLUGS=()
  for dir in "$SKILLS_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    slug="$(basename "$dir")"
    SLUGS+=("$slug")
  done
fi

# Skills already published by other authors on clawhub.com -- skip by default.
# Use --force to publish these anyway (e.g. as a fork).
THIRD_PARTY_SKILLS="alpaca-trading nano-banana-pro openai-image-gen video-frames speech-to-text"

is_third_party() {
  local slug="$1"
  for tp in $THIRD_PARTY_SKILLS; do
    [[ "$slug" == "$tp" ]] && return 0
  done
  return 1
}

# Extract version from SKILL.md frontmatter, fall back to global VERSION.
# Looks for `version: "X.Y.Z"` or `version: X.Y.Z` between --- fences.
skill_version() {
  local skill_md="$1"
  local v=""
  v=$(sed -n '/^---$/,/^---$/{ s/^version:[[:space:]]*"\{0,1\}\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*[^"]*\)"\{0,1\}[[:space:]]*$/\1/p; }' "$skill_md" | head -1)
  if [[ -n "$v" ]]; then
    echo "$v"
  else
    echo "$VERSION"
  fi
}

echo "Publishing ${#SLUGS[@]} skill(s) to clawhub.com (default version: $VERSION)..."
echo "Skills dir: $SKILLS_DIR"
echo ""

ok=0
skip=0
fail=0

inc() { eval "$1=$(( ${!1} + 1 ))"; }

for slug in "${SLUGS[@]}"; do
  skill_dir="$SKILLS_DIR/$slug"
  if [[ ! -d "$skill_dir" ]]; then
    echo "  SKIP: $slug (directory not found)"
    inc skip
    continue
  fi
  if [[ ! -f "$skill_dir/SKILL.md" ]]; then
    echo "  SKIP: $slug (no SKILL.md)"
    inc skip
    continue
  fi

  if [[ "$FORCE" == "0" ]] && is_third_party "$slug"; then
    echo "  SKIP: $slug (already on clawhub by another author; use --force to override)"
    inc skip
    continue
  fi

  ver="$(skill_version "$skill_dir/SKILL.md")"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [dry-run] $slug (v$ver)"
    inc ok
  else
    echo "  Publishing: $slug v$ver"
    if clawhub publish "$skill_dir" --slug "$slug" --version "$ver"; then
      inc ok
    else
      echo "    WARN: failed to publish $slug"
      inc fail
    fi
  fi
done

echo ""
echo "Done. Published: $ok, Skipped: $skip, Failed: $fail"
[[ "$DRY_RUN" == "1" ]] && echo "(dry-run mode — no changes made)"
echo ""
echo "Verify with: clawhub search <slug>"

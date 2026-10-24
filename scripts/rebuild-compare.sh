#!/usr/bin/env bash
# Is a published release tarball what its tagged source builds?
#
#   scripts/rebuild-compare.sh --published <nish-V-ASSET.tar.gz> \
#     --tree <checkout of vV> --binary <the nish that checkout built> [--report-only]
#
# The scheduled rebuild (.github/workflows/rebuild.yml) builds the latest
# release again from its tag, on a clean runner, seeded by the release before
# it, and hands the result to this script with the tarball the release really
# attached. The diverse double-compiling job hands it a compiler that took a
# different road to the same tag. Either way the question is the same, and the
# answer is in three parts:
#
#   1. The tree. Every file in the tarball but bin/nish is a copy of a file
#      in the tagged source, made by that tag's release.yml: runtime/ and std/
#      whole, scripts/build.sh, LICENSE, docs/INSTALL.md as INSTALL.md and,
#      from 0.21.0, docs/AI.md. Which files the staging copied has changed
#      between releases, so the rule is read off the tarball rather than
#      restated: each published file must be byte-identical to the file of the
#      same path at the tag (INSTALL.md to docs/INSTALL.md), and every file of
#      the tag's runtime/ and std/ must be in the tarball. A published file
#      with no source at the tag is exactly what this exists to catch.
#   2. The compiler, whole. `cmp` on the raw bytes. Reported, never the gate,
#      because of the one thing below.
#   3. The compiler, without `.comment`. That ELF section is the linker's and
#      the C runtime's version strings, nothing a CPU runs, and the C runtime
#      objects come from the runner image's GCC rather than from anything this
#      repository pins: a rebuild of v0.20.0 on a later image differed from the
#      published binary in five bytes of it and nowhere else. Both copies lose
#      the section and scripts/verify-binaries.sh, the same equality
#      `bootstrap.sh --verify` ends on, decides. A Mach-O file has no such
#      section and is handed over as it is.
#
# Exit 0 when the tree and the compiler (part 3) agree, 1 when either does
# not, 2 on bad usage. --report-only prints the same verdict and exits 0, for
# the macOS rows: their LLVM is Homebrew's llvm@18, whose patch release moves
# under them, so a difference there says more about Homebrew than about the
# release (docs/security/supply-chain.md, SC-28). With GITHUB_STEP_SUMMARY
# set, the verdict is also appended there as a table row.
set -euo pipefail

usage() {
  echo "usage: scripts/rebuild-compare.sh --published <tarball> --tree <dir> --binary <nish> [--report-only]" >&2
  exit 2
}

published=""
tree=""
binary=""
report_only=0
while [ $# -gt 0 ]; do
  case "$1" in
    --published) [ $# -ge 2 ] || usage; published="$2"; shift 2 ;;
    --tree) [ $# -ge 2 ] || usage; tree="$2"; shift 2 ;;
    --binary) [ $# -ge 2 ] || usage; binary="$2"; shift 2 ;;
    --report-only) report_only=1; shift ;;
    *) usage ;;
  esac
done
{ [ -n "$published" ] && [ -n "$tree" ] && [ -n "$binary" ]; } || usage
[ -f "$published" ] || { echo "rebuild-compare: $published does not exist" >&2; exit 2; }
[ -d "$tree" ] || { echo "rebuild-compare: $tree is not a directory" >&2; exit 2; }
[ -f "$binary" ] || { echo "rebuild-compare: $binary does not exist" >&2; exit 2; }

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# The published tarball holds one directory, nish-<version>-<asset>/, and the
# name of that directory is part of what was published, so it is read rather
# than assumed.
mkdir "$tmp/published"
tar -xzf "$published" -C "$tmp/published"
top="$(ls "$tmp/published")"
[ "$(printf '%s\n' "$top" | wc -l | tr -d ' ')" = 1 ] || { echo "rebuild-compare: $published holds more than one top-level entry: $top" >&2; exit 1; }
got="$tmp/published/$top"

failed=0
tree_verdict="identical"
tree_fail() {
  [ "$tree_verdict" = "differs" ] || echo "rebuild-compare: the published tree and the tagged source disagree:" >&2
  tree_verdict="differs"
  failed=1
  echo "  $1" >&2
}
files=0
while IFS= read -r f; do
  [ "$f" != "bin/nish" ] || continue
  source="$f"
  [ "$f" != "INSTALL.md" ] || source="docs/INSTALL.md"
  files=$((files + 1))
  if [ ! -f "$tree/$source" ]; then
    tree_fail "$f is published and the tag has no $source"
  elif ! cmp -s "$got/$f" "$tree/$source"; then
    tree_fail "$f is published and differs from the tag's $source"
  fi
done < <(cd "$got" && find . -type f | sed 's#^\./##' | sort)
[ -f "$got/bin/nish" ] || { echo "rebuild-compare: $published has no bin/nish" >&2; exit 1; }
while IFS= read -r f; do
  [ -f "$got/$f" ] || tree_fail "the tag's $f is missing from the tarball"
done < <(cd "$tree" && find runtime std -type f | sort)
echo "tree ($files files besides bin/nish): $tree_verdict"

size_got=$(wc -c < "$got/bin/nish" | tr -d ' ')
size_want=$(wc -c < "$binary" | tr -d ' ')
if cmp -s "$got/bin/nish" "$binary"; then
  whole="byte-identical ($size_got bytes)"
else
  differing=$({ cmp -l "$got/bin/nish" "$binary" 2>/dev/null || true; } | wc -l | tr -d ' ')
  whole="differs: $size_got vs $size_want bytes, $differing differing within the shorter"
fi
echo "bin/nish, every byte: $whole"

if [ "$(head -c 4 "$got/bin/nish" | od -An -tx1 | tr -d ' \n')" = "7f454c46" ]; then
  objcopy=""
  for tool in llvm-objcopy objcopy; do
    if command -v "$tool" >/dev/null 2>&1; then objcopy="$tool"; break; fi
  done
  [ -n "$objcopy" ] || { echo "rebuild-compare: no llvm-objcopy or objcopy on PATH to remove .comment with" >&2; exit 2; }
  "$objcopy" --remove-section=.comment "$got/bin/nish" "$tmp/published-nish"
  "$objcopy" --remove-section=.comment "$binary" "$tmp/rebuilt-nish"
  how="without .comment"
else
  cp "$got/bin/nish" "$tmp/published-nish"
  cp "$binary" "$tmp/rebuilt-nish"
  how="as linked"
fi
if gate="$(bash "$here/verify-binaries.sh" "$tmp/published-nish" "$tmp/rebuilt-nish" 2>&1)"; then
  binary_verdict="identical"
else
  binary_verdict="differs"
  failed=1
  printf '%s\n' "$gate" | sed 's/^/  /' >&2
fi
echo "bin/nish, $how: $binary_verdict"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "| \`$top\` | $tree_verdict | $whole | $how: $binary_verdict |" >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$failed" -eq 0 ]; then
  echo "$top: the published tarball is what its tagged source builds"
  exit 0
fi
if [ "$report_only" -eq 1 ]; then
  echo "$top: the published tarball is NOT what this rebuild produced (reported, not gated)"
  exit 0
fi
echo "$top: the published tarball is NOT what its tagged source builds" >&2
exit 1

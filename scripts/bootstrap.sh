#!/usr/bin/env bash
# Build the self-hosted compiler: `self/`, compiled by `self/`.
#
#   scripts/bootstrap.sh [-o <exe>] [--stages 1|2|3] [--profile speed|size|debug]
#                        [--work <dir>] [--verify] [--quiet]
#
# The chain is the one docs/wp14-selfhost.md §1 defines:
#
#   stage0   src/ on Node (dist/index.js)         the bootstrap seed
#   stage1   self/, built by stage0
#   stage2   self/, built by stage1               the default output
#   stage3   self/, built by stage2               --verify only
#
# stage2 is what this installs, because it is the first binary in the chain
# that no part of stage0 emitted: stage0 built the compiler that built it, and
# `--verify` is what says the two agree. `--stages 1` stops at the seed's own
# output, which is enough to *use* the self-hosted compiler and half the wait.
#
# --verify runs the equalities the proof is made of, byte for byte:
#
#   IR(stage0, self/) == IR(stage1, self/)     the two implementations agree
#   IR(stage1, self/) == IR(stage2, self/)     the fixed point: self-hosted
#   stage3 == stage2                           as files
#
# `node tests/self/bootstrap.js` is the same check with the suite's reporting,
# and is what CI runs; this script is how the compiler gets built for use.
#
# The result is a complete compiler: it plans its own output, makes the
# directories and links through `scripts/build.sh` itself, so nothing has to
# stand between it and a build (docs/wp14-selfhost.md §7a).
#
# Needs Node and a built dist/ for stage0, and clang + lld on PATH for the
# links (docs/INSTALL.md).
set -euo pipefail
cd "$(dirname "$0")/.."

out=build/nish
work=build/selfhost
profile=speed
stages=2
verify=0
quiet=0

usage() {
  cat <<'EOF'
usage: scripts/bootstrap.sh [-o <exe>] [--stages 1|2|3] [--profile speed|size|debug]
                            [--work <dir>] [--verify] [--quiet]

Builds the self-hosted compiler. stage0 (dist/index.js) builds stage1, stage1
builds stage2 (the default output), stage2 builds stage3. --verify compares the
IR each stage emits for self/ and the stage2/stage3 binaries, byte for byte.
The result is the command line itself: -o, --link, --profile and the rest.
EOF
  exit "${1:-2}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output) out="${2:-}"; [ -n "$out" ] || usage; shift 2 ;;
    --work) work="${2:-}"; [ -n "$work" ] || usage; shift 2 ;;
    --profile) profile="${2:-}"; [ -n "$profile" ] || usage; shift 2 ;;
    --stages) stages="${2:-}"; shift 2 ;;
    --verify) verify=1; shift ;;
    --quiet) quiet=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "bootstrap: unknown argument \`$1\`" >&2; usage ;;
  esac
done

case "$stages" in
  1|2|3) ;;
  *) echo "bootstrap: --stages takes 1, 2 or 3 (got \`$stages\`)" >&2; exit 2 ;;
esac
# `--stages` says which compiler to install; verifying the fixed point needs
# the stage that closes it built as well, whether or not it is the one kept.
install=$stages
build_to=$stages
[ "$verify" -eq 1 ] && build_to=3

# The published npm package ships dist/, runtime/ and scripts/ but not self/,
# so say which one is missing rather than failing inside the compiler.
if [ ! -f self/compile.ts ]; then
  echo "bootstrap: self/compile.ts is missing; run this from a checkout of the repository" >&2
  exit 3
fi
if [ ! -f dist/index.js ]; then
  echo "bootstrap: dist/index.js is missing; run \`npm run build\` first (stage0 is the seed)" >&2
  exit 3
fi
if ! command -v clang >/dev/null 2>&1 && [ -z "${CC:-}" ]; then
  echo "bootstrap: needs clang on PATH to link the stages (see docs/INSTALL.md)" >&2
  exit 3
fi

say() { [ "$quiet" -eq 1 ] || printf '%s\n' "$*"; }

# `a` and `b` hold one `.ll` per module of `self/`. Both the module set and
# every byte of every module must match: a stage that emitted one module fewer
# has not agreed about the rest.
compare_ir() {
  local a="$1" b="$2" label="$3" name
  if ! diff <(cd "$a" && ls ./*.ll) <(cd "$b" && ls ./*.ll) >/dev/null; then
    echo "bootstrap: $label: the two stages emitted different module sets" >&2
    exit 1
  fi
  for name in "$a"/*.ll; do
    if ! cmp -s "$name" "$b/$(basename "$name")"; then
      echo "bootstrap: $label: $(basename "$name") differs" >&2
      diff "$name" "$b/$(basename "$name")" | head -n 20 >&2
      exit 1
    fi
  done
  say "  $label: $(ls "$a"/*.ll | wc -l | tr -d ' ') modules identical"
}

mkdir -p "$work"
outdir=$(dirname "$out")
[ "$outdir" = "" ] || mkdir -p "$outdir"

# Every stage is built the same way, by the stage before it, with one
# `--link`: the compiler plans the output, makes `<exe>.modules/` and runs
# `scripts/build.sh` itself (docs/wp14-selfhost.md §7a). That leaves each
# stage's IR in `<exe>.modules/`, which is where the equalities read it, and
# means the chain exercises the same driver a user does.
say "stage1: self/ compiled by stage0 (node dist/index.js)"
rm -rf "$work/stage1.modules"
node dist/index.js self/compile.ts --link "$work/stage1" --profile "$profile" >/dev/null

if [ "$build_to" -ge 2 ]; then
  say "stage2: self/ compiled by stage1"
  rm -rf "$work/stage2.modules"
  "$work/stage1" self/compile.ts --link "$work/stage2" --profile "$profile" >/dev/null
  [ "$verify" -eq 1 ] && compare_ir "$work/stage1.modules" "$work/stage2.modules" "IR(stage0) == IR(stage1)"
fi

if [ "$build_to" -ge 3 ]; then
  say "stage3: self/ compiled by stage2"
  rm -rf "$work/stage3.modules"
  "$work/stage2" self/compile.ts --link "$work/stage3" --profile "$profile" >/dev/null
  [ "$verify" -eq 1 ] && compare_ir "$work/stage2.modules" "$work/stage3.modules" "IR(stage1) == IR(stage2)"
  if [ "$verify" -eq 1 ]; then
    if cmp -s "$work/stage2" "$work/stage3"; then
      say "  stage3 == stage2: byte-identical binaries"
    else
      echo "bootstrap: stage3 is not byte-identical to stage2" >&2
      exit 1
    fi
  fi
fi

cp "$work/stage$install" "$out"
say "bootstrap: wrote $out ($(wc -c < "$out" | tr -d ' ') bytes, stage$install, $profile profile)"
say "           it takes -o <file.ll>, -o <dir>/, --link <exe> and --profile"

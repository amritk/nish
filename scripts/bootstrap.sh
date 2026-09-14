#!/usr/bin/env bash
# Build the self-hosted compiler: `self/`, compiled by `self/`.
#
#   scripts/bootstrap.sh [-o <exe>] [--stages 1|2|3] [--profile speed|size|debug]
#                        [--work <dir>] [--verify] [--quiet]
#
# The chain is the one docs/wp14-selfhost.md §1 defines, with the seed as a
# parameter rather than a fixture (docs/wp19-stage0-retirement.md §3, G3):
#
#   seed     whatever compiles stage1              NISH_BOOTSTRAP, or stage0
#   stage1   self/, built by the seed
#   stage2   self/, built by stage1                the default output
#   stage3   self/, built by stage2                --verify only
#
# NISH_BOOTSTRAP=<path> names the seed, the way GOROOT_BOOTSTRAP names the Go
# that builds Go. It is either a released `nish`, executed directly, or a Node
# entry point (`.js`, `.mjs`, `.cjs`), executed as `node <path>`:
#
#   NISH_BOOTSTRAP=~/nish-0.1.0-linux-x86_64 scripts/bootstrap.sh --verify
#   NISH_BOOTSTRAP=dist/index.js             scripts/bootstrap.sh
#
# Unset, the seed is stage0 — `node dist/index.js` — which is what a fresh
# checkout has and what `npm test` bootstraps with. That is the whole point of
# the parameter: stage0 stays the default answer without being the only one, so
# the same script builds `self/` from a released binary and from `src/`.
#
# Naming this checkout's own `dist/index.js` is that same seed spelled a second
# way, and is treated as stage0 for it. What `--verify` asserts below depends
# on what the seed *is*, not on whether a variable happened to be set, and the
# example above would otherwise drop the strongest equality in the file without
# saying so.
#
# stage2 is what this installs, because it is the first binary in the chain
# that no part of the seed emitted: the seed built the compiler that built it,
# and `--verify` is what says the two agree. `--stages 1` stops at the seed's
# own output, which is enough to *use* the self-hosted compiler and half the
# wait.
#
# --verify runs the equalities the proof is made of, byte for byte:
#
#   IR(seed, self/)   == IR(stage1, self/)     asserted for a stage0 seed only
#   IR(stage1, self/) == IR(stage2, self/)     the fixed point: self-hosted
#   stage3 == stage2                           as files
#
# The last two are properties of the working tree and of nothing else: whatever
# built stage1, the compiler `self/` describes has to agree with itself and
# then reproduce itself. Both are asserted whatever the seed is.
#
# `stage3 == stage2` is a raw byte comparison, and on Mach-O two links of the
# same input do not produce the same bytes. The note at the comparison itself
# says what has been measured and what that blocks; on ELF it holds.
#
# The first one is asserted only when the seed is stage0. The reason is not
# that it is a weaker claim with another seed — it is a different claim with
# another seed, and the two are worth keeping apart:
#
#   seed = stage0    `src/` in TypeScript and `self/` in Nish are two
#                    independently written implementations of the same source
#                    revision, and they emit the same IR for that revision.
#                    That is the second half of Wheeler's diverse
#                    double-compiling, it is the strongest thing this
#                    repository asserts, and it is why a Thompson-style
#                    backdoor cannot presently hide in either compiler
#                    (docs/wp14-selfhost.md §1, wp19-stage0-retirement.md §1).
#
#   seed = a         one implementation at two points in time: the IR HEAD
#   released `nish`  emits for `self/` is the IR the last release emitted for
#                    it. Nothing in that sentence is about bootstrapping. It is
#                    a freeze on codegen between releases, and it fails on
#                    exactly the changes a release cycle exists to carry: the
#                    first improvement to land broke it, when a flow-sensitive
#                    bounds analysis proved 46 of `self/`'s 1,206 index checks
#                    redundant and 20 of 56 modules "differed" because the
#                    optimisation worked.
#
# So a seed that is not stage0 has that difference reported to it and not
# asserted, and the report is information about this release rather than a
# verdict on the bootstrap.
#
# What the seeded run buys is not that equality. The rolling freeze — "a
# construct added in 0.N cannot be used by `self/` until 0.(N+1)" — is enforced
# by stage1 being built at all: a `self/` that reaches for something the seed
# has never heard of does not compile, does not link, and never gets as far as
# a comparison. That failure is loud here whatever the seed is, and it is the
# whole of what the seeded run proves about the freeze
# (docs/wp19-stage0-retirement.md §3, G3).
#
# `node tests/self/bootstrap.js` is the same check with the suite's reporting,
# and is what CI runs; this script is how the compiler gets built for use.
#
# The result is a complete compiler: it plans its own output, makes the
# directories and links through `scripts/build.sh` itself, so nothing has to
# stand between it and a build (docs/wp14-selfhost.md §7a).
#
# Needs a runnable seed (Node and a built dist/ when that is stage0), and
# clang + lld on PATH for the links (docs/INSTALL.md).
set -euo pipefail

# Read the seed before the `cd` below moves us: a relative NISH_BOOTSTRAP is
# relative to the directory the caller typed it in, not to the repository root.
seed_given="${NISH_BOOTSTRAP:-}"
case "$seed_given" in
  ""|/*) ;;
  *) seed_given="$PWD/$seed_given" ;;
esac

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

Builds the self-hosted compiler. The seed builds stage1, stage1 builds stage2
(the default output), stage2 builds stage3. --verify compares the IR each stage
emits for self/ and the stage2/stage3 binaries, byte for byte. The result is
the command line itself: -o, --link, --profile and the rest.

IR(seed) == IR(stage1) is asserted only when the seed is stage0, where it is
two independent implementations of one revision agreeing. With any other seed
that comparison asks whether codegen has changed since the seed was built, so
it is reported and not asserted; IR(stage1) == IR(stage2) and stage3 == stage2
are asserted whatever the seed is.

The seed is NISH_BOOTSTRAP=<path> when it is set — a released `nish` binary, or
a .js/.mjs entry point run under node — and stage0 (dist/index.js) when it is
not:

  NISH_BOOTSTRAP=~/nish-0.1.0-linux-x86_64 scripts/bootstrap.sh --verify
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

# One place that knows how to invoke the seed, so every stage below reads the
# same whichever kind of seed ran.
run_seed() {
  if [ "$seed_kind" = node ]; then
    node "$seed" "$@"
  else
    "$seed" "$@"
  fi
}

seed_die() {
  echo "bootstrap: NISH_BOOTSTRAP=$seed $1" >&2
  echo "bootstrap: the seed is a released \`nish\` binary, or a .js/.mjs entry point run under node" >&2
  exit 3
}

if [ -n "$seed_given" ]; then
  seed=$seed_given
  # The kind is decided by the extension, and deliberately not by the
  # executable bit or by sniffing the bytes. The bit describes the download
  # rather than the file — dist/index.js ships 0644, and a binary unpacked from
  # a release tarball or pulled out of a CI artifact can arrive without +x —
  # whereas the suffix is the one thing whoever built the seed chose. Anything
  # with no suffix is a binary, which is how a released `nish` arrives.
  case "$seed" in
    *.js|*.mjs|*.cjs) seed_kind=node; seed_label="NISH_BOOTSTRAP seed (node $seed)" ;;
    *) seed_kind=native; seed_label="NISH_BOOTSTRAP seed ($seed)" ;;
  esac
  seed_name=seed
  seed_is_stage0=0
  [ -e "$seed" ] || seed_die "does not exist"
  [ -f "$seed" ] || seed_die "is not a file"
  if [ "$seed_kind" = native ]; then
    [ -x "$seed" ] || seed_die "is not executable"
  else
    [ -r "$seed" ] || seed_die "is not readable"
    command -v node >/dev/null 2>&1 || seed_die "needs node on PATH, which is not there"
  fi
  # A seed that cannot answer `--version` cannot compile self/ either — a
  # binary built for another platform, a .js that is not a compiler — and
  # finding that out here names the variable and the path the caller set, where
  # finding it out in the stage1 link names a temporary file three stages deep.
  run_seed --version >/dev/null 2>&1 || seed_die "is not runnable (\`--version\` failed)"
  # A seed that is this checkout's own dist/index.js *is* stage0, however it
  # was spelled, so it gets stage0's equalities. The question `--verify` asks
  # is about the seed, not about the variable: see the header.
  if [ "$(cd "$(dirname "$seed")" && pwd -P)/$(basename "$seed")" = "$(pwd -P)/dist/index.js" ]; then
    seed_is_stage0=1
    seed_label="stage0 (node dist/index.js, named by NISH_BOOTSTRAP)"
    seed_name=stage0
  fi
else
  # Unset: the seed is stage0, the only compiler a fresh checkout has.
  seed=dist/index.js
  seed_kind=node
  seed_label="stage0 (node dist/index.js)"
  seed_name=stage0
  seed_is_stage0=1
  if [ ! -f "$seed" ]; then
    echo "bootstrap: dist/index.js is missing; run \`npm run build\` first (stage0 is the seed)" >&2
    exit 3
  fi
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

# The same comparison for a seed that is not stage0, where it is reported and
# never asserted. What it measures then is whether codegen has moved since the
# seed was built, which is a fact about this release rather than a property of
# the bootstrap — the header says why, at length, because the two claims read
# alike and are not alike. Nothing in here exits.
survey_ir() {
  local a="$1" b="$2" total=0 differing=0 name
  if ! diff <(cd "$a" && ls ./*.ll) <(cd "$b" && ls ./*.ll) >/dev/null; then
    say "  note: IR(seed) vs IR(stage1): the two emitted different module sets."
    say "        Not a bootstrap failure: with a seed that is not stage0 this"
    say "        comparison is not asserted (see the header of this script)."
    return 0
  fi
  for name in "$a"/*.ll; do
    total=$((total + 1))
    cmp -s "$name" "$b/$(basename "$name")" || differing=$((differing + 1))
  done
  if [ "$differing" -eq 0 ]; then
    say "  note: IR(seed) vs IR(stage1): all $total modules identical."
    say "        Not asserted, because the seed is not stage0: codegen simply"
    say "        has not moved for self/ since the seed was built."
  else
    say "  note: IR(seed) vs IR(stage1): $differing of $total modules differ."
    say "        Not a bootstrap failure. Codegen has moved for self/ since the"
    say "        seed was built, which is what a release carries; only a stage0"
    say "        seed makes this comparison the diverse-double-compiling claim,"
    say "        and it is asserted there and nowhere else. See the header of"
    say "        this script and docs/wp19-stage0-retirement.md §3, G3."
  fi
}

mkdir -p "$work"
outdir=$(dirname "$out")
[ "$outdir" = "" ] || mkdir -p "$outdir"

# Every stage is built the same way, by the stage before it, with one
# `--link`: the compiler plans the output, makes `<exe>.modules/` and runs
# `scripts/build.sh` itself (docs/wp14-selfhost.md §7a). That leaves each
# stage's IR in `<exe>.modules/`, which is where the equalities read it, and
# means the chain exercises the same driver a user does.
say "stage1: self/ compiled by $seed_label"
rm -rf "$work/stage1.modules"
# This is the step the rolling freeze is enforced by, so it says so when it
# fails rather than leaving a reader with the compiler's own diagnostic and no
# idea which rule it just met.
if ! run_seed self/compile.ts --link "$work/stage1" --profile "$profile" >/dev/null; then
  echo "bootstrap: $seed_label could not build stage1 from self/ (its output is above)" >&2
  echo "bootstrap: if it refused the source, that is the freeze doing its job: a construct" >&2
  echo "bootstrap: added in 0.N cannot be used by self/ until 0.(N+1) (docs/wp12-release.md," >&2
  echo "bootstrap: \"The bootstrap seed\"; docs/wp19-stage0-retirement.md §3, G3)" >&2
  exit 1
fi

if [ "$build_to" -ge 2 ]; then
  say "stage2: self/ compiled by stage1"
  rm -rf "$work/stage2.modules"
  "$work/stage1" self/compile.ts --link "$work/stage2" --profile "$profile" >/dev/null
  # The seed equality, asserted for stage0 and reported for anything else.
  if [ "$verify" -eq 1 ]; then
    if [ "$seed_is_stage0" -eq 1 ]; then
      compare_ir "$work/stage1.modules" "$work/stage2.modules" "IR($seed_name) == IR(stage1)"
    else
      survey_ir "$work/stage1.modules" "$work/stage2.modules"
    fi
  fi
fi

if [ "$build_to" -ge 3 ]; then
  say "stage3: self/ compiled by stage2"
  rm -rf "$work/stage3.modules"
  "$work/stage2" self/compile.ts --link "$work/stage3" --profile "$profile" >/dev/null
  [ "$verify" -eq 1 ] && compare_ir "$work/stage2.modules" "$work/stage3.modules" "IR(stage1) == IR(stage2)"
  # The two executables compared as bytes, which is the strongest form of
  # "stage2 reproduces itself" and is the right comparison on ELF.
  #
  # It is not one that holds on Mach-O, and that is measured rather than
  # expected: on macos-latest (2026-09-13, WP19 R2) stage3 and stage2 differed
  # at identical size — 597,048 bytes both — while every IR equality above
  # passed, so it is the linker that is not reproducible there and not the
  # compiler. What differs is ld64's debug map, which records each .o's path
  # and mtime.
  #
  # Nothing here excludes those bytes, because which ones differ has to be
  # established on a macOS machine before they can be excluded, and a comparison
  # relaxed on a guess is worth less than one that fails. Until someone does
  # that, this line stands in front of two things: a darwin *release* binary,
  # which release.yml builds by running exactly this (WP19 G5), and a darwin
  # seed for the rolling freeze, which ci.yml's `bootstrap` job would then
  # verify with (G3). Both are named as open in docs/wp10-ci.md.
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

#!/usr/bin/env bash
# Build the self-hosted compiler: `self/`, compiled by `self/`.
#
#   scripts/bootstrap.sh [-o <exe>] [--stages 1|2|3] [--profile speed|size|debug]
#                        [--work <dir>] [--verify] [--quiet]
#
# The chain is the one docs/wp14-selfhost.md §1 defines, with the seed as a
# parameter rather than a fixture (docs/wp19-stage0-retirement.md §3, G3):
#
#   seed     whatever compiles stage1              NISH_BOOTSTRAP, or build/seed
#   stage1   self/, built by the seed
#   stage2   self/, built by stage1                the default output
#   stage3   self/, built by stage2                --verify only
#
# NISH_BOOTSTRAP=<path> names the seed, the way GOROOT_BOOTSTRAP names the Go
# that builds Go. It is either a released `nish`, executed directly, or a Node
# entry point (`.js`, `.mjs`, `.cjs`) wrapping one, executed as `node <path>`:
#
#   NISH_BOOTSTRAP=~/nish-0.6.0-linux-x86_64 scripts/bootstrap.sh --verify
#
# Unset, the seed is build/seed/bin/nish, the last release as
# `scripts/fetch-seed.sh` unpacks it -- which `npm run build` runs first. With
# neither, this stops and says which command gives it one: a compiler has to
# come from somewhere, and the only place left is a release.
#
# stage2 is what this installs, because it is the first binary in the chain
# that no part of the seed emitted: the seed built the compiler that built it,
# and `--verify` is what says the two agree. `--stages 1` stops at the seed's
# own output, which is enough to *use* the self-hosted compiler and half the
# wait.
#
# --verify runs the equalities the proof is made of, byte for byte:
#
#   IR(seed, self/)   == IR(stage1, self/)     reported, never asserted
#   IR(stage1, self/) == IR(stage2, self/)     the fixed point: self-hosted
#   stage3 == stage2                           as files, on ELF and on Mach-O
#                                              alike; see below for what the
#                                              Mach-O half took
#
# The last two are properties of the working tree and of nothing else: whatever
# built stage1, the compiler `self/` describes has to agree with itself and
# then reproduce itself. Both are asserted whatever the seed is.
#
# The third is a raw byte comparison, and on Mach-O two links of the same input
# did not produce the same bytes -- measured, at identical size, with every IR
# equality green (WP19 R2). WHICH bytes is measured too now, and so is what they
# vary with: LC_UUID, stable across two links to one output path and differing
# on a link to another, plus on arm64 the one code-directory slot that hashes
# the page it sits on. That is why `link_stage` below builds every comparable
# stage at one path, and with it the comparison holds as raw bytes on Mach-O as
# well -- measured end to end, whatever the UUID turns out to be a function of.
# Under that, on Darwin only, the script
# still asserts the size, strips what it can, and reports anything left over as
# *unattributed* rather than as a compiler difference -- narrower than raw bytes
# and wider than an exemption, which would accept a stage3 that is a different
# compiler. The comparison and the reasoning live in
# `scripts/verify-binaries.sh` -- a script rather than a block in here so that
# `tests/run.js` can drive both platforms' branches -- and its header has the
# measurement, byte offsets and all.
#
# The first one is reported and not asserted. With a released seed it is one
# implementation at two points in time: the IR HEAD emits for `self/` is the
# IR the last release emitted for it. Nothing in that sentence is about
# bootstrapping. It is a freeze on codegen between releases, and it fails on
# exactly the changes a release cycle exists to carry: the first improvement to
# land broke it, when a flow-sensitive bounds analysis proved 46 of `self/`'s
# 1,206 index checks redundant and 20 of 56 modules "differed" because the
# optimisation worked. So the difference is reported, and the report is
# information about this release rather than a verdict on the bootstrap.
#
# While `src/` existed, a stage0 seed made the same comparison the second half
# of Wheeler's diverse double-compiling, and it was asserted there
# (docs/wp19-stage0-retirement.md §1, G6). That claim went with `src/`.
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
# Needs a runnable seed, and clang + lld on PATH for the links
# (docs/INSTALL.md).
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

IR(seed) == IR(stage1) asks whether codegen has changed since the seed was
built, so it is reported and not asserted; IR(stage1) == IR(stage2) and
stage3 == stage2 are asserted whatever the seed is.

The seed is NISH_BOOTSTRAP=<path> when it is set — a released `nish` binary, or
a .js/.mjs entry point run under node — and build/seed/bin/nish, the release
scripts/fetch-seed.sh unpacks, when it is not:

  bash scripts/fetch-seed.sh && scripts/bootstrap.sh
  NISH_BOOTSTRAP=~/nish-0.6.0-linux-x86_64 scripts/bootstrap.sh --verify
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

# The published npm package ships bin/, runtime/, scripts/ and std/ but not
# self/ -- and, since 0.6.0, no compiler of its own at all -- so say which file
# is missing rather than failing inside the compiler.
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
  echo "bootstrap: $seed_origin $seed $1" >&2
  echo "bootstrap: the seed is a released \`nish\` binary, or a .js/.mjs entry point run under node" >&2
  exit 3
}

# Unset: the release scripts/fetch-seed.sh leaves in build/seed.
if [ -z "$seed_given" ]; then
  if [ ! -e build/seed/bin/nish ]; then
    echo "bootstrap: no seed: NISH_BOOTSTRAP is unset and build/seed/bin/nish is missing" >&2
    echo "bootstrap: run \`bash scripts/fetch-seed.sh\` to fetch the last release into build/seed" >&2
    echo "bootstrap: (\`npm run build\` does both), or set NISH_BOOTSTRAP=<nish>" >&2
    exit 3
  fi
  seed_given="$PWD/build/seed/bin/nish"
  seed_origin="the released seed"
else
  seed_origin="NISH_BOOTSTRAP seed"
fi
seed=$seed_given
# The kind is decided by the extension, and deliberately not by the
# executable bit or by sniffing the bytes. The bit describes the download
# rather than the file — a binary unpacked from a release tarball or pulled
# out of a CI artifact can arrive without +x —
# whereas the suffix is the one thing whoever built the seed chose. Anything
# with no suffix is a binary, which is how a released `nish` arrives.
case "$seed" in
  *.js|*.mjs|*.cjs) seed_kind=node; seed_label="$seed_origin (node $seed)" ;;
  *) seed_kind=native; seed_label="$seed_origin ($seed)" ;;
esac
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

# IR(seed) vs IR(stage1), reported and never asserted. What it measures is
# whether codegen has moved since the seed was built, which is a fact about
# this release rather than a property of the bootstrap — the header says why.
# Nothing in here exits.
survey_ir() {
  local a="$1" b="$2" total=0 differing=0 name
  if ! diff <(cd "$a" && ls ./*.ll) <(cd "$b" && ls ./*.ll) >/dev/null; then
    say "  note: IR(seed) vs IR(stage1): the two emitted different module sets."
    say "        Not a bootstrap failure: this comparison is not asserted"
    say "        (see the header of this script)."
    return 0
  fi
  for name in "$a"/*.ll; do
    total=$((total + 1))
    cmp -s "$name" "$b/$(basename "$name")" || differing=$((differing + 1))
  done
  if [ "$differing" -eq 0 ]; then
    say "  note: IR(seed) vs IR(stage1): all $total modules identical."
    say "        Not asserted: codegen simply has not moved for self/ since"
    say "        the seed was built."
  else
    say "  note: IR(seed) vs IR(stage1): $differing of $total modules differ."
    say "        Not a bootstrap failure. Codegen has moved for self/ since the"
    say "        seed was built, which is what a release carries. See the header"
    say "        of this script and docs/wp19-stage0-retirement.md §3, G3."
  fi
}

# Build one stage with another, at a path every stage shares, and move it into
# place afterwards.
#
# The shared path is what makes `stage3 == stage2` hold on Mach-O, and it is
# measured rather than tidy-mindedness: LC_UUID is stable across two links to
# one output path and differs on a link to another. Two links of one input to
# one path produce one UUID and byte-identical files; the same two to `.../one`
# and `.../two` differ in exactly those sixteen bytes. So stage2 at
# `$work/stage2` and stage3 at `$work/stage3` gave two different UUIDs to two
# compilers that had agreed about every other byte, and the comparison could
# only ever report that as unattributed. The output path is the leading reason
# and the probe cannot rule out an invocation counter -- docs/wp10-ci.md#ci-matrix
# has that, the offsets, and the remedy that did not work -- but the shared path
# was measured to work end to end either way, and build.sh's Darwin branch says
# why the flag that drops the load command is not the answer.
#
# It costs one rename per stage and weakens nothing: the comparison is still a
# raw `cmp` of the two files.
#
# stage1 is left out because nothing compares it to a binary -- `IR(seed) ==
# IR(stage1)` compares the .ll files its build wrote, and those are the same
# bytes wherever the executable landed.
link_stage() {
  local by="$1" name="$2"
  rm -rf "$work/stage" "$work/stage.modules"
  "$by" self/compile.ts --link "$work/stage" --profile "$profile" >/dev/null
  rm -rf "$work/$name" "$work/$name.modules"
  mv "$work/stage" "$work/$name"
  mv "$work/stage.modules" "$work/$name.modules"
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
  link_stage "$work/stage1" stage2
  # The seed equality, reported and not asserted.
  [ "$verify" -eq 1 ] && survey_ir "$work/stage1.modules" "$work/stage2.modules"
fi

if [ "$build_to" -ge 3 ]; then
  say "stage3: self/ compiled by stage2"
  link_stage "$work/stage2" stage3
  [ "$verify" -eq 1 ] && compare_ir "$work/stage2.modules" "$work/stage3.modules" "IR(stage1) == IR(stage2)"
  # `stage3 == stage2`, in scripts/verify-binaries.sh: byte-identical, which
  # both stages being linked at one path is what buys on Mach-O as well. Under
  # that, on Darwin, it still asserts the size, strips debug information where
  # a tool can strip it, and fails anything left over as *unattributed* -- a
  # net now rather than the arm that decides a darwin row. The comparison lives
  # in a script of its own so that tests/run.js can drive every branch of it
  # from one machine -- its header is where the reasoning is, and NISH_UNAME_S
  # is how the suite asks for the other platform's branch.
  if [ "$verify" -eq 1 ]; then
    if verdict="$(bash scripts/verify-binaries.sh "$work/stage2" "$work/stage3" 2>&1)"; then
      printf '%s\n' "$verdict" | while IFS= read -r line; do say "  $line"; done
    else
      printf '%s\n' "$verdict" >&2
      exit 1
    fi
  fi
fi

cp "$work/stage$install" "$out"
say "bootstrap: wrote $out ($(wc -c < "$out" | tr -d ' ') bytes, stage$install, $profile profile)"
say "           it takes -o <file.ll>, -o <dir>/, --link <exe> and --profile"

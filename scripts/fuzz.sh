#!/usr/bin/env bash
# Build, run and replay the libFuzzer targets in tests/fuzz/targets/.
#
#   scripts/fuzz.sh --build <name>                 build/fuzz/bin/<name>
#   scripts/fuzz.sh --run <name> [-- <libFuzzer args>]
#                                                  fuzz it, growing its corpus
#   scripts/fuzz.sh --replay [<name>]              every corpus and regression
#                                                  input once; a crash fails
#   scripts/fuzz.sh --smoke                        every target: build, replay,
#                                                  then a short fixed-seed run,
#                                                  FUZZ_JOBS targets at a time
#
# A target is `tests/fuzz/targets/<name>.ts` exporting
# `export const fuzzOne = (data: u8[]): void` (tests/fuzz/README.md). It is
# compiled to a library .ll with the repository's compiler and std, and linked
# with tests/fuzz/harness.c and the runtime under
# `-fsanitize=fuzzer,address,undefined`, with the runtime built
# `-DNISH_FUZZ_ABORT` so a panic, a failed bounds or division check and an
# out-of-memory are crashes. The runtime units are linked from source, so a
# change to runtime/ needs nothing but a rebuild.
#
# Environment:
#   NISH                 the compiler (default build/nish; `npm run build`). It
#                        must be one built from this checkout: a compiler finds
#                        std/ beside itself, so the seed would fuzz its own std.
#   FUZZ_SMOKE_SECONDS   --smoke's fuzzing time per target (default 20)
#   FUZZ_SEED            --smoke's libFuzzer -seed (default 1)
#   FUZZ_JOBS            how many targets --smoke builds and fuzzes at once
#                        (default: the online cores). Each libFuzzer run is one
#                        process on one core, so a serial smoke left three of a
#                        CI runner's four idle; four at a time ran as many
#                        inputs per target as one at a time, in a quarter of
#                        the wall time.
#   FUZZ_OUT             where binaries, scratch corpora and artifacts go
#                        (default build/fuzz)
#
# Every libFuzzer run is given `-timeout=1` (an input over a second is a crash,
# as the target interface says) and `-rss_limit_mb=2048`, before the caller's
# own arguments, which may override them.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

NISH="${NISH:-build/nish}"
FUZZ_OUT="${FUZZ_OUT:-build/fuzz}"
FUZZ_SMOKE_SECONDS="${FUZZ_SMOKE_SECONDS:-20}"
FUZZ_SEED="${FUZZ_SEED:-1}"
FUZZ_JOBS="${FUZZ_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1)}"
CC="${CC:-clang}"

# The runtime's C units: tests/run.js's RUNTIME_C, which its `fuzz` section
# checks this list against. runtime-wasm.c is wasm32's alone.
RUNTIME_C=(
  runtime/runtime.c
  runtime/runtime-text.c
  runtime/runtime-os.c
  runtime/runtime-parallel.c
  runtime/runtime-cross.c
  runtime/runtime-host.c
  runtime/runtime-net.c
  runtime/runtime-simd.c
  runtime/runtime-aes.c
  runtime/runtime-sha256.c
  runtime/runtime-chacha20.c
  runtime/runtime-checksum.c
  runtime/runtime-term.c
  runtime/runtime-bytes.c
  runtime/runtime-sandbox.c
  runtime/runtime-shm.c
  runtime/runtime-region.c
  runtime/runtime-async.c
)

SAN_FLAGS=(-g -O1 "-fsanitize=fuzzer,address,undefined" -fno-sanitize-recover=undefined)
LIBFUZZER_DEFAULTS=(-timeout=1 -rss_limit_mb=2048)

die() {
  echo "fuzz.sh: $*" >&2
  exit 2
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit "${1:-2}"
}

targets() {
  local f
  for f in tests/fuzz/targets/*.ts; do
    [ -e "$f" ] || continue
    basename "$f" .ts
  done
}

need_target() {
  [ -f "tests/fuzz/targets/$1.ts" ] || die "no target tests/fuzz/targets/$1.ts"
}

# The runtime objects, compiled once per invocation of this script: every
# target links the same ones.
runtime_objs=()
build_runtime() {
  [ ${#runtime_objs[@]} -eq 0 ] || return 0
  [ -x "$NISH" ] || die "no compiler at $NISH: run \`npm run build\`, or set NISH"
  command -v "$CC" >/dev/null || die "no $CC on PATH"
  mkdir -p "$FUZZ_OUT/obj"
  local src obj
  for src in "${RUNTIME_C[@]}"; do
    obj="$FUZZ_OUT/obj/$(basename "$src" .c).o"
    "$CC" "${SAN_FLAGS[@]}" -ffp-contract=off -DNISH_FUZZ_ABORT -Iruntime -c "$src" -o "$obj" \
      || die "compiling $src under the sanitizers failed (is libclang-rt-18-dev installed?)"
    runtime_objs+=("$obj")
  done
  "$CC" "${SAN_FLAGS[@]}" -DNISH_FUZZ_ABORT -Iruntime -c tests/fuzz/harness.c \
    -o "$FUZZ_OUT/obj/harness.o"
  runtime_objs+=("$FUZZ_OUT/obj/harness.o")
}

build() {
  local name="$1"
  need_target "$name"
  build_runtime
  local ir="$FUZZ_OUT/ir/$name"
  rm -rf "$ir"
  mkdir -p "$ir" "$FUZZ_OUT/bin"
  if ! "$NISH" "tests/fuzz/targets/$name.ts" -o "$ir/" >"$ir.log" 2>&1; then
    cat "$ir.log" >&2
    die "$name: compile failed"
  fi
  # clang instruments only functions carrying `sanitize_address`, which the
  # compiler never emits, so every definition is given it here; without it the
  # compiled Nish code links under ASan uninstrumented. Every `define` line
  # ends `) {`, `) #N {` (an attribute group) or `) <attributes> {` (a raw
  # definition's inline list, such as `nounwind` or `"probe-stack"="inline-asm"`),
  # and the attribute is appended to whichever list is there. UBSan instruments
  # in clang's frontend, so it never reaches a .ll: the compiled code's own
  # bounds and division checks stand in for it. A define this misses fails the
  # build rather than going quiet. The check reads all of grep's output instead
  # of `grep -q`: under pipefail, -q's early exit SIGPIPEs the first grep, and
  # the pipeline's 141 read as "no miss", so a miss passed whenever the first
  # grep was still writing.
  sed -i -E 's/^(define .*\)( [^!{]*)?) \{$/\1 sanitize_address {/' "$ir"/*.ll
  if grep -h '^define ' "$ir"/*.ll | grep -v ' sanitize_address {$' >/dev/null; then
    die "$name: a define in $ir/ was not given sanitize_address"
  fi
  # A library build writes one module per source module, the std modules the
  # target imports included, and the link takes them all.
  "$CC" "${SAN_FLAGS[@]}" -Wno-override-module "$ir"/*.ll "${runtime_objs[@]}" -lm \
    -o "$FUZZ_OUT/bin/$name" || die "$name: link failed"
  echo "fuzz.sh: built $FUZZ_OUT/bin/$name"
}

# The directories of inputs a target is replayed over: its seed corpus and its
# regressions, those that exist.
input_dirs() {
  local d
  for d in "tests/fuzz/corpus/$1" "tests/fuzz/regressions/$1"; do
    [ -d "$d" ] && echo "$d"
  done
  return 0
}

replay() {
  local name="$1" dirs
  mapfile -t dirs < <(input_dirs "$name")
  if [ ${#dirs[@]} -eq 0 ]; then
    die "$name: no tests/fuzz/corpus/$name/ to replay"
  fi
  mkdir -p "$FUZZ_OUT/artifacts/$name"
  # -runs=0 runs each input once and fuzzes nothing; nothing is written to the
  # corpus directories.
  "$FUZZ_OUT/bin/$name" "${LIBFUZZER_DEFAULTS[@]}" -runs=0 \
    -artifact_prefix="$FUZZ_OUT/artifacts/$name/" "${dirs[@]}"
}

# Fuzz `name` with a scratch copy of its corpus as the first (written)
# directory, so the checked-in corpus only grows when someone copies inputs
# back by hand (tests/fuzz/README.md).
run() {
  local name="$1"
  shift
  local work="$FUZZ_OUT/work/$name" dirs
  mkdir -p "$work" "$FUZZ_OUT/artifacts/$name"
  mapfile -t dirs < <(input_dirs "$name")
  "$FUZZ_OUT/bin/$name" "${LIBFUZZER_DEFAULTS[@]}" \
    -artifact_prefix="$FUZZ_OUT/artifacts/$name/" "$@" "$work" "${dirs[@]}"
}

[ $# -ge 1 ] || usage
mode="$1"
shift
case "$mode" in
  --build)
    [ $# -eq 1 ] || usage
    build "$1"
    ;;
  --run)
    [ $# -ge 1 ] || usage
    name="$1"
    shift
    if [ $# -ge 1 ]; then
      [ "$1" = "--" ] || usage
      shift
    fi
    build "$name"
    run "$name" "$@"
    ;;
  --replay)
    if [ $# -eq 1 ]; then
      names=("$1")
    else
      [ $# -eq 0 ] || usage
      mapfile -t names < <(targets)
    fi
    for name in "${names[@]}"; do
      build "$name"
      replay "$name"
    done
    ;;
  --smoke)
    [ $# -eq 0 ] || usage
    mapfile -t names < <(targets)
    [ ${#names[@]} -gt 0 ] || die "no targets in tests/fuzz/targets/"
    [[ "$FUZZ_JOBS" =~ ^[1-9][0-9]*$ ]] || die "FUZZ_JOBS must be a positive integer, not '$FUZZ_JOBS'"
    # The lanes share the runtime objects, so they are built here, once,
    # before any lane starts: a lane that found them missing would build them
    # itself, into the same files as the others.
    build_runtime
    logs="$FUZZ_OUT/smoke"
    rm -rf "$logs"
    mkdir -p "$logs"
    # Each target is a lane writing its own log and, as it exits, its status,
    # so the logs are printed whole and in target order once every lane is
    # done, and one target's crash does not stop the others. The status comes
    # from an EXIT trap: the lane stops at its first failing step under
    # `set -e`, which a status written after the lane, or a lane run as a
    # condition, would not keep.
    running=0
    for name in "${names[@]}"; do
      if [ "$running" -ge "$FUZZ_JOBS" ]; then
        # A lane's status is read from its file below, not from here.
        wait -n || true
        running=$((running - 1))
      fi
      (
        status_file="$logs/$name.status"
        trap 'echo "$?" >"$status_file"' EXIT
        build "$name"
        replay "$name"
        rm -rf "$FUZZ_OUT/work/$name"
        run "$name" -seed="$FUZZ_SEED" -max_total_time="$FUZZ_SMOKE_SECONDS" -print_final_stats=1
      ) >"$logs/$name.log" 2>&1 &
      running=$((running + 1))
    done
    wait
    # Under GitHub Actions each target's log folds into a group of its own.
    group=""
    [ "${GITHUB_ACTIONS:-}" = true ] && group=1
    failed=()
    for name in "${names[@]}"; do
      [ -n "$group" ] && echo "::group::fuzz.sh: $name"
      cat "$logs/$name.log"
      [ -n "$group" ] && echo "::endgroup::"
      status="$(cat "$logs/$name.status" 2>/dev/null || echo missing)"
      [ "$status" = 0 ] || failed+=("$name (exit $status)")
    done
    if [ ${#failed[@]} -gt 0 ]; then
      echo "fuzz.sh: smoke failed in ${#failed[@]} of ${#names[@]} targets: ${failed[*]}" >&2
      exit 1
    fi
    echo "fuzz.sh: smoke passed over ${#names[@]} targets, $FUZZ_JOBS at a time"
    ;;
  -h | --help)
    usage 0
    ;;
  *)
    usage
    ;;
esac

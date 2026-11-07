#!/usr/bin/env bash
# End-to-end A/B of the challenge submission's HTTP workers, one arm a round.
# README.md in this directory says what the arms are, what each figure is and
# where it comes from.
#
#   bash bench/http1-e2e/run.sh setup              # clone the challenge, install the nish versions, build loadgen
#   bash bench/http1-e2e/run.sh build <arm>        # build the submission for one arm
#   bash bench/http1-e2e/run.sh seed               # the full seed database (conduit_seed), once
#   bash bench/http1-e2e/run.sh round <arm> <n>    # one measured round -> results/<machine>/<arm>-<n>.json
#   bash bench/http1-e2e/run.sh rounds "<arms>" <n>  # n rounds of each arm, interleaved A B C A B C ...
#   bash bench/http1-e2e/run.sh cachegrind <arm>   # one HTTP worker under cachegrind -> results/<machine>/<arm>-cg.json
#
# An arm is a nish version plus patches: A (0.34.1, the submission as pushed),
# B (0.35.0, the same source), C (0.35.0, patches/arm-c-sendbody.patch), and the
# knob arms K-<name> (arm B with patches/knob-<name>.patch applied to the
# installed 0.35.0 package's std/). ARM_NISH=<version|tarball> overrides an
# arm's compiler.
#
# Environment: WORK (scratch, default ~/http1-e2e-work), MACHINE (results
# label, default uname -m in kebab-case), PGHOST/PGPORT/PGUSER/PGPASSWORD (a Postgres
# superuser), USERS THINK RAMP MEASURE TAIL SKIP (the load; SKIP seconds are
# dropped at each end of the measure window), PERF=1 (perf-stat.sh over the
# window), TRACE=<seconds> (tracefs syscall and sched_switch trace of the HTTP
# workers inside the window). Nothing here changes the host's kernel settings.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${WORK:-$HOME/http1-e2e-work}"
CHALLENGE_REPO="${CHALLENGE_REPO:-https://github.com/amritk/multicore-server-challenge}"
CHALLENGE_REF="${CHALLENGE_REF:-ccr-54288e72-j5sj3b}"
SUB=submissions/nish-std-amritk
export MACHINE="${MACHINE:-$(uname -m | tr _ -)}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d postgres)
mkdir -p "$WORK"

arm_nish() {
  if [ -n "${ARM_NISH:-}" ]; then echo "$ARM_NISH"; return; fi
  case "$1" in
    A) echo 0.34.1 ;;
    B | C | K-*) echo 0.35.0 ;;
    *) echo "run.sh: unknown arm $1" >&2; exit 2 ;;
  esac
}

# The arm's compiler: its own prefix, so a knob's std patch touches no other arm.
nish_prefix() {
  local arm="$1" v prefix
  v="$(arm_nish "$arm")"
  case "$arm" in K-*) prefix="$WORK/nish-$arm" ;; *) prefix="$WORK/nish-$(basename "$v" .tgz)" ;; esac
  if [ ! -x "$prefix/bin/nish" ]; then
    case "$v" in *.tgz) npm install -g --prefix "$prefix" --no-audit --no-fund "$v" >&2 ;;
                 *) npm install -g --prefix "$prefix" --no-audit --no-fund "nish@$v" >&2 ;; esac
    case "$arm" in
      # The launcher package and its native package each carry std/: patch both.
      K-*) for d in "$prefix"/lib/node_modules/nish "$prefix"/lib/node_modules/nish/node_modules/@amritk/nish-*; do
             patch -d "$d" -p1 < "$HERE/patches/knob-${arm#K-}.patch" >&2
           done ;;
    esac
  fi
  echo "$prefix"
}

cmd_setup() {
  if [ ! -d "$WORK/challenge/.git" ]; then
    GIT_LFS_SKIP_SMUDGE=1 git clone -q "$CHALLENGE_REPO" "$WORK/challenge"
  fi
  git -C "$WORK/challenge" fetch -q --depth=30 origin "$CHALLENGE_REF"
  git -C "$WORK/challenge" checkout -q FETCH_HEAD
  (cd "$WORK/challenge/bench" && go build -o "$WORK/loadgen" ./cmd/loadgen)
  nish_prefix A > /dev/null
  nish_prefix B > /dev/null
}

cmd_build() {
  local arm="$1" prefix dir
  prefix="$(nish_prefix "$arm")"
  dir="$WORK/arm-$arm"
  rm -rf "$dir"
  cp -r "$WORK/challenge/$SUB" "$dir"
  case "$arm" in C) patch -d "$dir" -p1 < "$HERE/patches/arm-c-sendbody.patch" ;; esac
  # build.sh reads x86's `flags` line from /proc/cpuinfo under pipefail; an
  # aarch64 cpuinfo has none, so the grep fails and build.sh exits there
  # silently. Let it find nothing, and build baseline, as it means to.
  sed -i "s|cut -d: -f2) \"|cut -d: -f2 \|\| true) \"|" "$dir/build.sh"
  # Every arm is built with -g, so perf and cachegrind name its functions:
  # build.sh's own flags plus -g, which keeps the symbols the link would strip.
  # (build.sh stops at x86-64-v3, so valgrind 3.22, which cannot run AVX-512,
  # runs every x86 arm as built.)
  printf '#!/bin/sh\nexec "%s" "$@" -g\n' "$prefix/bin/nish" > "$WORK/nish-g-$arm"
  chmod +x "$WORK/nish-g-$arm"
  (cd "$dir" && NISH="$WORK/nish-g-$arm" CC="${CC:-clang-18}" bash build.sh > build.log 2>&1) || {
    tail -20 "$dir/build.log" >&2
    exit 1
  }
  echo "built arm $arm with $("$prefix/bin/nish" --version) -> $dir/bin/conduit"
}

cmd_seed() {
  (cd "$WORK/challenge" && bash seed/make-seed.sh)
}

fresh_db() {
  "${PSQL[@]}" -c "DROP DATABASE IF EXISTS conduit WITH (FORCE)" \
    -c "CREATE DATABASE conduit TEMPLATE conduit_seed STRATEGY FILE_COPY"
}

cmd_round() {
  local arm="$1" n="$2"
  fresh_db
  node "$HERE/round.mjs" --arm "$arm" --round "$n" --dir "$WORK/arm-$arm" \
    --loadgen "$WORK/loadgen" --nish "$(arm_nish "$arm")" \
    --out "${RESULTS:-$HERE/results/$MACHINE}/$arm-$n.json"
}

cmd_rounds() {
  local arms="$1" n="$2" i arm
  for i in $(seq 1 "$n"); do
    for arm in $arms; do cmd_round "$arm" "$i"; done
  done
}

cmd_cachegrind() {
  local arm="$1"
  fresh_db
  node "$HERE/round.mjs" --arm "$arm" --round cg --dir "$WORK/arm-$arm" \
    --loadgen "$WORK/loadgen" --nish "$(arm_nish "$arm")" --cachegrind "$WORK/cg-$arm" \
    --out "${RESULTS:-$HERE/results/$MACHINE}/$arm-cg.json"
}

case "${1:-}" in
  setup) cmd_setup ;;
  build) cmd_build "$2" ;;
  seed) cmd_seed ;;
  round) cmd_round "$2" "$3" ;;
  rounds) cmd_rounds "$2" "$3" ;;
  cachegrind) cmd_cachegrind "$2" ;;
  *) sed -n '2,25p' "$0"; exit 2 ;;
esac

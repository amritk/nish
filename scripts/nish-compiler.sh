# shellcheck shell=bash
# Sourced, not run: how a shell script turns a compiler path into a command.
#
#   . scripts/nish-compiler.sh
#   nish_compiler "${NISH:-build/nish}"
#   "${compiler[@]}" program.ts -o out.ll
#
# A Node entry point (.js, .mjs, .cjs) is run under node and anything else --
# a native `nish` -- directly. That is the rule `NISH_BOOTSTRAP` follows in
# scripts/bootstrap.sh and tests/self/seed.js follows as `NODE_ENTRY`, so one
# path names a compiler the same way to every tool. Bash, because the answer is
# an array: a compiler path with a space in it stays one word.
# shellcheck disable=SC2034 # `compiler` is the answer, read by the script that sourced this
nish_compiler() {
  case "$1" in
    *.js | *.mjs | *.cjs) compiler=(node "$1") ;;
    *) compiler=("$1") ;;
  esac
}

# `nish_allow_panics <command...>` sets the array `allow_panics` to
# `(--allow-panics)` when `<command> --help` lists that flag, and to `()` when
# it does not, so a build of a program that may panic on purpose -- src/, a
# test or a fuzz target, never an example a user would copy -- reads
#
#   nish_allow_panics "${compiler[@]}"
#   "${compiler[@]}" ${allow_panics[@]+"${allow_panics[@]}"} program.ts -o out.ll
#
# The `${allow_panics[@]+...}` spelling is for macOS's bash 3.2, which calls
# an empty array unbound under `set -u`. The flag is the one `ALLOW_PANICS_FLAG` in src/options.ts spells, and
# tests/allow-panics.js asks the same question for the test scripts. It is a
# probe, not "the seed never gets it": a released compiler older than the flag
# exits 2 on it, and a `NISH_BOOTSTRAP` seed can be any release. Once every
# supported seed accepts the flag, this function can go and its callers pass
# the flag directly. The help is read whole before it is searched, so the
# compiler never meets a closed pipe.
# shellcheck disable=SC2034 # `allow_panics` is the answer, read by the script that sourced this
nish_allow_panics() {
  local help
  help=$(NO_COLOR=1 "$@" --help 2>/dev/null) || help=""
  case "$help" in
    *--allow-panics*) allow_panics=(--allow-panics) ;;
    *) allow_panics=() ;;
  esac
}

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

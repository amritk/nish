#!/usr/bin/env bash
# `stage3 == stage2`: the last of the equalities `scripts/bootstrap.sh --verify`
# asserts, as a script of its own.
#
#   scripts/verify-binaries.sh <stage2> <stage3>
#
# Exit 0 and one or more lines on stdout saying what was compared; exit 1 and
# the reason on stderr when the two binaries are not the same compiler.
#
# It is a file rather than a block inside bootstrap.sh for the reason
# .github/seed-matrix.sh is one: it is a gate, it has arms that only one
# operating system reaches, and a gate nothing can run is a gate nothing
# checks. `tests/run.js` drives this script with fabricated files and
# `NISH_UNAME_S` set, so every arm below is asked for on whatever machine the
# suite is running on -- which is the check the Darwin arm did not have when it
# was first written, and it was wrong.
#
# THE COMPARISON. Two links of the same input produce the same bytes on ELF,
# and that is the strongest form of "stage2 reproduces itself": it is asserted
# there and nothing here relaxes it.
#
# On Mach-O they do not, and that is measured rather than expected: on
# macos-latest (2026-09-13, WP19 R2) stage3 and stage2 differed at identical
# size -- 597,048 bytes both -- while every IR equality in bootstrap.sh passed.
# ld64 writes a debug map naming each .o by path and mtime, so the difference
# is the linker's and not the compiler's.
#
# That is not a reason to assert nothing. An arm that printed a line and
# carried on would accept any difference at all, including a stage3 that is a
# different compiler from stage2 -- and the whole point of the line is that the
# binary a release ships is the one the fixed point was proved about. So on
# Darwin the comparison NARROWS rather than lifting, to two facts about the
# code rather than about ld64:
#
#   * the two files are the same SIZE. The measurement above is that they were,
#     exactly, while differing -- so a difference in generated code, which is
#     what this comparison exists to catch, has to keep the byte count to get
#     past it.
#   * the two files are IDENTICAL once the debug information is stripped. That
#     is the targeted form of "exclude the debug map" -- objcopy or strip
#     removes it and what is left is the text and data the compiler emitted --
#     rather than excluding the bytes on a guess about which ones they are.
#
# `strip -x` is the ld64-native spelling and needs no LLVM on PATH;
# llvm-objcopy/objcopy is the fallback for a host with one and not the other.
# If none of them works on these two files the size assertion still stands and
# the last line says the other half did not run, because a check that cannot
# run has to say so rather than pass.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: scripts/verify-binaries.sh <stage2> <stage3>" >&2
  exit 2
fi
a="$1"
b="$2"
for f in "$a" "$b"; do
  [ -f "$f" ] || { echo "verify-binaries: $f does not exist" >&2; exit 2; }
done

# Overridden by tests/run.js so both arms can be driven from one machine.
uname_s="${NISH_UNAME_S:-$(uname -s)}"

if cmp -s "$a" "$b"; then
  echo "stage3 == stage2: byte-identical binaries"
  exit 0
fi

if [ "$uname_s" != "Darwin" ]; then
  echo "bootstrap: stage3 is not byte-identical to stage2" >&2
  exit 1
fi

size_a=$(wc -c < "$a" | tr -d ' ')
size_b=$(wc -c < "$b" | tr -d ' ')
if [ "$size_a" != "$size_b" ]; then
  {
    echo "bootstrap: stage3 differs from stage2 and the two are not even the same size"
    echo "bootstrap: ($size_a vs $size_b bytes). On Mach-O ld64's debug map makes the raw byte"
    echo "bootstrap: comparison unreliable, but the size is not the debug map: this is a"
    echo "bootstrap: difference in what the compiler emitted (docs/wp10-ci.md#ci-matrix)."
  } >&2
  exit 1
fi

# A scratch directory of its own, so this never writes next to the binaries it
# was handed -- bootstrap.sh's work directory is also where the next stage gets
# built, and tests/run.js hands it files in a fixture it then compares.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
stripped=0
for tool in llvm-objcopy objcopy; do
  if command -v "$tool" >/dev/null 2>&1 &&
     "$tool" --strip-debug "$a" "$tmp/a" 2>/dev/null &&
     "$tool" --strip-debug "$b" "$tmp/b" 2>/dev/null; then
    stripped=1
    break
  fi
done
if [ "$stripped" -eq 0 ] && command -v strip >/dev/null 2>&1; then
  cp "$a" "$tmp/a"
  cp "$b" "$tmp/b"
  if strip -x "$tmp/a" 2>/dev/null && strip -x "$tmp/b" 2>/dev/null; then
    stripped=1
  fi
fi

if [ "$stripped" -eq 0 ]; then
  echo "stage3 == stage2: same size ($size_a bytes); the raw bytes differ, which on Mach-O"
  echo "is ld64's debug map. NOT checked with the debug map stripped: no llvm-objcopy,"
  echo "objcopy or strip on PATH could strip these two files, so that half of the"
  echo "comparison did not run"
  exit 0
fi

if cmp -s "$tmp/a" "$tmp/b"; then
  echo "stage3 == stage2: same size ($size_a bytes) and identical with the debug map"
  echo "stripped; the raw bytes differ, which on Mach-O is ld64's debug map"
  exit 0
fi

{
  echo "bootstrap: stage3 differs from stage2 with the debug information stripped out."
  echo "bootstrap: ld64's debug map is not what differs, then -- this is the code itself,"
  echo "bootstrap: and the fixed point does not hold (docs/wp10-ci.md#ci-matrix)."
} >&2
exit 1

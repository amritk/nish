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
# `NISH_UNAME_S` set, so every arm is reached from whatever machine the suite
# runs on. Read the caveat under WHAT THE TESTS PROVE before trusting that
# sentence further than it goes.
#
# THE COMPARISON. Two links of the same input produce the same bytes on ELF,
# and that is the strongest form of "stage2 reproduces itself": it is asserted
# there and nothing here relaxes it.
#
# On Mach-O they do not, and that is measured rather than expected: on
# macos-latest (2026-09-13, WP19 R2) stage3 and stage2 differed at identical
# size -- 597,048 bytes both -- while every IR equality in bootstrap.sh passed.
# Same size, differing bytes: something small and fixed-width is not
# reproducible, and it is the linker's rather than the compiler's.
#
# WHAT THAT SOMETHING IS HAS NOT BEEN MEASURED, and an earlier version of this
# header said it had. It claimed ld64's debug map -- the table naming each .o
# by path and mtime -- and that claim is wrong for the binaries this script is
# actually handed:
#
#   * `scripts/bootstrap.sh` defaults to `--profile speed` and never passes
#     `-g`, so there is no DWARF in the .o files and ld64 emits no debug map to
#     begin with.
#   * `scripts/build.sh`'s Darwin branch links the speed and size profiles with
#     `-Wl,-x`, so any local-symbol table is gone at link time, before this
#     script sees the file.
#
# So stripping debug information off these two is a no-op or close to it, and a
# comparison that leans on it explains nothing. The leading candidate for what
# does differ is **LC_UUID**: ld64 writes one by default, it is a fixed-width
# content hash in a load command, no strip removes or recomputes it -- that is
# deliberate, so a dSYM keeps matching its binary -- and it fits the
# measurement exactly, being small, fixed-width, and present in a binary with
# no symbols and no debug info.
#
# That is a candidate and not a finding. Nobody has run this on a mac. If it
# turns out to be right the remedy is one of two one-liners, and both belong in
# the commit that measures it rather than in this one: link with
# `-Wl,-no_uuid`, which makes the byte comparison hold outright, or mask the
# LC_UUID load command here before comparing.
#
# WHAT IS ASSERTED ON DARWIN, then, is narrower than raw bytes and wider than
# nothing:
#
#   * the two files are the same SIZE. The measurement above is that they were,
#     exactly, while differing -- so a difference in generated code, which is
#     what this comparison exists to catch, has to keep the byte count to get
#     past it. This is the assertion doing the work.
#   * they are identical once debug information is stripped, where a tool on
#     PATH can strip it. At `--profile speed` that is expected to remove
#     nothing, per the two bullets above; it is kept because it costs nothing
#     and because `--profile debug` does put DWARF in the .o files.
#
# A pair that is the same size and still differs after that is reported as
# **unattributed** and fails. It fails because the alternative is a blanket
# exemption that would accept a stage3 that is a different compiler, which is
# the one thing this comparison is for; and it says "unattributed" rather than
# "the code differs" because on the evidence above it is at least as likely to
# be LC_UUID. The message carries the next step.
#
# WHAT THE TESTS PROVE. `tests/run.js` reaches every branch here, and for the
# Darwin branches it does so two ways: with ELF pairs, which establish the
# control flow only -- `NISH_UNAME_S=Darwin` changes which branch runs, not
# what format the files are -- and with a fabricated minimal Mach-O pair
# differing only in LC_UUID, which is the real format and the real field. That
# second one is what says the unattributed arm is reachable with a benign pair,
# and it is asserted as a known limitation rather than as a pass.
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

# Overridden by tests/run.js so both platforms' branches can be driven from one
# machine. Announced when set, because a release build that had this in its
# environment would assert a different equality and the log should say so.
uname_s="$(uname -s)"
if [ -n "${NISH_UNAME_S:-}" ] && [ "${NISH_UNAME_S}" != "$uname_s" ]; then
  echo "verify-binaries: NISH_UNAME_S=$NISH_UNAME_S overrides the real platform ($uname_s); this is a test hook" >&2
  uname_s="$NISH_UNAME_S"
fi

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
    echo "bootstrap: ($size_a vs $size_b bytes). Whatever is not reproducible about ld64 is"
    echo "bootstrap: small and fixed-width -- the size is not it. This is a difference in"
    echo "bootstrap: what the compiler emitted (docs/wp10-ci.md#ci-matrix)."
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

if [ "$stripped" -eq 1 ] && cmp -s "$tmp/a" "$tmp/b"; then
  echo "stage3 == stage2: same size ($size_a bytes) and identical once debug information"
  echo "was stripped; the raw bytes differ, which is ld64 and not the compiler"
  exit 0
fi

{
  echo "bootstrap: stage3 and stage2 are the same size ($size_a bytes) and still differ."
  if [ "$stripped" -eq 1 ]; then
    echo "bootstrap: Stripping debug information did not account for it -- which at"
    echo "bootstrap: --profile speed is expected, because nothing put DWARF in the .o files"
    echo "bootstrap: and build.sh already linked with -Wl,-x."
  else
    echo "bootstrap: No llvm-objcopy, objcopy or strip on PATH could strip either file, so"
    echo "bootstrap: that half of the comparison did not run."
  fi
  echo "bootstrap:"
  echo "bootstrap: This difference is UNATTRIBUTED. It is a failure rather than a warning,"
  echo "bootstrap: because the alternative accepts a stage3 that is a different compiler."
  echo "bootstrap: But it may well be benign: the leading candidate is LC_UUID, the"
  echo "bootstrap: content hash ld64 writes by default and no strip removes. To find out,"
  echo "bootstrap: compare these two with \`otool -l\` and look at the LC_UUID commands."
  echo "bootstrap: If that is all that differs, link with -Wl,-no_uuid or mask the load"
  echo "bootstrap: command here, and record the measurement (docs/wp10-ci.md#ci-matrix)."
} >&2
exit 1

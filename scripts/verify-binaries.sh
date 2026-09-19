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
# On Mach-O they did not, and that was measured rather than expected: on
# macos-latest (2026-09-13, WP19 R2) stage3 and stage2 differed at identical
# size -- 597,048 bytes both -- while every IR equality in bootstrap.sh passed.
# Same size, differing bytes: something small and fixed-width was not
# reproducible, and it was the linker's rather than the compiler's.
#
# WHAT THAT SOMETHING WAS is now measured, and an earlier version of this
# header first claimed it wrongly and then said, correctly, that nobody had run
# it on a mac. Somebody has: a throwaway workflow ran release.yml's `binaries`
# steps on both darwin rows on 2026-09-19 and attributed every differing byte
# to the load command, section or linkedit blob it falls inside.
#
#   x86_64-darwin    649,808 bytes both, 16 differing, all at 0x468..0x478:
#   (macos-15-intel) LC_UUID's sixteen bytes of UUID, and nothing else in the
#                    file. `otool -l` diffed to the one `uuid` line.
#
#   aarch64-darwin   646,696 bytes both, 48 differing: the same sixteen at
#   (macos-latest)   0x468, plus 33 in the LC_CODE_SIGNATURE blob at 0x9ca81 --
#                    one SHA-256 code-directory slot. ld64 ad-hoc signs arm64
#                    (`codesign -dvvv`: adhoc,linker-signed) and that slot is
#                    the page hash of the page LC_UUID sits on, so the
#                    signature is the consequence and the UUID the cause. The
#                    Intel row, which ld64 does not sign at all, is the control
#                    for that claim.
#
# So LC_UUID it was, as this header had guessed. The remedy it proposed was
# wrong, and that is measured too: `-Wl,-no_uuid` does make the two files
# identical, and dyld on arm64 then refuses to load either of them -- `missing
# LC_UUID load command`, then SIGABRT -- so the stage links and will not start.
# An unloadable compiler is worse than any reproducibility, and ELF's
# `--build-id=none` has no Mach-O twin.
#
# WHAT SETTLED IT was one more measurement. Three links of one input by one
# compiler, on both rows -- twice to the same output path, once to a different
# one -- and what came back is that the UUID is STABLE ACROSS TWO LINKS TO ONE
# PATH and DIFFERS ON A LINK TO ANOTHER, with nothing else in the file moving.
# It is not a hash of the output's own content, then, which is what ld64
# classic did and what would have made any two links of one input agree.
#
# The output path is the leading explanation and it is not the only one the
# probe leaves standing. The two same-path links were invocations 1 and 2 and
# the differing-path link was invocation 3, and the probe never went back to
# the first path -- so path-identity and invocation-order are confounded, and
# anything that had changed by the third link (a coarse clock tick, a
# per-session counter, an intermediate name derived from the path rather than
# equal to it) fits the same numbers. A fourth link back to the first path,
# expected to reproduce the FIRST UUID, is the one line that would tell them
# apart, and it was not run.
#
# The remedy holds either way, which is why this is left as it is rather than
# guessed at: run 4 measured it end to end, with a real `bootstrap.sh --verify`
# on both darwin rows, and got byte-identical stages. Whatever LC_UUID is a
# function of, two stages linked at one path agree.
#
# That makes the failure the harness's rather than the toolchain's:
# `scripts/bootstrap.sh` linked stage2 at `$work/stage2` and stage3 at
# `$work/stage3`, so two compilers that agreed about every other byte were
# guaranteed two different UUIDs. It links both at `$work/stage` now and moves
# each into place afterwards, and both darwin rows reach the `cmp -s` above and
# stop at it. Nothing below was relaxed to get there.
#
# The debug map, which an even earlier version of this header named, was never
# it: bootstrap.sh defaults to `--profile speed` and never passes `-g`, so
# there is no DWARF in the .o files for ld64 to build a map from, and build.sh
# already dropped the local symbols at the link.
#
# WHAT IS ASSERTED ON DARWIN is therefore a net under a byte comparison that
# now holds, rather than the arm that decides a darwin row. It costs nothing
# while the two files are identical, and it is narrower than raw bytes and
# wider than nothing when some future toolchain starts varying something else:
#
#   * the two files are the same SIZE. The measurement above is that they were,
#     exactly, while differing -- so a difference in generated code, which is
#     what this comparison exists to catch, has to keep the byte count to get
#     past it. This is the assertion doing the work.
#   * they are identical once debug information is stripped, where a tool on
#     PATH can strip it. At `--profile speed` that is expected to remove
#     nothing, per the debug-map paragraph above; it is kept because it costs
#     nothing and because `--profile debug` does put DWARF in the .o files.
#
# A pair that is the same size and still differs after that is reported as
# **unattributed** and fails. It fails because the alternative is a blanket
# exemption that would accept a stage3 that is a different compiler, which is
# the one thing this comparison is for; and it says "unattributed" rather than
# "the code differs" because the one thing ld64 was measured to vary is already
# accounted for by the shared link path, so what is left is unknown rather than
# damning. The message carries the next step.
#
# WHAT THE TESTS PROVE. `tests/run.js` reaches every branch here, and for the
# Darwin branches it does so two ways: with ELF pairs, which establish the
# control flow only -- `NISH_UNAME_S=Darwin` changes which branch runs, not
# what format the files are -- and with a fabricated minimal Mach-O pair
# differing only in LC_UUID, which is the real format and the real field. That
# second one is what says the unattributed arm is reachable with a benign pair,
# and it is asserted as a known limitation rather than as a pass. It stays a
# limitation of this script, and it has stopped describing what a bootstrap
# produces: the stages still carry an LC_UUID each, and bootstrap.sh links them
# at one path, so the two agree and there is no such pair to forgive.
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
  echo "bootstrap: The one thing ld64 was measured to vary here is LC_UUID -- and on arm64"
  echo "bootstrap: the code-directory slot that hashes the page it sits on. It was stable"
  echo "bootstrap: across two links to one path, which is why scripts/bootstrap.sh links"
  echo "bootstrap: every comparable stage at one path, and that was measured to hold end to"
  echo "bootstrap: end. So either these two were not built that way, which \`otool -l\` will"
  echo "bootstrap: show by disagreeing about the uuid, or ld64 is varying something new."
  echo "bootstrap: Attribute the differing bytes before changing anything, the way the"
  echo "bootstrap: first measurement was made (docs/wp10-ci.md#ci-matrix)."
} >&2
exit 1

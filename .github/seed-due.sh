#!/usr/bin/env bash
# Which seed targets a given version's release attaches, as JSON on stdout.
#
#   .github/seed-due.sh 0.3.0     the rows of .github/seed-targets.json whose
#                                 `attachedSince` is <= 0.3.0, as a JSON array
#
# One script because there is one question, asked from two sides:
#
#   * release.yml asks it about the version it is releasing, and builds a
#     `binaries` matrix row for each answer. That is what makes the asset list
#     a derivation rather than a list -- nothing in that workflow spells a
#     triple.
#   * .github/seed-matrix.sh asks it about the LAST RELEASE's version, to tell
#     the two kinds of absent seed apart: a target that was due and is missing
#     is a broken gate and fails, a target not yet due is a platform with no
#     bootstrap row and nothing is wrong.
#
# Asked from two sides and answered in two places, it would be the same defect
# `seed-targets.json` exists to prevent one level up: two comparisons that
# agree until one of them is edited. The version is the argument rather than
# something this script discovers, because the two callers mean different
# versions by it and that is the whole distinction.
#
# `attachedSince` is a version and not a boolean for the reason the JSON's note
# gives at length: a boolean says "the workflow builds this today", `seeds`
# needs "the release carried this", and the release is a past event. Flipping a
# boolean and teaching release.yml to build the asset cannot happen in one
# commit, because the release that would carry it is `needs: ci` on the job the
# flipped boolean turns red.
set -euo pipefail

cd "$(dirname "$0")/.."

targets=.github/seed-targets.json

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: .github/seed-due.sh <version>   (e.g. 0.3.0, without the leading v)" >&2
  exit 2
fi
version="${1#v}"

# Dotted integers only. A version this cannot parse must stop the run rather
# than sort oddly: every caller is deciding whether a missing release asset is
# a failure, and "0.3.0-rc1 looked smaller than 0.3.0" is the wrong way to find
# out that the scheme changed.
if ! printf '%s' "$version" | grep -Eq '^[0-9]+(\.[0-9]+)*$'; then
  echo "seed-due: '$version' is not a dotted-integer version; teach this script the new scheme before releasing it" >&2
  exit 2
fi

# jq compares arrays element by element, so [0,2,0] <= [0,3,0] without a
# hand-rolled semver sort -- and without `sort -V`, which is GNU-only and this
# runs on macOS too (tests/run.js drives it there).
jq -c --arg v "$version" '
  def semver: split(".") | map(tonumber);
  def due($a): ($a | type) == "string" and ($a | test("^[0-9]+(\\.[0-9]+)*$"));
  [ .targets[]
    | if due(.attachedSince) then .
      else error("seed-due: \(.asset) has no dotted-integer attachedSince")
      end
    | select((.attachedSince | semver) <= ($v | semver)) ]
' "$targets"

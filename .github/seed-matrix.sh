#!/usr/bin/env bash
# Which seeds the last release attaches, as the matrix of ci.yml's `bootstrap`
# job (WP19 G3). Reads .github/seed-targets.json; writes `rows` to
# $GITHUB_OUTPUT as a JSON array, one object per seed that actually exists.
#
# It is a file rather than a `run:` block because it is the gate, and a gate
# nothing can run is a gate nothing checks. `tests/run.js`'s WP19 seed-target
# block drives this script against a stand-in for `gh` and asks it for each of
# the states below -- which is the check that was missing when the "no seed"
# branch was turned from a failure into a warning, and again when it was turned
# from a warning into a failure for a state in which nothing is wrong.
#
# There are three answers here and only two colours, so the job this feeds is
# one of a pair and this script decides which of them says what:
#
#   * A target already DUE at the last release's version -- its
#     `attachedSince` is that version or older, which `.github/seed-due.sh`
#     decides -- is one that release attaches. A release that does not carry it
#     means the freeze went unchecked on a platform that could have checked it,
#     and that is a failure here -- exit 1, red, and red for the release
#     workflow that runs this one through `needs: ci`. The annotation carries
#     the recovery, because that red also blocks the release that would fix it.
#
#   * A target not yet due at that version gets no row. Nothing runs, nothing
#     passes, and no green check claims a freeze that nothing checked
#     (docs/wp19-stage0-retirement.md §A5 is what that costs when it is told
#     the other way round). This is the state of every target whose
#     `attachedSince` is newer than the last release -- the darwin pair and
#     aarch64-linux against v0.2.0, until the release that carries them.
#
#     `attachedSince` is a version rather than the boolean that used to stand
#     here, and the difference is the whole reason this arm can be reached at
#     all. A boolean says "release.yml builds this today"; this script needs
#     "the last release carried this", and a release is a past event. So the
#     commit that taught release.yml to build the darwin pair could not also
#     flip their boolean: v0.2.0 does not carry them, this job would go red,
#     and release.yml's `release` job is `needs: ci` -- the release that would
#     carry them could not be cut. That is a deadlock rather than a gate, and
#     a version is what tells the two states apart without one.
#
#   * Before the first release there is no seed anywhere and no row for
#     anything. That is the second case for every platform at once, and it must
#     not be red: release.yml's `release` job is `needs: ci`, so a red CI is a
#     release that cannot be cut, and the first release is the one that would
#     supply the seed this gate is waiting for. It is also every fork of this
#     repository on the day it is forked.
#
# The whole matrix is the release's answer rather than a list in ci.yml, so a
# platform's row appears the day a release carries its seed and not before.
#
# Which is worth reading twice, because it is presence and not `attachedSince`
# that builds a row: the check below looks for the tarball first. So the release
# that first carries a seed gives that platform a `bootstrap` row on every push
# and every pull request afterwards -- an LLVM install, bootstrap.sh --verify
# and the CLI contract, on hardware that may never have run any of it. If that
# row is red, `ci` is red and release.yml's `release` job is `needs: ci`, and
# rolling `attachedSince` back does not help: the asset is already attached.
# Fixing the row or deleting the asset are the only two ways out. Exercise a
# platform's rows before its attachedSince arrives -- .github/seed-targets.json
# says so at more length, under BEFORE ADDING A PLATFORM.
set -euo pipefail

cd "$(dirname "$0")/.."

targets=.github/seed-targets.json
out="${GITHUB_OUTPUT:-/dev/null}"

# Always consumes its input, so that a run outside Actions -- the test harness,
# or a developer asking what the last release carries -- is not a broken pipe.
summary() {
  cat >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

tag="$(gh release list --limit 1 --json tagName --jq '.[0].tagName // ""')"
if [ -z "$tag" ]; then
  echo "::notice::No release exists yet, so there is no seed on any platform and the rolling freeze is unchecked everywhere. Nothing is wrong: it starts being checked at the first release, and this job is green rather than red because a red CI is a release that cannot be cut. No bootstrap row runs, so nothing here claims the freeze held. No nish-cmp row runs either, for the same reason and with the same consequence: there is no released compiler to compare HEAD against."
  echo "rows=[]" >> "$out"
  # Both outputs are written in every arm that exits 0. An output this script
  # never sets is the empty string rather than `[]`, and `!= '[]'` is true of
  # it -- so a job keyed on the unset value asks GitHub to evaluate an empty
  # matrix, which is an error and not a skip. That is the same shape as the
  # deadlock the header describes, arriving as a red X on the first release
  # instead of a grey square.
  echo "cmp=[]" >> "$out"
  summary <<'EOF'
### Seeds

No release exists yet, so the rolling freeze (WP19 G3) is **not checked** on any
platform, and no `bootstrap` row runs. That is the state before the first
release and in a fresh fork; it is not a failure, because `release.yml`'s
`release` job is `needs: ci` and the first release is what supplies the seed.
EOF
  exit 0
fi

version="${tag#v}"

# `gh release list --limit 1` returns the newest release whatever its shape,
# prereleases included, so the newest tag may be one seed-due.sh cannot order --
# `v0.3.0-rc1`. That has to fail, because guessing an order is how a missing
# seed gets excused; but it has to fail EXPLAINING ITSELF, because this job is
# `needs: ci` for the release workflow and a red check whose only output is on
# stderr is a release nobody can see the reason for. The `missing` branch below
# sets that standard and this matches it.
if ! bash .github/seed-due.sh "$version" >/dev/null 2>&1; then
  echo "::error::The newest release is $tag, and .github/seed-due.sh cannot order '$version' against the attachedSince versions in .github/seed-targets.json -- it takes dotted integers, and a prerelease or a tag of another shape is not one. This job reads the NEWEST release (\`gh release list --limit 1\`), so a prerelease at the head of the list stops it. Either teach seed-due.sh the new scheme, or do not leave a tag of that shape as the newest release: this check is red until one of those happens, and release.yml's release job is needs: ci."
  exit 1
fi

# One question to the release, answered as a list of names, so that "the
# release does not carry this" is read from what it carries rather than from a
# download that failed for some other reason.
assets="$(gh release view "$tag" --json assets --jq '.assets[].name')"

rows='[]'
missing=''
checked=''
unchecked=''

# Which targets that release was supposed to carry, asked of the one script
# that compares versions (.github/seed-due.sh). `due` is the list of assets;
# everything else in the file is a platform whose first release has not
# happened yet, and a missing asset there is the second state rather than the
# first.
due="$(bash .github/seed-due.sh "$version" | jq -r '.[].asset')"

count="$(jq '.targets | length' "$targets")"
i=0
while [ "$i" -lt "$count" ]; do
  row="$(jq -c ".targets[$i]" "$targets")"
  asset="$(printf '%s' "$row" | jq -r '.asset')"
  since="$(printf '%s' "$row" | jq -r '.attachedSince')"
  tarball="nish-$version-$asset.tar.gz"
  if printf '%s\n' "$assets" | grep -qxF "$tarball"; then
    rows="$(printf '%s' "$rows" |
      jq -c --argjson row "$row" --arg tag "$tag" --arg tarball "$tarball" \
        '. + [$row + {tag: $tag, tarball: $tarball}]')"
    checked="$checked $asset"
  elif printf '%s\n' "$due" | grep -qxF "$asset"; then
    missing="$missing $tarball"
  else
    unchecked="$unchecked $asset:$since"
  fi
  i=$((i + 1))
done

if [ -n "$missing" ]; then
  echo "::error::$tag attaches no$missing, and release.yml builds that seed at this version (.github/seed-targets.json gives it an attachedSince of $tag or older). Nothing can check the rolling freeze on that platform without it, so this fails rather than warns: see docs/wp19-stage0-retirement.md G3. To get unstuck, attach the asset to $tag or delete the release, before cutting another -- this check is red until one of those happens, and release.yml's release job is needs: ci. Note that lowering that target's attachedSince does NOT clear this, and neither does raising it: the row below is built from what the release CARRIES, so once an asset is attached its bootstrap row exists regardless of the version, and once it is missing this branch fires regardless of the version. The asset and the release are the two things to change."
  exit 1
fi

echo "rows=$rows" >> "$out"

# Which of those rows `nish-cmp` runs on (WP19 G2.1), which is two questions.
#
# WHICH PLATFORM. The tool compiles the whole corpus twice on one host -- with
# the last released `nish` and with the compiler HEAD builds -- and requires
# every byte to match, so what it wants is a seed rather than a platform
# sweep. It is the successor to `ir_oracle.js` and `interop_oracle.js`, which
# run on Linux and die with stage0 (docs/wp19-stage0-retirement.md §2B), so
# the Linux rows are the ones it inherits. macOS is left out on a measurement
# rather than a preference: the checks that keep `macos-latest` out of the
# `test` matrix encode an ELF assumption (§5a item 3), and a gate is the wrong
# place to discover that. Derived from `rows` rather than named, so a Linux
# platform whose first release lands later gets a `nish-cmp` row the day it
# gets a `bootstrap` one, with no edit here or to ci.yml.
#
# WHICH RELEASE. `cmpSince` in .github/seed-targets.json, compared the way
# `attachedSince` is and for the same reason -- a release already published
# cannot grow a file. The seeds 0.1.1 through 0.4.0 ship no std/, so against
# any of them the tool correctly reports two corpus programs on which HEAD is
# right and the seed is broken. That is a defect in what was published, not a
# difference anybody can fix in the tree, so this gate gets no row until a
# release carries a seed that can compile the corpus -- an absent row saying
# no comparison happened, where a green one with those two programs allowlisted
# would say one happened and passed. The JSON's note has the reasoning at
# length and the recovery.
cmp_since="$(jq -r '.cmpSince // empty' "$targets")"
if [ -z "$cmp_since" ]; then
  echo "::error::.github/seed-targets.json has no cmpSince, so nothing decides which releases nish-cmp (WP19 G2.1) may compare against. Add it: it is a dotted-integer version, read the note beside it."
  exit 1
fi
# Its shape is checked before it is compared, and separately, so that a
# cmpSince nobody can order is RED rather than quietly "no row". Folded into
# the comparison below it would be indistinguishable from a seed that is
# simply too old -- the job would go grey and the notice would give the wrong
# reason, which is worse than either colour on its own. This is seed-due.sh's
# rule for `attachedSince` applied to the sibling field, and `tests/run.js`
# asserts the same shape against the file so an edit is normally caught there
# first; this is the arm for an edit that reaches a runner anyway.
if ! printf '%s' "$cmp_since" | grep -Eq '^[0-9]+(\.[0-9]+)*$'; then
  echo "::error::.github/seed-targets.json sets cmpSince to '$cmp_since', which is not a dotted-integer version, so nothing can decide whether $tag's seed may be compared against (WP19 G2.1). Fix the field: guessing an order is how a gate gets skipped for a reason nobody wrote down. This check is red until it is, and release.yml's release job is needs: ci."
  exit 1
fi
# The same array-wise jq comparison seed-due.sh makes, for the same reason it
# is not `sort -V`: that is GNU-only and this runs on macOS too.
if jq -e -n --arg v "$version" --arg since "$cmp_since" \
  'def semver: split(".") | map(tonumber);
   ($since | semver) <= ($v | semver)' >/dev/null; then
  cmp="$(printf '%s' "$rows" | jq -c '[.[] | select(.runner | startswith("ubuntu"))]')"
else
  cmp='[]'
  echo "::notice::nish-cmp (WP19 G2.1) does not run against $tag: .github/seed-targets.json sets cmpSince to $cmp_since, and a seed older than that cannot compile the corpus -- the releases before it ship no std/, so every nish/<module> specifier is refused. No row runs, and nothing here claims the comparison passed. The first release at or after $cmp_since gives this gate a row with no edit to ci.yml."
fi
echo "cmp=$cmp" >> "$out"
echo "::notice::Seeded from $tag. The rolling freeze is checked on:$checked. Not yet due at $tag, so it is NOT checked on:${unchecked:- (nothing)} -- each of those is written <asset>:<attachedSince>, and its row appears here on the first release at or after that version."

{
  echo "### Seeds on $tag"
  echo
  echo "| Seed | Rolling freeze |"
  echo "| --- | --- |"
  for asset in $checked; do echo "| \`$asset\` | checked: \`bootstrap ($asset)\` builds \`self/\` with it |"; done
  for pair in $unchecked; do
    echo "| \`${pair%%:*}\` | **not checked** — not attached until ${pair##*:}, so this release carries no seed |"
  done
} | summary

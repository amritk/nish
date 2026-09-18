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
  echo "::notice::No release exists yet, so there is no seed on any platform and the rolling freeze is unchecked everywhere. Nothing is wrong: it starts being checked at the first release, and this job is green rather than red because a red CI is a release that cannot be cut. No bootstrap row runs, so nothing here claims the freeze held."
  echo "rows=[]" >> "$out"
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

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
#   * A target marked `attached` is one release.yml builds. A release that does
#     not carry it means the freeze went unchecked on a platform that could
#     have checked it, and that is a failure here -- exit 1, red, and red for
#     the release workflow that runs this one through `needs: ci`. The
#     annotation carries the recovery, because that red also blocks the release
#     that would fix it.
#
#   * A target that is not `attached` yet -- the darwin pair and
#     aarch64-linux, until WP19 G5 builds them -- gets no row. Nothing runs,
#     nothing passes, and no green check claims a freeze that nothing checked
#     (docs/wp19-stage0-retirement.md §A5 is what that costs when it is told
#     the other way round).
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
# One question to the release, answered as a list of names, so that "the
# release does not carry this" is read from what it carries rather than from a
# download that failed for some other reason.
assets="$(gh release view "$tag" --json assets --jq '.assets[].name')"

rows='[]'
missing=''
checked=''
unchecked=''

count="$(jq '.targets | length' "$targets")"
i=0
while [ "$i" -lt "$count" ]; do
  row="$(jq -c ".targets[$i]" "$targets")"
  asset="$(printf '%s' "$row" | jq -r '.asset')"
  attached="$(printf '%s' "$row" | jq -r '.attached')"
  tarball="nish-$version-$asset.tar.gz"
  if printf '%s\n' "$assets" | grep -qxF "$tarball"; then
    rows="$(printf '%s' "$rows" |
      jq -c --argjson row "$row" --arg tag "$tag" --arg tarball "$tarball" \
        '. + [$row + {tag: $tag, tarball: $tarball}]')"
    checked="$checked $asset"
  elif [ "$attached" = "true" ]; then
    missing="$missing $tarball"
  else
    unchecked="$unchecked $asset"
  fi
  i=$((i + 1))
done

if [ -n "$missing" ]; then
  echo "::error::$tag attaches no$missing, and release.yml builds that seed (.github/seed-targets.json marks it attached). Nothing can check the rolling freeze on that platform without it, so this fails rather than warns: see docs/wp19-stage0-retirement.md G3. To get unstuck, attach the asset to $tag or delete the release, before cutting another -- this check is red until one of those happens, and release.yml's release job is needs: ci."
  exit 1
fi

echo "rows=$rows" >> "$out"
echo "::notice::Seeded from $tag. The rolling freeze is checked on:$checked. No seed exists yet, so it is NOT checked on:${unchecked:- (nothing)} -- those rows appear here when WP19 G5 attaches those binaries."

{
  echo "### Seeds on $tag"
  echo
  echo "| Seed | Rolling freeze |"
  echo "| --- | --- |"
  for asset in $checked; do echo "| \`$asset\` | checked: \`bootstrap ($asset)\` builds \`self/\` with it |"; done
  for asset in $unchecked; do echo "| \`$asset\` | **not checked** — no seed on this release (WP19 G5) |"; done
} | summary

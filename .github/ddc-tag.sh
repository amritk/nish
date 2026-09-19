#!/usr/bin/env bash
# Whether this release may carry a `ddc` tag, and what it is named (WP19 G6).
#
#   .github/ddc-tag.sh 0.3.0     cut ddc-0.3.0 at the commit being released,
#                                or refuse and say why
#
# G6 is the cheapest gate in docs/wp19-stage0-retirement.md and the only one
# that cannot be recovered after the fact. The tag marks the last commit at
# which `IR(stage0, self/) == IR(stage1, self/)` and the fixed point both hold,
# and once R6 deletes `src/` there is no commit left that has the property to
# tag. A step somebody remembers is therefore the wrong mechanism: it is
# remembered at every release except the one where it was not, and that release
# is the one after which nothing can be said about diverse double-compiling at
# all (§6.1). So the release cuts the tag, on the run whose own jobs proved the
# property, and this script is what decides whether it may.
#
# It is a file rather than a `run:` block for the reason .github/seed-matrix.sh
# is one: this is a gate, and a gate nothing can run is a gate nothing checks.
# §G3 records the two times this repository wrote logic of exactly this class as
# inline shell in a workflow where nothing could reach it, and both corrections
# were a script driven from `tests/run.js` through every arm. The WP19 ddc-tag
# block there drives this one against a stand-in for `git`, so each answer below
# is reached from whatever machine the suite runs on.
#
# **This script proves nothing and must not grow a proof.** What proves the
# property is `tests/self/bootstrap.js`, which `npm test` runs in the `ci` job,
# and `scripts/bootstrap.sh --verify` with stage0 as the seed, which every row
# of the `binaries` job runs -- stage0 is the one seed for which
# `IR(seed) == IR(stage1)` is asserted rather than reported, because there it is
# two independently written implementations of one revision agreeing rather than
# one implementation at two dates (G3, and docs/wp12-release.md "The bootstrap
# seed"). This script reads whether those jobs succeeded. DDC_PROOF carries
# their results as whitespace-separated `<job>:<result>` pairs taken from
# `needs.<job>.result`, and every pair has to say `success`: a job that did not
# run reports an empty result, and a `needs:` edited to drop one reports nothing
# at all, which is the same answer -- the proof did not run -- and neither may
# tag. A tag on a release whose bootstrap did not prove the property is worse
# than no tag, because it is a claim nobody can falsify afterwards.
#
# The five answers:
#
#   * **The tag is due.** Every named job succeeded, the version is one a tag
#     can be named after, and the remote carries no `ddc` tag for it. The tag is
#     cut at the commit the release is built from and pushed. Exit 0.
#
#   * **The tag is already there, at this commit.** A re-run of the release --
#     `gh release create` failed and somebody ran the workflow again -- must not
#     be turned into a failure by the step that already did its job. Nothing is
#     cut, and this is green.
#
#   * **The tag is already there, at another commit.** Two commits claim one
#     version, and moving a tag that CI has already built is what
#     docs/wp12-release.md refuses to do for `v*` tags. Red, with the recovery
#     in the annotation, because a provenance tag that silently moved is worth
#     less than no tag.
#
#   * **The proof did not run.** Red, and nothing is cut. Note what makes this
#     arm live rather than theoretical: the release job graph puts this job
#     after `ci` and `binaries`, so their results are `success` whenever it runs
#     at all -- but `${{ needs.<job>.result }}` for a job this one does not
#     `needs:` evaluates to the empty string rather than to an error, so a
#     `needs:` list edited down is a release that would tag without a proof and
#     this is what stops it.
#
#   * **The version is not one a tag can be named after**, or there is no commit
#     to point the tag at. Both are the workflow handing this script something
#     other than a release, and both are red rather than a tag named after it.
#
# The tag is cut **before** `gh release create` publishes, which is the one
# ordering choice here with a cost either way. A release that then fails to
# publish leaves a `ddc` tag naming a commit at which the property did hold --
# true, harmless, and green on the re-run by the second arm above. The other
# order loses the tag exactly when the publish is the last thing standing
# between that commit and nobody being able to name it.
#
# Lightweight rather than annotated, deliberately: an annotated tag needs a
# tagger identity this job has no honest one for, and what the tag has to carry
# is the commit. The paragraph that says what it means is G6 itself, which is
# where the re-verification procedure lives.
set -euo pipefail

cd "$(dirname "$0")/.."

# The decision, as a value rather than as prose: `tag` is what this release's
# tag is (or would have been) called and `created` says whether this run is what
# cut it. The annotations below are what a person reads; this is what
# `tests/run.js` reads, and what a later step would name the tag from rather
# than spelling the derivation a second time.
out="${GITHUB_OUTPUT:-/dev/null}"

# Always consumes its input, so that a run outside Actions -- the test harness,
# or somebody asking what this release would decide -- is not a broken pipe.
summary() {
  cat >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: .github/ddc-tag.sh <version>   (e.g. 0.3.0, without the leading v)" >&2
  exit 2
fi
version="${1#v}"

# Dotted integers, with a prerelease suffix allowed because a prerelease proves
# the property exactly as a release does and `ddc-0.3.0-rc1` names its commit
# perfectly well. What this refuses is a branch name, which is what
# GITHUB_REF_NAME holds when the workflow is dispatched at one -- the `targets`
# job refuses that first, and this is the same guard next to the step that would
# otherwise stamp it into a permanent tag.
if ! printf '%s' "$version" | grep -Eq '^[0-9]+(\.[0-9]+)*(-[0-9A-Za-z.]+)?$'; then
  echo "created=false" >> "$out"
  echo "::error::.github/ddc-tag.sh was handed '$1', which is not a version a tag can be named after. This runs on a v* tag and takes GITHUB_REF_NAME without its leading v; a branch name reaching it means the workflow was dispatched at a branch. No ddc tag is cut."
  exit 1
fi

tag="ddc-$version"
echo "tag=$tag" >> "$out"

# Every job the release ran to prove the property, and what it answered. The
# pairs are the argument rather than something this script discovers, because
# only the workflow knows which jobs those were -- and because an empty answer
# is the whole point: it is what a dropped `needs:` produces.
proof="${DDC_PROOF:-}"
unproved=''
jobs=0
for pair in $proof; do
  jobs=$((jobs + 1))
  case "$pair" in
    *:success) ;;
    *:*) result="${pair#*:}"; unproved="$unproved ${pair%%:*}=${result:-(no result)}" ;;
    *) unproved="$unproved $pair=(no result)" ;;
  esac
done

if [ "$jobs" -eq 0 ] || [ -n "$unproved" ]; then
  named="${unproved:- (DDC_PROOF is empty, so no job claims to have proved anything)}"
  echo "created=false" >> "$out"
  echo "::error::No $tag tag: the run that would carry it did not prove IR(stage0, self/) == IR(stage1, self/) and the fixed point. What answered:$named. That proof is tests/self/bootstrap.js in the ci job and scripts/bootstrap.sh --verify in every binaries row, and DDC_PROOF is their needs.<job>.result -- an empty result means the job did not run, and a job missing from the list means this job's needs: no longer names it. A tag cut here would be a provenance claim nobody could falsify later, which is worse than no tag (docs/wp19-stage0-retirement.md G6), so this is red and nothing is cut."
  summary <<EOF
### Provenance (WP19 G6)

No \`$tag\` tag. The jobs that prove
\`IR(stage0, self/) == IR(stage1, self/)\` and the fixed point answered:$named.
Nothing is tagged, because a \`ddc\` tag on a release that did not prove the
property is a claim nobody can check afterwards.
EOF
  exit 1
fi

# The commit the release is built from. GITHUB_SHA is the tag's commit on both
# of this workflow's triggers; resolving it rather than trusting it is what
# catches a checkout that does not contain it, which would otherwise be a tag
# pointing at nothing.
if ! sha="$(git rev-parse --verify "${GITHUB_SHA:-HEAD}^{commit}" 2>/dev/null)" || [ -z "$sha" ]; then
  echo "created=false" >> "$out"
  echo "::error::No $tag tag: this checkout has no commit at '${GITHUB_SHA:-HEAD}' to point it at. The tag names the commit the release is built from, so there is nothing to cut until the checkout carries it."
  exit 1
fi

# Asked of the remote rather than of this clone, because the remote is where the
# tag would be pushed and because actions/checkout fetches no tags at its
# default depth -- a local answer would report "no tag" for a tag that is there,
# turn a re-run into the first arm, and fail at the push instead of passing
# here.
#
# Two patterns, not one, and the second is not decoration. A tag cut by hand is
# usually annotated, and an annotated tag is an object of its own: the line for
# `refs/tags/<tag>` then carries the TAG OBJECT's sha and the commit appears
# only on a second line named `refs/tags/<tag>^{}`. `ls-remote` matches its
# patterns against the whole ref name, so asking for `refs/tags/<tag>` alone
# returns the first line and not the second -- and comparing a tag object's sha
# against a commit's says "this tag is on another commit" about a tag that is on
# this one. Measured on git 2.43: one pattern answers one line, both answer two.
# With `release` needing this job that mistake is a release nobody can cut, so
# the peeled ref is asked for by name. A lightweight tag has no second line and
# the extra pattern simply matches nothing.
#
# A question that could not be ASKED is not an answer of "no tag": treating a
# failed `ls-remote` as an empty remote turns the idempotent re-run above into a
# push the remote rejects, and the job would then blame a concurrent run for
# what was a network error. git's own message is on stderr and reaches the log.
if ! remote="$(git ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}")"; then
  echo "created=false" >> "$out"
  echo "::error::No $tag tag: this job could not ask the remote whether one already exists -- git's message is above. Nothing is cut, because a tag cut without that answer is either a duplicate of one already there or a second claim on a commit that already has one. Re-run this job once the remote can be reached; if $tag is already cut at this release's commit the re-run is green and there is nothing to repair."
  exit 1
fi
tagged=''
while IFS=$'\t' read -r line_sha line_ref; do
  [ -n "${line_ref:-}" ] || continue
  case "$line_ref" in
    "refs/tags/$tag^{}") tagged="$line_sha" ;;
    "refs/tags/$tag") [ -n "$tagged" ] || tagged="$line_sha" ;;
  esac
done <<EOF
$remote
EOF

if [ "$tagged" = "$sha" ]; then
  echo "created=false" >> "$out"
  echo "::notice::$tag is already cut at $sha, which is the commit this release is built from. Nothing to do: this is a re-run of a release that already recorded its provenance, and re-cutting a tag it already has would fail the release rather than protect anything (docs/wp19-stage0-retirement.md G6)."
  summary <<EOF
### Provenance (WP19 G6)

\`$tag\` was already cut at \`$sha\`, the commit this release is built from.
This run changed nothing.
EOF
  exit 0
fi

if [ -n "$tagged" ]; then
  echo "created=false" >> "$out"
  echo "::error::$tag already exists and points at $tagged, but this release is built from $sha. Two commits cannot both be the last one at which IR(stage0, self/) == IR(stage1, self/) held for $version, and a provenance tag that moved is worth less than none: G6's procedure checks out the tag and re-runs the proof there. Nothing is cut. Either this version was released once already -- in which case release a new patch version rather than rebuilding this one (docs/wp12-release.md) -- or delete $tag, decide which commit it belongs on, and run this again."
  exit 1
fi

# One guard for both, because the failure they share is the one worth naming: a
# `ddc` tag that appeared between the question above and this push -- a human
# cutting one by hand, or a second run of this workflow that the concurrency
# group did not serialise. git says so on stderr and this says which release it
# happened during, rather than ending the job on a bare exit status.
if ! git tag "$tag" "$sha" || ! git push origin "refs/tags/$tag"; then
  echo "created=false" >> "$out"
  echo "::error::$tag could not be cut at $sha, although no tag of that name existed when this job asked the remote. Something cut one in between -- another run of this workflow, or a tag pushed by hand. Read git's message above, check what $tag now points at, and re-run this job: if it points at $sha the re-run is green and there is nothing to repair."
  exit 1
fi

echo "created=true" >> "$out"
echo "::notice::Cut $tag at $sha. This release's ci and binaries jobs both proved IR(stage0, self/) == IR(stage1, self/) and the fixed point over every module of self/, so this commit is one the property can be re-verified at afterwards: docs/wp19-stage0-retirement.md G6 has the four-step procedure, and it is the only thing that survives R6 deleting src/."
summary <<EOF
### Provenance (WP19 G6)

Cut \`$tag\` at \`$sha\`.

\`IR(stage0, self/) == IR(stage1, self/)\` and the fixed point both hold at that
commit — \`tests/self/bootstrap.js\` in \`ci\`, and \`scripts/bootstrap.sh
--verify\` on every \`binaries\` row, proved it on this run. The tag is what
G6's re-verification procedure checks out; after R6 deletes \`src/\` there is no
other commit at which the property can be demonstrated.
EOF

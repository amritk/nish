#!/usr/bin/env bash
# Diverse double-compiling: build a release by a road that never passes
# through a published binary.
#
#   scripts/ddc-chain.sh --work <dir> --to <vX.Y.Z> [--root <ddc-tag>]
#
# Every release is built by the release before it, so a compiler that hid
# something in its own output could pass it down the whole line without a
# trace in any source file. This builds the line again from a root that is
# not a Nish binary at all: the `ddc-*` tag (ddc-0.6.0 by default) is the last
# commit whose compiler TypeScript still builds, so its stage0 is `tsc` output
# run by Node (docs/wp19-stage0-retirement.md, G6). From there each release
# tag after the root, in version order up to --to, is built with
# `NISH_BOOTSTRAP` set to the compiler the step before produced, exactly as
# release.yml builds it with the published one. If the end of this chain
# matches the published compiler of --to, the published line and this one
# agree, and a trick would have had to live in Node, tsc and LLVM as well.
#
# At the root it first runs the tag's own `node tests/self/bootstrap.js`, the
# check G6 recorded: the IR that tsc's compiler emits is the IR each stage
# after it emits, so the root is the TypeScript compiler's own answer.
#
# Each step uses a git worktree of its tag inside --work and removes it when
# done (the root's stays, for its logs). The compiler of step <tag> is
# <work>/out-<tag>/bin/nish, and the last line printed is the path of the one
# for --to. Needs a clone with the tags, Node, npm and LLVM 18 on PATH; the
# whole chain from ddc-0.6.0 to v0.20.0 takes about twenty minutes on one core.
set -euo pipefail

usage() {
  echo "usage: scripts/ddc-chain.sh --work <dir> --to <vX.Y.Z> [--root <ddc-tag>]" >&2
  exit 2
}

work=""
to=""
root="ddc-0.6.0"
while [ $# -gt 0 ]; do
  case "$1" in
    --work) [ $# -ge 2 ] || usage; work="$2"; shift 2 ;;
    --to) [ $# -ge 2 ] || usage; to="$2"; shift 2 ;;
    --root) [ $# -ge 2 ] || usage; root="$2"; shift 2 ;;
    *) usage ;;
  esac
done
{ [ -n "$work" ] && [ -n "$to" ]; } || usage
case "$root" in ddc-*) ;; *) echo "ddc-chain: the root must be a ddc-* tag, not $root" >&2; exit 2 ;; esac

repo="$(cd "$(dirname "$0")/.." && pwd)"
git -C "$repo" rev-parse -q --verify "refs/tags/$root" >/dev/null || { echo "ddc-chain: no tag $root in $repo (fetch the tags first)" >&2; exit 2; }
git -C "$repo" rev-parse -q --verify "refs/tags/$to" >/dev/null || { echo "ddc-chain: no tag $to in $repo (fetch the tags first)" >&2; exit 2; }
mkdir -p "$work"
work="$(cd "$work" && pwd)"

# The release tags strictly after the root's version and up to --to, in
# version order. `sort -V` agrees with semver for the plain X.Y.Z tags this
# repository has ever cut.
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1)" = "$1" ]; }
from="${root#ddc-}"
end="${to#v}"
chain=("$root")
while IFS= read -r tag; do
  version="${tag#v}"
  if newer "$version" "$from" && ! newer "$version" "$end"; then chain+=("$tag"); fi
done < <(git -C "$repo" tag -l 'v[0-9]*' | sort -V)
[ "${chain[${#chain[@]}-1]}" = "$to" ] || { echo "ddc-chain: $to is not a release after $root" >&2; exit 2; }
echo "ddc-chain: ${chain[*]}"

prev=""
for tag in "${chain[@]}"; do
  wt="$work/wt-$tag"
  out="$work/out-$tag"
  log="$work/$tag.log"
  rm -rf "$wt" "$out"
  git -C "$repo" worktree prune
  git -C "$repo" worktree add -q -f --detach "$wt" "$tag"
  start=$(date +%s)
  if [ -z "$prev" ]; then
    # The root's dependencies are its own lockfile's, and none of their
    # install scripts run: tsc is the one that matters and it needs none.
    if ! (cd "$wt" && npm ci --ignore-scripts --no-audit --no-fund && npm run build &&
      node tests/self/bootstrap.js &&
      env -u NISH_BOOTSTRAP bash scripts/bootstrap.sh -o "$out/bin/nish" --profile speed --verify) > "$log" 2>&1; then
      tail -n 40 "$log" >&2
      echo "ddc-chain: the root $tag did not build; the log is $log" >&2
      exit 1
    fi
  else
    if ! (cd "$wt" && NISH_BOOTSTRAP="$prev" bash scripts/bootstrap.sh -o "$out/bin/nish" --profile speed --verify) > "$log" 2>&1; then
      tail -n 40 "$log" >&2
      echo "ddc-chain: $tag did not build with the compiler of the step before; the log is $log" >&2
      exit 1
    fi
  fi
  # A compiler finds its runtime, std/ and link script beside its own bin/,
  # where a release tarball puts them, and the next step's build links with
  # them; so each step's output is laid out the way release.yml stages one.
  mkdir -p "$out/scripts"
  cp -R "$wt/runtime" "$wt/std" "$out/"
  cp "$wt/scripts/build.sh" "$out/scripts/build.sh"
  echo "ddc-chain: $tag in $(($(date +%s) - start))s, $(sha256sum < "$out/bin/nish" | cut -d' ' -f1)"
  prev="$out/bin/nish"
  [ "$tag" = "$root" ] || git -C "$repo" worktree remove -f "$wt"
done
echo "$prev"

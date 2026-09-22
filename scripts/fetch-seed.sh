#!/bin/sh
# Fetch the seed: the last released `nish`, unpacked into build/seed/.
#
#   scripts/fetch-seed.sh               the latest release, unless one is there
#   scripts/fetch-seed.sh 0.5.0         that release (a no-op when it is there)
#   scripts/fetch-seed.sh --force       fetch the latest again, whatever is there
#
# The seed is the compiler that builds stage1 (docs/wp19-stage0-retirement.md
# §3): what `NISH_BOOTSTRAP` names for scripts/bootstrap.sh, and the slot
# tests/self/seed.js looks in after `NISH_BOOTSTRAP` and build/nish. A fresh
# clone has no released compiler in it, and this is the one command that
# gives it one:
#
#   bash scripts/fetch-seed.sh
#   NISH_BOOTSTRAP=build/seed/bin/nish bash scripts/bootstrap.sh
#
# The download is install.sh's, called rather than copied: the asset name, the
# latest-version redirect, the check that what arrived runs and says the
# version asked for, and the swap that leaves a working seed in place when a
# download fails are all there already, and a second copy of them would be a
# second place for a release's asset name to be spelled.
#
# With no version this is a no-op whenever build/seed/bin/nish already runs,
# without touching the network, which is what lets the session hook call it on
# every start. That seed may be older than the latest release; --force (or a
# version) is how to move it on.
set -eu

cd "$(dirname "$0")/.."

dir=build/seed
version=""
force=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help) sed -n '2,/^set -eu$/{/^set -eu$/d;s/^# \{0,1\}//;p}' "$0"; exit 0 ;;
    --force) force=--force; shift ;;
    -*) printf 'fetch-seed: unknown option %s (try --help)\n' "$1" >&2; exit 2 ;;
    *) [ -z "$version" ] || { printf 'fetch-seed: two versions given: %s and %s\n' "$version" "$1" >&2; exit 2; }
       version="$1"; shift ;;
  esac
done

if [ -z "$version" ] && [ -z "$force" ] && have="$("$dir/bin/nish" --version 2>/dev/null)"; then
  printf 'fetch-seed: %s in %s (already there)\n' "$have" "$dir"
  exit 0
fi

# install.sh's closing advice is about a user's PATH and does not apply to a
# seed in a build directory, so only its failure reaches the caller.
if ! log="$(sh install.sh $version $force --dir "$dir" 2>&1)"; then
  printf '%s\n' "$log" >&2
  exit 1
fi
printf 'fetch-seed: %s in %s\n' "$("$dir/bin/nish" --version)" "$dir"

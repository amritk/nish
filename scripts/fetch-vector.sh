#!/bin/sh
# Fetch and build vector, the spec-to-contract tool, at the version
# .vector-version pins, into build/vector/ (its binary: build/vector/dist/vector).
#
#   bash scripts/fetch-vector.sh            build the pinned version, unless it is there
#   bash scripts/fetch-vector.sh --force    clone and build it again, whatever is there
#
# vector is https://github.com/amritk/vector (MIT). It is not taken from npm,
# which lags its tags: this clones the tag v<version> and links dist/vector
# with the nish vector pins in its .nish-version. When that is the seed's
# version (build/seed, scripts/fetch-seed.sh) the seed is copied in; otherwise
# vector's scripts/fetch-nish.sh fetches it. vector's scripts/fetch-z3.sh puts
# the z3 its `spec check` runs in build/vector/.z3/. With no flag this is a
# no-op, without touching the network, whenever build/vector/dist/vector
# already prints "vector <version>" and .z3/z3 is there.
#
# Which of vector's gates CI runs and which stay by hand: .claude/orientation.md,
# the spec-first paragraph; the regenerate commands: contracts/README.md.
set -eu

cd "$(dirname "$0")/.."

force=""
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    *) echo "fetch-vector: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

version=$(tr -d ' \t\r\n' < .vector-version)
case "$version" in
  ''|*[!0-9.]*) echo "fetch-vector: .vector-version is not a version: '$version'" >&2; exit 2 ;;
esac

dir=build/vector
bin="$dir/dist/vector"

if [ -z "$force" ] && [ -x "$bin" ] && [ -x "$dir/.z3/z3" ] \
  && [ "$("$bin" --version 2>/dev/null || true)" = "vector $version" ]; then
  echo "fetch-vector: vector $version already in $dir"
  exit 0
fi

# Clone beside the old build and swap it in only once the clone succeeded, so
# a failed clone (offline, a missing tag) leaves the previous vector in place.
mkdir -p build
tmp="$dir.tmp.$$"
trap 'rm -rf "$tmp"' EXIT
rm -rf "$tmp"
git clone --quiet --depth 1 --branch "v$version" https://github.com/amritk/vector "$tmp"
rm -rf "$dir"
mv "$tmp" "$dir"
nish=$(tr -d ' \t\r\n' < "$dir/.nish-version")
if [ -x build/seed/bin/nish ] && [ "$(build/seed/bin/nish --version)" = "nish $nish" ]; then
  mkdir -p "$dir/.nish"
  cp -R build/seed/. "$dir/.nish/"
else
  (cd "$dir" && bash scripts/fetch-nish.sh)
fi
(
  cd "$dir"
  bash scripts/fetch-z3.sh
  mkdir -p dist
  # A nish that holds the root package to no panic by default lists
  # `--allow-panics`: vector keeps panic sites no proof removes yet, so it
  # is built relaxed until it migrates. An older nish has no such flag. This is
  # the POSIX twin of `nish_allow_panics` (scripts/nish-compiler.sh, bash only).
  relax=""
  help=$(NO_COLOR=1 .nish/bin/nish --help 2>/dev/null) || help=""
  case "$help" in *--allow-panics*) relax=--allow-panics ;; esac
  .nish/bin/nish src/main.ts $relax --link dist/vector
)

got=$("$bin" --version)
if [ "$got" != "vector $version" ]; then
  echo "fetch-vector: built $bin prints '$got', not 'vector $version'" >&2
  exit 1
fi
echo "fetch-vector: $got in $dir"

#!/bin/sh
# Install the nish native compiler, without npm and without node.
#
#   curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
#
# (A short vanity URL would go in front of that once the project has a domain
# to hang one on; the raw URL is what works today and is what the docs give.)
#
# Downloads the prebuilt compiler for this machine from a GitHub release and
# unpacks it into $NISH_INSTALL (default ~/.nish). Nothing is compiled here:
# the binary was built, --verify'd and smoke-tested on hardware of its own
# architecture by .github/workflows/release.yml before the release existed.
#
#   NISH_INSTALL=/opt/nish sh install.sh        where it goes
#   sh install.sh v0.4.0                        a version other than the latest
#
# The other way in is npm -- `npm install -g @amritk/nish` -- which gets the
# same binary through per-platform packages, and falls back to a compiler that
# runs under node on a platform this does not cover. docs/INSTALL.md §2 has
# both.
set -eu

REPO="amritk/nish"

say() { printf '%s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

# The `asset` half of a release asset name, from what `uname` says. This is the
# inverse of the `host` field in .github/seed-targets.json -- that file is the
# one place a platform is spelled, and `tests/run.js` drives this function
# against every row of it rather than trusting two lists to stay equal.
#
# `uname -m` is the reason this is a mapping and not a concatenation: Linux on
# 64-bit ARM says `aarch64` and macOS on the same chip says `arm64`, and the
# triple this project targets calls both `aarch64`.
nish_asset() {
  _os="$1"
  _arch="$2"
  case "$_os" in
    Linux) _os=linux ;;
    Darwin) _os=darwin ;;
    *) return 1 ;;
  esac
  case "$_arch" in
    x86_64 | amd64) _arch=x86_64 ;;
    aarch64 | arm64) _arch=aarch64 ;;
    *) return 1 ;;
  esac
  printf '%s-%s\n' "$_arch" "$_os"
}

# Move the binary to libexec/ and leave a one-line `exec` of it at bin/nish.
# This is the whole reason this script does anything beyond unpacking.
#
# The compiler resolves scripts/build.sh and runtime/ from argv[0]'s directory
# (docs/wp19-stage0-retirement.md §5a item 4). Invoked as `$PATH` found it --
# a bare `nish` -- argv[0] is `nish` with no directory in it, so it looks in
# `./..` and every `--link` fails against whatever the working directory
# happens to be:
#
#     --link: cannot find scripts/build.sh (looked in ./.. and .)
#
# `--version` and plain `-o` keep working, which is what makes it a trap rather
# than an outage, and it is why unpacking the tarball onto `$PATH` is not an
# install. The exec hands the binary an absolute path as argv[0], so it
# resolves from `libexec/..` -- the install directory -- whatever the caller
# typed and wherever they are. It goes in `libexec` because the wrapper has to
# take the name `nish`, and the two cannot both be that file.
nish_write_wrapper() {
  _dir="$1"
  mkdir -p "$_dir/libexec" "$_dir/bin"
  # Unconditionally, because the caller has just unpacked a fresh `bin/nish`
  # over whatever was there: a guard that skipped the move when `libexec/nish`
  # already existed would make an upgrade into an existing install keep the OLD
  # binary and point a new wrapper at it, silently. The marker is what stops a
  # second call with no unpack in between moving the wrapper on top of the
  # compiler.
  if [ -e "$_dir/bin/nish" ] && ! grep -q 'Written by install.sh' "$_dir/bin/nish" 2>/dev/null; then
    mv -f "$_dir/bin/nish" "$_dir/libexec/nish"
  fi
  {
    printf '#!/bin/sh\n'
    printf '# Written by install.sh. Execs the compiler by absolute path, so that it\n'
    printf '# resolves its runtime from this install rather than from $PWD.\n'
    printf "exec '%s' \"\$@\"\n" "$_dir/libexec/nish"
  } > "$_dir/bin/nish"
  chmod +x "$_dir/bin/nish"
}

# Sourced for the functions alone, by the tests that check them against
# seed-targets.json and against the defect above. Everything below is the
# install.
[ "${NISH_INSTALL_SOURCE_ONLY:-}" = "1" ] && return 0 2>/dev/null

asset="$(nish_asset "$(uname -s)" "$(uname -m)" || true)"
if [ -z "$asset" ]; then
  die "no prebuilt compiler for $(uname -s) on $(uname -m).
  The npm package works anywhere node does -- it falls back to a compiler that
  runs under node on a platform with no binary of its own:
      npm install -g @amritk/nish"
fi

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v tar >/dev/null 2>&1 || die "tar is required"

version="${1:-${NISH_VERSION:-}}"
if [ -z "$version" ]; then
  # The redirect rather than the API: /releases/latest redirects to the tag, so
  # this needs no token and is not rate limited the way api.github.com is for
  # an unauthenticated caller behind a shared address.
  version="$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
    "https://github.com/$REPO/releases/latest" | sed 's#.*/tag/##')"
  [ -n "$version" ] || die "could not work out the latest version; pass one, e.g. sh install.sh v0.4.0"
fi
case "$version" in v*) ;; *) version="v$version" ;; esac
plain="${version#v}"

install_dir="${NISH_INSTALL:-$HOME/.nish}"
name="nish-$plain-$asset"
url="https://github.com/$REPO/releases/download/$version/$name.tar.gz"

say "installing nish $plain ($asset) into $install_dir"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fSL --progress-bar "$url" -o "$tmp/nish.tar.gz" ||
  die "could not download $url
  Check https://github.com/$REPO/releases for what $version actually carries:
  not every release attaches every platform, and one already published cannot
  grow an asset."

# --strip-components=1 because the tarball holds one directory, `$name/`, whose
# layout is already the one the compiler needs: bin/nish beside runtime/ and
# scripts/, which it resolves one level up from its own path.
mkdir -p "$install_dir"
tar -xzf "$tmp/nish.tar.gz" -C "$install_dir" --strip-components=1
[ -x "$install_dir/bin/nish" ] || die "$install_dir/bin/nish is missing after unpacking $name.tar.gz"

nish_write_wrapper "$install_dir"

installed="$("$install_dir/bin/nish" --version 2>/dev/null || true)"
[ -n "$installed" ] || die "$install_dir/bin/nish did not run on this machine"

say ""
say "$installed is in $install_dir/bin"
say ""
say "Put it on your PATH by adding this to your shell profile:"
say ""
say "    export PATH=\"$install_dir/bin:\$PATH\""
say ""
# Not a symlink into /usr/local/bin. A symlink leaves argv[0] pointing at the
# link, and the compiler does not resolve one before looking for its runtime
# next door -- the same defect the exec above works around, reached a different
# way. Copy the wrapper if you want it somewhere else; it holds an absolute
# path and works from anywhere.
say "To put it somewhere already on your PATH, copy the wrapper rather than"
say "linking it -- it holds an absolute path, and a symlink would not resolve:"
say ""
say "    cp $install_dir/bin/nish ~/.local/bin/nish"

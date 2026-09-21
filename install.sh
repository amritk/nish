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
# The other way in is npm -- `npm install -g @amritk/nish` -- which gets the
# same binary through per-platform packages, and falls back to a compiler that
# runs under node on a platform this does not cover. docs/INSTALL.md §2 has
# both, and says which to pick.
set -eu

REPO="amritk/nish"

say() { printf '%s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
install.sh - install the nish native compiler

  curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
  sh install.sh [<version>] [options]

Arguments:
  <version>            a release to install, e.g. 0.4.0 or v0.4.0.
                       Default: the latest release.

Options:
  --dir <path>         where to install. Default: $NISH_INSTALL, or ~/.nish
  --force              reinstall even when that version is already there
  --uninstall          remove the install directory and stop
  -h, --help           this text

Environment:
  NISH_INSTALL         same as --dir

Upgrading is running this again: it installs over an existing install, and
says nothing needs doing when the version already matches.
USAGE
}

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
    printf '# resolves its runtime from this install rather than from $PWD -- which\n'
    printf '# every release up to 0.5.0 needs, because it resolves no symlink.\n'
    printf "exec '%s' \"\$@\"\n" "$_dir/libexec/nish"
  } > "$_dir/bin/nish"
  chmod +x "$_dir/bin/nish"
}

# An absolute spelling of a path, without requiring it to exist yet.
#
# The wrapper `nish_write_wrapper` writes bakes this in, and a wrapper holding
# a relative path resolves against whoever's working directory happens to be
# current -- so `--dir build/nish` produces a compiler that runs from the
# directory it was installed from and nowhere else, which is a worse version of
# the argv[0] defect the wrapper exists to work around. `$PWD` rather than
# `cd`, so a path whose parent does not exist yet still comes back absolute.
nish_abspath() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s\n' "$PWD/${1#./}" ;;
  esac
}

# The version a compiler reports, or nothing. `--version` answers `nish <v>`,
# and the word is dropped here so the caller compares versions. Anything
# unreadable, unrunnable or not there at all is "nothing", because every one of
# those means the same thing to this script.
nish_version_of() {
  [ -x "$1" ] || return 0
  "$1" --version 2>/dev/null | sed -n 's/^nish //p' || true
}

# The version installed in a directory, through its wrapper -- so this answers
# for the install as a whole rather than for a binary, and comes back empty if
# the wrapper is there but points somewhere that is not.
nish_installed_version() {
  nish_version_of "$1/bin/nish"
}

# Sourced for the functions alone, by the tests that check them against
# seed-targets.json and against the defect above. Everything below is the
# install.
[ "${NISH_INSTALL_SOURCE_ONLY:-}" = "1" ] && return 0 2>/dev/null

version=""
install_dir="${NISH_INSTALL:-$HOME/.nish}"
force=""
uninstall=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h | --help) usage; exit 0 ;;
    --dir) [ $# -ge 2 ] || die "--dir needs a path"; install_dir="$2"; shift 2 ;;
    --force) force=1; shift ;;
    --uninstall) uninstall=1; shift ;;
    -*) die "unknown option $1 (try --help)" ;;
    *) [ -z "$version" ] || die "two versions given: $version and $1"; version="$1"; shift ;;
  esac
done

install_dir="$(nish_abspath "$install_dir")"

if [ -n "$uninstall" ]; then
  [ -d "$install_dir" ] || die "nothing installed in $install_dir"
  rm -rf "$install_dir"
  say "removed $install_dir"
  say "If you added it to your PATH, take that line out of your shell profile."
  exit 0
fi

asset="$(nish_asset "$(uname -s)" "$(uname -m)" || true)"
if [ -z "$asset" ]; then
  die "no prebuilt compiler for $(uname -s) on $(uname -m).
  The npm package works anywhere node does -- it falls back to a compiler that
  runs under node on a platform with no binary of its own:
      npm install -g @amritk/nish"
fi

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v tar >/dev/null 2>&1 || die "tar is required"

[ -n "$version" ] || version="${NISH_VERSION:-}"
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

have="$(nish_installed_version "$install_dir")"
if [ "$have" = "$plain" ] && [ -z "$force" ]; then
  say "nish $plain is already installed in $install_dir"
  say "Nothing to do. --force reinstalls it."
  exit 0
fi

name="nish-$plain-$asset"
url="https://github.com/$REPO/releases/download/$version/$name.tar.gz"

if [ "$have" = "$plain" ]; then
  say "reinstalling nish $plain ($asset) in $install_dir"
elif [ -n "$have" ]; then
  say "upgrading nish $have to $plain ($asset) in $install_dir"
else
  say "installing nish $plain ($asset) into $install_dir"
fi

# Staged beside the destination rather than in $TMPDIR, so the swap at the end
# is a rename within one filesystem rather than a copy across two.
parent="$(dirname "$install_dir")"
mkdir -p "$parent"
tmp="$(mktemp -d "$parent/.nish-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM
stage="$tmp/stage"
mkdir -p "$stage"

curl -fSL --progress-bar "$url" -o "$tmp/nish.tar.gz" ||
  die "could not download $url
  Check https://github.com/$REPO/releases for what $version actually carries:
  not every release attaches every platform, and one already published cannot
  grow an asset."

# --strip-components=1 because the tarball holds one directory, `$name/`, whose
# layout is already the one the compiler needs: bin/nish beside runtime/ and
# scripts/, which it resolves one level up from its own path.
tar -xzf "$tmp/nish.tar.gz" -C "$stage" --strip-components=1
[ -x "$stage/bin/nish" ] || die "$name.tar.gz does not carry bin/nish"
# Three files rather than release.yml's seven, and deliberately the short list:
# these are what every release since 0.1.1 has carried, and the rest is what a
# given release happens to have. `runtime_os.c` arrived in 0.2.0 when the
# runtime was split into two translation units, so demanding it here would make
# this script refuse to install 0.1.1 -- which it did, until it was pointed at
# one. What the tarball ought to contain is `release.yml`'s question and it
# gates it at build time; this is only checking that what arrived is a compiler
# and not, say, an HTML error page that `tar` happened to accept.
for f in bin/nish runtime/runtime.c runtime/nish.h scripts/build.sh; do
  [ -e "$stage/$f" ] || die "$name.tar.gz is missing $f, so this is not a usable compiler"
done

nish_write_wrapper "$stage"

# Run the thing before letting it replace a working compiler, and check it says
# the version that was asked for. That catches a truncated download, a tarball
# built for another architecture, and an asset whose name does not match what
# is inside it -- none of which `tar` complains about.
#
# The binary directly, not through the wrapper: the wrapper written above holds
# an absolute path, and at this point that path is the staging directory, which
# is about to stop existing. It is rewritten after the move.
got="$(nish_version_of "$stage/libexec/nish")"
[ -n "$got" ] || die "the compiler in $name.tar.gz did not run on this machine"
[ "$got" = "$plain" ] || die "$name.tar.gz contains nish $got, not $plain"

# Swap, rather than unpacking over the top. A failed or partial extract into a
# live install leaves no working compiler and nothing to go back to; this way
# the old one stays whole until the new one has run.
backup=""

# Put back whatever was there. Written as an `if` rather than
# `[ -n "$backup" ] && mv ...`: under `set -e` a bare AND-list whose left side
# is false is itself a failed command, so the short form would exit the script
# on the no-backup path -- silently, before the `die` beneath it could say
# what went wrong.
restore_backup() {
  if [ -n "$backup" ]; then
    rm -rf "$install_dir"
    mv "$backup" "$install_dir"
  fi
}

if [ -e "$install_dir" ]; then
  backup="$tmp/previous"
  mv "$install_dir" "$backup"
fi
if ! mv "$stage" "$install_dir"; then
  restore_backup
  die "could not move the new install into $install_dir; the previous one is untouched"
fi

# Now that the files are at their final path, rewrite the wrapper to point at
# it. Calling this a second time is safe and is what the marker in it is for:
# the binary is already in libexec/ and `bin/nish` is already a wrapper, so
# this rewrites the one line and moves nothing.
nish_write_wrapper "$install_dir"

# Through the wrapper this time, which is what a user will run. A version here
# proves the whole path: the command, the absolute exec, and the binary.
final="$(nish_installed_version "$install_dir")"
if [ "$final" != "$plain" ]; then
  # The staged binary ran a moment ago, so reaching here means the move or the
  # wrapper rewrite went wrong rather than the download. Put the old install
  # back anyway: the trap is about to delete the backup, and leaving a broken
  # compiler in place with nothing to fall back to is the one outcome all of
  # this staging exists to avoid.
  restore_backup
  die "installed into $install_dir, but running $install_dir/bin/nish did not answer nish $plain"
fi
installed="nish $final"

say ""
say "$installed is in $install_dir/bin"
case ":$PATH:" in
  *":$install_dir/bin:"*)
    say ""
    say "That directory is already on your PATH."
    ;;
  *)
    say ""
    say "Put it on your PATH by adding this to your shell profile:"
    say ""
    say "    export PATH=\"$install_dir/bin:\$PATH\""
    ;;
esac
say ""
say "  nish --version          what you just installed"
say "  sh install.sh           upgrade to the latest release"
say "  sh install.sh --help    versions, --dir, --uninstall"
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

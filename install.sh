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
# Nothing downloaded runs, or is even unpacked, before its SHA-256 matches. A
# release up to 0.15.0 is checked against the digest pinned below, in this
# script -- a different place from the release it describes, so an asset
# replaced on GitHub after the fact does not match. A later release is checked
# against the SHA256SUMS file release.yml attaches beside it. A release that
# has neither is refused rather than trusted (docs/security/supply-chain.md).
#
# The other way in is npm -- `npm install -g @amritk/nish` -- which gets the
# same binary through per-platform packages. It covers the same platforms and no
# more: since 0.6.0 there is no compiler inside that package to fall back to, so
# on anything else it refuses by name rather than serving something slower.
# docs/INSTALL.md §2 has both channels, and says which to pick.
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

Every download is checked against a SHA-256 before it is unpacked or run, and
one that does not match -- or that has no published digest -- is refused.

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

# One shell word that means exactly `$1`, for a path baked into the wrapper.
#
# Single quotes, because nothing is special inside them -- not `$`, not a
# backtick, not a space -- so the only character to handle is a single quote
# itself, which closes the string, gets a backslash, and opens it again.
# Splicing the path between two quotes unescaped, which is what this replaced,
# turned `--dir "/tmp/o'neil"` into a wrapper that ran whatever followed the
# quote. scripts/postinstall.mjs quotes its own `exec` the same way.
nish_shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

# Whether a version is one this script will put in a URL: dotted, starting
# with a digit, nothing but letters, digits, `.`, `-` and `+`. That is every
# release this project has made, and what it rules out is a version that
# reaches past `/releases/download/<tag>/` -- a `/`, a `..`, a `?` -- or the
# whole URL the latest-release redirect answers with when there is no tag to
# land on.
nish_valid_version() {
  case "$1" in
    "" | [!0-9]* | *..* | *[!0-9A-Za-z.+-]*) return 1 ;;
  esac
  return 0
}

# The SHA-256 of a file, in lower-case hex, or failure when this machine has
# no tool to compute one. `sha256sum` is coreutils, `shasum` ships with macOS,
# and `openssl` covers what has neither.
nish_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print tolower($1) }'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print tolower($1) }'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 -r "$1" | awk '{ print tolower($1) }'
  else
    return 1
  fi
}

# The digest of every release tarball published before release.yml attached
# SHA256SUMS, keyed by `<version>-<asset>`, or nothing for one not listed.
#
# Each was read from the asset GitHub serves and checked against the file
# itself on 2026-10-02. They live here rather than being fetched because a
# digest fetched from the release it describes only proves the two agree with
# each other: whoever can replace an asset can replace the sums beside it. A
# release is not immutable on GitHub, and this list is -- an edit to it is a
# reviewed change to this repository. A pinned digest wins over SHA256SUMS
# when both exist.
nish_pinned_sha256() {
  case "$1-$2" in
    0.1.1-x86_64-linux) echo 0ab19cb8878d740208cd76ed44490ccdf568ce8167b7d183d402208d973b3dc7 ;;
    0.2.0-x86_64-linux) echo 85b65dda36989712add80d0742d7958194685be62ff8e0f7c7e429b869c9909b ;;
    0.3.0-x86_64-linux) echo 521d52e100ed18c07e886f09b28ab4123e01fa13c765efdc9a6b54746a19128a ;;
    0.4.0-aarch64-darwin) echo 28fd4aa18c2e8f4cf2f04215097ca60293a173cd26fe13cf12947687c2ef32c5 ;;
    0.4.0-aarch64-linux) echo 2583ef4ca627caa7ce85404d50b92f94bd5983b4aed3311ffb31604a0e13b18d ;;
    0.4.0-x86_64-darwin) echo e65141346a28e23a1709674085425a7376f7032ba275eda64d188ff5ba7a3c03 ;;
    0.4.0-x86_64-linux) echo 5754803068301334be546dae6ec65709d583ef5c1df34e88d1f07a2e3d2971ad ;;
    0.5.0-aarch64-darwin) echo ade1cc82d21e452667ff3eb4f64f17154c2c4180ed75de24a769b2216b2a7376 ;;
    0.5.0-aarch64-linux) echo 62a33b4758d2413b9792d99f471698cd174f98206ca9f6aa9a2b9fa652fdae53 ;;
    0.5.0-x86_64-darwin) echo e34d249ea92742ab8abe8baa27d21e6ef792f0f8fe0ca5d752783d9120927fc9 ;;
    0.5.0-x86_64-linux) echo 01d499097a74c1d513674f13a9085e243b5bfda9243ea12c2a59a9276e45ccc8 ;;
    0.6.0-aarch64-darwin) echo a181a50f3ff13ff89445680aacf06f09d25d63718015ecdb7391daa1b0d7d991 ;;
    0.6.0-aarch64-linux) echo 1b558a8479c8b13b72425e550226c8d5da00b0f385acb7447d7388199696c8a8 ;;
    0.6.0-x86_64-darwin) echo 2979c576982790d24ef7b5454b194dbbe5966e8d9433380819a911669c2b8aa6 ;;
    0.6.0-x86_64-linux) echo e5106a136e5d8d4c26f055fdab597f6e32a7564d598f21bb9c3bc026f41ab06e ;;
    0.8.0-aarch64-darwin) echo dd7dd86db14cf685369bfe62185d186c24121515a413e4dbc466905e73bc6a6e ;;
    0.8.0-aarch64-linux) echo df70d344429607fc9c18a6e8e804f994bad36b1b8a9c62e9f8ffa9f7108f4c5a ;;
    0.8.0-x86_64-darwin) echo 584b2e13f6c01a5e3f4bf4e65f703a01e1ac14c87674c26a90e59e164b39ff5b ;;
    0.8.0-x86_64-linux) echo 7e51df4574180cc54ff2bb6782abd69e6f5e21d94971670b11d3b31b417fb0db ;;
    0.9.0-aarch64-darwin) echo a95176ce59d0f8c2afd7d0bfe9bd3b5dd115a6b3caf9fd8cd5719eaa07fa9c9b ;;
    0.9.0-aarch64-linux) echo ee333ed22ed6b5d7f76455c3a2b71be38ff1f79e45fff52e1a5b15b8a2ebe2ba ;;
    0.9.0-x86_64-darwin) echo 3faa89a51a2e13c61aeb902541cfa6108e66b839e18cbd612e5304d77111d3c5 ;;
    0.9.0-x86_64-linux) echo 394d76c0eb280575a27a1f8b3310e32939d4fa51a5fdbb58abe73709f2dd4f72 ;;
    0.10.0-aarch64-darwin) echo e21eb2e0c9b9d8d0d892c0a7cfc41d5e0d84f531ab0ef1f4595d1279cabc5db8 ;;
    0.10.0-aarch64-linux) echo f246454c92dea3f5ea63d476b84cc44bc4bf4ffe6dfc92e9fc5858217e906897 ;;
    0.10.0-x86_64-darwin) echo a3eb219689f9ceb1237080dc65ab537b3e09b801250cc024c0c5d3ed4fe8ed3c ;;
    0.10.0-x86_64-linux) echo ece843f89d1b3482b98f793016802a8c4f269bc6627a147587d287b2c96a4622 ;;
    0.11.0-aarch64-darwin) echo 9e185aa991c03ce08fcdc1b8de5fd4ad1ce9970804e8ce48b5d109ad2f322b73 ;;
    0.11.0-aarch64-linux) echo 18cbac5148032188b430a33ffe443211185b318a3ddbdef0746ba4db7ed78152 ;;
    0.11.0-x86_64-darwin) echo 6310e21f708cd7d4f5b80236bfe763c1951e7c11430b0798281da086ade3cf0d ;;
    0.11.0-x86_64-linux) echo f5de9858e4ccb771f063be45ca5ebf1d41825177cbb04ef82e7dd410a09736f7 ;;
    0.12.0-aarch64-darwin) echo ae528fecc9eb1fcea9be65993acf98306c3ab1d6a776b1f1c5abd9ed3993cf0c ;;
    0.12.0-aarch64-linux) echo a2a51376ecf2b7ce21a3b109fd5cc95a00d744f707640d2bb82807540614b05c ;;
    0.12.0-x86_64-darwin) echo 904a45b4499c7cb52b7779d481df8685b806da4f0b46bcf84ac65116c257b15f ;;
    0.12.0-x86_64-linux) echo 24c1f0ae0b165d94c4516d40b963c12c6397400f189502395c2218c41162649a ;;
    0.13.0-aarch64-darwin) echo ef4975c0422f46f6869f1b826dd474af71517e93b98b635819d5a333498c6630 ;;
    0.13.0-aarch64-linux) echo 040fb7818d2c2d018e428e264dc6fb43ab371d44516bd306715f4136a5afee9a ;;
    0.13.0-x86_64-darwin) echo 264c9219412244ee001818b2d29b345b558b82b4794ff6994bdce89de82a33c7 ;;
    0.13.0-x86_64-linux) echo a0d26a168dd2080a70bfcb2ce4fe85e2dd398074a84249ecb94fe735be021b2e ;;
    0.14.0-aarch64-darwin) echo 861adbdbc3df6df4b134852ff16d3d97943d6241839533f74925252297b62132 ;;
    0.14.0-aarch64-linux) echo 5051142dfcf0eb02eb5889ca9b4d7676e217dde02d05bfa1ee3cf7674907de4c ;;
    0.14.0-x86_64-darwin) echo 7c1f14c528de80c831bcd5829954e23ca360478da8dcf277e22919c5f5326228 ;;
    0.14.0-x86_64-linux) echo 2258aeeb895377fc9b40a7aea3c34e045ce03151cb0865825cc1ed3f3da8b93f ;;
    0.15.0-aarch64-darwin) echo b217299039380ff2747d46abc6b2672fa9976b62cb23d05b20f39af0ed390369 ;;
    0.15.0-aarch64-linux) echo 4b5749832e7c96878c8dd8f8a807ecea47e425e943b7604946819ee47c9fb819 ;;
    0.15.0-x86_64-darwin) echo f720cf231cf299c9c160fe097a33647bd49b8e1d1c96f1338f9876d494df983a ;;
    0.15.0-x86_64-linux) echo eb1b7bdf391c20a5c6d5e088ce074b81fac4c7a32854ca3916a8d179cb5be86c ;;
  esac
}

# The release SHA256SUMS line for one file name: the digest, or nothing. Both
# `sha256sum` spellings of the name are accepted -- `name` and the binary-mode
# `*name` -- and a digest that is not 64 hex digits is no digest at all.
nish_sums_lookup() {
  awk -v n="$2" '$2 == n || $2 == ("*" n) { print tolower($1); exit }' "$1" |
    grep -E '^[0-9a-f]{64}$' || true
}

# Whether a directory holds an install this script may replace or remove: one
# with a `bin/nish` in it. Anything else that already exists and is not empty
# is somebody's directory, and the swap below would move it aside and the exit
# trap would delete it -- so `--dir ~/projects` would have emptied a project
# folder. It is refused instead.
nish_is_install() {
  [ -e "$1/bin/nish" ] || [ -L "$1/bin/nish" ]
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
    printf 'exec %s "$@"\n' "$(nish_shell_quote "$_dir/libexec/nish")"
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
  nish_is_install "$install_dir" ||
    die "$install_dir has no bin/nish, so it is not an install of this script's; not removing it"
  rm -rf "$install_dir"
  say "removed $install_dir"
  say "If you added it to your PATH, take that line out of your shell profile."
  exit 0
fi

asset="$(nish_asset "$(uname -s)" "$(uname -m)" || true)"
if [ -z "$asset" ]; then
  die "no prebuilt compiler for $(uname -s) on $(uname -m).
  This project publishes one for x86_64/aarch64 on linux and darwin, and that
  is the whole list -- the npm package refuses on anything else rather than
  falling back, because there is no second compiler in it to fall back to.
  docs/INSTALL.md has what is left for this platform: bootstrapping from a
  released nish that runs here, in a checkout of the repository."
fi

if [ -e "$install_dir" ] && ! nish_is_install "$install_dir" && [ -n "$(ls -A "$install_dir" 2>/dev/null || echo file)" ]; then
  die "$install_dir already exists, is not empty and is not a nish install.
  Installing would replace it and delete what is in it. Pick an empty or new
  directory with --dir, or remove this one yourself."
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
nish_valid_version "$plain" || die "$version is not a release version (one looks like 0.15.0 or v0.15.0)"

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

# The digest, before tar or the binary sees a byte of it. `tar` has had path
# traversal bugs of its own, and the version check below runs the download, so
# both come after this and neither is the check.
expected="$(nish_pinned_sha256 "$plain" "$asset")"
if [ -z "$expected" ]; then
  sums_url="https://github.com/$REPO/releases/download/$version/SHA256SUMS"
  curl -fsSL "$sums_url" -o "$tmp/SHA256SUMS" ||
    die "$version publishes no SHA256SUMS ($sums_url), and this script pins no digest for it,
  so there is nothing to check $name.tar.gz against. It is not installed: an
  unverified download is never run."
  expected="$(nish_sums_lookup "$tmp/SHA256SUMS" "$name.tar.gz")"
  [ -n "$expected" ] || die "$version's SHA256SUMS has no entry for $name.tar.gz; not installing it"
fi
actual="$(nish_sha256 "$tmp/nish.tar.gz")" ||
  die "no sha256sum, shasum or openssl on PATH, so the download cannot be verified; not installing it"
[ "$actual" = "$expected" ] || die "$name.tar.gz does not match its published SHA-256, so it is not installed.
  expected $expected
  got      $actual"

# --strip-components=1 because the tarball holds one directory, `$name/`, whose
# layout is already the one the compiler needs: bin/nish beside runtime/ and
# scripts/, which it resolves one level up from its own path.
tar -xzf "$tmp/nish.tar.gz" -C "$stage" --strip-components=1
[ -x "$stage/bin/nish" ] || die "$name.tar.gz does not carry bin/nish"
# Three files rather than release.yml's seven, and deliberately the short list:
# these are what every release since 0.1.1 has carried, and the rest is what a
# given release happens to have. `runtime-os.c` arrived in 0.2.0 when the
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

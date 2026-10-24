# Installation

Nish comes as one prebuilt compiler, the `nish` command. On its own it checks a
program and writes LLVM IR. Building a native binary also needs LLVM, which is
`clang` and the `lld` linker; LLVM 18 is the recommended version. This page
installs both and checks that they work. [INSTALL.md](../../INSTALL.md) covers
everything else: release tarballs, WebAssembly, building the compiler from
source, and platforms with no prebuilt binary.

## What runs where

A prebuilt compiler exists for four platforms: Linux (glibc) on x86_64 and on
ARM64, and macOS on Intel and on Apple Silicon.

Windows is not supported natively. Install
[WSL](https://learn.microsoft.com/windows/wsl/install) with Ubuntu and follow
the Linux steps inside it. musl-based Linux (Alpine), FreeBSD and 32-bit
systems have no prebuilt compiler either; INSTALL.md describes what you can do
on them.

## 1. Install LLVM

`nish` calls `clang` from your `PATH`, or the compiler named by the `CC`
environment variable when that is set.

**Ubuntu / Debian**

```bash
sudo apt-get update
sudo apt-get install -y clang-18 lld-18 llvm-18
export CC=clang-18        # add this line to your shell profile
```

These packages install only versioned commands (`clang-18`, `ld.lld-18`), not
a plain `clang`, which is why `CC` points at the versioned one.

**Fedora**

```bash
sudo dnf install clang lld llvm
```

**macOS**

```bash
xcode-select --install
```

Xcode's command-line tools are enough to build native binaries. For the
WebAssembly targets, install Homebrew's LLVM instead, as
[INSTALL.md](../../INSTALL.md#macos) describes.

## 2. Install the compiler

Either way below installs the same prebuilt compiler; nothing is compiled
during the install.

**With the install script.** This needs neither Node nor npm, only `sh`,
`curl` and `tar`:

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

The script installs into `~/.nish`. It ends by printing the `export PATH=…`
line to add to your shell profile; run that line in your shell too, or open a
new terminal. To upgrade later, run the same command again. Ending the
command with `| sh -s -- --help` instead of `| sh` lists the script's other
options: another directory, and uninstalling.

**Or with npm.** This needs Node.js 22.18 or newer. The package and the
command it installs are both `nish`:

```bash
npm install -g nish
```

Install it without `-g` (`npm install --save-dev nish`) to pin the
version per project in `package.json`, and run it as `npx nish`. Releases up
to 0.18.0 were published as `@amritk/nish`; if you installed that, uninstall
it (`npm uninstall -g @amritk/nish`) and install `nish` instead.

Nish is pre-alpha and changes between minor releases, so you may want to pin
an exact version: end the install script's command with `| sh -s 0.20.0`,
or run `npm install -g nish@0.20.0`. Read the
[changelog](../../../CHANGELOG.md) before you upgrade.

### Checking where the download came from

Every release lists a SHA-256 for each of its files in `SHA256SUMS`, and the
install script refuses a download that does not match. Releases after 0.20.0
also carry a signed *build provenance attestation*: a record, signed through
GitHub, that the files were built by Nish's release workflow from the tagged
source on GitHub's own runners. A matching checksum shows that the file is the
one the release lists; the attestation shows where that release came from.

When the [GitHub CLI](https://cli.github.com) (`gh`) is installed and signed
in, the install script checks the attestation too, and refuses to install if
it does not verify. Without `gh` it skips that check and says so. To check a
tarball you downloaded yourself, with its version and platform filled in
(for example `nish-0.21.0-x86_64-linux.tar.gz` and `refs/tags/v0.21.0`):

```bash
gh attestation verify nish-<version>-<platform>.tar.gz \
  --repo amritk/nish \
  --signer-workflow amritk/nish/.github/workflows/release.yml \
  --source-ref refs/tags/v<version>
```

Each release also attaches a software bill of materials,
`nish-<version>.spdx.json`, in the SPDX format. It lists every file of the
release with its checksum, the LLVM, linker and Node.js versions that built
each compiler, and the third-party code compiled into it.

## 3. Check that it worked

```bash
nish --version
"${CC:-clang}" --version
```

The first command prints `nish` and a version number, for example
`nish 0.20.0`. If `nish` is not found, the directory it was installed into is
not on your `PATH` yet. The second runs the C compiler `nish` will use, `$CC`
if you set it and `clang` otherwise, and prints its LLVM version. If it is not
found, `nish` cannot build a binary either.

The real test is building a program: see
[Your first program](first-program.md). If `nish` cannot find a C compiler
when it builds a binary, it prints `no usable C compiler found` and the
install command for your platform, and exits with code 3.

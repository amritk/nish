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

Debian and Ubuntu name the versioned compiler `clang-18`, which is why `CC`
points at it. On Ubuntu 24.04 the plain `clang` is already version 18, so if
`clang --version` reports 18 you do not need `CC`.

**Fedora**

```bash
sudo dnf install clang lld llvm
```

**macOS**

```bash
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"   # add this line to your shell profile
```

Xcode's command-line tools (`xcode-select --install`) also build native
binaries. Homebrew's LLVM is needed only for the WebAssembly targets.

## 2. Install the compiler

There are two ways to install it. Both put the same compiler on your machine,
already built: nothing is compiled during the install.

**With npm.** This needs Node.js 22.18 or newer. The package is
`@amritk/nish` and the command it installs is `nish`. The unscoped `nish`
package on npm is an unrelated project, so do not install that one.

```bash
npm install -g @amritk/nish
```

Install it without `-g` (`npm install --save-dev @amritk/nish`) to pin the
version per project in `package.json`, and run it as `npx nish`.

**With the install script.** This needs neither Node nor npm, only `sh`,
`curl` and `tar`:

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

The script installs into `~/.nish`. It ends by printing the `export PATH=…`
line to add to your shell profile; run that line in your shell too, or open a
new terminal. To upgrade later, run the same command again. Ending the
command with `| sh -s -- --help` instead of `| sh` lists the script's other
options: a particular version, another directory, and uninstalling.

## 3. Check that it worked

```bash
nish --version
clang --version           # or: $CC --version
```

The first command prints `nish` and a version number, for example
`nish 0.18.0`. The second prints the LLVM version. If `nish` is not found,
the directory it was installed into is not on your `PATH` yet.

The real test is building a program, which is the next page:
[your first program](first-program.md). If `nish` cannot find a C compiler
when it builds a binary, it prints `no usable C compiler found` and the
install command for your platform, and exits with code 3.

## Pre-alpha

Nish is pre-alpha, and the language and its flags change between minor
releases. Pin an exact version (`npm install -g @amritk/nish@0.18.0`, or end the
install script's command with `| sh -s 0.18.0`) and read the
[changelog](../../../CHANGELOG.md) before you upgrade.

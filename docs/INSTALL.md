# Installing nish

`nish` compiles a static subset of TypeScript to LLVM IR and, with
`--link`, to a native binary. The compiler itself only needs Node.js; the
`--link` step (and anything else that turns `.ll` into machine code) needs an
LLVM toolchain.

## 1. Prerequisites

- **Node.js 22.18 or newer** (22 is what CI uses). That is the version where
  Node strips TypeScript types without a flag, which the compiler is written in
  and `docs/RUN_UNDER_NODE.md` relies on.
- **clang** (LLVM 18 recommended) and **lld**, for `--link`. Without them
  `nish` still writes the `.ll` files and exits 3 with the install
  command for your platform when you ask for `--link`.

### Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y clang-18 lld-18 llvm-18
```

Debian ships versioned binaries (`clang-18`, `ld.lld-18`, ...). Either point
`nish` at the versioned compiler with `CC=clang-18`, or expose the plain
names on `PATH`:

```bash
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do
  ln -sf "/usr/bin/$t-18" ~/.local/llvm-bin/$t
done
export PATH=~/.local/llvm-bin:$PATH     # add to your shell profile
```

(`sudo apt-get install -y clang lld llvm` also works if your release's default
LLVM is 15 or newer.)

### Fedora

```bash
sudo dnf install clang lld llvm
```

### macOS

```bash
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"   # add to your shell profile
```

Xcode's `clang` (`xcode-select --install`) also works for native binaries;
the Homebrew LLVM is needed for the `wasm` and `wasi` profiles (`wasm-ld`).

### WASI (optional, for `--profile wasi`)

The `wasi` profile links the runtime against wasi-libc so that whole programs
(strings, `console.log`, files, `process.argv`) run under any WASI host. It
needs a WASI sysroot and compiler-rt's wasm32 builtins next to your clang:

```bash
# Ubuntu / Debian: the packaged sysroot lands in /usr/lib/wasi-sysroot
sudo apt-get install -y wasi-libc libclang-rt-18-dev-wasm32

# Any platform: wasi-sdk's sysroot and builtins tarballs (versions that match your clang)
curl -L -o - https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/wasi-sysroot-24.0.tar.gz | tar -xz -C /opt
curl -L -o - https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/libclang_rt.builtins-wasm32-wasi-24.0.tar.gz | tar -xz -C /opt
export WASI_SYSROOT=/opt/wasi-sysroot-24.0    # add to your shell profile
```

`scripts/build.sh` looks for the sysroot in `WASI_SYSROOT`,
`/usr/lib/wasi-sysroot`, `/opt/wasi-sdk/share/wasi-sysroot` and
`/usr/share/wasi-sysroot`, and for `libclang_rt.builtins-wasm32.a` in clang's
resource directory, next to the sysroot (as the tarball above unpacks it),
in `<sysroot>/lib/wasm32-wasi/`, or at `WASI_BUILTINS=<file>`. Then:

```bash
nish examples/argv.ts --link build/argv.wasm --profile wasi
node examples/wasi-host.mjs build/argv.wasm 3 4 five     # or: wasmtime build/argv.wasm 3 4 five
```

Node's built-in `node:wasi` runs the module (argv, stdout, exit code and the
working directory behave as natively); `npm test` prints
`skipped: no WASI sysroot` and moves on when none is installed.

### Windows

Windows is not supported natively yet: `scripts/build.sh` is a bash script
and the runtime is built with clang on a POSIX toolchain. Use
[WSL](https://learn.microsoft.com/windows/wsl/install) with Ubuntu and follow
the Ubuntu steps inside it.

## 2. Install the compiler

**Two ways in, and they install the same compiler.** Neither compiles anything
on your machine: the binary was built, `--verify`d and smoke-tested on hardware
of its own architecture by the release workflow before the release existed, and
installing is a download and an unpack.

Through npm, which is also how an Nish *program* resolves its dependencies
([wp21-packages.md](wp21-packages.md)), so this is the one to pick if you want
the compiler pinned per project in a `package.json`:

```bash
npm install -g @amritk/nish
nish --version
```

Or without npm and without node at all:

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

That unpacks into `~/.nish` (`NISH_INSTALL` changes it), takes an optional
version (`sh install.sh v0.4.0`, latest otherwise), and prints the one line to
add to your shell profile. On a platform it has no binary for it says so and
names the npm route, which works anywhere node does.

The npm route installs the **native** compiler, and it is a download rather than a
build: nothing is compiled on your machine. The package declares one
`nish-<os>-<arch>` package per supported platform as an `optionalDependencies`
entry with `os` and `cpu` set, so npm fetches exactly the one that matches and
skips the rest. Each of those carries the self-hosted compiler — `self/`
compiled by itself — already built, `--verify`d and smoke-tested on a machine
of its own architecture by the release workflow.

A postinstall step then puts that binary on your PATH directly, so `nish` is
the compiler rather than a node script that starts it — 3.2 ms per invocation
instead of 94 ms, measured. If you install with `npm ci --ignore-scripts`, or
in a sandbox that disables scripts, the step does not run and `nish` is a small
node launcher that spawns the same binary: the same compiler and the same
answers, about 91 ms slower to start. Nothing else changes, and the install
never fails over it.

> [!IMPORTANT]
> **Unpacking a release tarball onto your `PATH` is not an install.** The
> compiler resolves `scripts/build.sh` and `runtime/` from `argv[0]`'s
> directory, and a bare `nish` found on `PATH` has no directory in it — so it
> looks in `./..` and every `--link` fails against whatever your working
> directory happens to be, while `--version` and `-o` keep working. Both
> installers above handle it by running the binary through a one-line `exec` of
> an absolute path. If you unpack a tarball by hand, invoke it by path
> (`nish-<version>-<asset>/bin/nish`) or write that wrapper yourself. The
> underlying defect is [wp19 §5a](wp19-stage0-retirement.md#5a-what-r6-is-waiting-on)
> item 4.

**Do not install `nish`.** That name on the public registry has belonged to
`stdarg`'s "A Node.js Interactive shell" since February 2014 — versions 0.0.0
and 0.0.1, both deprecated by their author, nothing published since. **This
compiler is `@amritk/nish`** (decided 2026-09-19,
[docs/wp12-release.md](wp12-release.md#the-npm-name)), and the command it
installs is still `nish` — the package name and the command are two different
strings, and that is the one thing the scope costs.

On a platform this project attaches no binary for — the table below is the
whole list, so musl, FreeBSD and 32-bit anything are outside it — `nish` runs
the TypeScript compiler that ships in the same package, under Node. It is the
same compiler by every test this repository runs and about eight times slower
to compile with, and it needs no C toolchain to install. Nothing announces
this, because there is nothing for you to do about it; `nish --version`
answers either way.

**Nothing is published to the registry yet.** The installer is built and
tested, and what is left is a person publishing a release under it, which
[docs/wp12-release.md](wp12-release.md#release-procedure) step 4 is about.
Until that happens, install from a release.

From a release tarball on GitHub — the same package `npm publish` would upload,
carried by the release instead of the registry. The `Release` workflow attaches
the npm tarball to the release it builds for a `v*` tag. `npm pack` names it
after `package.json#name`, so it is `amritk-nish-<version>.tgz` from 0.4.0 on
and `nish-<version>.tgz` for the releases cut before the scope was taken — the
example below is one of those:

```bash
curl -LO https://github.com/amritk/nish/releases/download/v0.2.0/nish-0.2.0.tgz
npm install -g ./nish-0.2.0.tgz
nish --version
```

Installed on its own like that, the package finds no platform package next to
it and runs the Node compiler — the fallback above, reached here because the
binary was never fetched rather than because none exists for your machine. To
get the native one, install the pair: a release from 0.4.0 on attaches the
platform packages beside the npm tarball, under the name `npm pack` gave them.

```bash
base=https://github.com/amritk/nish/releases/download/v0.4.0
curl -LO $base/amritk-nish-0.4.0.tgz
curl -LO $base/amritk-nish-x86_64-linux-0.4.0.tgz     # the row matching your machine
npm install -g ./amritk-nish-0.4.0.tgz ./amritk-nish-x86_64-linux-0.4.0.tgz
```

As a native compiler, which needs no Node at all. A release also attaches the
self-hosted compiler — the binary `self/` produces by compiling itself — one
per supported platform, from the version named in the last column:

| Asset | For | Attached from |
| --- | --- | --- |
| `nish-<version>-x86_64-linux.tar.gz` | Linux on Intel or AMD | v0.1.1 |
| `nish-<version>-aarch64-linux.tar.gz` | Linux on ARM | v0.4.0 |
| `nish-<version>-x86_64-darwin.tar.gz` | macOS on Intel | v0.4.0 |
| `nish-<version>-aarch64-darwin.tar.gz` | macOS on Apple Silicon | v0.4.0 |

Each is built and smoke-tested on a machine of its own architecture rather than
cross-compiled, so the one you take has compiled and run two programs before it
reached you — a one-module one and a two-module one, from a directory unrelated
to the machine that built it.

The last column is there because a release is a past event and a workflow is
not. `release.yml` builds all four, but a release already published cannot grow
an asset: **v0.2.0, the current release, attaches `x86_64-linux` only**. Those
versions are not prose — they are `attachedSince` in
[`.github/seed-targets.json`](https://github.com/amritk/nish/blob/main/.github/seed-targets.json),
the same file the release workflow builds its matrix from, so this table and
the assets cannot drift apart without a test failing.

**The three new rows say v0.4.0 rather than v0.3.0 on purpose.** The workflow
builds all four now, but nothing in this repository has ever run on macOS or on
ARM Linux, and a row that has never run is not something to put in front of a
release: `release` needs the whole matrix, so one red row blocks the publish.
They wait for a release after the run that exercises them. The two macOS rows
wait on a second thing as well — the bootstrap's `stage3 == stage2` check does
not hold as a raw byte comparison under `ld64`, and which bytes actually differ
has not been measured on real hardware, so a darwin row may turn up work rather
than a green tick. `scripts/verify-binaries.sh`'s header is the long version.

Check [the releases page](https://github.com/amritk/nish/releases/latest) for
what a given version actually carries; on a platform whose row has not shipped
yet, take the npm package above, or build from source below.

```bash
# pick the row above that matches `uname -s` and `uname -m`
curl -LO https://github.com/amritk/nish/releases/download/v0.2.0/nish-0.2.0-x86_64-linux.tar.gz
tar -xzf nish-0.2.0-x86_64-linux.tar.gz
nish-0.2.0-x86_64-linux/bin/nish --version
```

Both URLs name the version rather than using GitHub's version-neutral
`/releases/latest/download/` form, because that form needs the asset's exact
file name and every asset name carries the version in it. **v0.2.0 is the
current release**; v0.1.1 before it was the first one with a binary attached.
The `v0.1.0` tag exists but has no release behind it and no assets, so every
`v0.1.0` download URL is a 404 — the tag was pushed by a workflow, and GitHub
raises no event for that, so nothing ever built it
([docs/wp12-release.md](wp12-release.md#release-procedure) step 2). When a newer
release exists, take its version from
[the releases page](https://github.com/amritk/nish/releases/latest).

Unpack it and run `bin/nish` from wherever you like; put that on `PATH` if you
want it there. Keep the directory intact rather than moving the binary out of
it: `--link` runs `scripts/build.sh` and compiles the C runtime
(`runtime/runtime.c` and `runtime/runtime_os.c`, the system-call half), and the
compiler finds all of them relative to its own location — `bin/nish` alone in a
directory can still emit IR with `-o`, but `--link` will tell you it cannot
find `scripts/build.sh`.

It still needs `clang` and `lld` on `PATH` for `--link` (§1), because linking
is the C toolchain's job in either compiler; what it does not need is Node.
x86_64 Linux is the only platform built today — on anything else, take the
`.tgz` above or build from a checkout.

From a checkout:

```bash
git clone https://github.com/amritk/nish.git
cd nish
npm install
npm run build       # src/ -> dist/
npm link            # optional: puts `nish` on PATH
# or run it in place: node dist/index.js ...
```

The package ships `dist/` (the compiler), `runtime/` (the C runtime — two
translation units and their header), and `scripts/build.sh` (the link
pipeline). `nish` locates the runtime and the script relative to its own
install directory, so a global install works from any working directory.

Building the IR yourself rather than through `--link` means naming the runtime
on the `clang` line, and it is two files:

```bash
clang app.ll runtime/runtime.c runtime/runtime_os.c -lm -o app
```

`runtime.c` is the half every program touches — the arena, strings, arrays,
number formatting, the panics — and `runtime_os.c` is the half that wraps the
system calls: files, directories, subprocesses, `getenv`, the monotonic clock.
They are separate so that each carries its own measured size ceiling
([docs/wp7-runtime.md](wp7-runtime.md)); nothing in the core calls into the
system-call half, so an older line that names `runtime.c` alone still links a
program that reads no files and spawns nothing. `scripts/build.sh` compiles
`runtime_os.c` beside any `runtime.c` it is handed, so a build that goes
through it — every `--link`, and every `--profile` recipe in these documents —
needs to name only the one.

## 2a. Building the self-hosted compiler (optional)

`self/` is the same compiler written in Nish, and it compiles itself
([docs/wp14-selfhost.md](wp14-selfhost.md)). From a checkout, with clang on
`PATH`:

```bash
npm run bootstrap                  # dist/ -> stage1 -> build/nish
build/nish hello.ts --link hello
./hello
```

`scripts/bootstrap.sh` builds stage1 with the Node compiler, then stage2 with
stage1, and installs stage2 as `build/nish`. `--verify` also builds stage3
and compares the IR and the binaries byte for byte; `--stages 1` stops one link
sooner. `build/nish` is then the compiler you run: it takes the same `-o`,
`--link` and `--profile` spellings as `nish` and makes every directory in the
way of the IR, a sidecar or the binary itself. It looks for `scripts/build.sh`
and the two `runtime/*.c` files one level up from wherever it was invoked, then
in the working directory, so it wants a checkout or an installed package around
it the way `nish` does.

The native compiler is about eight times faster than the Node one and needs no
Node at all. It writes the interop sidecars (`--emit-header`, `--emit-dts`,
`--emit-napi`) and the DWARF `-g` asks for byte for byte as `nish` does, and
passes `-g` on to `scripts/build.sh`, so the debug info survives into the
binary. It answers every flag `nish` answers, `--emit-ast` and
`--target host` included; the one thing that differs is what `--emit-ast`
prints, because each compiler dumps its own syntax tree and only `nish` has
the `typescript` package's node names to print. `nish` is also what the
`.tgz` package installs, whichever way that package reaches the machine.

## 3. Hello world

Create `hello.ts`:

```ts
export const main = (): number => {
  console.log("hello from Nish");
  return 0;
};
```

`export const main` is the process entry; its return value is the exit code
(`main(): void` exits 0). Compile and link it:

```bash
nish hello.ts --link hello
# wrote hello.ll
# linked hello: 5104 bytes (speed)
./hello
# hello from Nish
```

`hello.ll` is the LLVM IR, kept next to the binary. To only get the IR:

```bash
nish hello.ts -o hello.ll
```

Other build profiles: `--profile size` (smallest binary), `--profile debug`
(no optimisation, symbols kept). Run `nish --help` for every flag, and
see the [README](../README.md) for the language subset.

## 4. Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: compile error (`file:line:col: error: ...`), missing input file, or an `-o` layout that does not fit the module count |
| 2 | usage error: unknown flag, missing argument, no input files |
| 3 | toolchain error: `--link` found no `clang` (`CC` overrides), or `scripts/build.sh` failed (its output is shown; the `.ll` files are still written) |
| 70 | internal compiler error: an unexpected exception. Please report it at <https://github.com/amritk/nish/issues> with the input and command line; `NISH_DEBUG=1` prints the stack trace |

## Troubleshooting

- `--link: no usable C compiler found` -- install clang as above, or set
  `CC=/path/to/clang` (for example `CC=clang-18` on Debian).
- `warning: overriding the module target triple` from clang -- harmless: the
  IR is target-neutral and clang fills in the host triple.
- `the wasm profile needs wasm-ld` -- install `lld` (`lld-18` on Debian,
  bundled with Homebrew `llvm@18`).
- `the wasi profile needs a WASI sysroot` / `needs compiler-rt's wasm32
  builtins` -- install them as in the WASI section above, or point
  `WASI_SYSROOT` (a directory) and `WASI_BUILTINS` (the `.a` file) at them.

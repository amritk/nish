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

**Not from npm yet.** `npm install -g nish` installs somebody else's package.
The name `nish` on the public registry has belonged to `stdarg`'s "A Node.js
Interactive shell" since February 2014 — versions 0.0.0 and 0.0.1, both
deprecated by their author, nothing published since. Which name this compiler
takes is an open decision; the options and what each costs are in
[docs/wp12-release.md](wp12-release.md#open-decision-the-npm-name-is-taken).
Until it is settled, install from a release or from a checkout.

From a release tarball on GitHub — the same package `npm publish` would upload,
carried by the release instead of the registry. The `Release` workflow attaches
`nish-<version>.tgz` to the release it builds for a `v*` tag:

```bash
curl -LO https://github.com/amritk/nish/releases/download/v0.1.1/nish-0.1.1.tgz
npm install -g ./nish-0.1.1.tgz
nish --version
```

As a native compiler, which needs no Node at all. Every release also attaches
`nish-<version>-x86_64-linux.tar.gz` — the self-hosted compiler, the binary
`self/` produces by compiling itself:

```bash
curl -LO https://github.com/amritk/nish/releases/download/v0.1.1/nish-0.1.1-x86_64-linux.tar.gz
tar -xzf nish-0.1.1-x86_64-linux.tar.gz
nish-0.1.1-x86_64-linux/bin/nish --version
```

Both URLs name the version rather than using GitHub's version-neutral
`/releases/latest/download/` form, because that form needs the asset's exact
file name and both asset names carry the version in them. **v0.1.1 is the
current and only release**: the `v0.1.0` tag exists but has no release behind it
and no assets, so every `v0.1.0` download URL is a 404 — the tag was pushed by a
workflow, and GitHub raises no event for that, so nothing ever built it
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

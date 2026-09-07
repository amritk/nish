# Installing statictsc

`statictsc` compiles a static subset of TypeScript to LLVM IR and, with
`--link`, to a native binary. The compiler itself only needs Node.js; the
`--link` step (and anything else that turns `.ll` into machine code) needs an
LLVM toolchain.

## 1. Prerequisites

- **Node.js 18 or newer** (22 is what CI uses).
- **clang** (LLVM 18 recommended) and **lld**, for `--link`. Without them
  `statictsc` still writes the `.ll` files and exits 3 with the install
  command for your platform when you ask for `--link`.

### Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y clang-18 lld-18 llvm-18
```

Debian ships versioned binaries (`clang-18`, `ld.lld-18`, ...). Either point
`statictsc` at the versioned compiler with `CC=clang-18`, or expose the plain
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
statictsc examples/argv.ts --link build/argv.wasm --profile wasi
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

From npm (once published; see [docs/wp12-release.md](wp12-release.md)):

```bash
npm install -g statictsc
statictsc --version
```

From a release tarball on GitHub (the `Release` workflow attaches
`statictsc-<version>.tgz` to every `v*` tag):

```bash
npm install -g ./statictsc-0.1.0.tgz
```

From a checkout:

```bash
git clone https://github.com/amritk/compiler.git
cd compiler
npm install
npm run build       # src/ -> dist/
npm link            # optional: puts `statictsc` on PATH
# or run it in place: node dist/index.js ...
```

The package ships `dist/` (the compiler), `runtime/` (the C runtime and its
header), and `scripts/build.sh` (the link pipeline). `statictsc` locates the
runtime and the script relative to its own install directory, so a global
install works from any working directory.

## 2a. Building the self-hosted compiler (optional)

`self/` is the same compiler written in StaticTS, and it compiles itself
([docs/wp14-selfhost.md](wp14-selfhost.md)). From a checkout, with clang on
`PATH`:

```bash
npm run bootstrap                  # dist/ -> stage1 -> build/statictsc
scripts/statictsc.sh hello.ts --link hello
./hello
```

`scripts/bootstrap.sh` builds stage1 with the Node compiler, then stage2 with
stage1, and installs stage2 as `build/statictsc`. `--verify` also builds stage3
and compares the IR and the binaries byte for byte; `--stages 1` stops one link
sooner. `scripts/statictsc.sh` is that compiler's command line: it adds the
directory creation and the `--link` step the self-hosted compiler deliberately
does not do itself, and takes the same `-o`, `--link` and `--profile` spellings
as `statictsc`.

The native compiler is about eight times faster than the Node one and needs no
Node at all, but it does not emit debug info (`-g`) or the interop sidecars
(`--emit-header`, `--emit-dts`, `--emit-napi`) — those stay with `statictsc`,
which is also what the npm package installs.

## 3. Hello world

Create `hello.ts`:

```ts
export function main(): number {
  console.log("hello from StaticTS");
  return 0;
}
```

`export function main` is the process entry; its return value is the exit code
(`main(): void` exits 0). Compile and link it:

```bash
statictsc hello.ts --link hello
# wrote hello.ll
# linked hello: 5104 bytes (speed)
./hello
# hello from StaticTS
```

`hello.ll` is the LLVM IR, kept next to the binary. To only get the IR:

```bash
statictsc hello.ts -o hello.ll
```

Other build profiles: `--profile size` (smallest binary), `--profile debug`
(no optimisation, symbols kept). Run `statictsc --help` for every flag, and
see the [README](../README.md) for the language subset.

## 4. Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: compile error (`file:line:col: error: ...`), missing input file, or an `-o` layout that does not fit the module count |
| 2 | usage error: unknown flag, missing argument, no input files |
| 3 | toolchain error: `--link` found no `clang` (`CC` overrides), or `scripts/build.sh` failed (its output is shown; the `.ll` files are still written) |
| 70 | internal compiler error: an unexpected exception. Please report it at <https://github.com/amritk/compiler/issues> with the input and command line; `STATICTSC_DEBUG=1` prints the stack trace |

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

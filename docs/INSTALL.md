# Installing amritc

`amritc` compiles a static subset of TypeScript to LLVM IR and, with
`--link`, to a native binary. The compiler itself only needs Node.js; the
`--link` step (and anything else that turns `.ll` into machine code) needs an
LLVM toolchain.

## 1. Prerequisites

- **Node.js 18 or newer** (22 is what CI uses).
- **clang** (LLVM 18 recommended) and **lld**, for `--link`. Without them
  `amritc` still writes the `.ll` files and exits 3 with the install
  command for your platform when you ask for `--link`.

### Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y clang-18 lld-18 llvm-18
```

Debian ships versioned binaries (`clang-18`, `ld.lld-18`, ...). Either point
`amritc` at the versioned compiler with `CC=clang-18`, or expose the plain
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
amritc examples/argv.ts --link build/argv.wasm --profile wasi
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
npm install -g amritc
amritc --version
```

From a release tarball on GitHub (the `Release` workflow attaches
`amritc-<version>.tgz` to every `v*` tag):

```bash
npm install -g ./amritc-0.1.0.tgz
```

From a checkout:

```bash
git clone https://github.com/amritk/compiler.git
cd compiler
npm install
npm run build       # src/ -> dist/
npm link            # optional: puts `amritc` on PATH
# or run it in place: node dist/index.js ...
```

The package ships `dist/` (the compiler), `runtime/` (the C runtime and its
header), and `scripts/build.sh` (the link pipeline). `amritc` locates the
runtime and the script relative to its own install directory, so a global
install works from any working directory.

## 2a. Building the self-hosted compiler (optional)

`self/` is the same compiler written in AmritScript, and it compiles itself
([docs/wp14-selfhost.md](wp14-selfhost.md)). From a checkout, with clang on
`PATH`:

```bash
npm run bootstrap                  # dist/ -> stage1 -> build/amritc
build/amritc hello.ts --link hello
./hello
```

`scripts/bootstrap.sh` builds stage1 with the Node compiler, then stage2 with
stage1, and installs stage2 as `build/amritc`. `--verify` also builds stage3
and compares the IR and the binaries byte for byte; `--stages 1` stops one link
sooner. `build/amritc` is then the compiler you run: it takes the same `-o`,
`--link` and `--profile` spellings as `amritc` and makes every directory in the
way of the IR, a sidecar or the binary itself. It looks for `scripts/build.sh`
and `runtime/runtime.c` one level up from wherever it was invoked, then in the
working directory, so it wants a checkout or an installed package around it the
way `amritc` does.

The native compiler is about eight times faster than the Node one and needs no
Node at all. It writes the interop sidecars (`--emit-header`, `--emit-dts`,
`--emit-napi`) and the DWARF `-g` asks for byte for byte as `amritc` does, and
passes `-g` on to `scripts/build.sh`, so the debug info survives into the
binary. What is still only `amritc`'s is the `--emit-ast` dump, whose node
names come from the `typescript` package the self-hosted compiler does not use,
and the `--target host` alias. `amritc` is also what the npm package installs.

## 3. Hello world

Create `hello.ts`:

```ts
export function main(): number {
  console.log("hello from AmritScript");
  return 0;
}
```

`export function main` is the process entry; its return value is the exit code
(`main(): void` exits 0). Compile and link it:

```bash
amritc hello.ts --link hello
# wrote hello.ll
# linked hello: 5104 bytes (speed)
./hello
# hello from AmritScript
```

`hello.ll` is the LLVM IR, kept next to the binary. To only get the IR:

```bash
amritc hello.ts -o hello.ll
```

Other build profiles: `--profile size` (smallest binary), `--profile debug`
(no optimisation, symbols kept). Run `amritc --help` for every flag, and
see the [README](../README.md) for the language subset.

## 4. Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: compile error (`file:line:col: error: ...`), missing input file, or an `-o` layout that does not fit the module count |
| 2 | usage error: unknown flag, missing argument, no input files |
| 3 | toolchain error: `--link` found no `clang` (`CC` overrides), or `scripts/build.sh` failed (its output is shown; the `.ll` files are still written) |
| 70 | internal compiler error: an unexpected exception. Please report it at <https://github.com/amritk/compiler/issues> with the input and command line; `AMRITC_DEBUG=1` prints the stack trace |

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

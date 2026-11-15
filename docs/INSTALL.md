# Installing nish

`nish` compiles a static subset of TypeScript to LLVM IR and, with
`--link`, to a native binary. The compiler is itself a native binary, written
in Nish (`src/`), and needs nothing to run; the `--link` step (and anything
else that turns `.ll` into machine code) needs an LLVM toolchain.

## 1. Prerequisites

- **Node.js 22.18 or newer**, for the npm route and for building from a
  checkout — the launcher, the postinstall step and the test harness are Node
  scripts. It is the version where Node strips TypeScript types without a
  flag, which [running a program under Node](RUN_UNDER_NODE.md) relies on. The
  `install.sh` route below needs no Node at all.
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
the Homebrew LLVM is needed for the `wasm`, `wasm-host` and `wasi` profiles (`wasm-ld`).

`wasm-opt` (binaryen: `apt-get install binaryen`, `brew install binaryen`) is
optional. When it is on `PATH`, `scripts/build.sh --profile wasm-host` runs
`wasm-opt -Oz --strip-target-features` on the module, and the build line says
whether it ran: `add.wasm` goes from 102 bytes to 74. Without it the module
is complete and works the same. clang 18 also runs a `wasm-opt` it finds,
after any optimising wasm link, and keeps a `target_features` section for it
that build.sh's pass then drops. `NISH_WASM_OPT=0` links with neither pass,
even with binaryen installed: the bytes a machine without it builds.

<a id="wasi-optional-for---profile-wasi" style="scroll-margin-top: 65px"></a>

### WASI (optional, for `--profile wasi`)

The `wasi` profile links the runtime against wasi-libc so that whole programs
(strings, `console.log`, files, `process.argv`) run under any WASI host. It
needs a WASI sysroot and compiler-rt's wasm32 builtins next to your clang:

```bash
# Ubuntu / Debian: the packaged sysroot lands in /usr (/usr/include/wasm32-wasi, /usr/lib/wasm32-wasi)
sudo apt-get install -y wasi-libc libclang-rt-18-dev-wasm32
export WASI_SYSROOT=/usr                      # add to your shell profile

# Any platform: wasi-sdk's sysroot and builtins tarballs (versions that match your clang)
curl -L -o - https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/wasi-sysroot-24.0.tar.gz | tar -xz -C /opt
curl -L -o - https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/libclang_rt.builtins-wasm32-wasi-24.0.tar.gz | tar -xz -C /opt
export WASI_SYSROOT=/opt/wasi-sysroot-24.0    # add to your shell profile
```

`scripts/build.sh` looks for the sysroot in `WASI_SYSROOT`,
`/usr/lib/wasi-sysroot`, `/opt/wasi-sdk/share/wasi-sysroot` and
`/usr/share/wasi-sysroot`, and for `libclang_rt.builtins-wasm32.a` in clang's
resource directory, next to the sysroot (as the tarball above unpacks it),
in `<sysroot>/lib/wasm32-wasi/`, or at `WASI_BUILTINS=<file>`.

The packaged wasi-libc predates wasi-libc's `realpath`, so a module linked
against it answers `realpathSync` with `null` for every path. Use wasi-sdk's
sysroot (22 or later) when a program needs `realpathSync` to resolve. Then:

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
([Packages](guide/language/modules.md#packages)), so this is the one to pick if you want
the compiler pinned per project in a `package.json`:

```bash
npm install -g nish
nish --version
```

Or without npm and without node at all:

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

That unpacks into `~/.nish` and prints the one line to add to your shell
profile. On a platform it has no binary for it says so and names the four it
does build — the npm route covers exactly the same four and no more.

**Upgrade with `nish upgrade`.** It asks GitHub for the latest release and,
when it is newer than the compiler you are running, fetches that release's own
`install.sh` (from its tag, never `main`) into a private file and runs it over
your install's directory. `nish upgrade 0.4.0` installs a version you name, and
says so when it is older; `nish upgrade --check` only prints the version you
have and the latest. A compiler installed with npm is upgraded with npm:
`nish upgrade` prints the `npm install -g nish@<version>` line to run and
changes nothing. Running the install script again does the same job: it
installs over an existing install, says `upgrading nish 0.3.0 to 0.4.0`, and
says `nothing to do` when the version already matches.

Once a day at most, a command on a terminal that exits 0 or 1 (a compile,
`nish --version`, `nish --help` and the like) checks for a
newer release in the background and prints one line on stderr when there is
one. `NISH_NO_UPDATE_CHECK=1` turns it off; it is never shown in CI, with
`--json`, in `nish run`, or when stderr is not a terminal
([the CLI guide](guide/using-nish/cli.md#staying-up-to-date-nish-upgrade)).

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh          # latest
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh -s 0.4.0 # a version
sh install.sh --dir /opt/nish     # somewhere other than ~/.nish (or NISH_INSTALL)
sh install.sh --force             # reinstall the version already there
sh install.sh --no-modify-path    # leave shell startup files alone (or NISH_NO_MODIFY_PATH=1)
sh install.sh --uninstall         # remove it, and the PATH line it added
sh install.sh --help              # all of the above
```

The script puts the install's `bin/` on your `PATH` in the startup file of the
shell `$SHELL` names: `~/.zshrc` for zsh (under `$ZDOTDIR` when that is set),
`~/.bashrc` for bash on Linux, for bash on macOS whichever of
`~/.bash_profile`, `~/.bash_login` and `~/.profile` a login bash already reads
(`~/.bash_profile` when there is none), `conf.d/nish.fish` in fish's
configuration directory for fish, and `~/.profile` for any other shell. The
line sits between `# >>> nish >>>` and `# <<< nish <<<` and is added once:
running the script again, or `nish upgrade`, leaves it as it is, and
`--uninstall` takes it out of every file it may have gone into. Nothing is
written when the directory is already on `PATH`, or when its path holds a
quote, a backslash, a colon or a newline (the script prints the line to add
instead). The script cannot change the `PATH` of the shell you ran it from, so
it ends by naming the file to `source` there.

An upgrade cannot leave you without a compiler. The new one is unpacked beside
the old, checked that it runs *and* that it reports the version that was asked
for — which catches a truncated download, a tarball built for another
architecture, and an asset whose name does not match what is inside it — and
only then swapped in. If any of that fails the install you had is untouched.

**Every download is checked before it is unpacked.** install.sh compares the
tarball's SHA-256 with the release's `SHA256SUMS` (or with the digest pinned
for releases that predate it) and refuses a mismatch. For releases after
0.21.0 it also checks the release's **build provenance attestation** when a
signed-in GitHub CLI is present whose `gh attestation verify` takes the
options below.

The attestation is a Sigstore-signed statement, made by
`actions/attest-build-provenance` in the release workflow, that every file in
`SHA256SUMS` was built by `.github/workflows/release.yml` at the release's tag
on a GitHub-hosted runner. A failed verification refuses the install; with no
`gh`, a signed-out one or one too old for those options, the check is skipped
with a note saying so, and the SHA-256 still applies. Set
`NISH_REQUIRE_ATTESTATION=1` to refuse instead of skipping: the install then
fails unless `gh` verifies the attestation, and refuses a release of 0.21.0 or
older, which carries none. The same command by hand, on a tarball you
downloaded:

```bash
gh attestation verify nish-<version>-<asset>.tar.gz \
  --repo amritk/nish \
  --signer-workflow amritk/nish/.github/workflows/release.yml \
  --source-ref refs/tags/v<version> \
  --deny-self-hosted-runners
```

It works on any file the release attaches, the npm tarballs included. Each
release also attaches `nish-<version>.spdx.json`, an SPDX 2.3 software bill of
materials: every attached file with its SHA-256, the clang, linker, Node.js
and the previous release's compiler that built each tarball,
and the vendored code from
[THIRD_PARTY_NOTICES.md](https://github.com/amritk/nish/blob/main/THIRD_PARTY_NOTICES.md) that each of them contains.
How these fit the rest of the release's defences is
[docs/security/supply-chain.md](security/supply-chain.md).

The npm route installs the **native** compiler, and it is a download rather than a
build: nothing is compiled on your machine. The package declares one
`@amritk/nish-<asset>` package per supported platform as an `optionalDependencies`
entry with `os` and `cpu` set, so npm fetches exactly the one that matches and
skips the rest. Each of those carries the self-hosted compiler — `src/`
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
> (`nish-<version>-<asset>/bin/nish`) or write that wrapper yourself.

**The package is `nish` from 0.20.0**; the older `@amritk/nish` is
deprecated, and `npm install -g nish` replaces it. Versions 0.0.0 and 0.0.1 of
`nish` are an unrelated project that held the name before it, so pin
`nish@^0.20.0` or later rather than an older range.

**On a platform this project attaches no binary for, `npm install` gets you a
command that refuses.** The table below is the whole list, so musl, FreeBSD and
32-bit anything are outside it, and outside it `nish` prints what happened,
names the four platforms that do have a binary, and exits 3:

```
$ nish --version
nish: no prebuilt compiler for freebsd/x64

  This package installs a prebuilt native compiler. One is published for:
    aarch64-darwin  aarch64-linux  x86_64-darwin  x86_64-linux

  There is no compiler inside the package to fall back to, and nothing is
  compiled on your machine on any path.

  To get a compiler for this machine, build one from a released `nish` in a
  checkout of the repository:
    NISH_BOOTSTRAP=<a released nish that runs here> scripts/bootstrap.sh
  docs/INSTALL.md has the detail, including what to do when no released
  binary runs on this platform at all.
```

**musl, FreeBSD and 32-bit platforms have no `npm install` route to a
compiler.** What is left for them is building one from source, and that needs
one thing this page cannot hand you: a compiler that already runs on the
machine. It does not have to be built *for* the machine, only to run *on* it,
so the practical routes are

- a glibc container or host to build in, when the target is musl. Build
  `build/nish` there with `NISH_BOOTSTRAP=<released nish> scripts/bootstrap.sh`
  ([building from source](https://github.com/amritk/nish/blob/main/CONTRIBUTING.md#building-the-compiler-from-source)),
  and then **emit the IR in the container and link it on the musl host**:

  ```bash
  # in the glibc container, where build/nish runs
  build/nish app.ts -o app.ll
  # on the musl host, with its own clang and the runtime from this repository
  clang app.ll runtime/runtime.c runtime/runtime-text.c runtime/runtime-os.c runtime/runtime-parallel.c \
    runtime/runtime-cross.c runtime/runtime-host.c runtime/runtime-net.c \
    runtime/runtime-simd.c runtime/runtime-aes.c runtime/runtime-sha256.c runtime/runtime-chacha20.c \
    runtime/runtime-term.c runtime/runtime-bytes.c runtime/runtime-checksum.c runtime/runtime-sandbox.c \
    runtime/runtime-shm.c runtime/runtime-region.c -ffp-contract=off -lm -o app
  ```

  `--link`ing inside the container is the mistake to avoid: it shells out to the
  container's `clang` and hands you a glibc binary, which is the one thing the
  musl host cannot run. The split works because the compiler's output is
  target-neutral text — the C toolchain that compiles `runtime.c` and links is
  what decides the libc, not the compiler that wrote the IR;
- `--profile wasi`, which compiles the compiler itself into a single WASI module
  that runs anywhere Node does (`web/compile.mjs` drives one). This is not a
  shipped artefact and there is no supported install path for it;
- a target this project does build, if one will do.

If you need one of these to be a first-class install, that is the conversation
to have on the issue tracker rather than a workaround to discover here.

**On the registry from 0.10.0** (0.19.0 is on GitHub only), so
`npm install -g nish` is the whole install. The rest of this section is for a
machine that cannot reach the registry, or a release before 0.10.0.

From a release tarball on GitHub — the same package `npm publish` uploads,
carried by the release instead of the registry. The `Release` workflow attaches
the npm tarball to the release it builds for a `v*` tag. `npm pack` names it
after `package.json#name`, so it is `nish-<version>.tgz` before 0.4.0 and
from 0.20.0 on, and `amritk-nish-<version>.tgz` from 0.4.0 to 0.19.0, while the
package was scoped — the example below is one of the early ones:

```bash
curl -LO https://github.com/amritk/nish/releases/download/v0.2.0/nish-0.2.0.tgz
npm install -g ./nish-0.2.0.tgz
nish --version
```

Installed on its own like that, the package finds no platform package next to
it and refuses — the same refusal as above, but for the other reason: the binary
was never fetched rather than none existing for your machine. The message says
which of the two it is, because the remedy differs. **So install the pair**: a
release from 0.4.0 on attaches the platform packages beside the npm tarball,
under the name `npm pack` gave them.

```bash
base=https://github.com/amritk/nish/releases/download/v0.4.0
curl -LO $base/amritk-nish-0.4.0.tgz
curl -LO $base/amritk-nish-x86_64-linux-0.4.0.tgz     # the row matching your machine
npm install -g ./amritk-nish-0.4.0.tgz ./amritk-nish-x86_64-linux-0.4.0.tgz
```

As a native compiler, which needs no Node at all. A release also attaches the
self-hosted compiler — the binary `src/` produces by compiling itself — one
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

A release already published cannot grow an asset, so **the releases before
v0.4.0 attach `x86_64-linux` only**.

Check [the releases page](https://github.com/amritk/nish/releases/latest) for
what a given version actually carries; on a platform whose row has not shipped
yet, take the npm package above, or build from source below.

```bash
# pick the row above that matches `uname -s` and `uname -m`
curl -LO https://github.com/amritk/nish/releases/download/v0.16.0/nish-0.16.0-x86_64-linux.tar.gz
tar -xzf nish-0.16.0-x86_64-linux.tar.gz
nish-0.16.0-x86_64-linux/bin/nish --version
```

Both URLs name the version rather than using GitHub's version-neutral
`/releases/latest/download/` form, because that form needs the asset's exact
file name and every asset name carries the version in it. The example names
v0.16.0; take the current version from
[the releases page](https://github.com/amritk/nish/releases/latest). v0.1.1 was
the first release with a binary attached; the `v0.1.0` tag has no release and
no assets behind it.

Unpack it and run `bin/nish` from wherever you like; put that on `PATH` if you
want it there. Keep the directory intact rather than moving the binary out of
it: `--link` runs `scripts/build.sh` and compiles the C runtime
(`runtime/runtime.c`, `runtime/runtime-text.c`, the strings and number
formatting, `runtime/runtime-os.c`, the system-call half, and the rest), and the
compiler finds all of them relative to its own location — `bin/nish` alone in a
directory can still emit IR with `-o`, but `--link` will tell you it cannot
find `scripts/build.sh`.

It still needs `clang` and `lld` on `PATH` for `--link` (§1), because linking
is the C toolchain's job, not the compiler's; what it does not need is Node.
On a platform outside the table, build from a checkout.

To build the compiler from a checkout instead, follow
[building the compiler from source](https://github.com/amritk/nish/blob/main/CONTRIBUTING.md#building-the-compiler-from-source).
It needs Node, clang and a released `nish` to start from, which the build
fetches for you.

The published package ships `bin/` (the `nish` command, which is a launcher),
`runtime/` (the C runtime — seventeen translation units, the wasm subset and their
header — and `runtime/sqlite/`, SQLite's vendored source),
`scripts/build.sh` (the link pipeline), `std/` (the standard library) and
`docs/AI.md` (the rules card). The
compiler itself is not in it: it arrives as one prebuilt
`@amritk/nish-<asset>` package per platform, and `bin/nish` hands over to
whichever one npm installed.

That package carries its own copy of all of these, and its `docs/AI.md` is the
one an agent's `nish --help` names. `nish` locates the runtime, the script and
`std/` relative to its own install directory, so a global install works from
any working directory — and the binary runs from inside its own platform
package for exactly that reason.

Building the IR yourself rather than through `--link` means naming the runtime
on the `clang` line, and it is seventeen files:

```bash
clang app.ll runtime/runtime.c runtime/runtime-text.c runtime/runtime-os.c runtime/runtime-parallel.c \
  runtime/runtime-cross.c runtime/runtime-host.c runtime/runtime-net.c \
  runtime/runtime-simd.c runtime/runtime-aes.c runtime/runtime-sha256.c runtime/runtime-chacha20.c \
  runtime/runtime-term.c runtime/runtime-bytes.c runtime/runtime-checksum.c runtime/runtime-sandbox.c \
  runtime/runtime-shm.c runtime/runtime-region.c -ffp-contract=off -lm -o app
```

`runtime.c` is the part every program touches — the arena, arrays, the
panics — `runtime-text.c` holds strings and number formatting, and
`runtime-os.c` wraps the system calls: files, directories, subprocesses,
`getenv`, the monotonic clock.

`-ffp-contract=off` keeps clang from fusing a C `a*b+c` into one rounding
where the CPU has a fused multiply-add (every arm64, x86-64 at v3): the runtime
then prints the same float on every target, as `scripts/build.sh` compiles it.

`runtime-parallel.c` divides work across threads for `nish/threads` (a program
built with `--threads`, as every importer of `nish/threads` is, also needs
`-DNISH_THREADS=1 -pthread` on the line), `runtime-cross.c` copies the strings
and arrays a task answers, a channel sends or a `Mutex` keeps out of the arena
they were made in, `runtime-host.c` holds the wall clock, entropy, file times
and signals, `runtime-net.c` the sockets of `nish:net`, `runtime-simd.c` and
`runtime-aes.c` the vector text search and AES-GCM, `runtime-sha256.c` the
SHA-256 block kernel `nish/crypto/sha256` hands its blocks to on a CPU with the
SHA instructions (`NISH_SHA256=soft` keeps the portable path),
`runtime-chacha20.c` the ChaCha20 keystream `nish/crypto/chacha20poly1305`
hands a message of 256 bytes or more to on a CPU with AVX2 or NEON
(`NISH_CHACHA20=soft` keeps the portable path), `runtime-term.c` the stdin
reads and terminal calls of `nish:term`, `runtime-bytes.c` the byte-class runs
of `nish/bytes`, which `nish/json` steps over, `runtime-checksum.c` the CRC-32
kernels of `nish/compress/checksum`, `runtime-sandbox.c` the confinement a
`--sandbox` build applies, and `runtime-shm.c` the shared-memory regions of
`nish/sync/shm`. They are separate so that each carries its own measured size
ceiling; the core is three files that call each other — `runtime-os.c` builds strings
with `runtime-text.c`'s `nish_str_new` — and calls into none of the others, so a
line that names only `runtime.c`, `runtime-text.c` and `runtime-os.c` links a
program that uses none of the other fourteen. Leave out `runtime-text.c` and it
does not link at all: `nish_str_new` is undefined.

`scripts/build.sh` compiles the other
sixteen beside any
`runtime.c` it is handed, so a build that goes through it — every `--link`,
and every `--profile` recipe in these documents — needs to name only the one.

A program whose IR declares an `sqlite3_*` function also needs SQLite on a
hand-written line. `scripts/build.sh` adds it by itself; by hand, append
`runtime/sqlite/sqlite3.c` with the options `scripts/build.sh` lists under
"SQLite's compile-time options" (at least `-DSQLITE_THREADSAFE=0`, or `=2`
beside `-DNISH_THREADS=1`).

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
see the [user guide](guide/index.md) for the language.

To use a program as a script rather than keep the binary, run it:

```bash
nish run hello.ts
# hello from Nish
```

`nish run [options] <file.ts> [args ...]` compiles the file, links it into
`$XDG_CACHE_HOME/nish/run` (or `~/.cache/nish/run`) when that program has not
been linked before, and starts it with the arguments after the file. The first
run of a new edit pays for one link, and later runs start the cached binary. It
needs clang only for that link. It needs `HOME` or `XDG_CACHE_HOME` set to an
absolute path (a relative one is ignored, as if it were unset), and refuses the
run without one rather than keep a binary in a shared directory. The first run
that builds into the cache makes its root `0700`, so no other user can plant a
binary in it ([docs/security/cli.md](security/cli.md)).

Every link with the debug, speed or size profile, `nish run`'s and `--link`'s
alike, keeps the compiled C runtime in `$XDG_CACHE_HOME/nish/runtime` (or
`~/.cache/nish/runtime`), one entry per profile, `-g`, `--threads`, `CC` and
the version that compiler reports, made `0700` the same way. The first link
compiles the runtime's six files at once into it, and every later link compiles
only the program's modules, also at once, and links against the entry: a
`hello.ts` debug link goes from about half a second to about a tenth. `--link`
with no absolute `HOME` or `XDG_CACHE_HOME`, or with a root it cannot make
private, compiles the runtime itself as it always did; the wasi profile and
`scripts/build.sh` called directly never use the cache. Removing the directory
is always safe.

<a id="4-exit-codes" style="scroll-margin-top: 65px"></a>

## 4. Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: compile error (`file:line:col: error: ...`), missing input file, or an `-o` layout that does not fit the module count |
| 2 | usage error: unknown flag, missing argument, no input files |
| 3 | toolchain error: `--link` found no `clang` (`CC` overrides), or `scripts/build.sh` failed (its output is shown; the `.ll` files are still written) — or the `nish` command found no prebuilt compiler for this platform, or one that would not start. Under `--json` all of these are one `NL0002` object |
| | `nish run` answers these codes until the program starts, and the program's own exit status (`128 + n` for a signal) after that. With neither `HOME` nor `XDG_CACHE_HOME` set to an absolute path it answers 3 |
| 70 | internal compiler error: a broken invariant in the compiler. Please report it at <https://github.com/amritk/nish/issues> with the input and command line; the compiler is self-hosted and has no stack trace to print, so the message it prints is the whole report |

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

# The crypto twins

Each directory here that holds a `family.json` is a **family**: a set of
cryptographic kernels, written once in Nish and once each against OpenSSL, Go's
standard library, RustCrypto and `node:crypto`. Every program follows the same
contract over the same inputs, so all of them print the same checksum.
`run.mjs` builds every program, checks that the checksums agree with the
family's pinned `expected.txt`, and times the programs against each other in
interleaved rounds. Nish's own binary and a byte-identical copy of it run in
the same rounds, and the gap between those two is the noise band.

```bash
node bench/crypto/run.mjs --validate                  # what CI runs: build, checksums, the portable proof; nothing timed
node bench/crypto/run.mjs --validate --write-expected # rewrite each expected.txt, once every twin agrees
node bench/crypto/run.mjs --only hash --rounds 11     # time one family; the section goes to stdout
node bench/crypto/run.mjs --out build/bench/crypto/section.md
node bench/crypto/run.mjs --record                    # splice the section into docs/BENCHMARKS.md
node bench/crypto/run.mjs --no-go --no-rust           # leave twins out; their cells read —
node bench/run.mjs --only crypto                      # the same --record, through the main runner
```

`--compiler <nish>` names the compiler under test, and defaults to
`build/nish`. `--only` takes family names (`hash`) or kernel names (`sha256`).
`--families <dir>` reads the families from another directory, which is how
`tests/run.js` validates an altered copy of one.
`node bench/crypto/run.mjs --help` lists every option. `--record` writes the
whole table, so it refuses `--only`, `--no-<twin>` and `--families`, which time
a part of it or something else: send a part to `--out` or stdout instead. It also refuses a `docs/BENCHMARKS.md`
whose markers are not each there once, `begin` before `end`, or both absent.

`tests/run.js crypto-bench` runs `--validate` over every family it finds. It
also proves that `--validate` fails: a copy of the curves family whose
`expected.txt` has one line altered must exit 1 with a `CHECKSUM MISMATCH`
line, where the unaltered copy passes; and the `portableRounds` proof must pass
the real OpenSSL mask and fail a mask that clears nothing the proof kernel
uses. A new
family therefore needs no edit to the test harness: CI picks up its directory.

A missing toolchain is a note, never a failure, and that twin's columns read
—. The runner detects each twin as follows:

- **OpenSSL:** `$CC` (default `clang`) must compile and link a program that
  includes `<openssl/evp.h>` and `<openssl/ssl.h>` against `-lssl -lcrypto`,
  and the headers must be OpenSSL 3 or newer: the twins call its fetch API
  (`EVP_MD_fetch`, `EVP_MAC`, `EVP_KDF`), which 1.1 lacks.
- **Go:** `go` must be on `PATH`, or `GO=<path>` names it.
- **Rust:** `cargo` must be on `PATH`.
- **Node:** the Node running the script.

A module or crate that does not download is also a note, and so is a Go older
than the `go` line of the family's `go.mod` or a `rustc` older than a crate
needs. A twin that builds and then prints a different checksum is a failure,
and so is a twin that does not build for any other reason. A fetch that fails
on the twin's own `go.mod`, `go.sum`, `Cargo.toml` or `Cargo.lock` (a stale
lock file, a parse error, an unknown directive) is the twin's bug, not the
host's, and exits 1; so does a crate whose own `rust-version` is newer than the
host's `rustc`.

`--validate` first prints `crypto: columns <id>, …`, every column it knows,
and then accounts for each of them in every family it checks, after the
family's `<family>: N of N kernel size(s) match expected.txt` line:

```
crypto: columns nish, openssl, openssl-portable, go, go-purego, rust, rust-soft, node
hash: ran nish, openssl, openssl-portable, rust, rust-soft, node
hash did not run go: Go 1.21.0 is older than the go 1.24 its go.mod asks for
hash did not run go-purego: Go 1.21.0 is older than the go 1.24 its go.mod asks for
```

`<family>: ran` lists the columns at least one check ran. Each other column
gets `<family> has no <column>: <why>`, the family's own word (a twin or
portable build given as a string, every kernel `lacks` it, or no kernel with a
Nish column), or `<family> did not run <column>: <why>`, this machine's reason
(`--no-<twin>`, a missing or too-old toolchain, a download that failed). The
runner is the one authority on what ran: `tests/run.js crypto-bench` reads
these lines rather than probing the toolchains itself, takes its column list
from the `crypto: columns` line, and fails a column that has none of them, or a
run that prints no column list.

`--write-expected` refuses a family where no twin ran, since the checksums it
would pin would then be Nish's alone, agreeing with nothing.

## The program contract

```
<program> <kernel> <size> <iterations>
```

| Stream | Content |
| --- | --- |
| stdout | Exactly `checksum <8 lower-case hex digits>\n`: FNV-1a 32 over every output byte of every iteration, in order. |
| stderr | A line `ns <integer>`: the nanoseconds the timed loop took, read from a monotonic clock. Only the loop is timed, never input generation or key setup. Every iteration's fold is inside the loop, and so is timed, the same in every language. Other stderr lines are ignored. |
| exit status | 0 on success. 1 when an operation fails (a decrypt that does not authenticate, a handshake that does not complete). 2 on a usage error or an unknown kernel. |

`size` is the message length in bytes. For an `op/s` kernel it is whatever
size the kernel's README names, such as the IKM length for HKDF. `iterations`
is at least 1.

### Inputs

Every input is drawn from one stream, so every language sees the same bytes.

- **Seed:** FNV-1a 32 over the ASCII bytes of `<kernel>:<size>` (for example
  `sha256:1024`). A seed of 0 is read as 1.
- **Stream:** xorshift32 with shifts 13, 17 and 5, one step per byte, keeping
  the low byte of each step.
- **Order:** the key, then the nonce, then the AAD, then the message, each with
  the length its kernel declares (0 for an input the kernel does not use).
- **Tweak:** iteration `i` (from 0) XORs `i`, as a little-endian u32, into
  the first four bytes of the message, so every message has at least four
  bytes; a size that gives a shorter one is not a valid case. It starts from the message's original
  four bytes each time, never from the previous iteration's. Each iteration
  therefore hashes, seals or signs a different message, and the optimiser
  cannot hoist the work out of the loop.
- **Fold:** FNV-1a 32, starting at 2166136261, over each iteration's output
  bytes in order: a digest, a tag, a ciphertext followed by its tag, a
  signature, or a shared secret.

A family whose kernel needs another input (a public key, a second party's
share) derives it from these bytes, and its README says how.

### The shared generator and fold: `lib/`

Each language has one copy of the contract. A family's programs import it, so
a family writes only its kernels.

| File | Language | What it gives |
| --- | --- | --- |
| `lib/gen.ts` | Nish (`import … from "../lib/gen"`) | `inputs`, `baseOf`, `tweak`, `fold`, `foldStart`, `parseArgs`, `now`, `report` |
| `lib/gen.h` | C (`-I bench/crypto/lib`, which run.mjs passes) | `inputs`, `tweak`, `fold`, `FOLD_START`, `parse_args`, `now_ns`, `report` |
| `lib/gen.go` | Go (copied into the module's build directory as `gen.go`, package `main`) | `inputs`, `tweak`, `fold`, `foldStart`, `parseArgs`, `report` |
| `lib/gen.rs` | Rust (copied to `src/gen.rs`; the crate declares `mod gen;`) | `inputs`, `tweak`, `fold`, `FOLD_START`, `parse_args`, `report` |
| `lib/gen.mjs` | Node (`import … from "../lib/gen.mjs"`) | `inputs`, `tweak`, `fold`, `FOLD_START`, `parseArgs`, `now`, `report` |

`inputs(kernel, size, keyLen, nonceLen, aadLen, msgLen)` returns the four
buffers. `tweak(bytes, at, base, i)` XORs `i` into `bytes[at..at + 4)`
against the four original bytes `base`; C's `tweak(bytes, base, i)` takes
`bytes + at` instead of an offset. `parseArgs` exits 2 on a bad command line. `report` prints the
checksum line on stdout and the `ns` line on stderr. A change to one file is a
change to all five, and to every family's `expected.txt`.

## A family directory

| File | Required | What it is |
| --- | --- | --- |
| `family.json` | yes | The schema below. |
| `expected.txt` | yes | The pinned checksums: `<kernel> <size> <iterations> <checksum>` per line, at 3 iterations of every size in each kernel's `sizes` and its `validateSize`. `#` starts a comment line. Written by `--validate --write-expected`, never by hand; with `--only`, it replaces the lines that ran and keeps the rest. |
| `README.md` | yes, by review | The inputs each kernel draws and their lengths, the library call each twin makes, and any reason a column differs from the others. |
| `main.ts` | when a kernel has `nish` true | The Nish program, built with `nish --link --profile speed`. |
| `openssl.c` | unless `twins.openssl` is a string | Built with `$CC -O3 -I lib … -lssl -lcrypto`. |
| `go/` | unless `twins.go` is a string | A module (`go.mod`, `go.sum` when it has dependencies, `*.go`, package `main`). It is built with `GOTOOLCHAIN=local GOWORK=off GOFLAGS=-mod=readonly`, after a `go mod download`. |
| `rust/` | unless `twins.rust` is a string | A crate, with its manifest and lockfile stored as `cargo.toml` and `cargo.lock`. The repository's file names are kebab-case, so the runner copies them to `Cargo.toml` and `Cargo.lock`. Dependencies are pinned with `=x.y.z`, and the crate is built with `cargo build --release --locked` after a `cargo fetch --locked`. Its binary is the package's `name`. |
| `node.mjs` | unless `twins.node` is a string | Run as `node node.mjs <kernel> <size> <iterations>`. |

## `family.json`

Every field is checked, and an unknown field is an error, so a misspelt field
cannot fall back to a default.

```json
{
  "title": "SHA-2, HMAC and HKDF",
  "kernels": [
    { "name": "sha256", "sizes": [64, 1024, 1048576], "unit": "MB/s" },
    { "name": "hkdf-sha256", "sizes": [32], "unit": "op/s" },
    { "name": "x448", "sizes": [56], "unit": "op/s", "nish": "std/crypto has no X448 yet" }
  ],
  "twins": {
    "openssl": { "portable": { "env": { "OPENSSL_ia32cap": "~0x1000020000000000:~0x20000120" } } },
    "go": { "portable": { "tags": ["purego"] }, "lacks": { "x448": "crypto/ecdh has no X448" } },
    "rust": { "portable": { "rustflags": ["--cfg", "sha2_backend=\"soft\""] } },
    "node": { "portable": "node:crypto is OpenSSL's libcrypto with its assembly" }
  },
  "portableProof": "sha256@1048576",
  "portableProofFlags": ["ssse3", "avx", "avx2", "bmi2", "sha_ni"],
  "portableMinRatio": { "rust": null },
  "needs": [],
  "notes": []
}
```

### Top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | The heading of the family's table. |
| `kernels` | array, not empty | One entry per kernel; the fields are below. |
| `twins` | object | All four twins, `openssl`, `go`, `rust` and `node`, each either an object (below) or a string saying why the family has none, which the table's footnotes print. |
| `portableProof` | `"<kernel>@<size>"`, or a non-empty list of distinct ones, optional | The case `--validate` times to prove each portable column is portable; a list is tried in order, and the first case that reaches the ratio proves the twin. |
| `portableProofFlags` | array of `/proc/cpuinfo` flags; required with `portableProof` and an `OPENSSL_ia32cap` mask | The extensions whose loss slows the proof kernel under OpenSSL, each one the mask clears. OpenSSL's proof is held only on a CPU that has one of them. |
| `portableMinRatio` | number above 1, or an object, optional | How much slower a portable column must be than its default one at `portableProof`; the default is 1.2. An object sets it per twin (`openssl`, `go` and `rust`; a twin it leaves out keeps 1.2). A twin's value of `null` measures and reports the ratio without gating on it. Only valid with `portableProof`. |
| `portableRounds` | array of twins, optional | The twins (`openssl`, `go`, `rust`) whose proof, short of `portableMinRatio`, is settled by the paired rounds instead (see `portableProof` below). Each one's `portableMinRatio` must be a number. Only valid with `portableProof`. |
| `notes` | array of strings, optional | Footnotes printed under the family's table after the generated ones, for anything about its columns a reader needs and no other field says. |
| `needs` | array, optional | `["loopback"]` when the programs listen on and connect to `127.0.0.1`, as a handshake does. On a machine that refuses a loopback socket, the family is noted and left out, rather than failing; `--validate` prints `<family>: skipped (needs loopback)`. |

### Kernel fields

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | lower-case letters, digits and `-` | What the programs take as `<kernel>`. Unique in the family. |
| `sizes` | integers of at least 4 | The sizes the table times, one row each. The tweak needs four message bytes. |
| `unit` | `"MB/s"` or `"op/s"` | `MB/s` is 10⁶ message bytes a second, the right unit for a hash or an AEAD. `op/s` is operations a second, for a key derivation, a signature or a handshake, whose cost does not scale with a message. |
| `nish` | `true` (the default), or a string | A string makes the kernel twins-only and says why; the table's footnote prints it. The kernel has no Nish column, and its verdicts read —. `false` is refused, so the reason is never left out. Use it for a kernel `std/crypto` does not have yet, so the comparison exists before the Nish side does. A family whose kernels are all twins-only needs no `main.ts`. |
| `validateSize` | integer of at least 4, default the smallest size | A size `--validate` runs and `expected.txt` pins besides `sizes`, for a case too slow to time but worth pinning. |

### Twin fields

| Field | Type | Meaning |
| --- | --- | --- |
| `env` | object of strings, optional | The environment every run of this twin gets: the default and the portable column alike. For Go and Rust it is also the build's environment. |
| `portable` | object, or string | How to build or run the twin without assembly or CPU extensions. A string says why the twin has none; Node must give one. |
| `lacks` | object, optional | A kernel name mapped to why this twin does not implement it. That cell reads —, in the default and the portable column alike, and the footnote prints the reason. |

### `portable` objects, one shape per twin

| Twin | Fields | What the runner does |
| --- | --- | --- |
| `openssl` | `env`, required | Runs the same binary under these variables, typically `OPENSSL_ia32cap`, a mask that clears the CPU capability bits OpenSSL's assembly dispatches on. A mask with no `:` second word clears that whole word (BMI1, AVX2, BMI2, ADX, SHA-NI and on), so write `:~0x0` to keep it. |
| `go` | `tags`, `env` | Builds a second binary with `-tags <tags joined by ,>` (`purego` turns off the standard library's assembly), with `env` at build time and at run time. |
| `rust` | `rustflags`, `env` | Builds a second binary into a target directory of its own, with `CARGO_ENCODED_RUSTFLAGS` set to these flags, one element each. The usual flag is a backend `--cfg` that the crate reads. The default build gets an empty `CARGO_ENCODED_RUSTFLAGS`, and neither build sees a `RUSTFLAGS` from the environment, so the two differ by these flags alone. |

Each shape also takes `lacks`, a kernel name mapped to why the portable build
does not implement it: only that kernel's portable cell reads —, the default
column still runs it, and the footnote prints the reason. `lacks` is not what
makes the build portable, so a `portable` object still needs one of the
twin's other fields.

### `portableProof`

The proof checks that a portable column really is portable. For each twin
with both a default column and a portable one, `--validate` does two things:

1. It requires the portable binary's bytes to differ from the default one's,
   when it is a separate binary (Go and Rust). This step is exact: it shows the
   tag or flag reached the compiler. A misspelt `--cfg` is silently ignored, and
   it would produce the same bytes.
2. It times both columns at `portableProof` in 5 interleaved rounds (8, once
   rounded up as below) and
   compares their fastest rounds: noise on a shared machine only ever adds
   time. The portable column must take at least `portableMinRatio` times as
   long. A short result is measured once more over 11 rounds (12) before it counts
   as short.

A twin listed in `portableRounds` gets one more measurement when both ratios
fall short: 48 interleaved rounds of the two columns, each round a pair run
back to back. The portable column must be the slower of the pair in at least
36 of them. A mask that changed nothing runs the same code on both sides, so
each pair is a coin toss whatever the machine's noise, and 36 of 48 or more
comes up by chance less than once in a thousand runs; a real cost, even one
inside the ratio's noise, wins nearly every pair. The line reads `portable
<family> <column>: <ratio> the time of <twin> at <case>, slower in <n> of 48
paired rounds (needs <ratio>, or 36 of 48)`, or `NOT PORTABLE …` when short.
It is for a mask whose cost on some CI machines is about the size of the
ratio's noise: on GitHub's runners OpenSSL's X25519 under the curves family's
mask measured 1.029x to 1.046x against its 1.05x floor, while a reference
machine measures 1.1x. A lower floor would pass a mask that changed nothing
on a noisy run; a paired count does not.

When `portableProof` is a list, a short case prints `short <family> <column>:
… trying <next case>` and the next case is timed the same way; the first case
that reaches the ratio proves the twin, and only the last one's short result
counts as `NOT PORTABLE`. The cases a twin or its portable build `lacks` are
skipped. A list is for a mask whose cost depends on the CPU: which assembly
OpenSSL picks, and so what the mask takes away, changes with the extensions
the CPU has.

Each case's size must be one of its kernel's `sizes`. A column the proof
cannot reach prints `portable <family> <column>: unproved (<why>)` rather than
passing silently or failing. That is a column this machine did not build, a
twin or a portable build that `lacks` the kernel, or a host with nothing for the
portable build to give up:

- Go and Rust are proved on x86-64 and arm64 only, where the default builds
  carry the assembly the tag or flag takes away.
- OpenSSL is proved on x86-64 only, and only when `/proc/cpuinfo` lists one of
  the family's `portableProofFlags`: the extensions the mask clears that the
  proof kernel's assembly actually uses. The mask may clear more (the hash
  family's clears SSSE3, which SHA-256 uses and SHA-512 does not), so a flag it
  clears is not enough. On a CPU with none of the listed flags the masked and
  the unmasked run take the same path, and a ratio would fail a column that is
  portable. The hash family lists `ssse3`, `avx`, `avx2`, `bmi2` and
  `sha_ni`, the extensions OpenSSL's SHA-256 and SHA-512 paths beyond their
  scalar ones need.

On GitHub Actions on x86-64 Linux, `tests/run.js`'s `crypto-bench` check
also requires every family to be validated, no `did not run` line, and the
OpenSSL and Go proofs of every family with a `portableProof` to be proved
lines, not `unproved`: the runner has the toolchains and the extensions, so a
column left out there means the gate failed open.

Neither run inherits an `OPENSSL_ia32cap` or `OPENSSL_armcap` from the caller's
environment: the default column runs unmasked, and the portable one under the
family's mask alone.

Choose a kernel and size at which the twin's assembly really is faster on the
machines CI uses. Where it is only marginally faster, give that twin `null`:
the bytes check (step 1) still gates it, and the ratio is printed. OpenSSL
cannot take `null`: its portable column is the same binary, so there is no
bytes check, and only the time proves its mask did anything. The hash family does
this for Rust, whose SHA-512 AVX2 path is about 10% faster than its soft path
on a CPU without SHA extensions.

## The table

Each case (a kernel and a size) works in three steps:

1. Calibrate one iteration count on its first column, so that a run takes
   about 200 ms.
2. Run every column for `--rounds` rounds at that count, in
   `bench/json-compare/rounds.mjs`'s order: rotated one place each round and
   reversed on every other block, with the rounds rounded up to a multiple of
   twice the columns, so every column takes every place equally often and Nish
   and its copy take turns going first.
3. Report the median of each column's own `ns` lines. A checksum, in any
   round, that differs from the first column's fails the run, and nothing is
   written.

A run that takes longer than 120 s, in the table or in `--validate`, counts as
a failed one.

The two verdict columns divide Nish's median time by the fastest column in a
group:

- **Nish / best portable:** OpenSSL portable, Go purego and Rust soft.
- **Nish / best assembly:** OpenSSL, Go, Rust and Node, each in its default
  build.

Each quotient is read against that row's noise band, `|nish / nish-copy − 1|`,
by `bench/par-reading.mjs`'s `sideOf`. The band is Nish's gap alone, not
`bench/run.mjs`'s `judge`, the larger of both binaries' gaps to their copies. A
copy of every twin would add up to seven columns to every row, and the noise a
band measures is mostly the machine's: every column runs in the same
interleaved rounds and meets it alike. A twin whose own runs spread wider than
Nish's is not caught by it, so a quotient just past the band is weak evidence;
the table's **Band** column prints each row's band, as `±1.2%`, between the
timed columns and the two quotients read against it.

- **within the band:** no difference;
- **edge:** too close to call;
- **slower** or **faster:** a measured difference.

Every — in the table gets a footnote saying why.

The section sits between `<!-- crypto:begin -->` and `<!-- crypto:end -->` in
`docs/BENCHMARKS.md`. `bench/run.mjs` rewrites that file, but it carries the
section over unchanged. Record on a quiet machine: a busy one measures the
machine.

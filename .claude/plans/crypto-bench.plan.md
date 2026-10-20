---
name: Crypto benchmarks against OpenSSL, Go and Rust (#475)
overview: Add bench/crypto/, a directory of programs that time std/crypto's kernels, the TLS 1.3 handshake and the QUIC handshake against OpenSSL, Go, Rust and Node. Each accelerated primitive gets an assembly column and a portable column, every program prints a checksum over the same inputs, and rounds are interleaved with a noise band. The tables go into a generated section of docs/BENCHMARKS.md, the kernels join the instruction gate, and the numbers are read back against wp34 §6 S1.
stages:
  - id: harness
    title: "bench(crypto): add the crypto twin harness with the hash kernels"
    goal: bench/crypto/run.mjs builds, validates and times every family in interleaved rounds with a noise band, and proves it on SHA-256, SHA-512, HMAC-SHA256 and HKDF in Nish, OpenSSL, Go, Rust and Node
    verification: node bench/crypto/run.mjs --validate && node bench/crypto/run.mjs --only hash --rounds 3 --out build/bench/crypto/section.md && node tests/run.js crypto-bench && npm run check && npm run lint
    todos:
      - id: harness-contract
        content: Write bench/crypto/README.md — the program contract, the input generator, the checksum fold and the column set — see Contract
      - id: harness-runner
        content: Write bench/crypto/run.mjs — family discovery, builds, --validate, interleaved rounds, noise band, --record — see Harness
      - id: harness-hash
        content: Add bench/crypto/hash/ — Nish, OpenSSL, Go, Rust and Node twins for sha256, sha512, hmac-sha256 and hkdf-sha256 — see Harness
      - id: harness-only-crypto
        content: Make node bench/run.mjs --only crypto delegate to bench/crypto/run.mjs --record — see Harness
      - id: harness-ci
        content: Add a crypto-bench check to tests/run.js that runs --validate over every family found — see Harness
      - id: harness-readme
        content: Point bench/README.md at bench/crypto/ and say what bench/aes-gcm.mjs and bench/p256.mjs still measure — see Harness
  - id: aead
    title: "bench(crypto): time AES-128/256-GCM and ChaCha20-Poly1305 against the twins"
    goal: Seal and open for AES-128-GCM, AES-256-GCM and ChaCha20-Poly1305 at 64 B, 1,350 B, 16 KiB and 1 MiB, with portable and assembly columns for every twin that has both
    verification: node bench/crypto/run.mjs --validate --only aead && node bench/crypto/run.mjs --only aead --rounds 3 --out build/bench/crypto/aead.md && node tests/run.js crypto-bench
    todos:
      - id: aead-twins
        content: Add bench/crypto/aead/ with the five twins for the six seal and open kernels — see AEAD
      - id: aead-portable
        content: Prove each portable column really is portable, with the proof printed by the runner — see AEAD
  - id: curves
    title: "bench(crypto): time X25519, P-256, Ed25519 and X.509 against the twins"
    goal: X25519 base and variable point, P-256 sign and verify, Ed25519 sign and verify (twins only), X.509 mint and parse
    verification: node bench/crypto/run.mjs --validate --only curves,x509 && node bench/crypto/run.mjs --only curves,x509 --rounds 3 --out build/bench/crypto/curves.md && node tests/run.js crypto-bench
    todos:
      - id: curves-twins
        content: Add bench/crypto/curves/ with x25519-base, x25519, p256-sign, p256-verify, ed25519-sign and ed25519-verify — see Curves and X.509
      - id: curves-ed25519
        content: Give Ed25519 a Nish cell that reads "not in std/crypto", and file the follow-up issue — see Curves and X.509
      - id: curves-x509
        content: Add bench/crypto/x509/ with x509-mint and x509-parse twins — see Curves and X.509
  - id: handshake
    title: "bench(crypto): time one full TLS 1.3 and one QUIC handshake against the twins"
    goal: One full TLS 1.3 handshake and one QUIC handshake, client and server in one process, in Nish and in each twin that can do it
    verification: node bench/crypto/run.mjs --validate --only handshake && node bench/crypto/run.mjs --only handshake --rounds 3 --out build/bench/crypto/handshake.md && node tests/run.js crypto-bench
    todos:
      - id: handshake-tls
        content: Add bench/crypto/handshake/ tls13 for Nish, OpenSSL, Go, Rust (rustls) and Node — see Handshakes
      - id: handshake-quic
        content: Add the quic kernel for Nish, Go (quic-go) and Rust (quinn), with OpenSSL 3.0 skipped and the reason given — see Handshakes
  - id: record
    title: "bench(crypto): record the crypto tables and read them against wp34 S1"
    goal: docs/BENCHMARKS.md carries the generated crypto section, the kernels join the instruction gate, each cell more than 1.5x behind portable is analysed, and wp34 §6 S1 is updated or confirmed against the numbers
    verification: node bench/run.mjs --only crypto && git diff --exit-code -- docs/BENCHMARKS.md ':!docs/BENCHMARKS.md' ; node bench/run.mjs --instructions --check && node tests/run.js instructions && node tests/run.js crypto-bench && node docs/check-links.mjs
    todos:
      - id: record-section
        content: Run node bench/run.mjs --only crypto and commit the generated crypto block in docs/BENCHMARKS.md — see Record
      - id: record-gate
        content: Add the Nish crypto kernels to bench/instructions.json and update the program count in bench/run.mjs and tests/run.js — see Record
      - id: record-analysis
        content: Write docs/crypto-performance.md with a wp9-style cause for every cell more than 1.5x behind portable — see Record
      - id: record-s1
        content: Update or confirm docs/wp34-hosting-cs.md §6 S1 from the numbers, and file the AES-NI/PCLMUL issue if they undermine it — see Record
---

## Context

WP34 §6 S1 chose pure-Nish cryptography, and nothing has measured it since ([#475](https://github.com/amritk/nish/issues/475)). [bench/aes-gcm.mjs](../../bench/aes-gcm.mjs) and [bench/p256.mjs](../../bench/p256.mjs) time Nish alone. They have no twins, are not in [bench/run.mjs](../../bench/run.mjs) and are not in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md). [std/crypto/](../../std/crypto) has AES-GCM, ChaCha20-Poly1305, SHA-256/384/512, HMAC, HKDF, X25519, P-256 and X.509. It has **no Ed25519**. [std/net/tls.ts](../../std/net/tls.ts) is server-only. The test clients that drive it live under [tests/link/](../../tests/link), and [tests/link/net_tls_resume_bench/main.ts](../../tests/link/net_tls_resume_bench/main.ts) already times handshakes in-process in interleaved rounds.

This container has Go 1.24, cargo 1.97, OpenSSL 3.0.13 with headers and libcrypto, Node 22 and valgrind.

## Approach

- **A directory with its own runner**, after [bench/json-compare/](../../bench/json-compare). The core `BENCHMARKS` array in run.mjs needs one `.c` per program and does not interleave. `bench/run.mjs --only crypto` delegates to the new runner rather than growing that array.
- **One family per directory**, discovered by the runner. Stages 2–4 each add a directory and touch nothing shared. The CI check written in stage 1 validates whatever families exist, so a later family is covered without another edit to `tests/run.js`.
- **The generated block is a marker section.** It sits between `<!-- crypto:begin -->` and `<!-- crypto:end -->`. run.mjs's `kept` regex already carries such a block over a full run. Only stage 5 writes the block into docs/BENCHMARKS.md. Earlier stages write it to `--out` under `build/`.
- **Ed25519 is twins-only**, as the user decided at sign-off. The Nish cell reads `not in std/crypto` and a follow-up issue is filed. No stage edits `std/`.
- **The noise band is Nish against a byte-identical copy of its own binary**, timed in the same interleaved rounds. A ratio is read against it with `judge`/`sideOf` from [bench/par-reading.mjs](../../bench/par-reading.mjs), reused rather than reimplemented. "Faster" or "slower" is claimed only outside the band.

## Contract

Every program in every language follows one contract, written once in `bench/crypto/README.md`:

```
<program> <kernel> <size> <iterations>
  stdout: checksum <8 hex digits>     # FNV-1a 32 over every output byte, in order
  stderr: ns <elapsed>                # the timed loop only, monotonic clock
  exit 1 on any failed operation (a null seal, a failed open, a failed verify)
```

- **Inputs.** A shared xorshift32 seeded from the kernel name and size fills the key, nonce, AAD and message, with the same bytes in every language. Iteration `i` XORs `i` (u32 LE) into the first four message bytes and the last four nonce bytes, so no iteration repeats an input and nothing can be hoisted out of the loop.
- **Fold.** Every output byte of every iteration goes into the checksum: digests, ciphertext with its tag, recovered plaintext, shared secrets, Ed25519 signatures, DER bytes.
- **Randomised outputs.** Go and OpenSSL randomise ECDSA signatures. The P-256 sign kernel therefore folds a byte that says whether the signature verifies, plus the digest, rather than the signature bytes. The verify happens outside the timed loop. Verify kernels fold their boolean over a fixed ring of 16 signatures, one of them tampered. X.509 mint folds the parsed back subject, validity and public key. The handshake folds the negotiated suite and group and an echoed application record.
- **Open and verify** use a ring of 16 inputs prepared before the clock starts, as [bench/aes-gcm.ts](../../bench/aes-gcm.ts) does.
- **Columns.** `nish`, `nish-copy` (the noise band), `openssl`, `openssl-portable`, `go`, `go-purego`, `rust`, `rust-soft`, `node`. A twin that has no portable switch for a kernel gets one column, and the family's own `README.md` says why for that kernel.
- **`family.json`.** Each family directory declares itself, so the runner stays generic and stages 2–4 never edit it: `{ kernels: [{ name, sizes, unit: "MB/s" | "op/s", nish: true | false }], twins: { openssl, go, rust, node }, portable: { openssl: { OPENSSL_ia32cap }, go: { tags }, rust: { rustflags } }, portableProof?: "<kernel>@<size>", validateSizes }`. A kernel with `nish: false` is twins-only. Its Nish cell prints `—` with the family's note. `portableProof` names the kernel whose assembly/portable ratio `--validate` checks. Stage 1 fixes this schema. A later family that needs a field the schema lacks says so in its PR rather than editing the runner.
- **Layout.** `bench/crypto/<family>/` holds `family.json`, `README.md`, `expected.txt` (the pinned Nish checksums at `validateSizes`), `main.ts`, `openssl.c`, `go/` (module), `rust/` (crate, with `Cargo.lock`) and `node.mjs`.

## Harness

**Owns:** `bench/crypto/run.mjs`, `bench/crypto/README.md`, `bench/crypto/lib/**`, `bench/crypto/hash/**`, `bench/run.mjs`, `bench/README.md`, `tests/run.js`, `.gitignore`

- **`bench/crypto/run.mjs` flags.** `--validate` builds every variant, runs each kernel once at a small size and compares checksums. It exits 1 on a mismatch, prints `CHECKSUM MISMATCH <kernel> <variant>` and runs no timing. It ends with the line `crypto: checksums agree over <n> kernel(s) and <m> variant(s)`. Other flags: `--only <family|kernel,…>`, `--rounds N` (default 11), `--out <file>`, `--record` (splices the block into docs/BENCHMARKS.md), `--compiler` (via [bench/compiler.mjs](../../bench/compiler.mjs)) and `--no-rust`/`--no-go`/`--no-openssl`/`--no-node`. A missing toolchain is skipped with a `note:` naming it, as run.mjs does, and the skipped column reads `—` in the table.
- **Timing.** For each kernel × size the runner calibrates iterations once on `nish`, so a run takes about 200 ms, and gives every variant that same count. It runs `--rounds` rounds with the order rotating each round, as `(i + round) % n` in run.mjs does, and reports the median. Byte kernels report MB/s and op kernels report op/s. The table also gives `nish / best portable` and `nish / best assembly` ratios, each with its band verdict.
- **Machine line.** The block records the CPU model, the relevant CPU flags (`aes`, `pclmulqdq`, `sha_ni`, `avx2`, `avx512f`) and every toolchain version.
- **Builds.** Builds go to `build/bench/crypto/<family>/`. Nish builds with `--profile speed`. C uses `clang -O3` with `-lcrypto`. Go builds as a module per family, plus `-tags purego`. Rust is one crate per family with a committed `Cargo.lock`, built `--release`. `rust-soft` is built with the RustCrypto `force-soft`/`backend="soft"` cfgs in `RUSTFLAGS` and has its own target dir. Node runs the `.mjs` file directly.
- **Hash family** (`bench/crypto/hash/`). Kernels `sha256` and `sha512` at 64 B, 1 KiB and 1 MiB. `hmac-sha256` at 64 B and 1 KiB. `hkdf-sha256` is extract plus a 42-byte expand. SHA-NI is the accelerated primitive here: `openssl-portable` masks it, and `go-purego` and `rust-soft` disable it.
- **`bench/run.mjs --only crypto`.** Add `crypto` to `known()` and make it spawn `bench/crypto/run.mjs --record`, forwarding `--compiler`. A full `bench/run.mjs` run does not run crypto unless it is named, as with `awfy`, and still carries the existing block over.
- **CI** (`tests/run.js`, beside the WP9 bench check at ~14950). Add `check("crypto-bench: every family's twins print the same checksum as Nish …")`. It runs `node bench/crypto/run.mjs --compiler <NISH> --validate` and passes on exit 0 plus the `crypto: checksums agree` line. The Nish output must also equal a checksum file pinned per family at `bench/crypto/<family>/expected.txt`, so a missing twin can never make the check vacuous.
  - **Skips.** A twin whose toolchain is absent is reported in the check's output and is **not** a counted skip, so it adds no degradation. Validation must stay under 3 minutes on a cold build of the hash family. Rust crates build into a cached target under `build/`.
  - **Proof.** Show the check failing on a deliberately wrong twin checksum before committing.
- **Existing benches.** Leave bench/aes-gcm.mjs and bench/p256.mjs in place. bench/README.md says that they time Nish against itself (the AES path switch, the WP34 K5 baseline) and that bench/crypto/ is the comparison.

## AEAD

**Owns:** `bench/crypto/aead/**`

- **Kernels.** `aes128gcm-seal`, `aes128gcm-open`, `aes256gcm-seal`, `aes256gcm-open`, `chacha20poly1305-seal` and `chacha20poly1305-open`, each at 64, 1350, 16384 and 1048576 bytes. AAD is 13 bytes and the nonce is 12.
- **Twins.** OpenSSL EVP. Go `crypto/aes`+`crypto/cipher`, with `golang.org/x/crypto/chacha20poly1305`. Rust `aes-gcm` and `chacha20poly1305` (RustCrypto). Node `crypto.createCipheriv`.
- **Portable columns.**
  - `OPENSSL_ia32cap` masks AES-NI, PCLMULQDQ, AVX and AVX2 for AES-GCM, and the SIMD paths for ChaCha.
  - Go uses `-tags purego`.
  - Rust uses `--cfg aes_force_soft --cfg polyval_force_soft --cfg chacha20_force_soft`.
- **Proof that the mask took effect.** `--validate` prints, per twin, the assembly/portable time ratio of the 16 KiB seal. A ratio within 1.2x of 1 for AES-GCM fails validation with `portable column is not portable`. Name the mask bits in `bench/crypto/aead/README.md` and in `family.json`'s `portable`. `portableProof` is `aes128gcm-seal@16384`.

## Curves and X.509

**Owns:** `bench/crypto/curves/**`, `bench/crypto/x509/**`

- **Curve kernels.**
  - `x25519-base` and `x25519`, the latter with a variable point that comes from the previous iteration's output.
  - `p256-sign`, which is SHA-256 plus ECDSA over a 64-byte message, folded as in Contract.
  - `p256-verify`, over a ring of 16 with one tampered.
  - `ed25519-sign` and `ed25519-verify`.
- **Twins.** OpenSSL EVP_PKEY. Go `crypto/ecdh`, `crypto/ecdsa` and `crypto/ed25519`. Rust `x25519-dalek`, `p256` and `ed25519-dalek`. Node `crypto`.
- **Portable columns.** Go `purego` applies to P-256 (its assembly path is the nistec fiat/asm split). OpenSSL's ia32cap mask applies where it reaches. Rust uses `curve25519_dalek_backend="serial"`. `bench/crypto/curves/README.md` records any kernel where a twin has no portable switch.
- **Ed25519.** The Nish column prints `—` and its note reads `not in std/crypto`. The kernel is `nish: false` in `family.json`. The twins still cross-check each other's checksums (Ed25519 is deterministic). File one issue: "std/crypto: Ed25519 (RFC 8032)", linking #475 and the measured twin numbers.
- **X.509 kernels** (`bench/crypto/x509/`).
  - `x509-mint` creates a self-signed P-256 certificate with fixed subject and validity. The folding is defined in Contract.
  - `x509-parse` parses a fixed DER certificate and folds the subject, the validity dates, the SPKI bytes and the signature-verifies byte.
  - Twins are OpenSSL `X509_*`, Go `crypto/x509` and Rust `rcgen`+`x509-parser` (or `x509-cert`). Node gets `X509Certificate` for parse only.

## Handshakes

**Owns:** `bench/crypto/handshake/**`

- **`tls13`.** One full TLS 1.3 handshake, TLS_AES_128_GCM_SHA256 over X25519 with an ECDSA-P256 certificate and no resumption. The client and server run in one process over memory buffers, followed by one 32-byte application record echoed back.
  - **Nish** drives [std/net/tls.ts](../../std/net/tls.ts)'s `TlsServer` with the client from [tests/link/net_tls_common/](../../tests/link/net_tls_common). Import it rather than copy it. If it cannot be imported from `bench/`, say why in `bench/crypto/handshake/README.md`.
  - **Twins.** OpenSSL uses memory BIO pairs. Go uses `crypto/tls` over `net.Pipe`. Rust uses `rustls` with the `ring` provider (no cmake). Node uses `tls` over a socket pair.
- **`quic`.** One QUIC v1 handshake to 1-RTT, in-process.
  - **Nish** uses [std/net/quic.ts](../../std/net/quic.ts) with the `QcClient` from [tests/link/net_quic_conn/](../../tests/link/net_quic_conn).
  - **Twins.** Go uses `quic-go` and Rust uses `quinn`, each over an in-memory transport if the library offers one and loopback UDP otherwise. Say which in the table.
  - OpenSSL 3.0 has no QUIC server, so its column is skipped with that reason. Node has no stable QUIC, so it is skipped the same way.
- **Units and checksum.** Handshakes report handshakes per second. The checksum is defined in Contract.

## Record

**Owns:** `docs/BENCHMARKS.md`, `bench/instructions.json`, `bench/run.mjs`, `tests/run.js`, `docs/crypto-performance.md`, `docs/wp34-hosting-cs.md`, `docs/README.md`

- **Block.** Run `node bench/run.mjs --only crypto` on the stage's head and commit the block it writes. Nothing outside the markers may change. The commit body's `Measured:` trailer copies the headline figures from the block: AES-128-GCM 1,350 B seal, Nish against portable and against assembly, with the band.
- **Instruction gate.** Add the Nish programs at small fixed sizes to [bench/instructions.json](../../bench/instructions.json), written by `node bench/run.mjs --instructions --update`. Change the hard-coded `all 21 within` count in bench/run.mjs and in `tests/run.js` (~15606) to the new count.
- **Analysis.** Write a new [docs/crypto-performance.md](../../docs/crypto-performance.md), linked from the block's intro and from [docs/README.md](../../docs/README.md). Each Nish cell more than 1.5x behind the best portable twin gets one root cause, traced in the style of [docs/wp9-optimisation.md](../../docs/wp9-optimisation.md): the IR or the algorithm that costs it, the experiment that shows it, and the date and commit of the numbers.
- **S1 follow-through.** Read AES-GCM at 1,350 B against the relay's datagram rate in [docs/wp34-hosting-cs.md](../../docs/wp34-hosting-cs.md) §6 S1. If the numbers undermine S1, rewrite the row and file "builtins: AES-NI and PCLMUL for std/crypto/aes", linking K3's deferral. If they do not, add one sentence to S1 citing the measured figure.

## Out of scope

- Any change to `std/`, `src/` or `runtime/`, a new Ed25519, or a faster kernel. This plan measures. It does not optimise.
- `.github/workflows/`. CI coverage comes through `tests/run.js`, which the `test` job already runs.
- Moving bench/aes-gcm.mjs or bench/p256.mjs.

## Tests

- `tests/run.js` `crypto-bench` (stage 1) covers every family through `--validate` and the pinned `expected.txt`. Its negative proof is a mutated twin checksum, shown failing in the PR.
- Stage 5 extends `instructions` to the new count.
- There are no new `tests/cases/*`, so no golden or differential registration is needed.

## Verification

Each stage's `verification` line, plus `npm run check`, `npm run lint` and an undegraded `npm test` before the PR goes up. Generated files are regenerated with their tooling, never edited by hand: the `crypto` block of docs/BENCHMARKS.md (`bench/run.mjs --only crypto`) and the counts in bench/instructions.json (`--instructions --update`).

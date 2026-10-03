# Security audit index

The index of the repository's first security audit (#363). Each area was
audited by its own stage, and each stage left a record in this directory. A
record says what was checked, how, what was found, its severity and what became
of it, and it names the test that pins each property. How to report a
vulnerability, which releases get fixes and the threat model in brief are in
[`SECURITY.md`](../../SECURITY.md).

Every fix landed with a regression test that was shown failing on the stage's
base commit and passing after. An area that found nothing would still have
shipped its record and tests pinning what it checked.

**Severity.** Critical: forgery, key recovery, remote code execution. High:
memory corruption, a verifier that accepts bad input, secret-dependent timing
in a fixture path. Medium: denial of service (a panic, an unbounded loop or
allocation) on attacker input. Low: hardening and documentation drift.

## Areas

Counts are by severity, C / H / M / L, and say what is true on `main` now. A
finding one stage left open and a later stage fixed is counted as fixed, under
the record that found it. The notes below the table name each such finding.

| Area | Record | Scope | Fixed (C / H / M / L) | Open (C / H / M / L) |
| --- | --- | --- | ---: | ---: |
| AEADs | [crypto-aead.md](crypto-aead.md) | `std/crypto/chacha20poly1305.ts`, `std/crypto/aes.ts` | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 |
| P-256 and X25519 | [crypto-ecc.md](crypto-ecc.md) | `std/crypto/p256.ts`, `std/crypto/x25519.ts`, their constant-time fixtures | 0 / 0 / 0 / 2 | 0 / 0 / 0 / 1 |
| SHA-2, HMAC, HKDF, ct, base64url | [crypto-k1.md](crypto-k1.md) | `std/crypto/sha256.ts`, `sha512.ts`, `hmac.ts`, `hkdf.ts`, `ct.ts`, `base64url.ts` | 0 / 3 / 0 / 3 ¹ | 0 / 0 / 0 / 0 |
| DER, PEM, X.509 | [crypto-x509.md](crypto-x509.md) | `std/crypto/x509.ts` | 0 / 0 / 0 / 6 | 0 / 0 / 0 / 2 |
| Constant-time checks | [ct-verification.md](ct-verification.md) | `tests/ct-asm.js`, `tests/ct-timing.js`, the `ct_asm_*` fixtures, the harness in `tests/run.js` | 0 / 0 / 0 / 14 | 0 / 1 ² / 0 / 1 |
| Codegen | [codegen.md](codegen.md) | `src/bounds.ts`, `src/attributes.ts`, `src/escape.ts`, `src/parallel.ts`, `src/emit-arrays.ts` | 0 / 3 / 3 / 2 ³ | 0 / 1 / 0 / 1 |
| C runtime | [runtime.md](runtime.md) | `runtime/*.c`, `runtime/nish.h` | 0 / 2 / 3 / 4 ⁴ | 0 / 0 / 0 / 4 |
| CLI and `nish run` | [cli.md](cli.md) | `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts` (module resolution) | 0 / 1 / 2 / 4 ⁵ | 0 / 0 / 0 / 3 |
| Supply chain | [supply-chain.md](supply-chain.md) | `install.sh`, `bin/`, the install, seed and build scripts, `.github/workflows/`, `runtime/nish.mjs` and `shim.mjs`, `web/` | 3 / 0 / 2 / 19 | 0 / 0 / 0 / 1 ⁶ |
| **Total** | | | **3 / 9 / 10 / 57** | **0 / 2 / 0 / 13** |

1. K1-6 (High) was found by the K1 stage and fixed by the two after it: `push`
   and `new Array` by the codegen stage, and the file reads and concatenation
   by the runtime stage. The one source left, `join`, is counted under CG-3.
2. CT-13 is High *if real* and is unconfirmed.
3. CG-9 (Low) was fixed by the runtime stage as RT-7. K1-6, which the codegen
   record also lists, is counted once, under K1.
4. RT-9 added the ownership primitives CLI-7 and CLI-9 need; it is counted as
   a fixed Low. The "CG-3 (rest)" row of that record is CG-3 and is counted
   under codegen.
5. CLI-6 (Medium) was fixed in the runtime as RT-4. The compiler is built by
   the last release, so `nish` itself has the fix from 0.16.0.
6. SC-17 (Low) is accepted rather than open, and is not counted: `curl … | sh`
   runs `install.sh` unverified, and the record says why that stands.

## Open findings

Every finding still open across the records, most severe first. Where a
follow-up issue exists it is named. The rest are recorded in their records
only.

| Id | Severity | File | What is left | Follow-up |
| --- | --- | --- | --- | --- |
| CG-3 | High | `src/emit-arrays.ts` (`join`); `src/bounds.ts` | Under `--number-mode i32` a string `join` builds can pass 2^31 − 1 bytes, its `length` reads back negative, and the bounds prover trusts it. Every other source of such a length is closed | #382 |
| CT-13 | High if real; unconfirmed | `tests/cases/ct_asm_x25519.ts` (`ladderStep`), `std/crypto/x25519.ts` | `ladderStep` measured \|t\| = 35–42 in one link layout of the timing driver and 1.4–2.9 in others. Not established as a leak or as an artefact | #378 |
| CG-10 | Low | `src/emit-arrays.ts` (`emitElementAssignment`) | `xs[0] += grow(xs)` takes the slot's address before the right side runs, so the store lands in the old block | #382 |
| CLI-7 | Low | `src/compile.ts` (`runProgram`) | A cache hit does not check who owns the cache root. The primitive exists now (RT-9); `src/` may use it from the next release | — |
| CLI-8 | Low | `src/run-cache.ts` (`fnv1a64Hex`) | The cache entry is named by a 64-bit FNV-1a, not a cryptographic hash | — |
| CLI-9 | Low | `src/compile.ts` (`programOnPath`, `packageRootCandidates`) | The package root is trusted without an owner check, and `programOnPath` takes the first readable `nish`, where the shell takes the first executable one. Documented in [`docs/INSTALL.md`](../INSTALL.md); the primitives exist now (RT-9) | — |
| ECC-2 | Low | `std/crypto/p256.ts`, `std/crypto/x25519.ts` | Secret intermediates are not wiped. Needs a `secureZero`-style primitive in `runtime/` and `src/` | — |
| X509-6 | Low | `std/crypto/x509.ts` (`x509MintSelfSigned`) | The mint takes its key and serial from the caller. A helper that draws both would have to be a native-only module | — |
| X509-7 | Low | `std/crypto/x509.ts` (`x509ParseP256PrivateKey`) | Private-key material is not wiped. Same primitive as ECC-2 | — |
| CT-16 | Low | `tests/run.js` | The check reads `clang -O2` for the baseline CPU only. Documented in [`docs/LANGUAGE.md`](../LANGUAGE.md#constant-time-ctselect-and-cteq) | — |
| RT-10 | Low | `runtime/runtime-host.c` (`nish_signal_fd`) | Two threads whose first `signalFd()` calls overlap each make a pipe, and one never hears a signal | — |
| RT-11 | Low | `runtime/runtime.c` (`nish_write`) | A short `write(2)` is ignored | — |
| RT-12 | Low | `runtime/runtime-os.c` | File descriptors are not `O_CLOEXEC` | — |
| RT-13 | Low | `runtime/runtime-os.c` | The read loop stops at `EINTR` and answers a short file | — |
| SC-16 | Low | `.github/workflows/release.yml` | Immutable releases are on from v0.16.0 (`immutable: true`), so its assets and `SHA256SUMS` are fixed once published. Build provenance attestations, the stronger answer, are not: they need `id-token` and `attestations: write` on `release.yml` | #389 |

#382 also tracks the emitter half of CG-6. The codegen stage closed CG-6 by
refusing `orReturn` inside a `scope()` region. Joining before the return in
`src/emit-result.ts` would let that refusal go.

## Corrections still to make

The stages listed documentation corrections outside their own files. This stage
made every one that falls in `std/README.md`, `docs/INSTALL.md`,
`docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`, `docs/wp7-runtime.md`,
`.claude/selfhost.md`, `codegen.md` and `cli.md`. These are outside those files
and are still open:

| Where | What | From |
| --- | --- | --- |
| `runtime/shim.mjs`, `runtime/nish.d.ts` | The Node twin should open `writeFileSync`, `appendFileSync` and `spawnImpl`'s streams with `O_NOFOLLOW`, so the two runtimes agree on RT-4, and the declarations' comments should say so | [runtime.md](runtime.md) |
| `scripts/bootstrap.sh` | Its intermediate stage at `build/selfhost/stage` still finds the checkout only through the narrowed `.` fallback. Building it one level below the checkout's root, or passing the root explicitly, would let that fallback go | [cli.md](cli.md) |

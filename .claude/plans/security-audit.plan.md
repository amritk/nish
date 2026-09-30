---
name: Security audit — crypto first, then runtime, compiler, CLI and supply chain
overview: A deep adversarial security audit of the whole repository, weighted towards std/crypto. Each stage audits one attack surface, fixes every confirmed finding in the same PR with a regression test that fails on the base, and records what was checked and what was found in docs/security/<area>.md so an absence of findings is evidence rather than silence.
stages:
  - id: crypto-ecc
    title: "fix(crypto): audit and harden P-256 ECDSA and X25519"
    goal: No input to p256*/x25519* can forge, leak a key, panic or yield a non-canonical accept; every applicable Wycheproof vector passes
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner) && node tests/run.js ct_asm
    todos:
      - id: ecc-verify-edges
        content: Audit p256Verify for r/s range, point-at-infinity results, u1G+u2Q edge cases, digest truncation and malleability — see Crypto ECC
      - id: ecc-key-validation
        content: Audit p256PublicKey/p256Sign key and point validation (priv 0 or ≥ n, off-curve, invalid-curve, identity) and RFC 6979 nonce derivation — see Crypto ECC
      - id: ecc-x25519
        content: Audit x25519 clamping, non-canonical u ≥ p, masked top bit, low-order points and the ladder's CT shape — see Crypto ECC
      - id: ecc-wycheproof
        content: Extend tests/link/crypto_wycheproof with every applicable ecdsa_secp256r1 and x25519 vector not already run — see Crypto ECC
      - id: ecc-record
        content: Write docs/security/crypto-ecc.md and fix every confirmed finding with a failing-first regression test — see Crypto ECC
  - id: crypto-x509
    title: "fix(crypto): audit and harden the DER, PEM and X.509 parsers"
    goal: The parsers answer null on every malformed input, never panic, loop or allocate unboundedly, and never accept a certificate or key they should refuse
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner)
    todos:
      - id: x509-der
        content: Audit the DER reader for length overflow, nesting depth, truncation, non-minimal encodings and trailing bytes — see Crypto X.509
      - id: x509-semantics
        content: Audit x509ParseChain and x509VerifySignature for algorithm confusion, issuer/subject chaining, validity, basicConstraints and what the API promises versus what it checks — see Crypto X.509
      - id: x509-mint
        content: Audit x509MintSelfSigned for serial and key randomness source, validity window and private-key handling — see Crypto X.509
      - id: x509-malformed-corpus
        content: Add a fixed-seed malformed-input corpus (truncations and bit flips of every valid fixture) run under npm test that must answer null without a panic — see Crypto X.509
      - id: x509-record
        content: Write docs/security/crypto-x509.md and fix every confirmed finding with a failing-first regression test — see Crypto X.509
  - id: crypto-aead
    title: "fix(crypto): audit and harden ChaCha20-Poly1305 and AES-GCM"
    goal: Open never releases plaintext for an unauthenticated message, counters and lengths cannot wrap, and Wycheproof AEAD vectors pass
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner) && node tests/run.js ct_asm
    todos:
      - id: aead-open
        content: Audit Seal/Open for tag-before-decrypt, tag length, empty and huge inputs, and the plaintext buffer on failure — see Crypto AEAD
      - id: aead-counters
        content: Audit ChaCha20 block-counter and GCM counter wrap, non-96-bit IV GHASH derivation and maximum message lengths in both number modes — see Crypto AEAD
      - id: aead-wycheproof
        content: Add tests/link/crypto_wycheproof_aead with the chacha20_poly1305 and remaining aes_gcm vectors and its THIRD_PARTY_NOTICES.md entry — see Crypto AEAD
      - id: aead-record
        content: Write docs/security/crypto-aead.md and fix every confirmed finding with a failing-first regression test — see Crypto AEAD
  - id: crypto-k1
    title: "fix(crypto): audit and harden SHA-2, HMAC, HKDF, ct and base64url"
    goal: Hashes are correct at every length boundary in both number modes, MAC and compare helpers are constant time and misuse-resistant, and decoders are strict
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner) && node tests/run.js ct_asm
    todos:
      - id: k1-lengths
        content: Audit SHA-256/384/512 bit-length counters and padding for overflow in i32 and f64 number modes and at 2^29 and 2^32 byte boundaries — see Crypto K1
      - id: k1-mac
        content: Audit HMAC long-key handling, verify helpers, HKDF length bounds and the digest-ends-computation rule — see Crypto K1
      - id: k1-ct
        content: Audit timingSafeEqual/timingSafeEqualAt and base64url for secret-dependent branches, bounds and strictness, and add ct_asm fixtures for them — see Crypto K1
      - id: k1-record
        content: Write docs/security/crypto-k1.md and fix every confirmed finding with a failing-first regression test — see Crypto K1
  - id: ct-verification
    title: "test(crypto): prove the constant-time checks catch what they claim"
    goal: tests/ct-asm.js and the timing harness demonstrably refuse seeded secret-dependent branches, calls and loads
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner) && node tests/run.js ct_asm
    todos:
      - id: ct-mutation
        content: Extend tests/cases/ct_asm_refused so every rule tests/ct-asm.js enforces has a seeded violation it must refuse, on both targets — see CT verification
      - id: ct-harness
        content: Audit tests/ct-asm.js and tests/ct-timing.js for false negatives (unfollowed calls, unchecked architectures, allow-lists, statistical thresholds) — see CT verification
      - id: ct-record
        content: Write docs/security/ct-verification.md listing every function still held by discipline only — see CT verification
  - id: runtime-c
    title: "fix(runtime): audit the C runtime for memory safety and OS misuse"
    goal: No runtime entry point can be driven to an out-of-bounds access, integer-overflowed allocation, weak randomness or unsafe file or socket handling
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner)
    todos:
      - id: rt-memory
        content: Audit runtime.c and nish.h for size arithmetic overflow, bounds, string and number conversion buffers, and panic paths — see Runtime
      - id: rt-os
        content: Audit runtime-host.c and runtime-os.c for getrandom short reads and EINTR, file creation modes, path handling and spawn argv — see Runtime
      - id: rt-net
        content: Audit runtime-net.c and runtime-parallel.c for buffer handling, fd leaks, signal races and data races — see Runtime
      - id: rt-record
        content: Write docs/security/runtime.md and fix every confirmed finding with a failing-first regression test — see Runtime
  - id: codegen-soundness
    title: "fix(codegen): audit bounds-check elimination and emitted attributes"
    goal: No check the compiler removes and no LLVM attribute it emits can let a well-typed program read or write out of bounds or hit UB
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner)
    todos:
      - id: cg-bounds
        content: Audit src/bounds.ts eliminations against adversarial index arithmetic, aliasing and mutation between check and use — see Codegen
      - id: cg-attrs
        content: Audit src/attributes.ts and src/escape.ts for unjustified noalias, nonnull, inbounds, nsw/nuw and lifetime claims — see Codegen
      - id: cg-parallel
        content: Audit src/parallel.ts for data races the thread rules claim to exclude — see Codegen
      - id: cg-record
        content: Write docs/security/codegen.md and fix every confirmed finding with a failing-first golden or link test — see Codegen
  - id: cli-cache
    title: "fix(cli): audit nish run's cache and the compiler's file and process handling"
    goal: nish and nish run cannot be made to execute a stale or planted binary, write outside their outputs, or pass untrusted text to a shell
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner) && npm run build && npm run test:cli
    todos:
      - id: cli-cache-key
        content: Audit src/run-cache.ts for key collisions, cache directory ownership and permissions, symlink and TOCTOU races — see CLI and cache
      - id: cli-spawn
        content: Audit src/compile.ts and src/compilation.ts toolchain invocation, output paths and temp files — see CLI and cache
      - id: cli-record
        content: Write docs/security/cli.md and fix every confirmed finding with a failing-first test — see CLI and cache
  - id: supply-chain
    title: "fix(build): audit install, launcher, seed fetch and release workflows"
    goal: Every downloaded binary is verified before it runs, and no workflow lets PR text or a fork reach a secret or a shell
    verification: npm run check && npm run lint && npm test (0 skipped, no DEGRADED banner)
    todos:
      - id: sc-install
        content: Audit install.sh, bin/launcher.js, bin/packaging.js and scripts/postinstall.mjs for unverified downloads and path trust — see Supply chain
      - id: sc-seed
        content: Audit scripts/fetch-seed.sh and scripts/verify-binaries.sh for checksum and provenance verification — see Supply chain
      - id: sc-workflows
        content: Audit .github/workflows for injection, over-broad permissions, unpinned actions and fork-reachable secrets — see Supply chain
      - id: sc-js-runtime
        content: Audit runtime/shim.mjs, runtime/nish.mjs and web/*.mjs for prototype pollution, unsafe eval and host-boundary checks — see Supply chain
      - id: sc-record
        content: Write docs/security/supply-chain.md and fix every confirmed finding with a failing-first test — see Supply chain
  - id: security-policy
    title: "docs: add SECURITY.md and the audit index"
    goal: A reader can find how to report a vulnerability, the threat model, and every area's audit record from the README
    verification: npm run lint && node docs/check-links.mjs
    todos:
      - id: policy-file
        content: Add SECURITY.md with the reporting channel, supported versions, threat model and an index of docs/security/*.md — see Security policy
      - id: policy-readme
        content: Fold doc corrections the other stages reported into std/README.md and link SECURITY.md from README.md — see Security policy
---

# Security audit

## Context

The attack surface, by what an attacker controls:

| Surface | Code | Attacker controls |
| --- | --- | --- |
| Crypto primitives | [std/crypto/](../../std/crypto/) (~9k lines) | keys, signatures, ciphertexts, certificates, PEM text a Nish program receives |
| C runtime | [runtime/](../../runtime/) `*.c`, `nish.h` | every value a compiled program handles, sockets, files |
| Generated code | [src/bounds.ts](../../src/bounds.ts), [src/attributes.ts](../../src/attributes.ts), [src/escape.ts](../../src/escape.ts), [src/parallel.ts](../../src/parallel.ts) | the program's inputs, through any check the compiler proved away |
| CLI and cache | [src/compile.ts](../../src/compile.ts), [src/run-cache.ts](../../src/run-cache.ts) | other local users, the file system, source paths |
| Distribution | [install.sh](../../install.sh), [bin/](../../bin/), [scripts/](../../scripts/), [.github/workflows/](../../.github/workflows/) | the network, the release pipeline, pull request text |

The crypto modules already claim constant time by construction and are partly verified by [tests/ct-asm.js](../../tests/ct-asm.js). [std/README.md](../../std/README.md) lists what is still "discipline" only.

## Approach

- **Audit, then fix in the same PR.** A stage that finds nothing still ships its record and the regression tests that pin the properties it checked. A stage that finds something fixes it, with a test that fails on the base SHA and passes on the branch.
- **Severity.** Critical: forgery, key recovery, remote code execution. High: memory corruption, a verifier that accepts bad input, secret-dependent timing in a fixture path. Medium: denial of service (panic, unbounded loop or allocation) on attacker input. Low: hardening and documentation drift.
- **A finding a stage cannot fix inside its Owns** is written into its record as open, with the file it lives in, and raised in the PR body. The stage does not widen its scope.
- **Records are per stage** (`docs/security/<stage>.md`), so stages never share a file. Each record states what was checked, how, what was found, severity and disposition.
- **Changes to `std/README.md`** are reported in the PR body, not made; the security-policy stage folds them in after every other stage has merged.
- **No new language construct**, so no LANGUAGE.md rule or cookbook entry is expected. `src/` fixes must obey the rolling freeze — `src/` can't use a construct the last release lacks.

## Crypto ECC

**Owns:** `std/crypto/p256.ts`, `std/crypto/x25519.ts`, `tests/link/crypto_p256*/**`, `tests/link/crypto_x25519*/**`, `tests/link/crypto_wycheproof/**`, `tests/link/crypto_ecc_*/**`, `tests/cases/ct_asm_p256.*`, `tests/cases/ct_asm_x25519.*`, `docs/security/crypto-ecc.md`

Check against Wycheproof `ecdsa_secp256r1_sha256`, `ecdsa_secp256r1_sha256_p1363`, `x25519_test`, and against SEC1 §3.2.2 / §4.1.4 and RFC 7748 §5. Specific questions: does verify reject `r` or `s` equal to 0 or ≥ n, a public key at infinity or off the curve, and a sum point at infinity? Does sign refuse a private key of 0 or ≥ n? Is the digest reduced mod n the way SEC1 says for 32-byte digests? Is high-`s` accepted (document it — ECDSA is malleable by design)? Are all fiat-crypto ports faithful to upstream (diff against the named upstream revision)?

## Crypto X.509

**Owns:** `std/crypto/x509.ts`, `tests/link/crypto_x509*/**`, `tests/link/crypto_der_*/**`, `docs/security/crypto-x509.md`

Treat every byte as hostile. Lengths near 2^31 in `i32` mode, nesting depth, a SEQUENCE whose length runs past its parent, OID and INTEGER encodings, BIT STRING unused bits, UTCTime and GeneralizedTime parsing, PEM labels and base64 padding. For `x509ParseChain`: state exactly what it checks and what it does not (path validation, name chaining, basicConstraints, key usage, validity against a clock) and make the API name or doc match — a parser named like a validator is a finding. `x509MintSelfSigned` must take its key and serial from `os` randomness, never from anything predictable.

## Crypto AEAD

**Owns:** `std/crypto/chacha20poly1305.ts`, `std/crypto/aes.ts`, `tests/link/crypto_chacha20poly1305*/**`, `tests/link/crypto_aes*/**`, `tests/link/crypto_wycheproof_aead/**`, `tests/cases/ct_asm_chacha20poly1305.*`, `tests/cases/ct_asm_aes.*`, `THIRD_PARTY_NOTICES.md`, `docs/security/crypto-aead.md`

Tag comparison in constant time and before any plaintext is written or returned; the partially-decrypted buffer never escapes. ChaCha20's 32-bit block counter and GCM's 32-bit counter must refuse a message long enough to wrap rather than reuse keystream. Non-96-bit IVs go through GHASH per SP 800-38D §7.1. Both `--number-mode i32` and `f64`.

## Crypto K1

**Owns:** `std/crypto/sha256.ts`, `std/crypto/sha512.ts`, `std/crypto/hmac.ts`, `std/crypto/hkdf.ts`, `std/crypto/ct.ts`, `std/crypto/base64url.ts`, `tests/link/crypto_sha*/**`, `tests/link/crypto_hmac*/**`, `tests/link/crypto_hkdf*/**`, `tests/link/crypto_ct*/**`, `tests/link/crypto_base64url*/**`, `tests/cases/ct_asm_mac.*`, `tests/cases/ct_asm_k1_*`, `docs/security/crypto-k1.md`

The bit-length counter is the main suspect in `i32` number mode. The streaming window checks (`update(buf, off, len)`) must refuse negative and overflowing `off + len`. Add ct_asm fixtures for `timingSafeEqual`, `timingSafeEqualAt` and the base64url character maps, which std/README.md says are discipline only.

## CT verification

**Owns:** `tests/ct-asm.js`, `tests/ct-timing.js`, `tests/ct-timing/**`, `tests/cases/ct_asm_refused.*`, `docs/security/ct-verification.md`

A checker that has never been shown to fail proves nothing. `tests/cases/ct_asm_refused` already holds one function written to fail each way; audit it against every rule the checker enforces (conditional branch, call, secret-addressed load and store, each call it follows, each architecture) and add a seeded violation for any rule it does not yet exercise. Fixtures are discovered from `tests/cases/ct_asm_*.ts` by `tests/run.js`, which no stage edits. Report whether both architectures run in CI or one is skipped quietly. The CI workflow is out of scope — report it.

## Runtime

**Owns:** `runtime/*.c`, `runtime/nish.h`, `tests/runtime-test.c`, `tests/link/rt_sec_*/**`, `tests/cases/rt_sec_*`, `docs/security/runtime.md`

A struct layout change is two-sided with `src/runtime.ts` (orientation rule 4) — which this stage doesn't own. If a fix needs it, record the finding as open and do not make it.

## Codegen

**Owns:** `src/bounds.ts`, `src/escape.ts`, `src/attributes.ts`, `src/parallel.ts`, `src/emit-arrays.ts`, `tests/cases/cg_sec_*`, `tests/link/cg_sec_*/**`, `docs/security/codegen.md`

For each elimination rule in bounds.ts, try to write a well-typed program that reaches an out-of-bounds access once the check is gone, and run it under the native harness. Every attribute must carry the proof orientation rule 3 demands. A reproducer that crashes or reads out of bounds is a High finding.

## CLI and cache

**Owns:** `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts`, `tests/nish/cli.ts`, `tests/cases/cli_sec_*`, `docs/security/cli.md`

Shared machines: a cache under a world-writable temp directory, a predictable path, a key that ignores an input that changes the binary, or a check-then-exec race each lets another local user run code as the victim.

## Supply chain

**Owns:** `install.sh`, `bin/**`, `scripts/postinstall.mjs`, `scripts/fetch-seed.sh`, `scripts/verify-binaries.sh`, `scripts/platform-package.mjs`, `scripts/build.sh`, `scripts/bootstrap.sh`, `scripts/nish-compiler.sh`, `.github/workflows/**`, `.github/seed-targets.json`, `runtime/*.mjs`, `web/*.mjs`, `tests/fetch-seed.js`, `docs/security/supply-chain.md`

Any `curl | sh`, download-then-exec without a pinned checksum, `${{ }}` of attacker text inside `run:`, `pull_request_target`, a tag-pinned third-party action, or a job with more permissions than it uses. Workflow edits hold the PR for a human by design.

## Security policy

**Owns:** `SECURITY.md`, `README.md`, `std/README.md`, `docs/security/README.md`

Starts only after every other stage has merged or escalated. It indexes their records and applies the std/README.md corrections their PR bodies listed.

## Out of scope

- New crypto (TLS 1.3, Ed25519, RSA) and performance work.
- Relaxing any test, coverage, lint or CT check to make a stage pass.
- Rewriting history, and releasing — the Release PR stays a human's.

## Verification

Every stage runs `npm run check`, `npm run lint` and `npm test`, and reads the summary: `0 skipped` and no `DEGRADED:` banner. The crypto stages also run `node tests/run.js ct_asm` on its own, since the ct_asm section skips without clang. Every fix's regression test is shown failing on base `882857d` in the PR body.

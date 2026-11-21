---
name: WP83 — std panic-free for std/crypto
overview: std/crypto holds 1067 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (crypto/sha1 31, crypto/sha256 43, crypto/sha512 40, crypto/hmac 51, crypto/hkdf 60, crypto/ct 2, crypto/base64url 38, crypto/scram 1, crypto/aes 94, crypto/chacha20poly1305 87, crypto/x25519 4, crypto/ed25519 22, crypto/bcrypt 132, crypto/bcrypt-batch 42, crypto/p256 64, crypto/p384 7, crypto/rsa 65, crypto/jwt 89, crypto/x509 107, crypto/pki 61, crypto/pki-roots 24, crypto/x509-random 3). This package removes or proves them without touching what the code computes - secret handling stays a Secret that is wiped (nish:secret), and the constant-time paths stay constant-time, so no fix may add a data-dependent branch. Crypto already has nine instruction-count kernels in bench/instructions.json; the first todo adds only what they miss (HKDF, HMAC, JWT verify, an X.509 parse), baselined before any site changes, and no PR may raise a count. The docs/security record of the area must be updated when a finding's code moves.
priority: 200
labels: [ready]
issue: 2146
stages:
  - id: s1-hash-mac
    title: WP83 S1 — hashes, MACs and key derivation
    goal: sha1, sha256, sha512, hmac, hkdf, ct, base64url and scram are cleared; the missing bench programs land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js crypto && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2147
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - HKDF extract and expand, HMAC, a JWT verify and an X.509 parse, whichever the nine existing crypto kernels do not reach; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP83 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/crypto/sha1.ts, std/crypto/sha256.ts, std/crypto/sha512.ts, std/crypto/hmac.ts, std/crypto/hkdf.ts, std/crypto/ct.ts, std/crypto/base64url.ts, std/crypto/scram.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP83 S1
        status: pending
      - id: s1-security
        content: Update the docs/security std/crypto record where a fixed finding moved; keep every wipe and the constant-time property (the nish:secret wipe test under opt -O2 must still pass) — see WP83 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP83 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP83 S1
        status: pending
  - id: s2-cipher
    title: WP83 S2 — ciphers, curves, signatures and password hashing
    goal: aes, chacha20poly1305, x25519, ed25519, bcrypt and bcrypt-batch are cleared.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js crypto && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2148
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/crypto/aes.ts, std/crypto/chacha20poly1305.ts, std/crypto/x25519.ts, std/crypto/ed25519.ts, std/crypto/bcrypt.ts, std/crypto/bcrypt-batch.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP83 S2
        status: pending
      - id: s2-security
        content: Update the docs/security std/crypto record where a fixed finding moved; keep every wipe and the constant-time property — see WP83 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP83 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP83 S2
        status: pending
  - id: s3-pubkey
    title: WP83 S3 — P-256, P-384, RSA and JWT
    goal: p256, p384, rsa and jwt are cleared.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js crypto && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2149
    todos:
      - id: s3-fix
        content: Remove or prove every site in std/crypto/p256.ts, std/crypto/p384.ts, std/crypto/rsa.ts, std/crypto/jwt.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP83 S3
        status: pending
      - id: s3-security
        content: Update the docs/security std/crypto record where a fixed finding moved; keep every wipe and the constant-time property — see WP83 S3
        status: pending
      - id: s3-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP83 S3
        status: pending
      - id: s3-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP83 S3
        status: pending
  - id: s4-pki
    title: WP83 S4 — X.509 and the PKI
    goal: x509, pki, pki-roots and x509-random are cleared; a malformed certificate is a Result, never a panic.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js crypto && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2150
    todos:
      - id: s4-fix
        content: Remove or prove every site in std/crypto/x509.ts, std/crypto/pki.ts, std/crypto/pki-roots.ts, std/crypto/x509-random.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP83 S4
        status: pending
      - id: s4-security
        content: Update the docs/security std/crypto record where a fixed finding moved — see WP83 S4
        status: pending
      - id: s4-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP83 S4
        status: pending
      - id: s4-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP83 S4
        status: pending
---

# WP83 — std panic-free for std/crypto

## Context

std/crypto holds 1067 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (crypto/sha1 31, crypto/sha256 43, crypto/sha512 40, crypto/hmac 51, crypto/hkdf 60, crypto/ct 2, crypto/base64url 38, crypto/scram 1, crypto/aes 94, crypto/chacha20poly1305 87, crypto/x25519 4, crypto/ed25519 22, crypto/bcrypt 132, crypto/bcrypt-batch 42, crypto/p256 64, crypto/p384 7, crypto/rsa 65, crypto/jwt 89, crypto/x509 107, crypto/pki 61, crypto/pki-roots 24, crypto/x509-random 3). This package removes or proves them without touching what the code computes: secret handling stays a Secret that is wiped (nish:secret), and the constant-time paths stay constant-time, so no fix may add a data-dependent branch. Crypto already has nine instruction-count kernels in bench/instructions.json; the first todo adds only what they miss (HKDF, HMAC, JWT verify, an X.509 parse), baselined before any site changes, and no PR may raise a count. The docs/security record of the area must be updated when a finding's code moves.

Examples unblocked: none directly; crypto sites also reach the TLS and QUIC examples of WP82.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — hashes, MACs and key derivation

sha1, sha256, sha512, hmac, hkdf, ct, base64url and scram are cleared; the missing bench programs land first and are baselined.

Sites as of 071ed014 (266): crypto/sha1 31, crypto/sha256 43, crypto/sha512 40, crypto/hmac 51, crypto/hkdf 60, crypto/ct 2, crypto/base64url 38, crypto/scram 1. Kinds: overflow 105, index 75, panic 59, range 15, array-length 12.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `sha1Compress`, `sha256`, `Sha256.copy`, `sha256Compress`, `sha384`, `sha512`, `scramClientProofExposed`, `sha1`, `hmacSha256`, `hmacSha384`, `hmacSha512`, `hmacCheckKey`, `hkdfExtractInto`, `Sha256.digestInto`, `Sha1.digestInto`.

### S2 — ciphers, curves, signatures and password hashing

aes, chacha20poly1305, x25519, ed25519, bcrypt and bcrypt-batch are cleared.

Sites as of 071ed014 (381): crypto/aes 94, crypto/chacha20poly1305 87, crypto/x25519 4, crypto/ed25519 22, crypto/bcrypt 132, crypto/bcrypt-batch 42. Kinds: index 207, overflow 151, array-length 14, slice 4, divide 3, panic 2.

### S3 — P-256, P-384, RSA and JWT

p256, p384, rsa and jwt are cleared.

Sites as of 071ed014 (225): crypto/p256 64, crypto/p384 7, crypto/rsa 65, crypto/jwt 89. Kinds: overflow 141, index 56, array-length 24, panic 4.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `p256HmacInto`.

### S4 — X.509 and the PKI

x509, pki, pki-roots and x509-random are cleared; a malformed certificate is a Result, never a panic.

Sites as of 071ed014 (195): crypto/x509 107, crypto/pki 61, crypto/pki-roots 24, crypto/x509-random 3. Kinds: overflow 113, index 62, slice 13, array-length 3, io-exit 2, divide 1, pop 1.

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
    goal: ed25519 is cleared (22 to 0), and aes, chacha20poly1305, bcrypt and bcrypt-batch are lowered outside their constant-time copies; the 88 sites it left (x25519 not below its baseline) are stage S5's.
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
  - id: s5-cipher-residuals
    title: WP83 S5 — prove, remove or record the 88 cipher sites S2 left
    goal: Every one of the 88 sites S2 left in aes, chacha20poly1305, x25519, bcrypt and bcrypt-batch is proved or removed, inside the constant-time copies as well as outside them, with each copy kept in step; each site that stays has its reason in tests/std-panics.json and in its cipher's docs/security record, and the two drifted record anchors point at the code again.
    verification: node tests/run.js std-panics && node tests/run.js ct_asm && node tests/run.js crypto && node tests/run.js instructions && node tests/run.js performance && node tests/run.js link && node tests/run.js wasi && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs, and no count in bench/instructions.json rises on CI
    issue: 2283
    todos:
      - id: s5-format
        content: Add a residual list to tests/std-panics.json (one entry per function and kind, with its site count, reason and record anchor) and the tests/run.js std-panics checks that hold it to the sites found, with a fabricated mismatch that must fail — see WP83 S5, The residual format
        status: pending
      - id: s5-wrapping-sums
        content: Replace the u32-cast index sums in std/crypto/chacha20poly1305.ts (poly1305Le64, poly1305Absorb, chacha20Poly1305Seal) with sums the prover bounds or a Result, and add no new one in any S5 module — see WP83 S5, The no-wrapping-sum rule
        status: pending
      - id: s5-outside
        content: Prove or remove the sites outside the text-pinned copies in std/crypto/aes.ts, std/crypto/chacha20poly1305.ts and std/crypto/bcrypt-batch.ts, and in bcryptEncryptAt, bcryptCalibrate and bcryptCalibrateTime — see WP83 S5, The sites
        status: pending
      - id: s5-inside
        content: Prove or remove the sites inside the text-pinned copies (chacha20XorInto, aesEncryptBatch, f25519DecodeInto, f25519EncodeInto) and in bcrypt's generated round bodies through bench/crypto/bcrypt/gen-body.mjs, editing each tests/cases/ct_asm copy in the same commit with no data-dependent branch — see WP83 S5, Inside the constant-time copies
        status: pending
      - id: s5-record
        content: Write a residual entry for each site left, and one WP83 S5 row per record in docs/security/crypto-aead.md, crypto-ecc.md and crypto-bcrypt.md that lists every site fixed and every site kept with its reason and the check that fails without it; update their docs/security/README.md index rows — see WP83 S5, Records
        status: pending
      - id: s5-anchors
        content: Fix the drifted anchors at docs/security/crypto-k1.md line 89 (K1-3, base64url.ts) and docs/security/crypto-chacha20-hw.md line 60 (chacha20XorInto) against the file as this stage leaves it — see WP83 S5, Anchors
        status: pending
      - id: s5-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, add the nish-cmp DECLARED and file exit entries the IR moves need, and lower tests/std-panics.json to the exact new counts with the before and after table in the PR body — see WP83 S5, Pins and ratchet
        status: pending
---

# WP83 — std panic-free for std/crypto

## Context

std/crypto holds 1067 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (crypto/sha1 31, crypto/sha256 43, crypto/sha512 40, crypto/hmac 51, crypto/hkdf 60, crypto/ct 2, crypto/base64url 38, crypto/scram 1, crypto/aes 94, crypto/chacha20poly1305 87, crypto/x25519 4, crypto/ed25519 22, crypto/bcrypt 132, crypto/bcrypt-batch 42, crypto/p256 64, crypto/p384 7, crypto/rsa 65, crypto/jwt 89, crypto/x509 107, crypto/pki 61, crypto/pki-roots 24, crypto/x509-random 3). This package removes or proves them without touching what the code computes: secret handling stays a Secret that is wiped (nish:secret), and the constant-time paths stay constant-time, so no fix may add a data-dependent branch. Crypto already has nine instruction-count kernels in bench/instructions.json; the first todo adds only what they miss (HKDF, HMAC, JWT verify, an X.509 parse), baselined before any site changes, and no PR may raise a count. The docs/security record of the area must be updated when a finding's code moves.

Examples unblocked: none directly; crypto sites also reach the TLS and QUIC examples of WP82.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason. A wrap is spelled, never cast (owner's rule; `CLAUDE.md`, "A wrap is spelled, never cast"): no site is cleared by casting `i32` or `i64` arithmetic through `u32` or `u64` so that it wraps (`toI32(toU32(a) + toU32(b))`). Where the wrap would hide an overflow, prove the bound or return a Result. Where wrapping is the algorithm's answer (a hash multiply, a counter mod 2^32), write `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`, the one `nish:unsafe` use this rule allows, so every deliberate wrap is greppable. A value that is `u32` or `u64` all the way through wraps by its type and needs neither.
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

S2 set out to clear aes, chacha20poly1305, x25519, ed25519, bcrypt and bcrypt-batch. It merged as #2184 (81c01dcd) having cleared only ed25519 (22 to 0). It lowered aes (94 to 24), chacha20poly1305 (87 to 39), bcrypt (132 to 16) and bcrypt-batch (42 to 5) outside the constant-time copies `tests/cases/ct_asm_*.ts` pins and bcrypt's generated round bodies. It left x25519 at its baseline (4), because the edit that cleared it moved `f25519DecodeInto` and `f25519EncodeInto` away from their ct_asm copies. Neither `tests/std-panics.json` nor any record gave a reason for the 88 sites left (#2283). Stage S5 proves, removes or records them.

Sites as of 071ed014 (381): crypto/aes 94, crypto/chacha20poly1305 87, crypto/x25519 4, crypto/ed25519 22, crypto/bcrypt 132, crypto/bcrypt-batch 42. Kinds: index 207, overflow 151, array-length 14, slice 4, divide 3, panic 2.

### S3 — P-256, P-384, RSA and JWT

p256, p384, rsa and jwt are cleared.

Sites as of 071ed014 (225): crypto/p256 64, crypto/p384 7, crypto/rsa 65, crypto/jwt 89. Kinds: overflow 141, index 56, array-length 24, panic 4.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `p256HmacInto`.

### S4 — X.509 and the PKI

x509, pki, pki-roots and x509-random are cleared; a malformed certificate is a Result, never a panic.

Sites as of 071ed014 (195): crypto/x509 107, crypto/pki 61, crypto/pki-roots 24, crypto/x509-random 3. Kinds: overflow 113, index 62, slice 13, array-length 3, io-exit 2, divide 1, pop 1.

## WP83 S5 — prove, remove or record the 88 cipher sites S2 left

S2 (#2184, 81c01dcd) left 88 unproven, non-explicit sites in five modules, and nothing says why any of them stays (#2283). The owner decided on #2283 that WP83 clears them where it can, inside the constant-time copies as well as outside, and records a reason for each site that stays. WP83 (#2146) closes when this stage merges.

The rules of this package (above) apply, and so does the rule the owner set on #2219: no site is cleared by a sum cast through `u32` so that it wraps instead of panicking (see "The no-wrapping-sum rule").

### The sites

As of main 1908baed (`--emit-panics` on each module, counted the way `node tests/run.js std-panics` counts):

| Module | Function | Sites | Pinned copy |
| --- | --- | --- | --- |
| aes (24) | `aesAddRoundKey` | index 3, overflow 1 | unchecked copy in `ct_asm_aes` |
| | `aesEncryptBatch` | overflow 2 | **text-pinned** ("ct_asm_aes's loop copies match") |
| | `aesGcmSeal` | array-length 1, overflow 2, index 1 | — |
| | `aesGcmOpen` | array-length 1, index 1 | — |
| | `aesStore32` | index 2, overflow 1 | — |
| | `aesStore64` | overflow 1 | — |
| | `aesSbox`, `aesShiftRows`, `aesMixColumns`, `ghashMultiply` | index 1 each | unchecked copy in `ct_asm_aes` |
| | `aesGcmTag`, `aesKeyInto`, `aesLoad32`, `aesScheduleInto` | index 1 each | — |
| chacha20poly1305 (39) | `chacha20XorInto` | index 11, overflow 18 | **text-pinned** ("ct_asm_chacha20poly1305's loop copies match") |
| | `poly1305Le64` | index 2, overflow 1 | unchecked copy (`ctPoly1305Le64`) |
| | `chacha20Poly1305TagMatch` | index 2 | unchecked copy |
| | `chacha20Word` | index 1 | unchecked copy |
| | `chacha20`, `chacha20QuarterRound`, `chacha20Poly1305Seal`, `chacha20Poly1305Open` | array-length 1 each | — |
| x25519 (4) | `f25519DecodeInto`, `f25519EncodeInto` | overflow 2 each (`:529`, `:535`, `:589`, `:593`) | **text-pinned** ("ct_asm_x25519's copies match") |
| bcrypt (16) | `bcryptEncryptAt` | index 8 | — |
| | `bcryptBody2` to `bcryptBody6` | overflow 1 each | generated by [bench/crypto/bcrypt/gen-body.mjs](../../bench/crypto/bcrypt/gen-body.mjs) |
| | `bcryptCalibrate` | overflow 2 | — |
| | `bcryptCalibrateTime` | overflow 1 | — |
| bcrypt-batch (5) | `BcryptBatcher.waitNanos` | overflow 2 | — |
| | `BcryptBatcher.pending`, `BcryptBatcher.run` | overflow 1 each | — |
| | `bcryptBatchLane` | index 1 | — |

"Text-pinned" means a `tests/run.js` check compares the copy's text with the module's, so the two change in one commit. "Unchecked copy" means the `ct_asm` case holds its own version, indexed with `uncheckedGet`, that no check compares; keep it in step by hand where the module's arithmetic or control flow changes.

### Approach

- **Per site, keyed by function and kind, not by line.** A residual entry names a module, a function, the count of each kind it keeps, the reason and the record row. Line numbers move with every edit to the file (rule 4 already regenerates three sets of pins), and a function-and-kind key still gives every site exactly one reason. Where one function keeps sites for two different reasons, it gets two entries, each with a `lines` note in its reason.
- **Inside a copy the `ct_asm` check reads, only a proof.** A `Result` or an early return is a conditional branch the assembly check refuses. A length check on public sizes, hoisted to the entry of a function the check does not read, is fine. Inside a function the check reads, a site goes only when the prover discharges it (a literal-sized buffer, an index masked to a bound the array is known to have, a loop bound the prover reads), or it stays with a reason.
- **What counts as a wrapping sum.** The #2219 rule forbids a `u32` cast that stands in for a bounds or overflow check on an index, a length or an offset. Arithmetic that the algorithm defines modulo 2^32 is not that: it stays where it is held in `u32` all the way through, and where it is computed on an `i32` it is written `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`, never cast through `u32` (owner's rule; `CLAUDE.md`, "A wrap is spelled, never cast"). Examples are GCM's `inc32` counter (`aes.ts:1115`), ChaCha20's block counter, the cipher's own word arithmetic, and bcrypt's masked character classes (`bcrypt.ts:220`).

### The residual format

Add to [tests/std-panics.json](../../tests/std-panics.json), beside `kept`:

```json
"residual": [
  {
    "module": "std/crypto/chacha20poly1305.ts",
    "function": "chacha20XorInto",
    "sites": { "index": 11, "overflow": 18 },
    "reason": "…",
    "record": "docs/security/crypto-aead.md#…"
  }
]
```

In the std-panics section of [tests/run.js](../../tests/run.js) (where `keptOf` is):

- **Coverage.** For every module that has a residual entry, each counted non-`panic` site must fall in a function and kind that some entry names. The entry's count must equal the number of such sites found, so a fall and a new site both fail, naming the entry.
- **Anchors.** Every entry's `record` is a file that exists, and its text names the function.
- **No vacuous pass.** Factor the comparison into a function. Hold it to one fabricated mismatch (an entry with a count one too high) that must fail, the way `ct_asm_refused` keeps the assembly check honest.
- `--update-std-panics` leaves `residual` as written, as it does `kept`. A count that moves is edited by hand, so its reason is read again.
- Describe the list in the file's `note` and in the section's header comment. Describe it in [docs/LANGUAGE.md](../../docs/LANGUAGE.md), "Panics the standard library keeps", only if that section describes `kept`'s file format.

### The no-wrapping-sum rule

S2 cleared three sites in [std/crypto/chacha20poly1305.ts](../../std/crypto/chacha20poly1305.ts) with exactly the cast #2219 forbids:

- `:454` `poly1305Le64(m, toI32(toU32(at) + 8))`;
- `:586` `toI32(toU32(at) + (toU32(whole) << 4))`, in `poly1305Absorb`'s whole-blocks loop, whose head `ct_asm_chacha20poly1305` pins (`ctPoly1305AbsorbWhole`);
- `:738` `toI32(toU32(len) + toU32(POLY1305_TAG_SIZE))` in `chacha20Poly1305Seal`.

Replace each one with a sum the prover bounds. For `:738`, a plaintext too long for its sealed length is a real failure, so `chacha20Poly1305Seal` answers its refusal (`null`) for it, with a test at that length under `--number-mode f64`. A site this brings back is one of this stage's to prove or record. Add no `toI32(toU32(` index or length sum to any of the five modules. `git grep -c 'toI32(toU32(' std/crypto/chacha20poly1305.ts` goes from 3 to 0. bcrypt's 4, which are its masked character classes, stay.

### Inside the constant-time copies

- **`chacha20XorInto`** (29 sites) is the largest group. Proving its window (the caller has checked `srcAt + len` and `dstAt + len`) changes its text, so make the same edit to the copy in [tests/cases/ct_asm_chacha20poly1305.ts](../../tests/cases/ct_asm_chacha20poly1305.ts) and regenerate its `.ll`.
- **`aesEncryptBatch`** works the same way, with [tests/cases/ct_asm_aes.ts](../../tests/cases/ct_asm_aes.ts).
- **`f25519DecodeInto` and `f25519EncodeInto`:** S2's wrapping-helper edit is the forbidden kind of fix, so it does not come back. Prove the bit counters' bounds (`:529`, `:535`, `:589`, `:593`) and edit [tests/cases/ct_asm_x25519.ts](../../tests/cases/ct_asm_x25519.ts) to match, through the rewrites its check applies.
- **The bcrypt round bodies** are edited in `bench/crypto/bcrypt/gen-body.mjs` and regenerated, never by hand. The barrier check ("bcrypt barrier: after opt -O3 all 16 of bcryptBody's half-rounds…") must still pass.
- **The unchecked copies:** `ct_asm_aes`'s round functions and `ct_asm_chacha20poly1305`'s `ctChacha20Word`, `ctPoly1305Le64` and `ctChacha20Poly1305TagMatch` change only where the module's control flow or arithmetic changes.

`node tests/run.js ct_asm` passes on every target it reads, with the same functions checked as before. No fix adds a branch on a secret, and no checked function gains a branch.

### Records

Each module gets one WP83 S5 row in its record, in the form of ECC-11 in [docs/security/crypto-ecc.md](../../docs/security/crypto-ecc.md). The row gives the count before and after by kind, each site fixed by function and how, and each site kept with its reason and residual entry. It cites the check that fails without each property it states: the std-panics residual check, the copy check, a `tests/link` case.

| Module | Record |
| --- | --- |
| aes, chacha20poly1305 | [docs/security/crypto-aead.md](../../docs/security/crypto-aead.md) (and [crypto-chacha20-hw.md](../../docs/security/crypto-chacha20-hw.md) where `chacha20XorInto`'s guard changes) |
| x25519 | [docs/security/crypto-ecc.md](../../docs/security/crypto-ecc.md) |
| bcrypt, bcrypt-batch | [docs/security/crypto-bcrypt.md](../../docs/security/crypto-bcrypt.md) |

Update each record's row in [docs/security/README.md](../../docs/security/README.md) where its counts change.

### Anchors

Fix these two after the code edits, against the file as the stage leaves it. Both records state a base commit, so name the commit the new lines are read at (as ECC-11's "names at" does) rather than re-basing the record.

- [docs/security/crypto-k1.md](../../docs/security/crypto-k1.md) line 89 (K1-3) cites `std/crypto/base64url.ts:110` and `:75`. Point them at `base64urlDecode`'s and `base64urlEncode`'s length guards.
- [docs/security/crypto-chacha20-hw.md](../../docs/security/crypto-chacha20-hw.md) line 60 cites `chacha20poly1305.ts:258`, now a `*/` line. Point it at `chacha20XorInto`'s guard.

### Pins and ratchet

Follow rules 2 to 6. Run `node tests/run.js std-panics --update-std-panics` and check that the five modules' counts equal the residual entries. The bench kernels that reach this code are `crypto-aes128gcm-seal`, `crypto-chacha20poly1305-seal` and `crypto-x25519` in [bench/instructions.json](../../bench/instructions.json); none may rise. bcrypt has no instruction kernel, so a change to the round bodies also runs `node bench/crypto/bcrypt/run.mjs` interleaved against main and reports the band in the PR body.

### Done when

- Every site in the table is proved, removed, or covered by a residual entry with a reason.
- x25519 is below its baseline of 4, or each of its sites has a residual entry that says why no proof holds.
- `chacha20poly1305.ts` has no `toI32(toU32(` sum left.
- The two anchors are fixed.
- The verification line passes, and the PR body states how many figures and `check(...)` strings it checked in the records it edits.

### Out of scope

The sites S1, S3 and S4 left in their modules are not in scope: base64url, hmac, jwt, pki-roots, x509-random and x509, which their own records already cover. A residual entry for those modules is a later change. So is making the residual coverage check apply to every std/ module.

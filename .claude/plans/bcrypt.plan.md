---
name: bcrypt in std/crypto — a wiped, constant-time-compared single path, then a 4-way interleaved path at C's speed
overview: Add nish/crypto/bcrypt (std/crypto/bcrypt.ts) so the multicore-server-challenge server can hash and verify at cost 10 on every login, sign-up and password change. Stage 1 lands a reference-exact, Secret-disciplined single-hash path at parity with libxcrypt; stage 2 adds up-to-4-way hashing with the Blowfish encryptions interleaved, at parity with tigokraft's C.
stages:
  - id: bcrypt-core
    title: feat(crypto) — bcrypt hash and verify in nish/crypto/bcrypt
    goal: Hash ($2b$, cost 4–31, caller salt) and verify ($2a$, $2b$, $2y$) a Secret password exactly as the reference does, with the Blowfish state wiped and the compare constant-time, at single-path parity with libxcrypt crypt_r
    verification: npm run check, npm run lint, npm run lint:dead, node docs/check-links.mjs, node tests/run.js bcrypt, node tests/run.js wasi (WASI_SYSROOT=/usr, skip line read), node tests/run.js secret and an undegraded npm test all green; node bench/crypto/bcrypt/run.mjs prints the single-path rows
    status: pending
    todos:
      - id: core-reference
        content: Read the references (OpenBSD bcrypt.c and regress, Openwall crypt_blowfish and its wrapper.c test vectors, libxcrypt crypt-bcrypt.c, Go x/crypto/bcrypt, the challenge's SPEC.md and bench/seed/seed.go) and write down the behaviour table before any code — see Reference behaviour
        status: pending
      - id: core-module
        content: Write std/crypto/bcrypt.ts — Blowfish tables, EksBlowfishSetup, the bcrypt base64, hash and verify, the error type — see API and Implementation
        status: pending
      - id: core-secret
        content: Run the hashing inside expose, hold the Blowfish state as one Secret record or array the function wipes, compare with std/crypto/ct.ts, and pin any new wipe path under -O2 in tests/run.js — see Secret discipline
        status: pending
      - id: core-kat
        content: Add tests/link/crypto_bcrypt* with the OpenBSD regress and Openwall vectors (8-bit, embedded NUL, 72-byte and longer keys), the Go seed hashes, and one cost-10 vector, natively and under Node — see Tests
        status: pending
      - id: core-negative
        content: Add the negative tests — a malformed hash, a bad prefix, cost 3 and 32, a short salt, a wrong-length encoded salt or digest — each an Err, never a panic — see Tests
        status: pending
      - id: core-differential
        content: Add the differential test against libxcrypt crypt_r on random passwords (8-bit and NUL bytes included) and salts at cost 4–6 — see Tests
        status: pending
      - id: core-wasm
        content: Build the KAT program for wasm32 and run it under node tests/run.js wasi, as the other std/crypto modules do — see Tests
        status: pending
      - id: core-bench
        content: Add bench/crypto/bcrypt/ measuring CPU ms per cost-10 hash for Nish, libxcrypt crypt_r and OpenBSD bcrypt, and reach parity or show the IR that stops it — see Speed
        status: pending
      - id: core-docs
        content: Write the docs/security bcrypt record, the std/README.md row, the docs/guide page with the std/threads offload example and its scalar.config.json route, and THIRD_PARTY_NOTICES.md for anything copied — see Docs
        status: pending
      - id: core-goldens
        content: Regenerate tests/self/goldens/checked and register any new positive case with tests/differential/goldens.js — see Verification
        status: pending
  - id: threads-wipe
    title: fix(checker) — a std/threads task may call a function that wipes memory the task allocated
    goal: Let a std/threads task call a function whose only write outside its own frame is a wipe of memory that call allocated, so bcrypt can run on a worker thread, while a wipe of shared or captured memory stays a shared write
    verification: npm run check, npm run lint, node tests/run.js thread, node tests/run.js secret, node tests/run.js wasi, node tests/run.js performance, bash scripts/bootstrap.sh --verify and an undegraded npm test green; the new positive and negative cases pass natively and under Node
    status: pending
    todos:
      - id: tw-diagnose
        content: Reproduce the refusal with a minimal task that calls a function wiping a buffer it allocated, and find every reader of sharedWrite that refuses it — see Threads and wipes
        status: pending
      - id: tw-facts
        content: Change markWipe in src/attributes.ts so a wipe whose target the function itself allocated is a local write, and a wipe through a parameter, field or capture keeps today's facts — see Threads and wipes
        status: pending
      - id: tw-tests
        content: Add a positive case (a task calls a wiping function and the wipe still survives -O2) and negative cases (a task wiping a captured or shared buffer, a parameter, a holder field) — see Threads and wipes
        status: pending
      - id: tw-docs
        content: Update the docs/LANGUAGE.md rule, docs/guide/using-nish/threads.md and docs/security/secret.md — see Threads and wipes
        status: pending
      - id: tw-goldens
        content: Regenerate tests/self/goldens/checked and register the new positive case — see Verification
        status: pending
  - id: bcrypt-batch
    title: perf(crypto) — hash and verify up to four bcrypt passwords at once, interleaved
    goal: Compute up to four independent bcrypt hashes in one call with their Blowfish encryptions interleaved, equal to the single path byte for byte, at parity with tigokraft's 4-way C
    verification: npm run check, npm run lint, npm run lint:dead, node docs/check-links.mjs, node tests/run.js bcrypt, node tests/run.js wasi, node tests/run.js secret and an undegraded npm test green; node bench/crypto/bcrypt/run.mjs prints the 4-way rows
    status: pending
    todos:
      - id: batch-api
        content: Add bcryptHash4 and bcryptVerify4 to std/crypto/bcrypt.ts with fixed-arity Secret parameters and one Secret state for all lanes — see The batch API
        status: pending
      - id: batch-kernel
        content: Write the interleaved EksBlowfish loop, four independent encryption chains per round, and read its optimised IR for bounds checks and unhoisted loads — see Speed
        status: pending
      - id: batch-tests
        content: Check the 4-way path against the single path on random passwords, salts and lane counts 1–4 (null lanes), mixed costs, and the KAT vectors; pin any new wipe path under -O2 — see Tests
        status: pending
      - id: batch-bench
        content: Read tigokraft's licence; if it allows building it, add its src/bcrypt.c as a measured baseline (built from a fetched copy, nothing copied in), and measure the 4-way path against it — see Speed
        status: pending
      - id: batch-docs
        content: Extend the security record, the std/README.md row and the guide page with the batch API, and replace the guide's prefork workaround with the std/threads offload example (single and 4-lane) now that threads-wipe has landed — see Docs
        status: pending
      - id: batch-goldens
        content: Regenerate tests/self/goldens/checked and register any new positive case — see Verification
        status: pending
---

# bcrypt in `std/crypto`

## Why

The multicore server challenge (github.com/arjaythedev/multicore-server-challenge;
clone it into the scratchpad) requires bcrypt at cost 10 on every login,
sign-up and password change (README rule 7, SPEC.md "POST /api/users"). At the
leaders' user counts that is about 28 hashes/s and a third of the non-Postgres
CPU (c-iouring-tigokraft's README, "bcrypt: 4 hashes per core at once"). A
later session writes the server on this module, so its speed is the score.

Out of scope: the Conduit server, `std/net` (another session is writing
`std/net/postgres` in parallel — do not touch `std/net`), PBKDF2, and any
change to `src/`.

## Rules every stage follows

Read first: `.claude/orientation.md`, `CLAUDE.md`, `.claude/architecture.md`,
`.claude/testing.md`, `.claude/licensing.md`, `docs/security/README.md`,
`docs/security/secret.md`, `std/secret.ts`'s header, `docs/LANGUAGE.md`
"Secrets: `nish:secret`", `std/crypto/ct.ts`, `std/crypto/x509-random.ts`
(how a module gets random bytes it does not draw itself — bcrypt takes its
salt from the caller and stays pure, so a `std/threads` worker and wasm32 can
run it).

## Reference behaviour

Write this table in the security record before the code, one row per case,
citing the reference line:

- **The 72-byte limit and the terminating NUL.** The key stream is the
  password bytes *plus* a trailing NUL, cycled over the 18 P words, and only
  the first 72 bytes of that are used. OpenBSD `$2b$` and libxcrypt agree.
- **`$2a$` versus `$2b$`.** OpenBSD's `$2a$` wrapped the length at 255 (u8),
  `$2b$` fixed it; crypt_blowfish's `$2a$` and `$2y$` are the correct
  algorithm. Decide what this module's `$2a$` verify does for a key over 255
  bytes and record why (the seed hashes are Go's `$2a$`).
- **Embedded NULs.** A C implementation stops at the first NUL; a `u8[]` does
  not have to. Follow the reference: decide whether bytes after an embedded
  NUL count, test it, and record the choice (a hash made here must verify in
  libxcrypt and vice versa).
- **8-bit characters.** `$2x$` reproduces the sign-extension bug of old
  crypt_blowfish; `$2a$` in crypt_blowfish carries a countermeasure for keys
  that collide under the bug. Read wrapper.c's vectors and follow them for
  `$2a$`/`$2y$`; `$2x$` is not in scope and is refused.
- **Over 72 bytes.** Decide: truncate (the reference and every verifier) or
  refuse on hash (Go's `ErrPasswordTooLong`). Verify must accept a stored
  hash of a long password exactly as the reference does. Record the decision
  and the reason in the record and the guide page.

## API

`nish/crypto/bcrypt` (stage 1), names to be finalised against std's
conventions:

```ts
bcryptHash(password: Secret<u8[]>, salt: u8[], cost: i32): Result<string, BcryptError>
bcryptVerify(password: Secret<u8[]>, hash: string): Result<bool, BcryptError>
```

`salt` is 16 bytes the caller drew (the guide shows
`crypto.getRandomValues`); `cost` is 4–31; the output is `$2b$NN$` + 22 + 31
characters of bcrypt's base64. Malformed input is an `Err`, never a panic.

## Implementation

- One module, `std/crypto/bcrypt.ts`. The Blowfish P-array and S-box initial
  values are π's hex digits; if they are copied from a source file rather
  than generated, that file's notice is kept and listed per licensing.md.
- The state (18 + 1024 `u32`) is one flat `u32[]`, laid out for the kernel.
  Prove the S-box index in range at every lookup (a `& 0xff` on a byte and a
  fixed table length should let the checker drop the bounds check — read the
  performance warnings and the IR, never `--unchecked-indexing`).

## Secret discipline

- The password is a `Secret<u8[]>`, borrowed: the caller made it and wipes it.
- Hashing runs inside `expose`/`exposeWith`. The Blowfish state, the key
  stream, the salt-mixed copies, and every other intermediate the function
  makes are wiped before it returns, on every path.
- Verify compares the computed digest with the stored one in constant time
  (`std/crypto/ct.ts`), not with `===` on strings.
- A new wipe path (a `Secret<u32[]>`, a wipe inside a kernel) gets its
  `-O2` pin in `tests/run.js` beside "nish:secret: the wipe survives opt -O2".
- The record says what a wipe cannot reach: the caller's request body and
  any `string` the password passed through, registers and spilled stack
  slots, and that Blowfish's key-dependent S-box lookups are an inherent
  cache-timing channel of bcrypt in every implementation.

## The batch API

`A Secret can't be stored in an array or a field` (std/secret.ts header), so
the batch takes fixed-arity parameters:

```ts
bcryptHash4(p0: Secret<u8[]>, p1: Secret<u8[]> | null, p2: Secret<u8[]> | null,
            p3: Secret<u8[]> | null, salts: u8[], cost: i32): Result<string[], BcryptError>
bcryptVerify4(p0, p1, p2, p3, hashes: string[]): Result<bool[], BcryptError>
```

A null lane is not computed. All four lanes' state is **one** `Secret<u32[]>`
the function makes and wipes. Each password is loaded into its lane by
`exposeWith(state, p_i, loadLane)`, whose function exposes `p_i` to derive
that lane's key stream into the state and wipes its temporaries; then one
`exposeWith(state, params, eks4)` runs the interleaved loop.

The lead checked the shape with the seed compiler before planning: a
`Secret<u8[]>` as `exposeWith`'s argument, a nullable `Secret` parameter
narrowed with `=== null`, an `expose` inside `exposeWith`'s function, and a
wiped plain temporary all compile. If a rule refuses this design once it is
real code, **stop** (draft PR, blocker in the body): name the rule and the
language change it needs. Do not weaken a rule or go around it.

Verify of hashes with different costs or prefixes groups lanes by cost; a
lane whose hash is malformed is an `Err` for the call (or a per-lane result —
decide and record).

## Tests

- **Known answers**: OpenBSD `regress/lib/libc/bcrypt` and Openwall
  crypt_blowfish `wrapper.c` vectors, including the 8-bit (`\xa3`, `\xff`
  runs) and embedded-NUL cases, 72-, 73- and 255+-byte keys, and the Go
  seed's hashes. One cost-10 vector.
- **Differential**: libxcrypt `crypt_r` on random passwords and salts at cost
  4–6, both directions (hash here, verify there and back). Check where
  `crypt_r` is available in CI (`.github/workflows/ci.yml`) and on this box.
- **Negatives**: malformed hash, bad prefix (`$2x$`, `$3$`, `$2c$`), cost 3,
  32 and non-digits, a salt shorter than 16 bytes, bad base64.
- **Batch**: the 4-way path against the single path on random inputs, every
  lane count 1–4, mixed costs.
- **wasm32**: the KAT program builds and runs under `node tests/run.js wasi`.

Every new TypeScript snippet the tests add has its exact LLVM IR shown in the
PR, per CLAUDE.md.

## Speed

On this box, CPU ms per cost-10 hash, as `Measured:` trailers with noise
bands (`.claude/testing.md` → "A `Measured:` trailer"):

- stage 1: the single path against libxcrypt `crypt_r` (`$2b$`) and OpenBSD's
  bcrypt (built from a fetched copy);
- stage 2: the 4-way path against c-iouring-tigokraft's `src/bcrypt.c` — read
  its licence first; build it only from a fetched copy and copy nothing in
  without licensing.md's steps. tigokraft reports 23.9 ms per hash 4-way vs
  libxcrypt's 46 ms on an i5-9500.

The target is parity with C. If Nish's codegen stops it (bounds checks on
S-box lookups, loads not hoisted, the state reloaded across the Feistel
round), show the IR, fix it in std if possible, and otherwise write the
codegen change needed in the PR body. `src/` is out of scope.

## Docs

- `docs/security/`: a bcrypt record (or the section of the crypto record it
  belongs in), in `docs/security/README.md`'s format, with the reference
  table, the decisions, the Secret discipline and what a wipe cannot reach.
- `std/README.md`: the module's row under `nish/crypto`.
- `docs/guide/`: a password-hashing page and its route in
  `scalar.config.json`, showing a server offloading hashing to a
  `std/threads` worker so a ~45 ms hash does not stall its event loop; its
  examples compile under `npm test`.
- `THIRD_PARTY_NOTICES.md` for anything copied.

## Verification

`npm run check`, `npm run lint`, `npm run lint:dead`,
`node docs/check-links.mjs`, the targeted sections above, and an undegraded
`npm test` (read the skip count). Regenerate `tests/self/goldens/checked/`
with `node tests/self/goldens.js --update` (`--seed build/seed/bin/nish`
without `build/nish`) and register new positive `tests/cases/*` with
`node tests/differential/goldens.js --update`, in the same commit.

## Threads and wipes

Added after sign-off (user decision, 2026-10-24, on PR #884's blocker 1).
`markWipe` in `src/attributes.ts` sets `sharedWrite` for every `wipe`, so a
`std/threads` task cannot call any function that wipes — bcrypt included,
though everything it wipes is memory the call itself allocated. Change the
facts so a wipe of a fresh allocation the function made (a `new Array`, a
`secret(...)` of a fresh value, the state a hash builds) is a local write,
and a wipe reached through a parameter, a field, a capture or a borrowed
`Secret` keeps today's facts. The `wipe` itself stays one volatile
`llvm.memset` no optimiser may remove, and the `-O2` wipe pin keeps passing.
If the facts cannot tell the two apart soundly, stop (draft PR, blocker in
the body) and say what the analysis needs. Do not weaken the shared-write
rule for anything but this case.

## Stages

- `bcrypt-core` and `threads-wipe` run in parallel; their Owns are
  disjoint apart from the generated goldens, which the second to merge
  regenerates.
- `bcrypt-batch` is spawned once both have merged, on the `main` that holds
  them.

### bcrypt-core

**Owns:** `std/crypto/bcrypt.ts`, `std/crypto/LICENSE-*` (new files only),
`tests/link/crypto_bcrypt*/**`, `tests/cases/*bcrypt*`, `tests/wipes/**`,
`tests/run.js`, `tests/differential/**`, `tests/self/goldens/checked/**`,
`bench/crypto/bcrypt/**`, `bench/README.md`, `docs/security/**` except
`docs/security/secret.md`, `std/README.md`,
`docs/guide/using-nish/password-hashing.md`,
`docs/guide/using-nish/standard-library.md`, `scalar.config.json`,
`THIRD_PARTY_NOTICES.md`, `.github/workflows/ci.yml` (only to install a
differential or bench dependency CI lacks); and, for the module's list
entries only (user decision, 2026-10-24), `src/std-modules.ts` and
`.github/workflows/release.yml`

### threads-wipe

**Owns:** `src/attributes.ts`, `src/parallel.ts`, `tests/cases/*wipe*thread*`,
`tests/cases/*thread*wipe*`, `tests/link/thread_*wipe*/**`, `docs/LANGUAGE.md`,
`docs/guide/using-nish/threads.md`, `docs/security/secret.md`, and the
generated `tests/self/goldens/checked/**` and `tests/differential/**`
registrations

### bcrypt-batch

**Depends on:** `bcrypt-core` and `threads-wipe` merged.

**Owns:** `bcrypt-core`'s globs, plus `docs/guide/using-nish/threads.md`.

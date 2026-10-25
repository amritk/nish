---
name: bcrypt verify — wipe the hash it recomputes (#953 item 1)
overview: bcryptVerify, bcryptVerify4 and the arrays between them and bcryptExposed leave the bcrypt hash recomputed from the attempted password in memory after return, and that hash can be cracked offline at bcrypt cost. This wipes every such intermediate on every path, after the constant-time compare, pins each new wipe root under opt -O2, keeps the public API and its answers byte for byte, keeps std/threads tasks able to call both verifiers (NL2471), and brings BCRYPT-7 and the record's "what a wipe cannot reach" text up to date. Item 2 of #953 (the single path's speed) and src/ are out of scope.
stages:
  - id: verify-wipe
    title: "fix(crypto): wipe the hash bcrypt verify recomputes"
    goal: No array bcryptVerify or bcryptVerify4 allocates for the recomputed hash, its digest, a lane's joined hash or the given hash's bytes outlives the call unwiped on any path; each new wipe root is pinned under -O2 in tests/wipes/crypto.js; bcryptHash/bcryptHash4 still return their full hash strings; the KATs, the batch's per-lane equality and both thread_bcrypt programs pass unchanged; docs/security/crypto-bcrypt.md says what is now wiped and what still is not; the bench shows the single and 4-way cost inside the noise band
    verification: node tests/run.js bcrypt && node tests/run.js wipes && node tests/run.js secret && node tests/run.js thread && WASI_SYSROOT=/usr node tests/run.js wasi && npm run check && npm run lint && node tests/self/goldens.js --update (diff read) && node bench/crypto/bcrypt/run.mjs, then an undegraded npm test before the PR (skip count read)
    status: pending
    todos:
      - id: wipe-single
        content: "bcryptVerify: wipe `expected` (bcryptRun's result) and the `given` bytes from bcryptBytesOf after timingSafeEqual, holding the compare's answer in a local first. bcryptRun: wipe `digest` after it is copied into `out`. bcryptHash: `out` may be wiped after String.fromBytes only if fromBytes copies — check; the returned string is the caller's and is never wiped. See The single path"
        status: pending
      - id: wipe-batch
        content: "bcryptVerify4's paths: bcryptLaneOk wipes bcryptRunLane's 60 bytes (including the null-lane zero array) and its given bytes after the compare; bcryptJoinedOk wipes bcryptJoin's out and the given bytes; bcryptVerifyGroup wipes bcryptRun4's `digests` after its loop. Check bcryptHash4's `digests` the same way (an intermediate, not the returned strings). Every early return wipes too. See The batch"
        status: pending
      - id: threads
        content: "Every new wipe targets an array the wiping function itself allocated or received as a fresh call result that the NL2471 rule in docs/LANGUAGE.md (and #945's fix) allows a std/threads task to wipe — never a parameter, a capture or a field. Confirm with node tests/run.js thread, in particular tests/link/thread_bcrypt_task and thread_bcrypt_batch, which must pass unchanged. If a wipe the rule refuses is the only way to reach an array, restructure in std/ (out of scope: src/) or record it in BCRYPT-7. See Threads"
        status: pending
      - id: pins
        content: "Pin every new wipe root under -O2 in tests/wipes/crypto.js, as the existing nish.bcryptExposed / nish.bcryptHash / nish.bcryptVerify entries do: raise the counts for roots that gained wipes, add entries (against tests/link/crypto_bcrypt or crypto_bcrypt_batch) for new roots such as bcryptVerify4's, and update the comment above them. Run node tests/run.js wipes and read that each pin is counted, not skipped"
        status: pending
      - id: record
        content: "docs/security/crypto-bcrypt.md: update BCRYPT-7 and the \"what a wipe cannot reach\" text (and the four-lane batch section's line about wipes) to list the recomputed hash, the digests and the given bytes as wiped, with the before/after evidence (the -O2 pin), and leave what still cannot be reached (registers, spills, the returned hash string, String copies) stated. Keep std/crypto/bcrypt.ts's header in step. node docs/check-links.mjs passes"
        status: pending
      - id: measure
        content: "Measure single and 4-way with node bench/crypto/bcrypt/run.mjs against main and a byte-identical copy of main for the noise band (npm run build first; the seed predates bcryptHash4). Report as Measured: lines in the commit body and PR body. A delta outside the band is reported with its numbers, not hidden"
        status: pending
      - id: goldens
        content: "Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff; it should move only bcrypt's module"
        status: pending
---

# bcrypt verify — wipe the hash it recomputes

One stage, one PR: three call sites in one file, their pins and their record.
Splitting it would put a wipe and the pin that proves it in different PRs.

## verify-wipe

**Owns:** `std/crypto/bcrypt.ts`, `tests/wipes/crypto.js`,
`docs/security/crypto-bcrypt.md`, `tests/link/crypto_bcrypt/**`,
`tests/link/crypto_bcrypt_batch/**`, `tests/link/thread_bcrypt_task/**` and
`tests/link/thread_bcrypt_batch/**` (only if a pin or a thread check needs a
call the programs do not yet make), `tests/self/goldens/checked/**`
(regenerated only), `.claude/plans/bcrypt-verify-wipe.plan.md`.

Not owned, and not to be touched: `src/`, `std/net/`, `std/secret.ts`,
`bench/` (run it, do not change it — #953 item 3 is separate), CI config.

### The single path

`bcryptVerify` (`std/crypto/bcrypt.ts` ~779) returns
`Ok(timingSafeEqual(expected, bcryptBytesOf(hash)))`. Bind both arrays and the
boolean to locals, wipe both arrays, then return. `bcryptRun` (~742) copies
`digest` into `out` and drops it: wipe `digest` before returning `out`.
`out` is the caller's: in `bcryptVerify` it is `expected` and wiped there; in
`bcryptHash` it becomes the returned string, so wipe `out` there only after
`String.fromBytes` and only if that copies (read its definition).

The parse error path returns before anything is computed; nothing to wipe.

### The batch

`bcryptLaneOk`, `bcryptJoinedOk` and `bcryptVerifyGroup` (~1390–1434) are
expression-bodied today; give them block bodies. `bcryptRunLane` returns
`bcryptRun`'s array or a fresh zero array, both the callee's own allocation
handed up. `bcryptRun4`'s `digests` are 124 bytes of four lanes' digests.

### Threads

`docs/LANGUAGE.md` NL2471 (~line 3807) limits what a `std/threads` task may
`wipe`; #945 allowed a Secret made from a fresh value. The two verifiers are
called from tasks in `tests/link/thread_bcrypt_task` and `thread_bcrypt_batch`;
both must still compile and pass. A wipe the checker refuses there is a
design signal, not a reason to touch `src/`.

### Out of scope

`src/`, `std/net`, #953 item 2 (single-path speed) and item 3 (the bench's
precondition message).

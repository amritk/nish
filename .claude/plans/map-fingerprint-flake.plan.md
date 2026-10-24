---
name: Deterministic map_fingerprint_miss
overview: map_fingerprint_miss counts key compares, and since #900 the string hash key is random per run, so a 32-bit hash match between an absent and a stored key (or two stored keys) makes its exact 0 / 10000 assertion fail about 2% of runs. Fix the hash key in that test's C shim so the count is deterministic, and keep the exact assertion.
stages:
  - id: fixed-key
    title: "test(runtime): fix the hash key under map_fingerprint_miss so its compare count is deterministic"
    goal: map_fingerprint_miss asserts exactly 0 compares on 10000 misses and exactly 10000 on 10000 hits, and passes every run
    verification: node tests/run.js map_ && npm run check && npm run lint, plus the linked binary printing the expected stdout on 1000 consecutive runs
    status: pending
    todos:
      - id: reproduce
        content: Build and link the fixture as tests/run.js linkCountingStrEq does, loop it 1000 times on the base and record the failure rate — see fixed-key, Reproduce
        status: pending
      - id: fix-key
        content: In tests/cases/map_fingerprint_miss.c, set nish_hash_key to a fixed key before main from a constructor — see fixed-key, The fix
        status: pending
      - id: prove
        content: Loop the fixed binary 1000 times, all identical expected stdout; run node tests/run.js map_ — see fixed-key, Verify
        status: pending
      - id: comments
        content: Update the comment above the check in tests/run.js, the shim's header, and docs/LANGUAGE.md ~8458 if it describes the counting — see fixed-key, Comments
        status: pending
---

# Deterministic map_fingerprint_miss

## fixed-key

**Owns:** `tests/cases/map_fingerprint_miss.c`, `tests/run.js` (only the comment and check block for `map_fingerprint_miss`, ~line 11613), `docs/LANGUAGE.md` (only the sentence at ~8458, if it needs it)

### Why it flakes

`tests/run.js` links `tests/cases/map_fingerprint_miss.ts` with
`-Wl,--wrap=nish_str_eq` and `tests/cases/map_fingerprint_miss.c`, and asserts
stdout is exactly `misses 10000: 0 key compares\nhits 10000: 10000 key compares\n`.
A probe compares the stored 32-bit hash before the key, so a key compare
happens only on a full 32-bit hash match. Since #900 (fbf6900) the SipHash key
is filled from `getentropy` by a priority-101 constructor
(`src/emit-map.ts` `seedHashKey`), so whether any of the 10000 absent keys
matches one of the 10000 stored hashes — or two stored keys match each other,
making the hit count 10001 — is chance, about 2% of runs. Seen on main at 92ed878.

### Reproduce

Build and link exactly as `linkCountingStrEq` does (`build/nish` the `.ts` to
`.ll`, then `clang -Wno-override-module -O2 -Iruntime -fuse-ld=lld
-Wl,--wrap=nish_str_eq <ll> tests/cases/map_fingerprint_miss.c <RUNTIME_C> -o exe`),
run it 1000 times and count outputs that differ from the expected. Record the
rate in the PR body and the commit's `Measured:` trailer.

### The fix

Fix the key, do not loosen the assertion. `seedHashKey` leaves a key that is
already filled alone (word 0 nonzero), and runs before `main`; a constructor in
the shim that writes a fixed key (for example the bytes 00..0f that
`map_hash_kat.c`'s `useTestKey` uses) gives the same result whichever of the
two constructors runs first, because both run before `main` and before any
map operation. Confirm the chosen key gives exactly 0 / 10000; if it does not,
pick another and say which and why. The `.ts`, its `.ll` golden, the
differential and checked goldens do not change — if any would, stop and say why.

The randomness of the key stays tested by `map_hash_collide` ("filled
differently in two runs"); the shim's comment should say this test fixes the
key on purpose and where the random key is covered.

### Verify

- The fixed binary prints the expected stdout on 1000 consecutive runs.
- `node tests/run.js map_` (covers map_fingerprint_miss, map_hash_collide, map_hash_kat) green, skip line read.
- `npm run check`, `npm run lint` bare, exit status read.

### Comments

The comment above the check in `tests/run.js` and the shim's header say the key
is fixed and why. Grep `docs/` for `map_fingerprint_miss` and update a sentence
that describes how it counts only if it is now wrong.

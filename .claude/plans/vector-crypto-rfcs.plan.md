---
name: Crypto RFCs as vector 0.2.1 contracts
overview: Bring nish's spec side up to @amritk/vector 0.2.1 (pinned, reproducible, kramdown-rfc specs, extracted contracts, regenerated tests that CI runs), then hold five std/crypto modules to the RFCs they implement — HKDF (5869), ChaCha20-Poly1305 (8439), HMAC-SHA-2 (4231), X25519 (7748), Ed25519 (8032) — each as a spec, an extracted contract and a generated Nish test. Spec side only; no file under std/, src/ or runtime/ changes.
stages:
  - id: s1-vector-021
    title: S1 — vector 0.2.1 pin, hex re-extracted, spec tests run in CI
    goal: nish pins vector 0.2.1 and can fetch and build it; specs/hex.md is a kramdown-rfc spec built to specs/hex.xml, contracts/hex.json is extracted from it and checks under 0.2.1, test/spec/hex.ts is 0.2.1's emit; every RFC the run cites is cached byte-identical in rfcs/ with its notice; tests/run.js builds and runs every test/spec/*.ts and refuses a stale one.
    verification: bash scripts/fetch-vector.sh && build/vector/dist/vector --version && bash scripts/build-spec.sh --check specs/hex.md && build/vector/dist/vector spec extract --check specs/hex.xml -o contracts/hex.json && build/vector/dist/vector spec check contracts/hex.json --run-sources && build/vector/dist/vector spec stale test/spec/hex.ts contracts/hex.json && node tests/run.js spec && node tests/run.js third-party-licence && npm run check && npm run lint && npm run lint:dead
    todos:
      - id: pin
        content: Add .vector-version (0.2.1) and scripts/fetch-vector.sh — clone amritk/vector at tag v<version> into build/vector, run its fetch-nish/fetch-z3, build dist/vector; idempotent, shellcheck-clean — see S1
        status: pending
      - id: build-spec
        content: Copy vector's scripts/build-spec.sh (MIT, upstream notice kept, THIRD_PARTY_NOTICES row) so specs build against nish's own .refcache/ with the pinned kramdown-rfc 1.7.43 and xml2rfc 3.35.0 — see S1
        status: pending
      - id: rfcs
        content: rfcs/rfc{4648,5869,8439,4231,7748,8032}.txt byte-identical to rfc-editor.org, .refcache/ entries for them plus RFC 2119/8174, and an "IETF RFCs" section in THIRD_PARTY_NOTICES.md (BCP 78 / TLP §3.c.i, in full and unmodified; RFC 8439 is IRTF stream) — see S1
        status: pending
      - id: hex
        content: Rewrite specs/hex.md as kramdown-rfc saying the same requirements, build specs/hex.xml, re-extract contracts/hex.json, re-emit test/spec/hex.ts; check --run-sources passes (nish/hex does not exist yet: it is spec-first, so there is no --module and no spec run) — see S1
        status: pending
      - id: run-js
        content: A `spec` section in tests/run.js — for each test/spec/<n>.ts, its header's vector-contract-sha256 equals sha256(contracts/<n>.json) (vector's spec-stale rule), then, when its contract's target module exists under std/, build it with build/nish, run it, exit 0 and no FAIL line (a spec-first module not yet landed is a SKIP naming it); a shard cost entry if pool.js needs one — see S1
        status: pending
      - id: docs
        content: .claude/orientation.md's spec-first paragraph says what CI now runs (stale + run) and what stays by hand (build-spec, extract, check, frozen, mutate), and where the pin lives; contracts/README.md with the regenerate commands — see S1
        status: pending
  - id: s2-hkdf
    title: S2 — RFC 5869 HKDF-SHA-256 contract
    goal: specs/rfc5869-hkdf-sha256.{md,xml}, contracts/rfc5869-hkdf-sha256.json and test/spec/rfc5869-hkdf-sha256.ts target nish/crypto/hkdf; vector 0.2.1 checks it and spec run reports SATISFIED.
    verification: bash scripts/build-spec.sh --check specs/rfc5869-hkdf-sha256.md && build/vector/dist/vector spec extract --check specs/rfc5869-hkdf-sha256.xml -o contracts/rfc5869-hkdf-sha256.json && build/vector/dist/vector spec check contracts/rfc5869-hkdf-sha256.json --run-sources --module std/crypto/hkdf.ts && build/vector/dist/vector spec run contracts/rfc5869-hkdf-sha256.json --nish-root . && build/vector/dist/vector spec frozen --base origin/main contracts/rfc5869-hkdf-sha256.json && node tests/run.js spec && npm run lint
    todos:
      - id: spec
        content: Port vector's specs/rfc5869-hkdf-sha256.md (MIT, notice) — Appendix A test cases 1–3, hmacSha256 as a nish/crypto/hmac reference function; outOfScope for the SHA-384, Secret, Label and Into exports — see S2
        status: pending
      - id: gen
        content: Build, extract, emit; spec run SATISFIED — see S2
        status: pending
  - id: s3-chacha20poly1305
    title: S3 — RFC 8439 ChaCha20-Poly1305 contract
    goal: specs/rfc8439-chacha20-poly1305.{md,xml}, its contract and test target nish/crypto/chacha20poly1305; vector 0.2.1 checks it and spec run reports SATISFIED.
    verification: bash scripts/build-spec.sh --check specs/rfc8439-chacha20-poly1305.md && build/vector/dist/vector spec extract --check specs/rfc8439-chacha20-poly1305.xml -o contracts/rfc8439-chacha20-poly1305.json && build/vector/dist/vector spec check contracts/rfc8439-chacha20-poly1305.json --run-sources --module std/crypto/chacha20poly1305.ts && build/vector/dist/vector spec run contracts/rfc8439-chacha20-poly1305.json --nish-root . && build/vector/dist/vector spec frozen --base origin/main contracts/rfc8439-chacha20-poly1305.json && node tests/run.js spec && npm run lint
    todos:
      - id: spec
        content: Port vector's specs/rfc8439-chacha20-poly1305.md (MIT, notice) — §2.3.2, 2.4.2, 2.5.2, 2.6.2, 2.8.2 and Appendix A vectors; outOfScope for chacha20QuarterRound (u32[]) and chacha20HeaderMask (RFC 9001) — see S3
        status: pending
      - id: gen
        content: Build, extract, emit; spec run SATISFIED — see S3
        status: pending
  - id: s4-hmac
    title: S4 — RFC 4231 HMAC-SHA-256/384/512 contract
    goal: specs/rfc4231-hmac-sha2.{md,xml}, its contract and test target nish/crypto/hmac with every RFC 4231 §4 test case for SHA-256, -384 and -512 (case 5's truncation as a slice); spec run SATISFIED.
    verification: bash scripts/build-spec.sh --check specs/rfc4231-hmac-sha2.md && build/vector/dist/vector spec extract --check specs/rfc4231-hmac-sha2.xml -o contracts/rfc4231-hmac-sha2.json && build/vector/dist/vector spec check contracts/rfc4231-hmac-sha2.json --run-sources --module std/crypto/hmac.ts && build/vector/dist/vector spec run contracts/rfc4231-hmac-sha2.json --nish-root . && build/vector/dist/vector spec frozen --base origin/main contracts/rfc4231-hmac-sha2.json && node tests/run.js spec && npm run lint
    todos:
      - id: spec
        content: New kramdown-rfc spec from RFC 4231 (and RFC 2104 for the construction) — hmacSha256/384/512 vectors, the *Verify functions accept the right tag and refuse a flipped bit; outOfScope with reasons for Secret, pbkdf2 and class exports — see S4
        status: pending
      - id: gen
        content: Build, extract, emit; spec run SATISFIED — see S4
        status: pending
  - id: s5-x25519
    title: S5 — RFC 7748 X25519 contract
    goal: specs/rfc7748-x25519.{md,xml}, its contract and test target nish/crypto/x25519 (secret-bytes scalars) with §5.2's single vectors, the 1- and 1000-iteration vectors, and §6.1's Diffie-Hellman exchange; spec run SATISFIED.
    verification: bash scripts/build-spec.sh --check specs/rfc7748-x25519.md && build/vector/dist/vector spec extract --check specs/rfc7748-x25519.xml -o contracts/rfc7748-x25519.json && build/vector/dist/vector spec check contracts/rfc7748-x25519.json --run-sources --module std/crypto/x25519.ts && build/vector/dist/vector spec run contracts/rfc7748-x25519.json --nish-root . && build/vector/dist/vector spec frozen --base origin/main contracts/rfc7748-x25519.json && node tests/run.js spec && npm run lint
    todos:
      - id: spec
        content: New kramdown-rfc spec from RFC 7748 §5, §6.1 — x25519 and x25519Base; the all-zero output check (§6.1 MAY) as a null result if nish does it; timing MUSTs excluded with a pointer to nish's ct tests; f25519* exports outOfScope; the 1,000,000-iteration vector excluded as too slow, said so — see S5
        status: pending
      - id: gen
        content: Build, extract, emit; spec run SATISFIED — see S5
        status: pending
  - id: s6-ed25519
    title: S6 — RFC 8032 Ed25519 contract
    goal: specs/rfc8032-ed25519.{md,xml}, its contract and test target nish/crypto/ed25519 with §7.1 TEST 1, 2, 3, 1024 and SHA(abc); spec run SATISFIED.
    verification: bash scripts/build-spec.sh --check specs/rfc8032-ed25519.md && build/vector/dist/vector spec extract --check specs/rfc8032-ed25519.xml -o contracts/rfc8032-ed25519.json && build/vector/dist/vector spec check contracts/rfc8032-ed25519.json --run-sources --module std/crypto/ed25519.ts && build/vector/dist/vector spec run contracts/rfc8032-ed25519.json --nish-root . && build/vector/dist/vector spec frozen --base origin/main contracts/rfc8032-ed25519.json && node tests/run.js spec && npm run lint
    todos:
      - id: spec
        content: New kramdown-rfc spec from RFC 8032 §5.1 (Ed25519 only; Ed25519ph/ctx and Ed448 out of scope, said so) — ed25519PublicKey, ed25519Sign, ed25519Verify; verify refuses a flipped signature or message bit; non-functional MUSTs excluded — see S6
        status: pending
      - id: gen
        content: Build, extract, emit; spec run SATISFIED — see S6
        status: pending
---

# Crypto RFCs as vector 0.2.1 contracts

nish's spec side (`specs/hex.md`, `contracts/hex.json`, `test/spec/hex.ts`) was
made for vector 0.1.0. Under 0.2.1, `vector spec check contracts/hex.json`
exits 1 (`fidelity: sources: specs/hex.md is a .md file, and no reader is
registered for it: readers are registered for .txt, .xml`), and `spec emit`
refuses it, so the generated test can no longer be regenerated. Nothing in
`tests/run.js` or CI runs `test/spec/hex.ts`. vector 0.2.1 is tagged on GitHub
(`v0.2.1`) but npm still serves 0.1.0, so the pin is a git tag.

**Rules for every stage.**

- Follow vector's `.claude/skills/vector-spec/SKILL.md` (in the
  `build/vector` checkout): write the spec, build it, `spec extract` the
  contract. Never hand-write or edit a contract, an XML or a generated test.
- Spec side only. No file under `std/`, `src/`, `runtime/` changes.
  `spec frozen --base origin/main` must pass for S2–S6.
- **A VIOLATED result is a finding about nish, never a reason to weaken a
  clause.** Stop and report it to the lead with the transcript. A wrong answer
  from `std/crypto` is a possible vulnerability: it goes to `SECURITY.md`'s
  private route, never into a PR body, an issue or a commit message.
- Tools: `gem install kramdown-rfc -v 1.7.43 --no-document`,
  `pip install xml2rfc==3.35.0`, `bash scripts/fetch-vector.sh` (after S1).
- RFC texts and `.refcache/` entries come only from S1. A stage that needs a
  reference S1 did not cache stops and says so.

## S1 — vector 0.2.1 pin, hex re-extracted, spec tests run in CI

Owns: `.vector-version`, `scripts/fetch-vector.sh`, `scripts/build-spec.sh`,
`rfcs/**`, `.refcache/**`, `THIRD_PARTY_NOTICES.md`, `specs/hex.md`,
`specs/hex.xml`, `contracts/hex.json`, `contracts/README.md`,
`test/spec/hex.ts`, `tests/run.js`, `tests/shard-costs.json`, `tests/pool.js`,
`.claude/orientation.md`, `knip.json`, `biome.json`, `.gitignore`,
`.claude/plans/vector-crypto-rfcs.plan.md`.

- `.vector-version` holds `0.2.1`. `scripts/fetch-vector.sh` clones
  `https://github.com/amritk/vector` at `v$(cat .vector-version)` into
  `build/vector/`, runs its `scripts/fetch-nish.sh` and `scripts/fetch-z3.sh`,
  and builds `build/vector/dist/vector`. It does nothing when that binary
  already prints the pinned version. CI never runs it: CI needs no vector, no
  z3 and no network for the spec side.
- `scripts/build-spec.sh` is vector's, copied whole with its MIT notice, so
  `<repo>/.refcache` resolves to nish's own cache.
- `rfcs/` holds RFC 4648, 5869, 8439, 4231, 7748 and 8032 as `.txt`,
  byte-identical to `https://www.rfc-editor.org/rfc/rfcN.txt`. Each is listed
  in a new "IETF RFCs" section of `THIRD_PARTY_NOTICES.md`, modelled on
  vector's. `node tests/run.js third-party-licence` stays green.
- `specs/hex.md` becomes a kramdown-rfc document (`docname: draft-hex-00`,
  pinned `date:`, `normative: RFC4648`). It keeps the same requirements and
  the same §5 exclusion, and may not change what the contract asks of
  `nish/hex`. If the requirement ids or clause ids move, the PR body says how.
- `tests/run.js` gets a `spec` section. For each `test/spec/<n>.ts`:
  1. `contracts/<n>.json` exists.
  2. The test's single `// vector-contract-sha256:` line equals the SHA-256
     of the contract's bytes. That is vector's `spec stale` rule
     (`scripts/spec-stale.mjs` upstream).
  3. If the contract's `target.module` has a file under `std/`, the test
     builds with `build/nish` and exits 0 with no `FAIL` line. If it has
     none (a spec-first module, like `nish/hex` today), the run is a SKIP
     that names the missing module.

  A missing contract, a stale hash or a failing test is a FAIL, never a
  SKIP. The only SKIP is a missing target module. The
  section prints one PASS per test, so a CI shard log shows each one.

## S2 — RFC 5869 HKDF-SHA-256 contract

Owns: `specs/rfc5869-hkdf-sha256.md`, `specs/rfc5869-hkdf-sha256.xml`,
`contracts/rfc5869-hkdf-sha256.json`, `test/spec/rfc5869-hkdf-sha256.ts`.

Start from vector's own spec of the same name, which already targets
`nish/crypto/hkdf`. Carry its MIT notice in the `.md`. Add `outOfScope` for
every `nish/crypto/hkdf` export the contract does not test, each with its
reason.

## S3 — RFC 8439 ChaCha20-Poly1305 contract

Owns: `specs/rfc8439-chacha20-poly1305.md`, `specs/rfc8439-chacha20-poly1305.xml`,
`contracts/rfc8439-chacha20-poly1305.json`, `test/spec/rfc8439-chacha20-poly1305.ts`.

Start from vector's spec of the same name. Its six functions match nish's
signatures exactly. Keep its six exclusions and add `outOfScope` for
`chacha20QuarterRound` and `chacha20HeaderMask`.

## S4 — RFC 4231 HMAC-SHA-256/384/512 contract

Owns: `specs/rfc4231-hmac-sha2.md`, `specs/rfc4231-hmac-sha2.xml`,
`contracts/rfc4231-hmac-sha2.json`, `test/spec/rfc4231-hmac-sha2.ts`.

## S5 — RFC 7748 X25519 contract

Owns: `specs/rfc7748-x25519.md`, `specs/rfc7748-x25519.xml`,
`contracts/rfc7748-x25519.json`, `test/spec/rfc7748-x25519.ts`.

## S6 — RFC 8032 Ed25519 contract

Owns: `specs/rfc8032-ed25519.md`, `specs/rfc8032-ed25519.xml`,
`contracts/rfc8032-ed25519.json`, `test/spec/rfc8032-ed25519.ts`.

## Order

S1 merges first and blocks the development of S2–S6, because those stages
need its pin, its `build-spec.sh`, its `rfcs/` and `.refcache/`, and its
`spec` section. S2–S6 own disjoint files and run in parallel, four at a time.

## Acceptance criteria

1. `.vector-version` reads `0.2.1`, and `bash scripts/fetch-vector.sh` on a
   fresh clone produces a `vector` whose `--version` prints `vector 0.2.1`.
2. Under that vector, `spec check --run-sources` exits 0 for every
   `contracts/*.json` in nish, hex included. The check also passes
   `--module <its std file>` for every contract whose module exists.
3. Every committed `specs/*.xml` and `contracts/*.json` is what its source
   yields: `scripts/build-spec.sh --check` and `spec extract --check` exit 0
   for each.
4. Every `test/spec/*.ts` is 0.2.1's emit of its contract: `spec stale` exits
   0, and re-running the regenerate line in its header leaves the file
   byte-identical.
5. CI runs every `test/spec/*.ts`. On a CI test shard of `main` after the
   run, the `spec` section prints a staleness PASS for each of the six
   tests and a run PASS for each of the five crypto tests (hex's run is a
   SKIP naming `nish/hex`, which has not landed yet). A stale header or a
   failing check is a FAIL there, not a SKIP.
6. RFC 5869, 8439, 4231, 7748 and 8032 each have a contract targeting the
   std/crypto module that implements it, and `spec run --nish-root .`
   reports SATISFIED with every requirement `pass`.
7. Every cited RFC text in `rfcs/` is byte-identical to rfc-editor.org's
   copy and listed in `THIRD_PARTY_NOTICES.md`, and copied vector files keep
   their MIT notice. `node tests/run.js third-party-licence` passes.
8. No file under `std/`, `src/` or `runtime/` changed in the run.
9. `.claude/orientation.md` says where the pin lives, what CI runs and what
   stays by hand, and no doc still says the spec tests are "run by hand, not
   by CI".

---
name: vector 0.6.0 — regenerate the spec tests, close the gaps it opens, and specify base64, SHA-2 and P-256 ECDSA
overview: Pin vector 0.6.0 and regenerate every test/spec file; bring the HMAC and HKDF Secret exports, RFC-cited PBKDF2, SCRAM and ChaCha20 values into the existing contracts where 0.6.0 can now express them; add spec-first contracts for std modules that have RFC vectors (base64/base64url, SHA-1/SHA-2, P-256 ECDSA). Whatever 0.6.0 still cannot express is recorded in the spec, not forced. No stage changes std/.
priority: 60
stages:
  - id: s1-vector-060
    title: "test(std): pin vector 0.6.0 and regenerate the spec tests"
    goal: .vector-version reads 0.6.0, every test/spec file is what vector 0.6.0 emits from its contract, contracts/README.md describes the forms 0.6.0 adds, and rfcs/ holds RFC 6234 and RFC 6979 for the new specs.
    verification: bash scripts/fetch-vector.sh && for n in hex rfc4231-hmac-sha2 rfc5869-hkdf-sha256 rfc7748-x25519 rfc7914-pbkdf2-sha256 rfc8032-ed25519 rfc8439-chacha20-poly1305 scram-sha256; do bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json || exit 1; done && node tests/run.js spec && node tests/run.js third-party-licence && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s1-bump
        content: Set .vector-version to 0.6.0, run bash scripts/fetch-vector.sh --force, re-extract all eight contracts (none should change) and re-emit all eight test/spec files with spec emit (only hex.ts and rfc8439-chacha20-poly1305.ts change, le64 becoming intBytes) — see S1
        status: pending
      - id: s1-readme
        content: Extend contracts/README.md "What a spec declares" with the forms vector 0.6.0 adds, each worded from vector's docs/guide/guides/writing-a-spec.md at v0.6.0 in build/vector/ and claiming nothing that guide does not say — see S1
        status: pending
      - id: s1-rfcs
        content: Add rfcs/rfc6234.txt and rfcs/rfc6979.txt byte-identical to the RFC Editor's plain-text copies and list them in THIRD_PARTY_NOTICES.md "IETF RFCs" beside the others — see S1
        status: pending
  - id: s2-hmac-hkdf-secret
    title: "test(std): cover the HMAC and HKDF Secret exports in their RFC contracts"
    goal: The rfc4231 and rfc5869 contracts test hmacSha256Secret, hmacSha384Secret, hmacSha512Secret and the six HKDF *Secret exports through properties against their plain twins, and try the window and offset-write exports; each export still out of scope names the vector 0.6.0 limitation that keeps it there.
    verification: bash scripts/fetch-vector.sh && for n in rfc4231-hmac-sha2 rfc5869-hkdf-sha256; do bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json || exit 1; done && node tests/run.js spec && node tests/run.js third-party-licence && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s2-secret
        content: Move hmacSha256Secret, hmacSha384Secret, hmacSha512Secret and hkdf{Extract,Expand}Sha{256,384}Secret, hkdfSha{256,384}Secret out of Out of scope into property clauses that drive the Secret parameter (vector #194) and compare with the plain export's result — see S2
        status: pending
      - id: s2-window
        content: Try hmacKeyedVerify and hmacKeyedInto, and hkdfExtractInto, hkdfExpandInto, hkdfExpandLabelInto, as a (buf, off, len) window and an (out, at) to end write (vector #185, #191); keep out of scope, with the exact reason, any whose parameter is a class such as HkdfScratch — see S2
        status: pending
      - id: s2-regen
        content: Rebuild the two specs, re-extract, spec check --run-sources --nish-root ., re-emit the tests, run spec mutate on each against std/ and report its kill count in the PR body — see S2
        status: pending
  - id: s3-pbkdf2-scram-cited
    title: "test(std): cite the PBKDF2 and SCRAM vectors from their RFCs"
    goal: The rfc7914 PBKDF2 rows and the scram-sha256 rows take their expected values from the RFC text (RFC 7914 section 11, RFC 7677 section 3) where vector 0.6.0 reads them, their integer arguments carry labels, and every row still sourced from a command says why.
    verification: bash scripts/fetch-vector.sh && for n in rfc7914-pbkdf2-sha256 scram-sha256; do bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json || exit 1; done && node tests/run.js spec && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s3-pbkdf2
        content: Replace the Python hashlib Source commands of the RFC 7914 section 11 PBKDF2-HMAC-SHA-256 rows with values cited from the RFC across its wrapped lines (vector #189), and label the iteration count and length arguments so spec check stops warning — see S3
        status: pending
      - id: s3-scram
        content: Cite the RFC 7677 section 3 exchange values for scram-sha256 where 0.6.0 reads them inside the wrapped messages, label S1's 4096 and S4's 0, and add property clauses where an export has an algebraic law (for example client proof XOR client signature gives the client key) — see S3
        status: pending
      - id: s3-regen
        content: Rebuild both specs, re-extract, spec check --run-sources --nish-root ., re-emit, run spec mutate on each and report the kill counts in the PR body — see S3
        status: pending
  - id: s4-chacha20-rfc-vectors
    title: "test(std): cite the omitted RFC 8439 vectors"
    goal: The rfc8439 contract cites the section 2.1.1 and 2.2.1 quarter-round vectors and the Appendix A.1 to A.4 vectors that #1671 lists as omitted, or records for each one still omitted the vector 0.6.0 limitation that keeps it out.
    verification: bash scripts/fetch-vector.sh && n=rfc8439-chacha20-poly1305 && bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json && node tests/run.js spec && node tests/run.js third-party-licence && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s4-vectors
        content: Add rows for RFC 8439 2.1.1, 2.2.1 (including the word positions 2, 7, 8, 13 now prose-only), A.1 vectors 1 to 5, A.2 vectors 1 to 3, A.3 vectors 1 to 11 and A.4 vectors 1 to 3, using the case-heading pairing and wrapped-value reading of vector 0.6.0 (#198, #189) — see S4
        status: pending
      - id: s4-record
        content: For each vector still omitted, write the reason into the spec where the omissions are listed, and update this spec's row in THIRD_PARTY_NOTICES.md only if its description of what Nish changed is no longer true — see S4
        status: pending
      - id: s4-regen
        content: Rebuild, re-extract, spec check --run-sources --nish-root ., re-emit, run spec mutate and report its kill count in the PR body — see S4
        status: pending
  - id: s5-spec-base64
    title: "test(std): specify base64 and base64url from RFC 4648"
    goal: A spec-first contract for nish/base64 and nish/crypto/base64url, cited from RFC 4648 section 10, passes against std/ with properties for round trips and the encoded length, and records what it leaves out.
    verification: bash scripts/fetch-vector.sh && n=rfc4648-base64 && bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json && node tests/run.js spec && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s5-spec
        content: Write specs/rfc4648-base64.md covering base64Encode, base64EncodedLength and base64EncodeInto (std/base64.ts) and base64urlEncode, base64urlDecode, base64StdPadEncode, base64StdPadDecode, base64StdPadEncodeInto and base64StdPadDecodedLength (std/crypto/base64url.ts), with the RFC 4648 section 10 vectors, round-trip and length properties and the strict-decode refusals — see S5
        status: pending
      - id: s5-regen
        content: Build the spec, extract the contract, spec check --run-sources --nish-root ., emit test/spec/rfc4648-base64.ts, run spec mutate and report its kill count — see S5
        status: pending
  - id: s6-spec-sha2
    title: "test(std): specify SHA-1 and SHA-2 from RFC 6234"
    goal: A spec-first contract for sha1, sha256, sha384 and sha512 in std/crypto, cited from RFC 6234, passes against std/ and records what it leaves out (the streaming classes if vector cannot drive them).
    verification: bash scripts/fetch-vector.sh && n=rfc6234-sha && bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json && node tests/run.js spec && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s6-spec
        content: Write specs/rfc6234-sha.md over sha1 (std/crypto/sha1.ts), sha256 (std/crypto/sha256.ts), sha384 and sha512 (std/crypto/sha512.ts) with the RFC 6234 section 8.5 test results, the one-million-a vector as an Iterate row marked slow if it is slow, and properties for digest length — see S6
        status: pending
      - id: s6-regen
        content: Fetch the RFC 6234 .refcache entry with build-spec --fetch, build, extract, spec check --run-sources --nish-root ., emit test/spec/rfc6234-sha.ts, run spec mutate and report its kill count — see S6
        status: pending
  - id: s7-spec-p256-ecdsa
    title: "test(std): specify P-256 ECDSA signing from RFC 6979"
    goal: A spec-first contract for p256Sign, p256SignSha256, p256Verify, p256VerifySha256 and p256PublicKey, cited from RFC 6979 appendix A.2.5, passes against std/ (its nonces are RFC 6979 deterministic, so the signatures match byte for byte) and records what it leaves out.
    verification: bash scripts/fetch-vector.sh && n=rfc6979-p256-ecdsa && bash scripts/build-spec.sh --check specs/$n.md && build/vector/dist/vector spec extract --check specs/$n.xml -o contracts/$n.json && build/vector/dist/vector spec check contracts/$n.json --run-sources --nish-root . && build/vector/dist/vector spec stale test/spec/$n.ts contracts/$n.json && node tests/run.js spec && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    todos:
      - id: s7-spec
        content: Write specs/rfc6979-p256-ecdsa.md with the A.2.5 key pair and the SHA-256 "sample" and "test" signatures for p256SignSha256 and p256Sign over the digest, a sign-then-verify property, a tampered-signature property for p256Verify, and the key as a Secret driven by a property or vector (vector #194) — see S7
        status: pending
      - id: s7-regen
        content: Fetch the RFC 6979 .refcache entry with build-spec --fetch, build, extract, spec check --run-sources --nish-root ., emit test/spec/rfc6979-p256-ecdsa.ts, run spec mutate and report its kill count — see S7
        status: pending
---

## Context

vector (github.com/amritk/vector, MIT) turns a kramdown-rfc spec into a JSON
contract and a Nish test (`contracts/README.md`). Nish pins 0.5.0; 0.6.0 adds
Secret parameters driven by a property and command sources that print an
integer, bool or null (#194), a (buf, off, len) window as one bytes parameter
(#185), an (out, at) → end write as a bytes result (#191), integers as bytes of
every width and byte order (#188), values named across wrapped lines (#189),
values paired under RFC case headings (#198), v3 plain-text RFCs (#183), and
fidelity fixes (#180, #179). Regenerating the eight tests under 0.6.0 changes
only `hex.ts` and `rfc8439-chacha20-poly1305.ts` (an `intBytes` helper replaces
`le64`); `node tests/run.js spec` passes 41 with 2 skips (hex has no module
yet).

Rules for every stage:

- **No `std/` change.** A property or vector that exposes a `std/` bug stops
  the stage: open the PR as a draft with the failing clause and the evidence.
- **Record, don't force.** An export or vector 0.6.0 cannot express stays
  `Out of scope` (or in the spec's omissions) with the exact limitation, so it
  can be filed upstream in amritk/vector.
- **`.refcache`.** `build-spec.sh --fetch` refreshes every stale entry; commit
  only the new entry your spec needs and `git checkout -- .refcache` the rest.
- New specs follow the existing ones' front matter, notice and layout
  (`specs/rfc7748-x25519.md` is a nish-authored one).
- Each stage's PR body says `Refs #1671` where it closes an item listed there.

## S1

**Owns:** `.vector-version`, `test/spec/*.ts` (regenerated only), `contracts/README.md`, `rfcs/rfc6234.txt`, `rfcs/rfc6979.txt`, `THIRD_PARTY_NOTICES.md` (the "IETF RFCs" paragraph only)
**Model:** sonnet
**Depends on:** —


Mechanical. The bump and regeneration are known to pass (verified in the
planning session). `contracts/README.md` is the one place the spec forms are
documented, so S1 documents all of 0.6.0's forms up front; later stages do not
edit it. The RFC copies for S6 and S7 land here so that the IETF paragraph of
`THIRD_PARTY_NOTICES.md` has one owner.

## S2

**Owns:** `specs/rfc4231-hmac-sha2.*`, `specs/rfc5869-hkdf-sha256.*`, `contracts/rfc4231-hmac-sha2.json`, `contracts/rfc5869-hkdf-sha256.json`, `test/spec/rfc4231-hmac-sha2.ts`, `test/spec/rfc5869-hkdf-sha256.ts`, `THIRD_PARTY_NOTICES.md` (the `specs/rfc5869-hkdf-sha256.md` block and table row only)
**Depends on:** s1


`specs/rfc4231-hmac-sha2.md` lists the three HMAC `*Secret` exports as out of
scope because "a property cannot construct" a `Secret<u8[]>`;
`specs/rfc5869-hkdf-sha256.md` lists the six HKDF `*Secret` exports and the
`*Into` exports. 0.6.0's #194 is meant for exactly this. The stateful classes
(`HmacSha256`, `HmacKey`, …), `pbkdf2HmacSha256` here, Expand-Label (RFC 8446)
and SHA-384 HKDF vectors stay as they are unless 0.6.0 covers them.

## S3

**Owns:** `specs/rfc7914-pbkdf2-sha256.*`, `specs/scram-sha256.*`, `contracts/rfc7914-pbkdf2-sha256.json`, `contracts/scram-sha256.json`, `test/spec/rfc7914-pbkdf2-sha256.ts`, `test/spec/scram-sha256.ts`
**Depends on:** s1


The PBKDF2 §11 values and the SCRAM §3 base64 sit across wrapped lines, so
they are now produced by Python `hashlib` Source commands. Replace a command
only with a value the RFC prints.

## S4

**Owns:** `specs/rfc8439-chacha20-poly1305.*`, `contracts/rfc8439-chacha20-poly1305.json`, `test/spec/rfc8439-chacha20-poly1305.ts`, `THIRD_PARTY_NOTICES.md` (the `specs/rfc8439-chacha20-poly1305.md` block and table row only)
**Depends on:** s1; merges after s2 (both may touch adjacent THIRD_PARTY_NOTICES.md lines; a conflict there goes back to this worker)


#1671 lists RFC 8439 2.1.1, 2.2.1, A.1 1–5, A.2 1–3, A.3 1–11 and A.4 1–3 as
omitted with no reason. Today A.1–A.4 are cited one case each (README: "cites
one of them"); 0.6.0's #198 pairs values under case headings.

## S5

**Owns:** `specs/rfc4648-base64.*`, `contracts/rfc4648-base64.json`, `test/spec/rfc4648-base64.ts`
**Depends on:** s1


`std/base64.ts` (encode only, not constant time) and
`std/crypto/base64url.ts` (constant time, strict) are two modules on purpose
(crypto-hardening S11). One spec may cover both, each export its own clause.

## S6

**Owns:** `specs/rfc6234-sha.*`, `contracts/rfc6234-sha.json`, `test/spec/rfc6234-sha.ts`, `.refcache/reference.RFC.6234.xml`
**Depends on:** s1


RFC 6234's test results are in its C test driver (§8.5). If vector cannot
read them there, cite the FIPS 180 examples RFC 6234 quotes, or source values
from a command with the reason recorded, as the PBKDF2 spec does now.

## S7

**Owns:** `specs/rfc6979-p256-ecdsa.*`, `contracts/rfc6979-p256-ecdsa.json`, `test/spec/rfc6979-p256-ecdsa.ts`, `.refcache/reference.RFC.6979.xml`
**Depends on:** s1


`p256Sign` takes the private key as `Secret<u8[]>`. Its nonces are RFC 6979
deterministic with HMAC-SHA-256, so A.2.5's SHA-256 signatures must match
byte for byte; the SHA-1/224/384/512 rows apply only if a std export signs a
digest of that size.

## Acceptance criteria

1. `main`'s `.vector-version` reads `0.6.0`, and re-emitting every
   `test/spec/*.ts` from its contract with that vector changes nothing.
2. `node tests/run.js spec` on `main` fails nothing; every test whose module is
   in `std/` passes against it, and each SKIP is hex's missing module or a
   declared slow clause.
3. `hmacSha256Secret`, `hmacSha384Secret`, `hmacSha512Secret` and the HKDF
   `*Secret` exports are tested by a contract clause, or each one still out of
   scope names the vector limitation that keeps it there.
4. Every PBKDF2, SCRAM and RFC 8439 row whose value the RFC prints cites the
   RFC; every row still sourced from a command, and every #1671 RFC 8439
   vector still omitted, carries a stated reason.
5. `std/base64.ts`, `std/crypto/base64url.ts`, `std/crypto/sha1.ts`,
   `sha256.ts`, `sha512.ts` (sha384 and sha512) and `std/crypto/p256.ts`'s
   sign/verify each have a contract cited from RFC 4648, RFC 6234 and RFC 6979,
   and `spec check --run-sources --nish-root .` exits 0 on each.
6. Every RFC a contract cites is byte-identical in `rfcs/` and named in
   `THIRD_PARTY_NOTICES.md`; `node tests/run.js third-party-licence` passes.
7. No file under `std/` changed.
8. What vector 0.6.0 still cannot express is listed in one place (the run
   report) and on #1671.

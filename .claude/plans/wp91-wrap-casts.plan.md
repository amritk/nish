---
name: WP91 — no wrap spelled as a cast
overview: std/, src/ and examples/ hold 555 casts that make signed arithmetic wrap through u32 or u64 (toI32(toU32(a) + toU32(b))) in 69 files, pinned by scripts/wrap-casts.txt. This package takes the count to zero, each cast becoming a sum src/bounds.ts proves, a Result where input can reach the overflow, or wrappingAdd/wrappingSub/wrappingMul from nish:unsafe where the wrap is the algorithm's answer, and then makes scripts/wrap-casts.mjs allow none.
priority: 165
labels: [ready]
issue: 2359
stages:
  - id: s1-compress-src-examples
    title: WP91 S1 — compress, src/ and examples, and one check for every file
    goal: The 26 casts in std/compress, src/ and examples/ are gone, and tests/run.js's compress-only wrapping-sum check is replaced by one that runs scripts/wrap-casts.mjs over every file.
    verification: scripts/wrap-casts.txt lists no std/compress, src/ or examples/ file; the new tests/run.js check fails on a planted cast and on a removed baseline line; docs/security/compress.md cites the new check; no bench/instructions.json count rises.
    issue: 2360
    todos:
      - id: s1-inventory
        content: List every cast in std/compress, src/ and examples/ with its function, its kind (hidden overflow, or intended wrap) and whether input can reach it; the table goes in the PR body — see WP91 S1
        status: pending
      - id: s1-deflate-hashes
        content: Rewrite deflate.ts's eight multiplicative-hash casts as wrappingMul from nish:unsafe and empty COMPRESS_UNSIGNED_OPS — see WP91 S1
        status: pending
      - id: s1-src
        content: Rewrite src/constants.ts's wrapAdd, wrapSub, wrapMul and its literal fold, and src/emit-ops.ts's negated literal, as nish:unsafe wrapping calls — see WP91 S1
        status: pending
      - id: s1-examples
        content: Prove or turn into a Result each cast in the nine examples/ files, dropping any --allow-panics opt-out that goes with it — see WP91 S1
        status: pending
      - id: s1-one-check
        content: Replace the tests/run.js check "std/compress has no u32-cast wrapping sum" with one that runs scripts/wrap-casts.mjs and its self-test, and move COMP-21's citation in docs/security/compress.md to it — see WP91 S1
        status: pending
  - id: s2-regex
    title: WP91 S2 — std/regex.ts
    goal: The 131 casts in std/regex.ts are gone.
    verification: scripts/wrap-casts.txt lists no std/regex.ts line; tests/std-panics.json gains no regex site; node tests/run.js regex passes; no bench/instructions.json count rises.
    issue: 2361
    todos:
      - id: s2-inventory
        content: List every cast in std/regex.ts by function and kind (slot or table index product, cursor advance, length sum) and whether a pattern or subject can reach its overflow — see WP91 S2
        status: pending
      - id: s2-rewrite
        content: Replace each std/regex.ts cast with a proven sum or a Result, adding no panic site and raising no instruction count — see WP91 S2
        status: pending
  - id: s3-json-text-temporal
    title: WP91 S3 — json, text, temporal, sqlite and sync
    goal: The 95 casts in std/json*.ts, std/text.ts, std/temporal.ts, std/sqlite.ts and std/sync/ are gone.
    verification: scripts/wrap-casts.txt lists none of those files; tests/std-panics.json gains no site in them; node tests/run.js json, temporal and sqlite pass; no bench/instructions.json count rises.
    issue: 2362
    todos:
      - id: s3-inventory
        content: List every cast in the eleven files by function and kind and whether input can reach its overflow — see WP91 S3
        status: pending
      - id: s3-rewrite
        content: Replace each cast with a proven sum, a Result, or (sync/ring.ts's sequence counters only) a wrapping call — see WP91 S3
        status: pending
  - id: s4-net-http
    title: WP91 S4 — std/net HTTP, HPACK, URL and the server stack
    goal: The 161 casts in the twenty std/net HTTP, HPACK, URL, fetch and server files are gone.
    verification: scripts/wrap-casts.txt lists none of the S4 files; tests/std-panics.json gains no site in them; node tests/run.js http1, http2, hpack, url and fetch pass; no bench/instructions.json count rises.
    issue: 2363
    todos:
      - id: s4-inventory
        content: List every cast in the S4 files by function and kind and whether a peer's bytes can reach its overflow — see WP91 S4
        status: pending
      - id: s4-rewrite
        content: Replace each cast with a proven sum or an error the codec already returns, with a before/after case in docs/security/ for any a peer could reach — see WP91 S4
        status: pending
  - id: s5-net-tls-quic-postgres
    title: WP91 S5 — std/net TLS, QUIC, PostgreSQL and DNS
    goal: The 82 casts in std/net/tls*, quic*, postgres* and dns.ts are gone.
    verification: scripts/wrap-casts.txt lists none of the S5 files; tests/std-panics.json gains no site in them; node tests/run.js tls, quic and postgres pass; no bench/instructions.json count rises.
    issue: 2364
    todos:
      - id: s5-inventory
        content: List every cast in the S5 files by function and kind, separating packet-number and sequence arithmetic the protocol defines modulo 2^n from length and offset sums — see WP91 S5
        status: pending
      - id: s5-rewrite
        content: Replace each length or offset cast with a proven sum or an error, and each protocol-defined wrap with a wrapping call — see WP91 S5
        status: pending
  - id: s6-crypto
    title: WP91 S6 — std/crypto
    goal: The 60 casts in ten std/crypto files are gone without adding a secret-dependent branch.
    verification: scripts/wrap-casts.txt lists no std/crypto file; the ct_asm checks pass; contracts whose module moved rerun vector's check and mutate; no bench/instructions.json count rises.
    issue: 2365
    todos:
      - id: s6-inventory
        content: List every cast in std/crypto by function and kind, marking which run on secret data and which sit in a function a ct_asm check reads — see WP91 S6
        status: pending
      - id: s6-rewrite
        content: Replace each cast with a wrapping call (word arithmetic), a proven sum, or, outside constant-time code only, a Result — see WP91 S6
        status: pending
  - id: s7-close
    title: WP91 S7 — allow none
    goal: scripts/wrap-casts.mjs refuses every cast wrap, with no baseline file.
    verification: scripts/wrap-casts.txt is deleted; npm run lint fails on a planted cast in any scanned file; CLAUDE.md and .claude/linting.md no longer mention a baseline.
    issue: 2366
    todos:
      - id: s7-drop-baseline
        content: Delete scripts/wrap-casts.txt and its --update mode so scripts/wrap-casts.mjs fails on any cast, and update CLAUDE.md, .claude/linting.md and the S1 check to match — see WP91 S7
        status: pending
---

# WP91 — no wrap spelled as a cast

## Context

A cast through an unsigned type, such as `toI32(toU32(a) + toU32(b))`, makes `i32` or `i64` arithmetic wrap. It does so without the overflow check or a proof from `src/bounds.ts`. Where the operands can overflow, the cast hides a panic: the program goes on with a wrong value, and the site leaves the panic count without anything being proven. Where the wrap is meant, a reader cannot tell. The owner's rule, now in [CLAUDE.md](../../CLAUDE.md) ("A wrap is spelled, never cast"), extends the #2219 decision from `std/compress` to all the Nish code here. A wrap never stands in for a panic, and a wrap the algorithm means is spelled `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`.

[scripts/wrap-casts.mjs](../../scripts/wrap-casts.mjs), in `npm run lint`, finds these casts in `std/`, `src/` and `examples/`. It pins their count per file in [scripts/wrap-casts.txt](../../scripts/wrap-casts.txt): 555 casts in 69 files when the rule landed. A count may only fall. This package takes it to zero.

| Stage | Files | Casts |
| --- | --- | --- |
| S1 | `std/compress/deflate.ts`, `src/constants.ts`, `src/emit-ops.ts`, nine `examples/` | 26 |
| S2 | `std/regex.ts` | 131 |
| S3 | `std/json*.ts` (6), `std/text.ts`, `std/temporal.ts`, `std/sqlite.ts`, `std/sync/ring.ts`, `std/sync/shm.ts` | 95 |
| S4 | `std/net/` http1-codec, hpack, url, http1-client-codec, fetch, upstream, http-compress, static, http-fields, http2, handler, http-server, outbound, serve, prefork, protobuf, http2-cleartext, http1-server, http2-frame, http2-tls | 161 |
| S5 | `std/net/` tls, tls-tcp, tls/record, tls/ticket, the eight quic files, postgres-async, postgres, postgres-carrier, dns | 82 |
| S6 | `std/crypto/` base64url, x509, pki, bcrypt, jwt, x25519, sha256, pki-roots, p256, rsa | 60 |

The counts are read from `scripts/wrap-casts.txt` at the commit that added it. A stage starts from the file as it stands on `main`.

## Approach

- **Three outcomes, chosen per site.**
  1. If the operands provably fit, write the plain `i32` sum and let `src/bounds.ts` discharge it. A loop index under `i < n` plus one, or a byte widened and added to a small constant, are examples.
  2. If input can reach the overflow (a length from the wire, a count times a slot size), return the module's existing error or a `Result`.
  3. If the wrap is the answer (a hash multiply, a sequence or packet counter mod 2^n, cipher word arithmetic on an `i32`), call `wrappingAdd`, `wrappingSub` or `wrappingMul`.

  A value that can be `u32` all the way through may move to `u32` instead.
- **A wrapping call is never a way to clear a panic site.** Each one gets a comment that says why wrapping is the right answer at that site. A reviewer rejects one on a length, an index or an offset.
- **The IR is the same for an intended wrap.** The seed compiles `toI32(toU32(a) + toU32(b))` and `wrappingAdd(a, b)` both to `add i32 %a, %b`, with no flags, and the `i64` multiply both to `mul i64`. Checked on the seed at the commit that added the lint. So outcome 3 moves no IR and needs no `tests/nish-cmp.js` entry. Outcomes 1 and 2 do move IR. `nsw` flags and error branches appear, so those stages declare their nish-cmp moves.
- **The seed already has `nish:unsafe`'s wrapping calls**, so `src/` can use them under the rolling freeze.
- **The rules of the panic packages apply** (rule 1 of [WP80](wp80-std-panics-examples.plan.md) through [WP87](wp87-std-panics-rest.plan.md)):
  - `tests/std-panics.json` may gain no site, so a cast that becomes an unproven sum fails.
  - No `bench/instructions.json` count may rise.
  - Pinned `std/<file>.ts:LINE:COL`s, the checked goldens and `docs/reference/` are regenerated in the same PR.
  - Each PR lowers `scripts/wrap-casts.txt` with `node scripts/wrap-casts.mjs --update`.
- **Each PR body carries the inventory table**, one row per cast: function, kind, whether input reaches it, and its outcome. This is the WP84 S3 format. The count says how many casts went. The table says what each one became.

## WP91 S1 — compress, src/ and examples, and one check for every file

**Files.**
- [std/compress/deflate.ts](../../std/compress/deflate.ts): eight multiplicative hashes, listed in `COMPRESS_UNSIGNED_OPS` in [tests/run.js](../../tests/run.js).
- [src/constants.ts](../../src/constants.ts): `wrapAdd`, `wrapSub` and `wrapMul`, the constant folder's model of the `wrapping*` builtins, and the radix fold at line 176.
- [src/emit-ops.ts](../../src/emit-ops.ts): the negated literal at line 538.
- The `examples/` files that `scripts/wrap-casts.txt` lists.

**Deflate.** Each hash becomes `wrappingMul(word, DEFLATE_HASH_MUL) >>> 17` (or `>>> shift`), with the hash's word in `i32`. Check that the shift keeps its logical meaning on an `i32`. If it does not, keep the product in `u32` and shift there, so no cast back to `i32` wraps. `COMPRESS_UNSIGNED_OPS` ends empty.

**src/.** Every site here is a fold whose wrap is the language's definition of the builtin or of a two's-complement literal, so each becomes a wrapping call. The fold runs on the compiler's own `i64` values, and `wrappingAdd` on two `i64`s is defined. Run `node tests/run.js wasi` and `performance`, as for any `src/` change.

**Examples.** `examples/file-server.ts`'s offset arithmetic (`served.size - pos`, `pos + took`) is file-size arithmetic. It becomes a proven sum or an error. Each other example's site is read and classed the same way.

**One check.** The `tests/run.js` check "std-panics: std/compress has no u32-cast wrapping sum" and its planted self-test only cover `std/compress`. Replace them with a check that runs `node scripts/wrap-casts.mjs` and asserts a zero exit. The check also copies the tree into a temporary directory, plants a cast in one file, and asserts a non-zero exit. That needs a `--root D` flag on the script, as `scripts/rfc-specs.mjs` has. [docs/security/compress.md](../../docs/security/compress.md) COMP-21 cites the old check's text at line 246. Point it at the new check and update the row's count in [docs/security/README.md](../../docs/security/README.md) if it changes.

## WP91 S2 — std/regex.ts

[std/regex.ts](../../std/regex.ts) holds 131 casts, nearly all on its own indexes:
- capture-slot and table products (`count * slots`, `pc * ns`)
- cursor advances (`from + i`, `off + 1`)
- key-length sums (`i + key.length + 2`)

The product of a pattern's state count and its slot count is reachable from the pattern. It needs a bound checked where the program is compiled, then a sum the prover discharges from that bound, or a compile error the regex API already returns. A cursor advance under a loop bound is usually provable as it stands once the cast is gone. Keep the matcher's inner loop at its instruction count: hoist a check out of the loop, and do not add one per step. Each removed cast is a row in the inventory table.

## WP91 S3 — json, text, temporal, sqlite and sync

- **json** ([json-value.ts](../../std/json-value.ts) 29, [json.ts](../../std/json.ts) 16, json-format 5, json-number 2, json-typed 1, json-tokenizer 1): span arithmetic (`end - base`, `at + n`) over a parsed document. A span inside a buffer the parser holds is provable from the buffer's length. One the input supplies is a parse error.
- **[temporal.ts](../../std/temporal.ts)** (22): date arithmetic. WP87 S1 already turns overflowing date arithmetic into a `Result`, so take these with it, or after it if WP87 S1 is open.
- **[sqlite.ts](../../std/sqlite.ts)** (6) and **[text.ts](../../std/text.ts)** (3): length sums.
- **[sync/ring.ts](../../std/sync/ring.ts)** (9) and **[sync/shm.ts](../../std/sync/shm.ts)** (1): a ring's head and tail sequence counters wrap by design. Those are wrapping calls, and the slot index taken from them stays a mask. Any length or offset sum is proven.

## WP91 S4 — std/net HTTP, HPACK, URL and the server stack

Every S4 file parses a peer's bytes, so a cast on a length or an offset there can be reachable from the network. Each one becomes:
- a sum proven from a length already checked against the buffer, or
- the codec's existing error: a 400, a `COMPRESSION_ERROR`, or a URL parse failure.

[hpack.ts](../../std/net/hpack.ts)'s Huffman state and integer decoding are the main reachable sites. [http1-codec.ts](../../std/net/http1-codec.ts) and [http1-client-codec.ts](../../std/net/http1-client-codec.ts) hold header and chunk-size arithmetic. A site a peer can reach that answered a wrong value before the change is a finding: record it in the area's `docs/security/` record with a before/after test, as COMP-21 did. No S4 file has a wrap the protocol means, so a wrapping call in S4 needs its reason spelled out in the PR body.

## WP91 S5 — std/net TLS, QUIC, PostgreSQL and DNS

QUIC packet numbers and TLS record sequence numbers are defined modulo 2^62 and 2^64. Arithmetic on them is a wrapping call where the RFC's own arithmetic wraps. Where the RFC instead bounds the value and closes the connection on exhaustion, it is a proven sum plus that close. Lengths and offsets in [tls.ts](../../std/net/tls.ts), [quic.ts](../../std/net/quic.ts), [quic-frame.ts](../../std/net/quic-frame.ts) and [postgres-async.ts](../../std/net/postgres-async.ts) follow S4's rule. A module with a vector contract reruns vector's `check` and `mutate` on it.

## WP91 S6 — std/crypto

The WP83 approach holds. Inside a function a `ct_asm` check reads, a `Result` or an early return is a branch the check refuses. So a site there goes only by proof or by a wrapping call:
- **Cipher word arithmetic** (sha256's word adds, x25519's limb arithmetic) is a wrapping call, or moves to `u32`.
- **[base64url.ts](../../std/crypto/base64url.ts), [x509.ts](../../std/crypto/x509.ts), [pki.ts](../../std/crypto/pki.ts) and [jwt.ts](../../std/crypto/jwt.ts)** parse public input outside constant-time code. Their length casts become proven sums or the parser's existing error.
- **[bcrypt.ts](../../std/crypto/bcrypt.ts)**'s masked character classes are WP83's example of an intended wrap. They become wrapping calls.

Secret intermediates stay `Secret` and are wiped, as `CLAUDE.md` requires. A change to a module with a contract reruns vector's `check` and `mutate`.

## WP91 S7 — allow none

With every count at zero, delete [scripts/wrap-casts.txt](../../scripts/wrap-casts.txt) and the script's `--update` mode, so any cast fails `npm run lint`. Drop the baseline sentence from [CLAUDE.md](../../CLAUDE.md) and the row's config column in [.claude/linting.md](../../.claude/linting.md). The S1 `tests/run.js` check then plants a cast and asserts that it fails with no baseline involved.

## Out of scope

- Arithmetic that is `u32` or `u64` all the way through. It wraps by its type and has no cast back.
- Masks and loop caps no wider than an assumed maximum. WP84 S3 handled those by inventory for `std/compress`, and they cannot be matched mechanically. A stage that meets one in its files lists it in its table but does not have to fix it.
- Shapes the scanner does not find: a `toU32` operand inside its own parentheses or under a `/`, and a `u32` local summed first and cast later. A stage that finds one in its files fixes it and says so. Teaching the scanner those shapes is a follow-up.
- `bench/` programs and the `tests/` fixtures.

## Tests

- **S1:** the `tests/run.js` check that runs `scripts/wrap-casts.mjs`, with its planted cast. Each reachable overflow S1 turns into an error gets a `tests/link` case that feeds the overflowing input and expects the error. Mirror `tests/link/std_compress_checked_sums`.
- **S2 to S6:** the same kind of case for each site input can reach, and the module's existing sections in `tests/run.js`.
- **S4 and S5:** a recorded finding has its before/after test, as in [docs/security/README.md](../../docs/security/README.md).

## Verification

Each stage, before pushing:
- `npm run check`, `npm run lint`, `npm run lint:dead` and `node docs/check-links.mjs`
- `node tests/run.js std-panics`, and the sections of the modules it touched
- `node tests/self/goldens.js --update`, with the diff read
- `node scripts/gen-reference.mjs --check`
- nish-cmp, with `DECLARED` entries for every program whose IR moved

S1 also runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance`, for its `src/` change. The bench shard's instructions table in CI shows no rise.

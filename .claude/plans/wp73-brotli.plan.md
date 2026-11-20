---
name: WP73 — Brotli, measured first, then an encoder and br responses
overview: There is no Brotli in std/ today, and HttpArena's json-comp profile scores a server's rate times (smallest body ÷ ours)². First measure gzip's levels against Brotli's qualities on json-comp's own bodies by that formula and record a go or no-go; only on a go build nish/compress/brotli at the qualities the figures pick and send br responses from nish/net/http-compress. A decoder for request bodies waits.
spec: docs/wp73-brotli.md
priority: 25
labels: [ready]
issue: 2034
stages:
  - id: s1-measure
    title: WP73 S1 — gzip's levels against Brotli's qualities on HttpArena's json-comp bodies, scored by its own formula, ending in a go or no-go
    goal: A bench in bench/brotli scores gzip at DEFLATE_FAST, DEFLATE_DEFAULT and DEFLATE_BEST and the reference Brotli at qualities 0 to 5, with its static dictionary and without, on json-comp's bodies by json-comp's formula, and records a go or no-go with the table in docs/BENCHMARKS.md.
    verification: node bench/brotli/run.mjs --rounds 5 prints every row decoded back byte for byte, the docs/BENCHMARKS.md table names its machine and commit, the verdict is in docs/wp73-brotli.md §1, and npm run lint, npm run lint:dead and node docs/check-links.mjs pass
    issue: 2035
    todos:
      - id: s1-bodies
        content: Write bench/brotli/bodies.mjs, building json-comp's bodies (/json/{count}?m= at its three pairs) from HttpArena's dataset at a pinned commit — see S1 — the bodies
        status: pending
      - id: s1-gzip-side
        content: Write bench/brotli/main.ts, compressing each body through the shipped HttpCompressor path at DEFLATE_FAST, DEFLATE_DEFAULT and DEFLATE_BEST into a reused buffer — see S1 — the two sides
        status: pending
      - id: s1-brotli-side
        content: Write bench/brotli/brotli.c against the system libbrotlienc at qualities 0 to 5, with the static dictionary and without — see S1 — the two sides
        status: pending
      - id: s1-run
        content: Write bench/brotli/run.mjs, building both sides, running five interleaved rounds, decoding every output with Node's zlib and scoring each row by json-comp's formula — see S1 — the score
        status: pending
      - id: s1-record
        content: Add the table to docs/BENCHMARKS.md and bench/brotli/README.md with machine and commit, and write the verdict into docs/wp73-brotli.md §1 — see S1 — the verdict
        status: pending
      - id: s1-close-out
        content: On a go, name the qualities and dictionary choice S2 builds; on a no-go, set json-comp's level in docs/wp71-httparena.md and close S2 and S3 as not planned — see S1 — the verdict
        status: pending
  - id: s2-encoder
    title: WP73 S2 — nish/compress/brotli, an encoder at the qualities S1 picked (only if S1 says go)
    goal: Only if S1 recorded a go, std/compress/brotli.ts compresses into a caller's buffer at the qualities S1 picked, and every output decodes byte for byte under Node's reference decoder.
    verification: node tests/run.js std_brotli && node bench/brotli/run.mjs --rounds 5 && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2036
    todos:
      - id: s2-module
        content: Add std/compress/brotli.ts, an RFC 7932 encoder at S1's qualities into a caller-held buffer, with doc comments on every export — see S2 — the encoder
        status: pending
      - id: s2-dictionary
        content: Include the static dictionary only if S1's table shows it pays on json-comp's bodies — see S2 — the encoder
        status: pending
      - id: s2-tests
        content: Add tests/run.js std_brotli, decoding every output with zlib.brotliDecompressSync over S1's bodies, empty input, one byte, incompressible input and inputs past one window — see S2 — tests
        status: pending
      - id: s2-bench
        content: Add the nish encoder as a third side of bench/brotli and record its row beside the reference — see S2 — the encoder
        status: pending
      - id: s2-docs
        content: Update docs/guide/using-nish/compression.md, regenerate docs/reference, and add THIRD_PARTY_NOTICES.md if any google/brotli code is ported — see S2 — the encoder
        status: pending
  - id: s3-br-response
    title: WP73 S3 — br as a response coding in nish/net/http-compress
    goal: A request offering br gets a br response from HttpCompressor when its q-values and the program's preference choose it, after S2's encoder lands.
    related: [2006]
    verification: node tests/run.js std_http_compress && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2037
    todos:
      - id: s3-offer
        content: Add HTTP_OFFER_BR and HTTP_CODING_BR to std/net/http-compress.ts and choose by q-value then program preference in httpAcceptEncoding — see S3 — br responses
        status: pending
      - id: s3-compressor
        content: Send Content-Encoding br from HttpCompressor through S2's encoder — see S3 — br responses
        status: pending
      - id: s3-tests
        content: Extend tests/link/std_http_compress with br round trips decoded by Node and q-value negotiation between gzip and br — see S3 — br responses
        status: pending
      - id: s3-docs
        content: Update docs/guide/using-nish/compression.md and the scope and findings of docs/security/compress.md with its docs/security/README.md row — see S3 — br responses
        status: pending
  - id: s4-decoder
    title: WP73 S4 — a Brotli decoder for request bodies, under a decompression-bomb limit
    goal: A request body sent with Content-Encoding br is decoded under the decompression-bomb limit of WP43's stage (#1931), with its security record.
    verification: node tests/run.js std_brotli && node tests/run.js std_http_compress && node scripts/security-scope.mjs && npm run lint
    labels: [deferred]
    issue: 2038
    todos:
      - id: s4-decode
        content: Add a decoder to std/compress/brotli.ts that writes into a caller's buffer and stops at the caller's output limit — see S4 — the decoder
        status: pending
      - id: s4-request-bodies
        content: Decode br request bodies under the bomb limit WP43's stage (#1931) sets — see S4 — the decoder
        status: pending
      - id: s4-record
        content: Record the decoder in docs/security/compress.md with a bomb, truncated-stream and malformed-stream test per finding — see S4 — the decoder
        status: pending
---

# WP73 — Brotli, measured first, then an encoder and br responses

## Context

[`nish/compress`](../../std/compress/) has DEFLATE, gzip and zlib, and [`nish/net/http-compress`](../../std/net/http-compress.ts) sends a gzip response when the request offers it. There is no Brotli (RFC 7932). HttpArena's `json-comp` sends `Accept-Encoding: gzip, br`, takes either, and scores the rate times (smallest bytes per response ÷ ours)²: a body 10% larger than the field's smallest loses about 17% of the profile's score. Compression is per request; no body may be compressed ahead of time. Spec: [docs/wp73-brotli.md](../../docs/wp73-brotli.md); the profile: [docs/wp71-httparena.md](../../docs/wp71-httparena.md).

`static-h2` and `static-h3` also offer `br`, but they may serve the `.br` sibling each file ships with, which needs no encoder: that is WP43 stage 3's sibling lookup, not this package.

## Approach

Measure before building. An encoder is a large module (and, with the static dictionary, 122,784 bytes of read-only data in every binary that imports it), so it is built only if `json-comp`'s own formula says a Brotli quality beats gzip's best level by more than the noise band. S2 and S3 wait on that verdict; S4 waits on a client that sends `br` bodies.

## WP73 S1 — gzip's levels against Brotli's qualities on HttpArena's json-comp bodies, scored by its own formula, ending in a go or no-go

Spec: [§1](../../docs/wp73-brotli.md#1-measured-first-s1). Nothing in `std/` changes in this stage; it adds `bench/brotli/`, mirroring [`bench/gzip/`](../../bench/gzip/README.md) (a Nish side, a C side, a `run.mjs` that builds both and runs them alternately).

### S1 — the bodies

`bench/brotli/bodies.mjs` writes the bodies `json-comp` asks for: `/json/{count}?m=` at the profile's three `count`/`m` pairs, built from HttpArena's `dataset.json` at a pinned HttpArena commit (the one [WP71](../../docs/wp71-httparena.md)'s rig pins, once it does; until then the README names the one used), the bytes our entry's `JsonWriter` would send. Each body is checked into `bench/brotli/` (or regenerated by the script) so a rerun scores the same input.

### S1 — the two sides

- **gzip:** `bench/brotli/main.ts` compresses each body through the shipped path `json-comp` uses, `HttpCompressor` in `nish/net/http-compress` with a level encoder, at `DEFLATE_FAST`, `DEFLATE_DEFAULT` and `DEFLATE_BEST`, into a reused buffer, as `bench/gzip/main.ts` does. A bench side is the code it names: it calls the shipped function, not a loop the bench wrote.
- **Brotli:** `bench/brotli/brotli.c` calls the system `libbrotlienc` (google/brotli 1.1.0 here; the README names the version) through `BrotliEncoderCompress` at qualities 0 to 5, mode `BROTLI_MODE_TEXT`, window 22. "Without the static dictionary" is measured by whatever the library allows (a build of its source with the dictionary search off, if the public API offers no switch); if no fair "without" row can be built, the README says so and S2 decides the dictionary on the "with" rows alone. Nothing from google/brotli is copied into the repo, so no notice is needed in this stage.

### S1 — the score

`bench/brotli/run.mjs` builds both sides, runs five interleaved rounds (each round every side, in alternating order), and for every row records the bytes out and the median CPU time per body on one core. Every output is decoded back with Node's `zlib.gunzipSync` or `zlib.brotliDecompressSync` and compared with its body byte for byte; a row that does not round-trip fails the run.

Each row's score is `json-comp`'s formula: rate × (smallest bytes in the table ÷ the row's bytes)². The rate is 1 ÷ (the measured per-request cost of serving the same body uncompressed + the row's compression time), where the per-request cost is measured on the same machine: a Nish `Http1Server` answering the body uncompressed over loopback, driven as the existing HTTP benches are. A rate from compression time alone would credit the fastest coding with a speed-up the server never sees. The noise band is the spread of the five rounds' scores.

### S1 — the verdict

**Go** if a Brotli quality's score beats gzip's best-scoring level by more than the noise band. The verdict, with the table, goes into:

- [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md): the table, naming the machine and the commit whose bench code produced it, and only the fields `run.mjs` prints;
- `bench/brotli/README.md`: how to run it and the same table;
- [docs/wp73-brotli.md](../../docs/wp73-brotli.md) §1: go or no-go in one line, with the quality (or qualities) S2 builds and whether the static dictionary pays.

On a **go**, the stage's PR names in S2's issue the qualities and the dictionary choice S2 builds. On a **no-go**, gzip's best-scoring level becomes `json-comp`'s, a change to the entry in [docs/wp71-httparena.md](../../docs/wp71-httparena.md) and not to `std/`, and S2 and S3 are closed as not planned with a link to the table.

## WP73 S2 — nish/compress/brotli, an encoder at the qualities S1 picked (only if S1 says go)

**Built only if WP73 S1 recorded a go.** If S1's verdict is no-go, this issue is closed as not planned with a link to S1's table, and nothing here is built. Spec: [§2](../../docs/wp73-brotli.md#2-the-encoder-nishcompressbrotli-s2).

### S2 — the encoder

- `std/compress/brotli.ts`, `nish/compress/brotli`: an RFC 7932 encoder at exactly the qualities S1 picked, no others. Written from the RFC; any code ported from google/brotli (MIT) keeps its notice and is listed in `THIRD_PARTY_NOTICES.md` (`.claude/licensing.md`).
- **A caller's buffers.** Like `nish/compress/deflate`, it compresses into a buffer the caller holds (with a `bound(len)` the caller sizes it by), so a warm response allocates nothing.
- **The static dictionary only if S1 shows it pays** on `json-comp`'s bodies. It is 122,784 bytes of read-only data in every binary that imports the module.
- Every export has a doc comment with `@param` and `@returns` (`node scripts/gen-reference.mjs --check`); `std/` code a `--deny-panics` caller reaches uses only guarded or proven accesses.
- `bench/brotli` gains a third side, the Nish encoder, and its row is recorded beside the reference's in `docs/BENCHMARKS.md`.
- `docs/guide/using-nish/compression.md` gains the module; `docs/reference/` is regenerated with `node scripts/gen-reference.mjs`.

An encoder reads only the program's own bytes, so it has no security record of its own; a decoder reads a peer's, which is S4's.

### S2 — tests

A `tests/run.js` section `std_brotli` (mirroring the gzip checks there) decodes every output with Node's `zlib.brotliDecompressSync` and compares bytes, over S1's bodies, empty input, one byte, incompressible input and inputs longer than one window, at every quality the module offers. A `tests/link` negative pins a caller's buffer that is too small.

## WP73 S3 — br as a response coding in nish/net/http-compress

Spec: [§3](../../docs/wp73-brotli.md#3-br-in-nishnethttp-compress-s3). Waits on S2's encoder; if S1 is a no-go this issue is closed as not planned with S2. This is the same work as WP43 stage 4's `br` item, filed as #2006, so its PR closes #2006 too.

### S3 — br responses

- `std/net/http-compress.ts`: `HTTP_OFFER_BR` beside `HTTP_OFFER_GZIP` and `HTTP_OFFER_DEFLATE`, `HTTP_CODING_BR` beside the other codings; `httpAcceptEncoding` chooses by the request's q-values and, between equal q-values, by the program's preference.
- `HttpCompressor` sends `Content-Encoding: br` through S2's encoder, at the quality S1 picked.
- `tests/link/std_http_compress`: `br` round trips decoded by Node, and negotiation cases (`gzip, br`; `br;q=1, gzip;q=0.8`; `br;q=0`; a program that offers gzip only).
- `docs/guide/using-nish/compression.md` says how to offer `br`; [docs/security/compress.md](../../docs/security/compress.md) widens its scope to the new coding (the parser's new token, no new input read), with its `docs/security/README.md` row.
- `docs/reference/` regenerated.

## WP73 S4 — a Brotli decoder for request bodies, under a decompression-bomb limit

**Deferred** until a client or profile sends `br` request bodies; none of HttpArena's profiles does. Spec: [§4](../../docs/wp73-brotli.md#4-stages).

### S4 — the decoder

- A decoder in `std/compress/brotli.ts` that writes into a caller's buffer and stops at the caller's output limit, answering a negative code for every malformed, truncated or over-limit stream and never panicking.
- Request bodies with `Content-Encoding: br` decoded under the decompression-bomb limit WP43's stage (#1931) sets for gzip and deflate.
- A decoder reads a peer's bytes, so it lands with its findings in `docs/security/compress.md` (scope, each finding fixed with a before/after test or recorded open) and its index row: a bomb past the limit, a truncated stream, a malformed one, and a stream referencing past the window.

## Out of scope

- Qualities above S1's pick: the slow ones are for files compressed once, not per request.
- `zstd` as a coding, until a client or profile asks for it.
- Serving a static file's `.br` sibling: WP43 stage 3.
- Shared or custom dictionaries (compression dictionary transport).

## Tests

| Stage | What | Where |
| --- | --- | --- |
| S1 | every bench output decodes back byte for byte | `bench/brotli/run.mjs` |
| S2 | reference decoder over bodies and edge inputs; too-small buffer negative | `tests/run.js` `std_brotli`, `tests/link/` |
| S3 | `br` round trips and q-value negotiation | `tests/link/std_http_compress` |
| S4 | bomb, truncated, malformed and out-of-window streams | `tests/run.js` `std_brotli`, `tests/link/` |

## Verification

Each stage's `verification` line, plus the definition of done in [CLAUDE.md](../../CLAUDE.md#definition-of-done): `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, and CI's nine test shards green on the head.

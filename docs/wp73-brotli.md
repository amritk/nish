# WP73: Brotli, measured first, then an encoder and `br` responses

**Status: proposed, design only; nothing in `std/` is built for it.** The
anchors are at `f2b8933f`.

`nish/compress` has DEFLATE, gzip and zlib (`std/compress/deflate.ts`,
`gzip.ts`, `zlib.ts`), and `nish/net/http-compress` sends a response gzipped
when the request offers it ([wp43](wp43-http-app-layer.md) stage 4). There is
no Brotli (RFC 7932). Browsers offer `br` on every HTTPS request, and two of
HttpArena's profiles ask for it:

- **`json-comp`** sends `Accept-Encoding: gzip, br` and takes either, but
  scores the rate times (smallest bytes per response ÷ ours)²
  ([wp71](wp71-httparena.md) §1). A body 10% larger than the field's smallest
  loses about 17% of the profile's score, so the coding and its level are
  worth about as much as the server's speed. Compression is per request:
  no body may be compressed ahead of time.
- **`static-h2`** and **`static-h3`** send `br;q=1, gzip;q=0.8`, and
  `/data/static/` ships a `.br` and a `.gz` sibling of each text file, which
  standard mode may serve as they are. That needs no encoder, only WP43
  stage 3's sibling lookup.

## 1. Measured first (S1)

Whether an encoder earns its place is a figure, not an assumption. On the
bodies `json-comp` asks for (`/json/{count}?m=` at its three pairs, built from
HttpArena's dataset) the bench records, per body, the bytes out and the CPU
time of:

- gzip at `DEFLATE_FAST`, `DEFLATE_DEFAULT` and `DEFLATE_BEST` from
  `nish/compress/deflate`;
- the reference Brotli library (`google/brotli`, through its CLI or a C
  harness in `bench/`) at qualities 0 to 5, with its static dictionary and
  without.

The verdict is `json-comp`'s own formula applied to each: rate times size
ratio squared. The rate is 1 ÷ (the per-request cost of serving the same body
uncompressed + the row's compression time), with the per-request cost
measured on the same machine: a Nish `Http1Server` answering the body
uncompressed over loopback, driven as the existing HTTP benches are. A rate
from compression time alone would credit the fastest coding with a speed-up
the server never sees. **Go** if a
Brotli quality beats the best gzip level by more than the noise band of five
interleaved rounds; otherwise the stage records the figures and gzip's best
level becomes `json-comp`'s, which is a change to the entry and not to
`std/`. Either way the table goes into [BENCHMARKS.md](BENCHMARKS.md) with
its machine and commit.

## 2. The encoder: `nish/compress/brotli` (S2)

If S1 says go, an encoder at the qualities S1 picked:

- **Written from RFC 7932.** Code ported from `google/brotli` (MIT) keeps its
  notice and is listed in `THIRD_PARTY_NOTICES.md`
  ([licensing](https://github.com/amritk/nish/blob/main/.claude/licensing.md)).
- **The static dictionary only if S1 shows it pays.** It is 122,784 bytes of
  read-only data in every binary that imports the module, and a small JSON
  body may not use it.
- **A caller's buffers.** Like `nish/compress/deflate`, it compresses into a
  buffer the caller holds, so a warm response allocates nothing.
- **Checked by a decoder that is not ours.** Tests decode every output with
  the reference decoder (Node's `zlib.brotliDecompressSync` in
  `tests/run.js`) and compare bytes, over the bench's bodies, empty input,
  one byte, incompressible input and inputs past one window.

An encoder reads only the program's own bytes, so it has no security record
of its own. A decoder reads a peer's, which is S4's.

## 3. `br` in `nish/net/http-compress` (S3)

`HTTP_OFFER_BR` beside `HTTP_OFFER_GZIP`, `httpAcceptEncoding` choosing by
the request's q-values and then by the program's preference, and
`Content-Encoding: br` from `HttpCompressor`. It is WP43 stage 4's `br` box,
and it moves `docs/guide/using-nish/compression.md` and
the scope of its record, `docs/security/compress.md`, in the same PR.

## 4. Stages

- **S1:** gzip's levels and Brotli's qualities on `json-comp`'s bodies, by
  `json-comp`'s formula; a go or no-go.
- **S2:** `nish/compress/brotli`, the encoder, if S1 says go.
- **S3:** `br` as a response coding in `nish/net/http-compress`.
- **S4** *(deferred)*: a decoder, for request bodies under WP43 stage 4's
  decompression-bomb limit, with its record.

## Not planned

Qualities above S1's pick (the slow ones are for files compressed once, not
per request), and `zstd` as a coding until a client or profile asks for it.

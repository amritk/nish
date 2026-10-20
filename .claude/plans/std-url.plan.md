---
name: nish/net/url — percent-decoding and query strings
overview: Add std/net/url.ts, a zero-allocation splitter, query-pair iterator and percent-decoder over a u8[] window with a string convenience on top, then move the HTTP/1.1 bench onto it. The application layer in #485 builds on it.
stages:
  - id: url-module
    title: "feat(std): nish/net/url, percent-decoding and query-string parsing"
    goal: Ship nish/net/url with its link tests, a Node differential, the arena-flat check, the guide section, the std/README row and a docs/security record
    verification: npm run check, npm run lint, node tests/run.js std_url, node tests/run.js wasi, node tests/run.js performance and an undegraded npm test green, with the regenerated goldens read
    status: pending
    todos:
      - id: url-split
        content: Add urlQueryStart and the path/query split over a u8[] window to std/net/url.ts — see Stage 1, API
        status: pending
      - id: url-decode
        content: Add percentDecode with its flags and URL_DECODE_ERR codes to std/net/url.ts — see Stage 1, Decoding
        status: pending
      - id: url-path-segment
        content: Add the path-segment iterator and percentDecodePathSegment, with %2F kept as a byte in its segment — see Stage 1, Paths
        status: pending
      - id: url-query-iter
        content: Add UrlQueryLimits and UrlQuery (reset, next, the pair windows, failed) and urlQueryFind — see Stage 1, Query pairs
        status: pending
      - id: url-string
        content: Add the string conveniences urlDecode and urlQueryGet on top of the byte API — see Stage 1, Strings
        status: pending
      - id: url-register
        content: Add net/url to stdModuleNames in src/std-modules.ts — see Stage 1, Registration
        status: pending
      - id: url-link-tests
        content: Add tests/link/std_url (every edge case, the arena-flat loop) and its negative programs — see Tests
        status: pending
      - id: url-differential
        content: Add the seeded-fuzz differential against URLSearchParams and decodeURIComponent, native and Node — see Tests, Differential
        status: pending
      - id: url-docs
        content: Add the std/README.md row and the URL section of docs/guide/using-nish/standard-library.md — see Stage 1, Docs
        status: pending
      - id: url-security
        content: Add docs/security/url.md and its row in docs/security/README.md — see Stage 1, Security record
        status: pending
      - id: url-goldens
        content: Regenerate tests/self/goldens and any link goldens with the repo's tooling and read the diff — see Verification
        status: pending
  - id: bench-query
    title: "perf(bench): a query route on the HTTP/1.1 bench, decoded by nish/net/url"
    goal: Add a query route and scenario to the HTTP/1.1 bench, hand-written first as the baseline, then on nish/net/url, and show req/s inside the noise band
    verification: npm run check, npm run lint and node bench/http.mjs --only query old=<hand-written> new=<module> nish-copy=<copy of new> with the delta read against the copy's band
    status: pending
    todos:
      - id: bench-baseline
        content: Add a /query route to bench/http1-server.ts that finds name= by hand, and a query scenario to bench/http.mjs — see Stage 2, Baseline
        status: pending
      - id: bench-module
        content: Move the /query route onto nish/net/url and measure it against the baseline and nish-copy — see Stage 2, Measurement
        status: pending
      - id: bench-readme
        content: Record the route and the figures in bench/README.md — see Stage 2, Measurement
        status: pending
---

## Context

`std/` has no URL decoding. `Http1Parser` (`std/net/http1.ts`) keeps a request target as bytes, and a handler that wants `?name=` has to scan for it by hand. The request names `bench/http1-server.ts`'s `query` route as the place that does so, but the bench has no such route today (`/json`, `/plaintext`, `/json-echo`, `/json-echo-doc` only), and `bench/http.mjs` has no `query` scenario; Stage 2 adds both. No open PR or issue covers URL, query or percent-decoding (only #531, the release PR, is open).

## Approach

- **Path: `std/net/url.ts`, imported as `nish/net/url`.** `std/README.md` puts protocol pieces under `nish/net` and `text.ts` is general string work; a URL target is HTTP's. One module, not two.
- **Bytes first.** Every function takes `(bytes: u8[], off: i32, len: i32)` and answers offsets, lengths or a count written into a caller-owned `u8[]`. Nothing allocates per call. The string functions sit on top and may allocate their answer.
- **Errors are negative `i32` codes**, as `JSON_TOK_ERR_*` and `JSON_WRITE_*` are: a sticky `failed` on the iterator, a negative return from the decoder. No panic on any input; a window outside its array is the one panic, as everywhere else in `std/`.
- **Caps are a class of defaulted fields**, `UrlQueryLimits`, in `Http1Config`'s style: one doc comment per field saying what happens past it.
- **No closures in the hot path** (`docs/AI.md`, `.claude/typescript.md`): the iterator is a class with `next()`, not a callback.

## Stage 1 — nish/net/url

**Owns:** `std/net/url.ts`, `std/README.md`, `src/std-modules.ts`, `tests/link/std_url*/**`, `tests/run.js`, `tests/differential/**`, `tests/self/goldens/**`, `docs/guide/using-nish/standard-library.md`, `docs/security/url.md`, `docs/security/README.md`, `docs/AI.md`, `llms.txt`

### API

A sketch; the worker may rename within the module's conventions but keeps every behaviour.

```ts
/** Index of the `?` in the window, or -1. The path is [off, q), the query (q, off+len). No copy. */
export const urlQueryStart = (bytes: u8[], off: i32, len: i32): i32
```

A fragment (`#…`) is not part of a request target (RFC 9112 §3.2); the splitter does not look for one, and the doc says so.

### Decoding

```ts
export const URL_DECODE_FORM: i32 = 1        // `+` is a space (application/x-www-form-urlencoded)
export const URL_DECODE_LENIENT: i32 = 2     // a malformed escape is copied as it stands (WHATWG percent-decode)
export const URL_DECODE_ALLOW_NUL: i32 = 4   // `%00` decodes to a 0 byte
export const URL_DECODE_ERR_ESCAPE: i32      // `%zz`, or `%4` / `%` at the end of the window
export const URL_DECODE_ERR_NUL: i32         // `%00` without ALLOW_NUL
export const URL_DECODE_ERR_SPACE: i32       // `out` too small; nothing written past `out.length`
/** Bytes written at out[at…], or a negative URL_DECODE_ERR_* code; errorAt names the offending input byte. */
export const percentDecode = (src: u8[], off: i32, len: i32, out: u8[], at: i32, flags: i32): i32
```

Default (flags 0) is strict: malformed escapes and `%00` are refused, `+` stays `+`. Decoding never grows the input, so `out` needs at most `len` bytes; a smaller `out` answers `URL_DECODE_ERR_SPACE` before any write past its end. The byte API does not validate UTF-8 — a decoded value is bytes — and the doc says so.

### Paths

A path is split into segments on the raw `/` only, before any decoding; `percentDecodePathSegment` decodes one segment, so `%2F` becomes byte `0x2F` inside its segment and can never start a new one. `+` is literal in a path. `/a%2Fb/c` is two segments, `a/b` and `c`. #485's router depends on this, so it gets its own test and its own row in the security record.

### Query pairs

```ts
export class UrlQueryLimits {
  /** The most pairs one query yields; past it, `next()` answers URL_QUERY_ERR_PAIRS and stays spent. */
  maxPairs: i32 = 100
}
export class UrlQuery {
  constructor(limits: UrlQueryLimits)
  reset(bytes: u8[], off: i32, len: i32): void   // reuse, so a warmed loop allocates nothing
  next(): i32          // URL_QUERY_PAIR, URL_QUERY_END, or a negative URL_QUERY_ERR_* (sticky in `failed`)
  keyStart: i32; keyLength: i32
  valueStart: i32; valueLength: i32
  hasValue: boolean    // false for `a`, true for `b=` with valueLength 0
  failed: i32
}
/** The first pair whose key, decoded in form mode, equals `name`; answers URL_QUERY_PAIR with q's windows set, URL_QUERY_END, or the error. */
export const urlQueryFind = (q: UrlQuery, name: string): i32
```

- `&` separates pairs; empty pairs (`a&&b`, a leading or trailing `&`) are skipped and not counted, as `URLSearchParams` does.
- `=` is optional: `a&b=` yields `a` (no value) and `b` (empty value). Only the first `=` splits; `a=b=c` is key `a`, value `b=c`.
- Repeated keys come out in order. `urlQueryFind` compares the decoded key with `name` byte by byte without allocating, so `?na%6De=x` finds `name`.
- Windows are raw (undecoded); the caller decodes a key or value with `percentDecode` and `URL_DECODE_FORM`.
- The cap bounds what the iterator yields; the scan itself is bounded by the window, which `Http1Config.maxTarget` already bounds.

### Strings

`urlDecode(s: string, flags: i32): string | null` — `null` for any error, and for a result that is not valid UTF-8 (a Nish string holds UTF-8), which is `decodeURIComponent`'s rule. `urlQueryGet(target: string, name: string): string | null` — the first value for `name` in the target's query, form-decoded; `""` for a key with no `=` (as `URLSearchParams.get` answers); `null` when absent or malformed. These may allocate their answer.

### Registration

`src/std-modules.ts`'s `stdModuleNames()` gains `net/url` in sorted order (`tests/run.js` fails when it disagrees with `std/`). That makes this a `src/` change: run `node tests/run.js wasi` and `node tests/run.js performance`, and regenerate `tests/self/goldens/checked-self.txt`.

### Docs

- `std/README.md`: a row in the `nish/net` table, in the house style (what it is, what it refuses, the record it has, the tests that run it).
- `docs/guide/using-nish/standard-library.md`: a section on `nish/net/url` with a compiled example — no new page, so no `scalar.config.json` route.
- Each divergence from Node, stated on purpose in both: strict mode refuses what `URLSearchParams` passes through (lenient mode matches it); the byte API does not reject invalid UTF-8 where `decodeURIComponent` throws; `%00` is refused by default.

### Security record

`docs/security/url.md`, in the shape of `docs/security/http1.md`: the base commit its anchors are at; rows for the pair cap, malformed escapes (strict and lenient), `%00`, the output-space check, `%2F` in paths, and no read outside the window; its Tests list naming each check by its exact `check(...)` string, grepped against `tests/run.js` before pushing. A row in `docs/security/README.md`.

## Stage 2 — the bench's query route

**Owns:** `bench/http1-server.ts`, `bench/http.mjs`, `bench/README.md`

**Depends on:** `url-module` merged (it imports `nish/net/url`), so it starts after that merge.

### Baseline

`bench/http1-server.ts` gains `/query?name=…`, answering `Hello, <name>` with the value found by a hand-written byte scan of the target — the code the request describes every handler writing. `bench/http.mjs` gains a `query keep-alive c=256` scenario whose path carries a percent-encoded name and a second pair. Build this binary first and keep it as `old`.

### Measurement

Move the route onto `UrlQuery` / `urlQueryFind` / `percentDecode` (no string conveniences, no per-request allocation). Run `node bench/http.mjs --only query old=<baseline> new=<module> nish-copy=<byte-identical copy of new>`, read every delta against the `new` / `nish-copy` spread, and claim "unchanged" only inside it. The figures go in the commit's `Measured:` trailer and in `bench/README.md`.

## Out of scope

- URL building or percent-encoding; full WHATWG URL parsing (scheme, host, port, userinfo, fragments).
- `application/x-www-form-urlencoded` request bodies beyond what the same `UrlQuery` over a body window already gives.
- The router itself (#485).

## Tests

- `tests/link/std_url`: every edge case above — split with and without `?`, `a&b=`, `a=b=c`, empty pairs, repeated keys in order, first-value lookup with an encoded key, `+` in both modes, `%zz`, `%4`, a trailing `%`, `%00` with and without the flag, lenient mode, `/a%2Fb/c` as two segments, an `out` one byte too small, the cap exactly reached and exceeded. Run natively and under Node with the same expected stdout. Mirror `tests/link/std_bytes` and `tests/link/std_json_tokenizer`.
- Negative programs: a malformed escape, the pair cap, a too-small buffer, and a window outside its array (the one panic), each with `expected.code`.
- **Arena flat:** a warmed loop of a few hundred `reset` / `next` / `percentDecode` calls inside `using a = arena()` prints `Arena.used()` before and after, equal.
- **Differential:** a seeded fuzz corpus (escapes, `+`, `&`, `=`, `%`, hex of both cases, non-ASCII bytes, empty pairs), each input run through the Nish program natively and under Node and through `URLSearchParams` and `decodeURIComponent` in the harness; every disagreement is either nil or one of the divergences the docs list, asserted as such. Register any new positive case with `node tests/differential/goldens.js --update` in the same commit.

## Verification

```
bash scripts/fetch-seed.sh --force
npm run check && npm run lint
node tests/run.js std_url
node tests/run.js wasi && node tests/run.js performance
node tests/self/goldens.js --update   # then read the diff
npm test                              # undegraded: read the skip count
```

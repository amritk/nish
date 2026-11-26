---
name: WP90 — a web-frameworks benchmark entry (scenario v2), and the multipart reader it needs
overview: the-benchmarker/web-frameworks takes any HTTP server that passes its scenario v2 spec, and nish/net/http-server meets every v2 route except POST /upload, because nothing in std/ parses multipart/form-data. Add a multipart reader to nish/net/multipart with its security record (S1), build the entry in bench/web-frameworks/ with a tests/link check of every v2 rule (S2), and hand the owner a ready upstream pull request, which they open when they choose (S3).
priority: 1
labels: [ready]
issue: 2343
stages:
  - id: s1-multipart-reader
    title: WP90 S1 — a multipart/form-data reader in nish/net/multipart, with its security record
    goal: std/net/multipart.ts reads a whole multipart/form-data body (RFC 7578, RFC 2046 §5.1) into its parts, with the boundary taken from the Content-Type by a media-type parser, under part and header caps, and refuses every malformed body with a named code.
    verification: node tests/run.js net_multipart && node tests/run.js net_media_type && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2344
    todos:
      - id: s1-media-type
        content: Add mediaTypeParse to std/net/http-fields.ts, reading type, subtype and parameters (quoted strings included) of a Content-Type value and refusing a malformed one — see WP90 S1
        status: pending
      - id: s1-reader
        content: Add MultipartReader and MultipartLimits to std/net/multipart.ts (creating the module and its stdModuleNames entry if WP74 S2 has not), answering each part's name, filename, content type and body span — see WP90 S1
        status: pending
      - id: s1-rules
        content: Implement the framing rules (boundary 1 to 70 bytes, CRLF delimiters, preamble and epilogue ignored, close delimiter required, Content-Disposition form-data with name required) with a MULTIPART_ERR code each — see WP90 S1
        status: pending
      - id: s1-tests
        content: Add tests/link/net_multipart_read (every rule, every cap, input from Node's FormData serialiser, a body holding every byte value) and tests/link/net_media_type — see WP90 S1
        status: pending
      - id: s1-record
        content: Write or extend docs/security/multipart.md with the reader's scope, findings and bounds, its docs/security/README.md row, std/README.md and standard-library.md rows, a guide section, and regenerate docs/reference — see WP90 S1
        status: pending
  - id: s2-entry
    title: WP90 S2 — bench/web-frameworks/, the scenario v2 entry on nish/net/http-server, checked by tests/link
    goal: bench/web-frameworks/ holds the language and framework configs and a server on port 3000 answering all six v2 routes exactly as SCENARIO.md states, one prefork worker a core, and tests/link/web_frameworks_entry drives every rule through it.
    verification: node tests/run.js web_frameworks_entry passes with a nonzero case count; make -f nish/http-server/.Makefile test passes in a web-frameworks checkout at the commit bench/web-frameworks/README.md names; npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2345
    todos:
      - id: s2-reread
        content: Re-read SCENARIO.md, CONTRIBUTING.md, the root config.yaml and the Dockerfile generator on the develop branch, and pin the commit in bench/web-frameworks/README.md — see WP90 S2
        status: pending
      - id: s2-configs
        content: Add bench/web-frameworks/nish/config.yaml (version, files, engine command) and nish/http-server/config.yaml (specs v2, website, version, reviewers) with the toolchain install as bootstrap steps — see WP90 S2
        status: pending
      - id: s2-server
        content: Add bench/web-frameworks/nish/http-server/server.ts and main.ts serving the six v2 routes on port 3000 under nish/net/prefork — see WP90 S2
        status: pending
      - id: s2-check
        content: Add tests/link/web_frameworks_entry, a Node driver sending every accepted and refused case of each route, split and chunked, over keep-alive — see WP90 S2
        status: pending
      - id: s2-readme
        content: Write bench/web-frameworks/README.md (the copy-in steps, the pinned upstream commit, how to run the upstream spec suite) and add a web-frameworks row to docs/BENCHMARKS.md naming no figures — see WP90 S2
        status: pending
  - id: s3-submit
    title: WP90 S3 — the upstream pull request to the-benchmarker/web-frameworks
    goal: The entry is a merged directory in the-benchmarker/web-frameworks, passing its CI, with amritk as its reviewer, and bench/web-frameworks/README.md links the upstream PR.
    verification: the upstream PR is merged with its CI green; bench/web-frameworks/README.md names the upstream PR and the commit it merged at; node docs/check-links.mjs
    issue: 2346
    todos:
      - id: s3-body
        content: Write the upstream PR body and the fork steps into bench/web-frameworks/README.md for the owner to use — see WP90 S3
        status: pending
      - id: s3-pr
        content: The owner copies bench/web-frameworks/nish/ into their fork, runs bundle exec rake config and the spec suite, and opens the PR when they choose — see WP90 S3
        status: pending
      - id: s3-record
        content: Record the upstream PR and its merge commit in bench/web-frameworks/README.md, and the first published figures in docs/BENCHMARKS.md once the board shows them — see WP90 S3
        status: pending
---

# WP90 — a web-frameworks benchmark entry, and the multipart reader it needs

## Context

[the-benchmarker/web-frameworks](https://github.com/the-benchmarker/web-frameworks) (results at [web-frameworks-benchmark.vercel.app](https://web-frameworks-benchmark.vercel.app/), and at the netlify address its README links) benchmarks HTTP servers, from full-stack platforms to small routers. Its rules were read on its `develop` branch on 2026-11-26 (`README.md`, `CONTRIBUTING.md`, `SCENARIO.md`, the root and per-language `config.yaml`):

- **Who may enter:** any entry that passes the spec suite. There is no popularity, release or maturity bar. A language's standard-library server counts as a framework, as it does on HttpArena ([WP71](wp71-httparena.plan.md)).
- **Scenario v2** is the one new entries take; v1 entries are "no longer accepted". At that commit 16 of 442 entries were on v2, and PR #10449 ("Use v1 for results", merged 2026-11-25) suggests the published board still shows v1 runs.
- **The run:** Docker with `--network host`, port 3000, plain HTTP, no logging, no compression. Load is `zrk --closed` over keep-alive connections, with the server pinned to its own CPUs. The board shows requests per second and p50 to p99 latency. No hardware is published.
- **The layout:** `<language>/config.yaml` (version, source globs, engine command), `<language>/<framework>/config.yaml` (`specs`, `website`, `version`, `reviewers`), and the source. `bundle exec rake config` generates the Dockerfile and Makefile; custom install steps go in `bootstrap`.

The v2 routes against what `std/` has at `37d7e924`:

| Route | Rule | Built |
| --- | --- | --- |
| `GET /` | 200, empty body | yes |
| `GET /user/{id}` | exactly 8 digits after percent-decoding, kept as a string, answered `{"id":"…"}`; otherwise 400 or 404 | yes: [`router.ts`](../../std/net/router.ts), [`url.ts`](../../std/net/url.ts) |
| `POST /user` | 200, empty body, for an empty body | yes |
| `GET /serialization?seed=` | one `seed` of 8 lowercase letters, else 400 (repeats and extra pairs too, percent-encoded or not); 100 objects `{"seed":…}` built per request | yes: `UrlQuery`, `JsonWriter` |
| `POST /deserialization` | media type checked first (415); a body of 100 items with integral ids 0 to 1,000,000, else 400; answers count and checksum | yes: [`json-value.ts`](../../std/json-value.ts), a media-type check S1 adds |
| `POST /upload` | multipart/form-data (else 415); one non-empty-filename part named `file` (else 400); answers first byte, last byte and SHA-256 hex | **no multipart parser**; SHA-256 is [`sha256.ts`](../../std/crypto/sha256.ts) |

Bodies arrive with Content-Length or chunked, both of which [`http1-codec.ts`](../../std/net/http1-codec.ts) de-frames; the upload (256 KiB plus framing) fits `HttpServerLimits.maxBody`'s default of 1 MiB. [`bench/httparena/`](../../bench/httparena/) already has the server shape (prefork, one worker a core) and the image (Ubuntu 24.04, LLVM 18, `install.sh` with its SHA-256 check).

## Approach

- **One module for both directions.** [WP74 S2](wp74-http-client-bodies.plan.md) (#2072) plans `std/net/multipart.ts` as a writer for the HTTP client. The reader goes in the same module and the same security record: whichever stage lands first creates the module, its `stdModuleNames` entry and `docs/security/multipart.md`, and the second extends them. Neither waits on the other.
- **Whole-body, sans-IO.** `HttpServerRequest.body` holds the whole body, so the reader works over a `u8[]` and answers spans into it, copying nothing. A streaming reader for bodies larger than memory is out of scope.
- **The media-type parser lives in `http-fields.ts`.** The 415 checks of `/deserialization` and `/upload` and the `boundary` parameter all need one, and the HTTP server is its natural home.
- **The framework is named `http-server`**, after the module the entry stands on, so the directory is `nish/http-server/`. Its `website` is the guide's HTTP server page.
- **The entry lives here first.** As with `bench/httparena/`, the source is kept and checked in this repository, and copied upstream. Our file-name lint refuses capitalised names, which matters only if the generator needs a hand-written Dockerfile (S2 finds out).

## WP90 S1 — a multipart/form-data reader in nish/net/multipart, with its security record

```ts
// std/net/http-fields.ts
export class MediaType { type: string; subtype: string; names: string[]; values: string[] }
export const mediaTypeParse = (value: u8[], from: i32, to: i32): MediaType | null
export const mediaTypeParam = (m: MediaType, name: string): string | null  // name compared case-insensitively

// std/net/multipart.ts
export class MultipartLimits { maxParts: i32 = 64; maxHeaderBytes: i32 = 8192; maxHeaders: i32 = 16 }
export class MultipartReader {
  constructor(body: readonly u8[], length: i32, boundary: string, limits: MultipartLimits)
  next(): i32                // MULTIPART_PART, MULTIPART_END, or a negative MULTIPART_ERR_* code
  name: string               // Content-Disposition name
  filename: string | null    // null when absent; "" when given empty
  contentType: string        // "text/plain" when absent (RFC 7578 §4.4)
  dataStart: i32             // the part's body is body[dataStart .. dataStart + dataLength)
  dataLength: i32
}
```

Rules, each with its own code and test:

- **Media type (RFC 9110 §8.3.1):** `type/subtype` tokens, then `; name=value` pairs with optional whitespace, the value a token or a quoted string (backslash escapes). Type, subtype and parameter names compare case-insensitively. A repeated parameter is refused.
- **Boundary (RFC 2046 §5.1.1):** 1 to 70 characters from the `bchars` set, not ending in a space; anything else is `MULTIPART_ERR_BOUNDARY`.
- **Framing:** a delimiter is CRLF `--boundary` (the first may open the body with no CRLF), followed by optional whitespace and CRLF; the close delimiter is `--boundary--`. The preamble and the epilogue are skipped. A body with no close delimiter is `MULTIPART_ERR_UNTERMINATED`.
- **Part headers:** field syntax checked with `httpFieldNameValid` and `httpFieldValueValid`. `Content-Disposition: form-data` with a `name` is required (`MULTIPART_ERR_DISPOSITION`); `filename` is read as given, and `filename*` is ignored (RFC 7578 §4.2). Past `maxHeaders` or `maxHeaderBytes` is `MULTIPART_ERR_HEADERS`, and past `maxParts` is `MULTIPART_ERR_PARTS`.
- **Nothing is written to disk.** Spans point into the caller's body, so no temporary file exists to remove.

Tests mirror [`tests/link/net_url_parse`](../../tests/link/net_url_parse/): `tests/link/net_media_type` (tokens, quoted strings, escapes, case, repeats, whitespace) and `tests/link/net_multipart_read`. The second covers each rule and code, each cap at its limit and one past, input split at a delimiter edge, a body holding every byte value and a boundary-like run inside data, and bodies built by Node's `FormData` through `new Request(...).arrayBuffer()`, read back field for field. Every new public declaration lands with its doc comment, `@param` and `@returns`.

Record (shared with WP74 S2, see Approach): the scope names `std/net/multipart.ts` and the `mediaTypeParse` lines of `http-fields.ts`. Its findings are delimiter confusion (a boundary inside a part's data), header smuggling through CR or LF in a part header, cap exhaustion, and quoted-string escapes. Each bound cites the `tests/link` case that fails without it. Add rows to [`docs/security/README.md`](../../docs/security/README.md), [`std/README.md`](../../std/README.md) and [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md), a "Reading a file upload" section on the guide's HTTP server page, and regenerate `docs/reference/`.

## WP90 S2 — bench/web-frameworks/, the scenario v2 entry on nish/net/http-server, checked by tests/link

First re-read the upstream files at `develop` and pin the commit. The facts in Context were read on 2026-11-26 and move. That includes how the generator picks a language's base image, which was not confirmed.

| File | Role |
| --- | --- |
| `bench/web-frameworks/nish/config.yaml` | `language.version` (the nish release), `files` (`"**/*.ts"`), `engines.default.command` (the built binary), `bootstrap` (apt-get LLVM 18 and clang, `install.sh` from the release tag, as [`nish.dockerfile`](../../bench/httparena/nish.dockerfile) does) |
| `bench/web-frameworks/nish/http-server/config.yaml` | `specs: v2`, `framework.website`, `framework.version`, `reviewers: [amritk]` |
| `bench/web-frameworks/nish/http-server/main.ts` | reads its port (3000), calls the server |
| `bench/web-frameworks/nish/http-server/server.ts` | the six routes, a `Router` and one prefork worker a pinned core, as [`bench/httparena/server.ts`](../../bench/httparena/server.ts) |
| `bench/web-frameworks/README.md` | the copy-in steps, the pinned upstream commit, the spec-suite command |

The server follows SCENARIO.md exactly: 200 on success and nothing else, `Content-Type: application/json` on JSON answers with only the listed fields, every body computed per request. Each 400 and 415 case has its own branch, so the check can name it. `/upload` answers `first_byte` and `last_byte` as `null` for an empty file, and the checksum is the SHA-256 hex of its bytes. The `/deserialization` integral test accepts `2` and `2.0` and refuses `2.5`, `"2"`, `true` and `null`, read through `JsonValue`'s number form, never by matching text.

`tests/link/web_frameworks_entry` builds `server.ts`, starts one worker and drives every case of the table in Context over keep-alive connections, with Content-Length and with chunked bodies, splitting requests across writes. It covers the fixtures' expected answers (checksum 4950, the upload's SHA-256) and every refusal SCENARIO.md lists. The upstream suite (`make -f nish/http-server/.Makefile test`) is the second check, run by hand in a checkout; the README records the commit it passed at.

`docs/BENCHMARKS.md` gets a row naming the entry and that it is not measured here, with no figures. Figures come from the board in S3.

## WP90 S3 — the upstream pull request to the-benchmarker/web-frameworks

**Decided (owner, 2026-11-26):** the owner opens the upstream PR from their own fork, and picks the time to submit it. Agent sessions here can write only to `amritk/nish`, and the board may still publish v1 results only (PR #10449), so no agent opens it or decides when. An agent's part of this stage is the first todo and the last one.

- **The PR kit (agent).** `bench/web-frameworks/README.md` gains a "Submitting upstream" section: the fork and copy steps, `bundle exec rake config`, the spec-suite command, and the PR title and body. The body says the framework's maintainer submits it, as CONTRIBUTING.md asks, and lists what the entry uses (`nish/net/http-server`, `nish/net/prefork`, `nish/net/multipart`).
- **The PR (owner).** The owner copies `bench/web-frameworks/nish/` into a fork, runs the steps, and opens the PR on `develop` when they choose.
- **The record (agent, after the merge).** `bench/web-frameworks/README.md` names the upstream PR and its merge commit. When the board publishes the entry, its figures go into `docs/BENCHMARKS.md` under the rules CLAUDE.md sets for that file (the commit, only the fields printed, maxima as maxima).

## Out of scope

- A streaming multipart reader for bodies larger than memory, and `multipart/mixed` or nested parts.
- Measuring the entry here: the board measures it, and no local figure is published.
- Scenario v1, TLS, HTTP/2, and any change to `nish/net/http-server` beyond what a route needs.
- The multipart writer (WP74 S2).

## Tests

- `tests/link/net_media_type`, `tests/link/net_multipart_read` (S1): mirror the existing `tests/link/net_*` cases, with an `expected.out` per case.
- `tests/link/web_frameworks_entry` (S2): mirror `tests/link/httparena_entry`, which builds a bench server and drives it from Node.

## Verification

```bash
node tests/run.js net_media_type
node tests/run.js net_multipart
node tests/run.js web_frameworks_entry
node scripts/security-scope.mjs
node scripts/gen-reference.mjs --check
npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
```

S1 changes `std/`, so it also regenerates `tests/self/goldens/checked/` (`node tests/self/goldens.js --update`) and greps `std/net/http-fields.ts:[0-9]` for pinned line numbers its additions move.

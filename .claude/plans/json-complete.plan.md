---
name: A complete std/json — writer, tokenizer, typed encode and decode (WP34 N11)
overview: Grow std/json from a one-field reader into what WP34 N11 and issue 484 ask for — a zero-allocation byte writer that matches JSON.stringify, a streaming validating tokenizer over u8[] proven against JSONTestSuite, and typed decoding and encoding of classes on top of both. Three stages, three PRs.
stages:
  - id: writer
    title: feat(std) — a JSON writer that writes into a byte buffer, in nish/json
    goal: JsonWriter writes any JSON value into a caller-owned u8[] with no per-call allocation, byte-identical to JSON.stringify, with misuse reported through a sticky error code
    verification: npm run check && npm run lint && node tests/run.js link && node tests/self/goldens.js && npm test (undegraded, skip count read)
    todos:
      - id: writer-issue
        content: Issue 571 is open as a sub-issue of 484; put Fixes 571 in the first push — see Writer
      - id: writer-class
        content: Add JsonWriter to std/json.ts with structure, value and raw methods and automatic commas and colons — see Writer API
      - id: writer-errors
        content: Implement the sticky error policy and its JSON_WRITE_ codes for every misuse and a full buffer — see Writer error policy
      - id: writer-numbers
        content: Write i32, u32 and i64 digits straight into the buffer, and f64 through the String(x) rule with NaN and Infinity as null — see Writer numbers
      - id: writer-string-helper
        content: Add jsonStringifyString and a writer-to-string convenience on top of the byte writer — see Writer API
      - id: writer-tests
        content: Add tests/link/std_json_writer with every value kind, nesting, escapes, f64 and i64 edges, every misuse, the hello bytes and an Arena.used() flatness check — see Tests
      - id: writer-node
        content: Check the ASCII, non-i64 half against JSON.stringify under Node through the prelude-run list in tests/run.js — see Tests
      - id: writer-portability
        content: Pin non-ASCII and non-UTF-8 strings in tests and record the byte-versus-code-unit reading under the WP33 rules — see Strings and portability
      - id: writer-bench
        content: Add a benchmark serializing the hello object N times with a varying input and a printed checksum, timed against a byte-identical copy for the noise band — see Measurement
      - id: writer-docs
        content: Update the std/json.ts header, std/README.md json.ts row, docs/wp34-hosting-cs.md N11 and a compiled docs/cookbook example — see Docs
      - id: writer-goldens
        content: Regenerate tests/self/goldens/checked.txt and checked-self.txt and read the diff — see Goldens and shared files
  - id: tokenizer
    title: feat(std) — a streaming JSON tokenizer over u8[], in nish/json-tokenizer
    goal: JsonTokenizer validates and tokenizes RFC 8259 JSON from a u8[] with caller-owned buffers, enforced depth and size limits, and JSONTestSuite's y_ and n_ verdicts
    verification: npm run check && npm run lint && node tests/run.js link && node tests/self/goldens.js && npm test (undegraded, skip count read)
    todos:
      - id: tokenizer-issue
        content: Issue 572 is open as a sub-issue of 484; put Fixes 572 in the first push — see Tokenizer
      - id: tokenizer-module
        content: Add std/json-tokenizer.ts with JsonTokenizer, its token kinds, and string and number decoding into caller-owned buffers — see Tokenizer API
      - id: tokenizer-limits
        content: Enforce depth, string length, number length and total size limits, and reject invalid UTF-8, lone surrogate escapes and trailing garbage — see Tokenizer limits
      - id: tokenizer-suite
        content: Vendor the JSONTestSuite test_parsing corpus with its MIT notice and check every y_ accepts and every n_ rejects, recording each i_ verdict — see Tokenizer conformance
      - id: tokenizer-fuzz
        content: Add a seeded mutation fuzz over the corpus that asserts no panic and a stable verdict — see Tokenizer conformance
      - id: tokenizer-node
        content: Compare token streams for the ASCII corpus against JSON.parse under Node — see Tests
      - id: tokenizer-security
        content: Write docs/security/json.md with depth bombs, huge numbers, invalid UTF-8 and duplicate keys, and list it in docs/security/README.md — see Tokenizer security record
      - id: tokenizer-alloc
        content: Prove Arena.used() stays flat while tokenizing a reused request body — see Tests
      - id: tokenizer-docs
        content: Add the std/README.md row and update wp34 N11 — see Docs
      - id: tokenizer-goldens
        content: Merge main after the writer lands, regenerate the checked goldens and read the diff — see Goldens and shared files
  - id: typed
    title: feat(std) — decode JSON into a class and encode it back, in nish/json
    goal: A class or interface with scalar, string, nested-class and array fields decodes from JSON through the tokenizer and encodes through the writer, refusing or ignoring unknown fields by option and honouring the tokenizer limits
    verification: npm run check && npm run lint && node tests/run.js link && node tests/self/goldens.js && npm test (undegraded, skip count read)
    todos:
      - id: typed-issue
        content: Issue 573 is open as a sub-issue of 484; put Fixes 573 and Fixes 484 in the first push — see Typed
      - id: typed-design
        content: Implement compiler-generated jsonDecode and jsonEncode for a class from its layout, design (b) chosen at sign-off — see Typed design
      - id: typed-tests
        content: Decode into a class with nested arrays and nested classes, round-trip it through the writer, and cover unknown, missing, duplicate and wrongly-typed fields — see Tests
      - id: typed-node
        content: Check decode and encode against JSON.parse and JSON.stringify under Node — see Tests
      - id: typed-docs
        content: Add the std/README.md rows, close N11 in docs/wp34-hosting-cs.md, a docs/cookbook example, and extend docs/security/json.md with the typed layer — see Docs
      - id: typed-goldens
        content: Merge main after the tokenizer lands, regenerate the checked goldens and read the diff — see Goldens and shared files
---

## Context

[`std/json.ts`](../../std/json.ts) is 737 lines and is only a reader: `jsonField` and `jsonFields` answer the text of one field of one flat object and do not validate. Issue #484 (WP34 N11, [`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) §8) asks for three more pieces: a tokenizer, a writer, and typed decoding. The first caller is a TechEmpower entry whose `/json` test writes `{"message":"Hello, World!"}` on every request inside an HTTP/1.1 loop that allocates nothing per request (N9). After that come cs's match report and `/matches`.

Facts the stages build on:
- **Strings are UTF-8 bytes.** `.length` counts bytes and `charCodeAt` returns a byte (LANGUAGE.md:75, :5200). Under Node they are UTF-16 code units. That is a class C divergence already recorded in [`docs/wp33-round-trip.md`](../../docs/wp33-round-trip.md) §3.2.
- **No API writes a string into a buffer.** The idiom is a guarded `charCodeAt` loop, as in `http1PutText` (`std/net/http1.ts:1376`). The guard lets the bounds proof remove the checks.
- **No f64 shortest-digits routine writes into a buffer.** Ryu lives in `runtime/runtime.c` as a static function. `${x}` allocates an arena string.
- **The i64 minimum has no literal** (NL2055). Write it as `lo << 10` (LANGUAGE.md:441).
- **std/ never uses `Result`.** It reports errors through negative i32 codes plus a sticky `failed` field (`HpackDecoder.failed`, `std/net/hpack.ts:36`).
- **std/ is not under the rolling freeze.** `build/nish-test` compiles it, never the seed.
- **std/json.ts is in `tests/self/goldens/checked.txt`** (through `docs/cookbook/json-fields.ts`), so every edit to it moves that golden.

## Approach

- **Three stages, three PRs.** The writer, the tokenizer and typed decoding each go in their own PR. The writer and the tokenizer have no dependency between them, so they are developed at the same time. Typed decoding consumes both APIs, so it starts after the tokenizer merges.
- **Module layout.** The writer goes into `std/json.ts` (`nish/json`), next to the reader, as the request specified. The tokenizer gets its own module, `std/json-tokenizer.ts` (`nish/json-tokenizer`), so the two concurrent stages own different source files. Typed decoding lives where the chosen design puts it.
- **One error policy for the whole family: sticky codes, not `Result`.** This matches hpack and qpack, and it keeps the hot path free of a Result's arena pointer. The first misuse sets `failed` to a negative `JSON_WRITE_*` / `JSON_TOK_*` code. Every later call is a no-op that returns the same code. The caller reads `failed` once at the end, and nothing ever panics.
- **The merge order is serialized: writer, then tokenizer, then typed.** Every std/ PR moves `checked.txt` and `checked-self.txt` without a textual conflict (CLAUDE.md, #549 after #547). So each later stage merges `main`, regenerates the goldens, and merges only once CI is green on that head.

## Writer

**Owns:** `std/json.ts`, `tests/link/std_json_writer/**`, `bench/json-writer/**`, `docs/cookbook/json-writer*.ts`, `std/README.md`, `docs/wp34-hosting-cs.md`, `docs/wp33-round-trip.md`, `tests/run.js`, `tests/self/goldens/checked*.txt`, `tests/differential/goldens*`

The first push carries `Fixes #571` and `Part of #484`.

### Writer API

```ts
export class JsonWriter {
  buf: u8[]; start: i32; end: i32; failed: i32       // end − start = bytes written
  constructor(buf: u8[], start: i32)
  reset(buf: u8[], start: i32): void                  // reuse across requests
  beginObject(): void; endObject(): void; beginArray(): void; endArray(): void
  key(name: string): void
  string(s: string): void; i32(v: i32): void; u32(v: u32): void; i64(v: i64): void
  f64(v: f64): void; boolean(v: boolean): void; null(): void
  raw(bytes: u8[], off: i32, len: i32): void          // already-encoded fragment, counts as one value
  written(): i32
}
export const jsonStringifyString = (s: string): string   // thin: a writer on a scratch buffer
```

- The method names are a starting point. If a method named `null`, `boolean` or `i32` clashes with a keyword or type name, rename it (for example to `nullValue` or `bool`) and say why in the commit body.
- State is a fixed-depth stack of container kinds plus "first element" bits. `JSON_WRITER_MAX_DEPTH` is a constant, and the stack is an inline `u8[]` field if LANGUAGE.md:3963 allows that. The writer inserts every `,` and `:` itself.
- Every new export and helper is `json`-prefixed. The module header stops saying only "a reader, not a parser" and describes the writer as well.
- `raw` validates nothing about the fragment and says so.

### Writer error policy

| misuse | code |
|---|---|
| a value where a key is due, or `key` outside an object or twice in a row | `JSON_WRITE_KEY_EXPECTED` / `JSON_WRITE_VALUE_EXPECTED` |
| `end*` with no matching `begin*`, or the wrong kind | `JSON_WRITE_UNBALANCED` |
| nesting past `JSON_WRITER_MAX_DEPTH` | `JSON_WRITE_TOO_DEEP` |
| a write that does not fit | `JSON_WRITE_FULL`; nothing past `buf.length` is touched |
| a second top-level value | `JSON_WRITE_DONE` |
| `raw` with a bad `off`/`len` window | `JSON_WRITE_BAD_WINDOW` |

- A full buffer never panics. The caller reads `failed` and decides whether to grow the buffer and retry or to send a 500.
- `complete()` (or similar) answers whether a whole value was written with every container closed.

### Writer numbers

- **Integers.** i32, u32 and i64 digits are written right to left into the buffer, with no allocation. The i64 minimum is handled without negating it.
- **f64.** The output matches `String(x)`, so `-0` writes `0`, as `JSON.stringify(-0)` does. NaN and ±Infinity write `null`.
- **f64 and allocation.** The digits come from `${v}` inside an `Arena.mark()`/`Arena.release(m)` pair, so `Arena.used()` stays flat. If that pattern turns out to be refused or unsound, document that the f64 path allocates and keep every other path allocation-free. The hello object has no f64.
- **Out of scope for f64.** Porting Ryu into Nish, or adding a runtime builtin, would be a `src/` change.

### Strings and portability

- **The escape rule.** It is `src/strings.ts` `jsonQuote`'s rule, re-implemented: the seven short escapes, `\u00xx` for bytes below 0x20, and everything else passed through byte for byte. The test pins `\u007f` passing through and `/` left unescaped.
- **Non-ASCII.** UTF-8 bytes pass through unchanged, so the output is the same UTF-8 that `JSON.stringify` produces once Node encodes it.
- **Non-UTF-8.** A string holding a lone 0xFF byte passes through raw. `JSON.stringify` cannot see that string at all, because Node has no such string.
- **Recording it.** Under the WP33 rules this is class C (§3.2 bytes vs code units). Record it in the std/json.ts header, and in the test as a pinned expected byte sequence.

## Tokenizer

**Owns:** `std/json-tokenizer.ts`, `tests/link/std_json_tokenizer/**`, `tests/json-suite/**`, `bench/json-tokenizer/**`, `docs/cookbook/json-tokenizer*.ts`, `docs/security/json.md`, `docs/security/README.md`, `THIRD_PARTY_NOTICES.md`, `std/README.md`, `docs/wp34-hosting-cs.md`, `tests/run.js`, `tests/self/goldens/checked*.txt`, `tests/differential/goldens*` — shared files merge after the writer

**Depends on:** writer (merge order only; developed concurrently)

The first push carries `Fixes #572` and `Part of #484`.

### Tokenizer API

```ts
export class JsonTokenizer {
  constructor(src: u8[], off: i32, len: i32, limits: JsonLimits)
  reset(src: u8[], off: i32, len: i32): void
  next(): i32            // JSON_TOK_* kind, JSON_TOK_END, or a negative error (sticky in failed)
  depth: i32; tokStart: i32; tokEnd: i32; failed: i32; errorAt: i32
  stringInto(out: u8[], off: i32): i32     // unescaped bytes of the current string token, -1 if out is short
  numberI64(): i64; numberF64(): f64; isInteger(): boolean
  keyEquals(name: string): boolean          // compares the current key without allocating
  skipValue(): i32
}
```

- The token kinds are object begin/end, array begin/end, key, string, number, true, false and null. Structure is validated in-line: a comma or colon in the wrong place, or trailing data, is an error.
- Strings are validated as UTF-8 (overlong encodings, surrogate code points and truncated sequences are rejected). `\uXXXX` escapes are decoded to UTF-8, and a lone surrogate escape is an error. This is the stricter reading; the security record says why.
- Number text is validated to the RFC 8259 grammar. `numberF64` parses it; a correctly rounded parse is needed for round-trip. If no in-Nish parse is exact, say so and pin the cases.

### Tokenizer limits

`JsonLimits` sets the maximum depth, maximum string bytes, maximum number digits and maximum total bytes. Exceeding any limit sets a distinct `JSON_TOK_*` error and never panics, and the defaults are documented. Duplicate keys are not the tokenizer's call: it reports them as tokens, and the typed layer decides.

### Tokenizer conformance

- **The corpus.** Vendor JSONTestSuite's `test_parsing/` (MIT) into `tests/json-suite/`, with the notice kept and listed in `THIRD_PARTY_NOTICES.md` ([`.claude/licensing.md`](../licensing.md)).
- **The check.** One check per file class: every `y_` accepts, every `n_` rejects, and each `i_` verdict is recorded in an expected file so a change shows up as a diff.
- **The fuzz.** A seeded PRNG mutates the corpus inputs (flip, insert, delete, truncate) for a fixed count. It asserts no panic, termination, and the same verdict on a re-run. The same seed is used every time, so the fuzz runs in `npm test`.

### Tokenizer security record

`docs/security/json.md` follows [`docs/security/README.md`](../../docs/security/README.md):
- state the base commit for its `file:line` anchors;
- cover depth bombs, huge numbers, long strings, invalid UTF-8, lone surrogates, duplicate keys and trailing garbage;
- list in Tests each `check(...)` string exactly, and grep each one against `tests/run.js` before pushing.

## Typed

**Owns:** `src/**`, `std/json*.ts`, `runtime/**`, `tests/cases/json_*`, `tests/link/std_json_typed/**`, `tests/ir/**`, `tests/wordings/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/AI.md`, `docs/cookbook/json-typed*.ts`, `docs/security/json.md`, `std/README.md`, `docs/wp34-hosting-cs.md`, `tests/run.js`, `tests/self/goldens/**`, `tests/differential/goldens*`

**Depends on:** tokenizer (starts after it merges)

The first push carries `Fixes #573` and `Fixes #484`.

### Typed design

**Decided at sign-off: (b), compiler-generated.** The two options were:
- **(a) A std-only schema API.** The caller writes a small per-class decoder against `JsonTokenizer`, with helpers such as `jsonReadObject`, `jsonExpectField` and `jsonReadArrayOf…`, and an encoder method on a `JsonEncodable` interface. `src/` does not change, and nothing is generated.
- **(b) Compiler-generated `jsonDecode<T>` / `jsonEncode<T>`.** The compiler generates them from the class layout. That makes it a new construct in `src/`, with everything CLAUDE.md asks of one: a golden `.ll`, an `llvm-as` pass, a native round trip, negative tests, a LANGUAGE.md rule and a cookbook entry, plus `wasi` and `performance` runs.

Both designs must do these things:
- refuse unknown fields, or ignore them when an option says so;
- reject duplicate keys;
- report a missing required field;
- honour `JsonLimits`;
- answer errors through the same sticky-code policy.

## Tests

| stage | test | what it pins |
|---|---|---|
| writer | `tests/link/std_json_writer/` (Suite) | every value kind; empty and nested `{}` and `[]`; all seven short escapes, a byte below 0x20 and 0x7f; f64 `-0`, `1e21`, `1e-7`, NaN, ±Infinity; i64 min and max; u32 max; every row of the error table; exact bytes of `{"message":"Hello, World!"}`; `Arena.used()` flat over 10,000 writes into a reused buffer, the `LbMeter` pattern (`tests/link/net_loopback/common.ts:32`) |
| writer | a Node prelude-run check in [`tests/run.js`](../../tests/run.js) | an ASCII-only, i64-free program prints the same lines under Node as native, where Node computes the expectation with `JSON.stringify` |
| tokenizer | `tests/link/std_json_tokenizer/` plus the corpus checks | every token kind, every limit, UTF-8 rejections, the `y_`/`n_`/`i_` verdicts, the fuzz, `Arena.used()` flat |
| tokenizer | Node | the token stream of every ASCII `y_` file matches a walk of `JSON.parse`'s value |
| typed | `tests/link/std_json_typed/` | decoding into a class with nested arrays and classes; a round trip through the writer; unknown, missing, duplicate and wrong-type fields; the limits |
| typed | Node | decoding then encoding equals `JSON.stringify(JSON.parse(x))` on the ASCII inputs |

A new positive `tests/cases/*` file, if any, is registered with `node tests/differential/goldens.js --update` in the same commit.

## Measurement

The writer stage adds a benchmark, `bench/json-writer/` or a `bench/run.mjs` entry. It serializes the hello object N times into a reused buffer. The message varies by iteration index, and every written byte is folded into a printed checksum.

The report gives:
- min and median ns/op over interleaved rounds;
- a noise band, measured as the same program timed against a byte-identical copy of itself in the same rounds;
- every delta read against that band.

The figures, copied from the benchmark's output on the head being merged, go into the commit's `Measured:` trailer. The tokenizer stage does the same for tokenizing a fixed body.

## Docs

- **The std/json.ts header** describes the reader and the writer. The tokenizer module gets a header of its own.
- **[`std/README.md`](../../std/README.md)** has a row per module.
- **[`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) §8 N11** records each stage as it lands: the writer is built and the tokenizer still open, then the tokenizer, then N11 closed.
- **Compiled examples.** Each stage adds a `docs/cookbook/json-*.ts` example (the cookbook is in the self-corpus and compiled by `npm test`). A `docs/AI.md` block is added only where it compiles single-file under `-o dir/`.

## Goldens and shared files

These shared files are touched by more than one stage. The serialized merge order makes that safe:
- `tests/run.js` (registration lines only);
- `std/README.md`;
- `docs/wp34-hosting-cs.md`;
- `THIRD_PARTY_NOTICES.md` (tokenizer only);
- `tests/self/goldens/checked.txt` and `checked-self.txt`.

The goldens are regenerated only with `node tests/self/goldens.js --update` (plus `--seed build/seed/bin/nish` if `build/nish` is missing), never edited or merged by hand. Each stage merges `main` after its predecessor lands and regenerates them, even when there is no textual conflict.

## Out of scope

- No change to `src/` in the writer or tokenizer stages. The typed stage changes `src/` (design (b), chosen at sign-off) and follows the rolling freeze: `src/` implements the construct but does not use it in its own source.
- No f64 shortest-digits builtin, and no in-Nish Ryu.
- A JSON Schema validator.
- Streaming output, a writer that flushes partial buffers to a socket.
- Pretty-printing or indentation.

## Verification

Each stage runs these before its PR goes up. Read each command's exit status, never a piped tail:
- `bash scripts/fetch-seed.sh --force`, then `npm run build`;
- `npm run check`;
- `npm run lint`;
- `node tests/self/goldens.js`;
- `npm test`, undegraded, with the skip count read.

The typed stage, design (b), also runs `node tests/run.js wasi` (with `WASI_SYSROOT`) and `node tests/run.js performance`.

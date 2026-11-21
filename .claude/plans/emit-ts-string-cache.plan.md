---
name: emit-ts string reads without re-encoding
overview: Under --emit-ts, every byte read of a string goes through runtime/core/strings.mjs's bytesOf, which caches only the last string it UTF-8-encoded. A std loop that alternates two strings (indexOfAnyFrom's text and needle set, yamlByte's strLen beside a word compare) evicts the document on every call and re-encodes all of it per byte, so a 108 KB YAML load takes 11.8 s under Node 22 where wasm takes 2.5 ms. Fix it in the runtime with a multi-entry cache and an ASCII fast path, pin it with a check that counts encodes, and measure YAML and JSON at 100 KB and 3 MB.
priority: 80
labels: [ready]
stages:
  - id: string-cache
    title: "perf(runtime): read emit-ts strings without re-encoding them per byte"
    goal: An --emit-ts program's charCodeAt, length, substring, slice, indexOf, startsWith and endsWith encode each string at most once while it stays in use, even when a loop alternates between several strings, and read an ASCII string directly with no encode at all; a tests/run.js check fails if per-call re-encoding comes back, and a bench script reports emit-ts against wasm (and native) for YAML and JSON at about 100 KB and 3 MB.
    verification: node tests/run.js emit-ts && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node bench/emit-ts-strings/run.mjs
    status: pending
    todos:
      - id: baseline
        content: Before changing the runtime, write bench/emit-ts-strings/run.mjs (YAML parseYaml + YamlJsonLoader, JSON parse, each at ~100 KB and ~3 MB, emit-ts under node vs wasm vs native) and record the 0.44.0 numbers — see Stage S1
        status: pending
      - id: cache
        content: Replace bytesOf's single slot in runtime/core/strings.mjs with a small recency-ordered multi-entry cache and an ASCII fast path for charCodeAt and strLen (and the other readers where it applies) — see Stage S1
        status: pending
      - id: regression
        content: Add tests/run.js checks that count TextEncoder.encode calls — one at the strings.mjs level for an alternating two-string loop, one end to end on an emit-ts YAML load — and show each fails against the old bytesOf — see Stage S1
        status: pending
      - id: audit
        content: Audit std's two-string per-byte loops (list in Stage S1), confirm each is covered by the new cache, and list them with their verdicts in the PR body; std/ itself is not edited — see Stage S1
        status: pending
      - id: numbers
        content: Re-run the bench after the change and put the before/after table (YAML and JSON, ~100 KB and ~3 MB, emit-ts / wasm / native, median and noise band, the commit) in the PR body — see Stage S1
        status: pending
      - id: squeeze
        content: Once the target is met, run extra profile-guided performance passes on the emit-ts YAML and JSON workloads inside the stage's Owns, keep each change that beats the noise band with output unchanged, and record every pass (kept or dropped) in the PR body — see Stage S1
        status: pending
---

## Context

`--emit-ts` rewrites `s.length` to `strLen(s)` and `s.charCodeAt(i)`,
`s.indexOf`, `s.slice`, `s.substring` to helpers in
[`runtime/core/strings.mjs`](../../runtime/core/strings.mjs), re-exported by
`runtime/core.mjs:57` and imported by every emitted program as `nish/runtime`
([`src/emit-ts-strings.ts`](../../src/emit-ts-strings.ts)). A Nish string is its
UTF-8 bytes, so each helper first calls `bytesOf(s)`, which keeps only the
**last** string it encoded.

Reported against 0.44.0 under Node 22: a program running `parseYaml` +
`YamlJsonLoader` over a 108 KB YAML file takes 11.8 s per call under emit-ts,
about 2 ms native and 2.5 ms on wasm. A CPU profile puts 95% in
`TextEncoder.encode`, through `bytesOf` ← `charCodeAt` ← `indexOfAnyFrom`
(`std/text.ts` ~680) ← `indexOfAny`, plus `strLen` ← `yamlByte`
(`std/yaml.ts` ~1092). `indexOfAnyFrom` alternates `text.charCodeAt(i)` with
`bytes.charCodeAt(j)`, so every call evicts the other string and the document
is re-encoded once per byte. JSON shows the same thing more mildly: emit-ts is
about 10x slower than wasm on a 3 MB document.

Two-string per-byte loops in `std/` found by a first pass (to be confirmed by
the audit todo; line numbers approximate):

| site | strings |
| --- | --- |
| `indexOfAnyFrom`, `std/text.ts:687` | `text`, the needle set `bytes` |
| `yamlByte`/`yamlIsWord`, `std/yaml.ts:1090-1116` | `text` (and `strLen(text)` per byte), `word` |
| `JsonTokenizer.literal`, `std/json-tokenizer.ts:911` | `this.src`, `"true"`/`"false"`/`"null"` |
| key compare, `std/json-tokenizer.ts:1289-1313` | `src`, `name` |
| `jsonNameHas`, `std/json.ts:522` callers | `name`, `text` |
| token compare, `std/net/http1-codec.ts:954` | `text`, `word` |
| header compare, `std/net/fetch.ts:1528` | `name`, `lower` |
| literal-prefix match, `std/regex.ts:3312`, `3340` | `text`, `this.prefix` |
| Levenshtein, `std/cli-args.ts:116` | `a`, `b` |
| version compare, `std/release.ts:230` | `a`, `b` |

## Approach

- **The fix lives in the runtime, not in the std loops.** Every emitted program
  imports the one `strings.mjs`; a cache there fixes every loop above and any
  later one, with no change to `std/` (and so no goldens, nish-cmp `DECLARED`
  entries or `std/*.ts:LINE:COL` pins move). If the audit finds a loop the cache
  cannot cover (more live strings than slots, or a fresh string built per byte),
  it is listed in the PR body as a follow-up with its measured cost. It is not
  fixed in this stage.
- **Measure first.** The bench script and its 0.44.0 numbers come before the
  runtime edit, so the "before" column is a recorded run and not a recollection.

## Stage S1 — read emit-ts strings without re-encoding them per byte

**Owns:** `runtime/core/strings.mjs`, `runtime/core/checks.mjs`,
`tests/run.js`, `tests/emit-ts/**`, `bench/emit-ts-strings/**`,
`docs/guide/using-nish/to-typescript.md`, `docs/RUN_UNDER_NODE.md`,
`tests/nish-cmp.js`, `runtime/core/arrays.mjs`, `runtime/core/arrays.d.ts`,
`runtime/core/numbers.mjs`, `runtime/core/numbers.d.ts`, `bench/README.md`

Amended 2026-11-21 (amend-respawn): `tests/nish-cmp.js` because the new
`bench/emit-ts-strings/main.ts` joins the nish-cmp corpus and differs from the
0.44.0 reference by src/std changes already declared for other programs, so it
needs its own narrow `DECLARED` entries; `runtime/core/arrays.mjs` and
`numbers.mjs` (and their `.d.ts`) because the squeeze profile names `newArray`
and `toI32`/`convertOther` as the top remaining runtime costs; `bench/README.md`
to list the new bench.

### Runtime

- Replace the single `lastString`/`lastBytes` slot with a small cache (start at
  4 to 8 entries) keyed by the string, **recency-ordered**: a hit moves to the
  front, a miss evicts the least recently used. Round-robin or FIFO
  replacement is not enough. A loop that touches the document between fresh
  substrings must keep the document resident however many short strings pass
  through.
- **ASCII fast path.** When a string is all ASCII, its UTF-8 bytes are its
  UTF-16 code units. Record that in the entry instead of encoding: `charCodeAt`
  reads `s.charCodeAt(k)` with the same bounds check and panic, and `strLen`
  answers `s.length`. Decide by measurement whether the ASCII test (a regex or
  a scan) is cached in the same entry, and whether strings under some short
  length skip the cache entirely. The other readers (`substring`, `slice`,
  `indexOf`, `startsWith`, `endsWith`) may keep using bytes. If an ASCII path
  for them is cheap and measurable, take it.
- Keep behaviour byte-identical: the same panics with the same values, lone
  surrogates encoded as `TextEncoder` encodes them (U+FFFD, three bytes), and
  `substring`'s clamp-and-swap. Note in the code why the cache is multi-entry
  (the alternating-loop case) so the next reader does not shrink it back.
- Equal-content distinct strings: a lookup compares with `===`. Keep the
  lookup's cost bounded and say how in a comment.
- Behaviour is internal. No `docs/LANGUAGE.md` change. Update
  `docs/guide/using-nish/to-typescript.md` or `docs/RUN_UNDER_NODE.md` only if
  either says something about string cost under emit-ts that is now wrong.

### Regression checks (`tests/run.js`, emit-ts section)

- **Unit, deterministic.** In a child `node` process, wrap
  `TextEncoder.prototype.encode` with a counter *before* importing
  `runtime/core/strings.mjs` (its encoder is built at module load). Then run a
  loop that alternates `charCodeAt` over a large non-ASCII string (≥ 100 KB, so
  the ASCII path does not hide the cache) with a short needle, plus `strLen` on
  the large one. Assert the encode count stays at a small constant, not
  proportional to the iterations. Prove by exit status of the child, per
  `.claude/testing.md` → "Checks that spawn a process".
- **End to end.** Compile a YAML program (parseYaml + YamlJsonLoader) with
  `--emit-ts`, run it under node with the same counter preloaded, over a
  generated document of about 100 KB, and assert encodes per document byte stay
  far below one. Make one input non-ASCII, so the cache and not only the ASCII
  path is under test. A generous wall-clock budget may sit beside it (say 10 s
  for what should take well under 1 s), never in place of the counter.
- Show, in the PR body, each check failing against the 0.44.0 `bytesOf`
  (revert the runtime locally and run it) and passing after.

### Bench (`bench/emit-ts-strings/run.mjs`)

- Hand-run, never part of `npm test`, in the style of `bench/yaml-json/run.mjs`
  (reuse its generated OpenAPI document and `bench/compiler.mjs`). Workloads:
  - YAML: `parseYaml` + `YamlJsonLoader` over generated documents of about
    100 KB and 3 MB.
  - JSON: the std JSON parse (`JsonDocument` or the tokenizer path the
    reporter would use), over documents of about 100 KB and 3 MB.
- For each workload, run the same program three ways: `--emit-ts` under node,
  wasm (wasm32-wasi under node's WASI or the repo's wasi host, with
  `WASI_SYSROOT=/usr` here), and native. Time the loop inside the program with
  a monotonic clock. Use interleaved rounds and report median and noise band
  (`.claude/testing.md` → "A `Measured:` trailer").
- The 108 KB YAML case must come in within about 5x of wasm under Node 22 (the
  container's node). If it does not, profile again (`node --cpu-prof`) and
  record what remains in the PR body.
- The PR body carries the before/after table: YAML and JSON × 100 KB and 3 MB ×
  emit-ts / wasm / native, before (0.44.0 runtime) and after, with the commit
  and the node version. Nothing goes into `docs/BENCHMARKS.md` in this stage.

### Squeeze passes (last)

Asked for by the requester: after the 5x target is met and the numbers are
recorded, do extra performance passes to take as much as the runtime allows.

- Each pass follows `/perf` if the session has it (otherwise its rules by hand):
  profile the emit-ts YAML and JSON workloads (`node --cpu-prof`), pick the top
  remaining runtime cost in `runtime/core/strings.mjs` (or another
  `runtime/core/*.mjs` helper the profile names, which then needs an `Owns`
  amendment from the lead, asked for in the PR body rather than taken), change
  one thing, and re-measure against an interleaved baseline.
- Candidates: the cache's hit path (slot order, the `===` check, avoiding
  array shuffles on a front hit), the ASCII test's cost and when it runs,
  `indexOf`/`startsWith`/`endsWith` encoding their needle on every call, and
  `substring`/`slice` on ASCII strings returning `s.substring` directly.
- Keep a change only if it beats the noise band and every check still passes.
  Drop it otherwise. Stop after three passes in a row that keep nothing, or
  when the profile shows the remaining time outside the runtime (in std's own
  logic, which is a follow-up).
- The PR body lists each pass: what changed, the figure before and after, and
  kept or dropped. The final before/after table is taken after the last pass.

### Audit

- For each site in the Context table (and any the audit adds), name the strings
  it alternates, confirm the new cache holds them all (count the live strings
  per iteration against the slot count), and give a one-line verdict in the PR
  body. A site that needs a `std/` change is a follow-up, not part of this PR.

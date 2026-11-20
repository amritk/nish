---
name: WP68 — shared libraries, layered like atomic design
overview: The survey of duplicated helpers and the tier rule are written (S1). Eight stages remain, one per cluster of duplicated helper, each shared copy benched against the fastest existing copy and every former caller proven to answer the same.
roadmap: docs/roadmap/wp68-shared-libraries.md
spec: docs/wp68-shared-libraries.md
priority: 60
issue: 1868
stages:
  - id: s2-hex-atom
    title: WP68 S2 — the hex atom, the tier directories, the biome rule and its fixture
    goal: A hex atom from a 256-entry table exists under std/atoms/, std/molecules/ exists, biome.json enforces the tier import rule with a fixture that breaks it, and every former hex caller gives the same answers.
    verification: node tests/run.js std && node tests/run.js link && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1879
    todos:
      - id: s2-decide
        content: Record the owner's answers to D1 directory and names, D2 public or internal, D3 whether src imports the tiers and D5 enforcement in docs/wp68-shared-libraries.md section 9 — see WP68 S2 — the hex atom and the tier rule
        status: pending
      - id: s2-atom
        content: Add the table hex atom in std/atoms/ and move manifestHexDigit, http1HexValue, urlHexValue and jsonTokHexDigit onto it where D4 allows — see WP68 S2 — the hex atom and the tier rule
        status: pending
      - id: s2-biome
        content: Add noRestrictedImports overrides to biome.json for the tiers and a fixture under tests that fails the rule — see WP68 S2 — the hex atom and the tier rule
        status: pending
      - id: s2-bench
        content: Add a chunked-body and percent-escape case to bench/http1-parse so the http1 and url hex callers are gated, and record the Measured trailer — see WP68 S2 — the hex atom and the tier rule
        status: pending
  - id: s3-decimal
    title: WP68 S3 — the decimal writer, two digits a step
    goal: One decimal writer that is 4 percent or more ahead of http1PutDecimal on non-negative values replaces the copies, with the integer 1 to 20 digit count benched first and signed values left on jsonWriterPutDigits64.
    verification: node tests/run.js std && node tests/run.js performance && npm run lint
    status: pending
    todos:
      - id: s3-bench-count
        content: Bench the integer<1, 20> digit count before adopting it and record the result in docs/wp68-shared-libraries.md — see WP68 S3 — the decimal writer
        status: pending
      - id: s3-writer
        content: Add the pairs decimal writer and move http1PutDecimal, pgPutDecimal and the JSON writer's non-negative path onto it — see WP68 S3 — the decimal writer
        status: pending
  - id: s4-be-load
    title: WP68 S4 — the big-endian load atom in the shift form
    goal: One shift-form big-endian load replaces the copies, getI32BE's postgres callers are timed against it, and every crypto caller's input is recorded as secret or public with a ct-asm spec where a load moves.
    verification: node tests/run.js ct_asm && node tests/run.js std && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s4-decide
        content: Record the owner's answer to D6, which crypto callers keep their constant-time copies, in docs/wp68-shared-libraries.md section 9 — see WP68 S4 — the big-endian load atom
        status: pending
      - id: s4-bench
        content: Time getI32BE's callers in bench/pg-decode rows against the shift form before deciding what it is worth — see WP68 S4 — the big-endian load atom
        status: pending
      - id: s4-atom
        content: Add the shift-form load atom, move sha1LoadWord and the other copies onto it, and add the crypto records and ct-asm specs for each moved load — see WP68 S4 — the big-endian load atom
        status: pending
  - id: s5-json-escape
    title: WP68 S5 — the JSON escape molecule
    goal: One escape molecule built from skipJsonPlain and copyBytes serves the JSON writer, with the density switch and runs for string input benched first and no gain claimed unless measured.
    verification: node tests/run.js json && node tests/run.js performance && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s5-decide
        content: Record the owner's answer to D4, how divergent copies are unified, in docs/wp68-shared-libraries.md section 9 — see WP68 S5 — the JSON escape molecule
        status: pending
      - id: s5-bench
        content: Bench a density switch and jsonWriterPutRuns for jsonWriterPutString over a string in bench/json-writer — see WP68 S5 — the JSON escape molecule
        status: pending
      - id: s5-molecule
        content: Add the molecule in std/molecules/ and move jsonWriterPutBytes and jsonWriterPutString onto it, checking bench/json-writer and bench/http1-request JSON cases — see WP68 S5 — the JSON escape molecule
        status: pending
  - id: s6-utf8
    title: WP68 S6 — the UTF-8 molecule
    goal: One RFC 3629 validator from the tokenizer's kernel path (skipJsonText then jsonTokUtf8Length) replaces the copies, with its candidates benched first and the corner tests run against every former caller.
    verification: node tests/run.js json && node tests/run.js std && node tests/run.js performance && npm run lint
    status: pending
    todos:
      - id: s6-bench-inputs
        content: Add a non-ASCII body to bench/json-tokenizer and non-ASCII claims to bench/jwt-verify so S6 is gated on the code it moves — see WP68 S6 — the UTF-8 molecule
        status: pending
      - id: s6-molecule
        content: Add the UTF-8 molecule after S5 (both edit std/json.ts and std/json-tokenizer.ts) and run the corner tests against each former caller — see WP68 S6 — the UTF-8 molecule
        status: pending
  - id: s7-digit
    title: WP68 S7 — the digit predicate
    goal: One digit predicate replaces the copies with no gain claimed and none lost on bench/json-tokenizer and bench/lexer.ts.
    verification: node tests/run.js std && node tests/run.js performance && npm run lint
    status: pending
    todos:
      - id: s7-atom
        content: Add the digit atom and move jsonTokIsDigit and src/lexer.ts isDigit onto it, respecting the seed freeze for src — see WP68 S7 — the digit predicate
        status: pending
  - id: s8-grow
    title: WP68 S8 — the byte-buffer grow
    goal: One byte-buffer grow replaces the copies with each copy's growth policy kept or named, and benches that actually grow a buffer exist for the modules that had none.
    verification: node tests/run.js std && node tests/run.js performance && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s8-decide
        content: Record the owner's answer to D4 for which growth policy the shared copy keeps in docs/wp68-shared-libraries.md section 9 — see WP68 S8 — the byte-buffer grow
        status: pending
      - id: s8-bench-inputs
        content: Add growing inputs for handler.ts, serve.ts, websocket.ts, quic-packet.ts and http1-client-codec.ts before gating them — see WP68 S8 — the byte-buffer grow
        status: pending
      - id: s8-atom
        content: Add the shared grow and move http1Reserve and the other copies onto it, naming each retained policy difference — see WP68 S8 — the byte-buffer grow
        status: pending
  - id: s9-fnv
    title: WP68 S9 — the FNV-1a step
    goal: One FNV-1a step replaces the copies with no gain claimed and none lost on bench/router.ts, and a bench for src/map.ts fnv1a exists before it is gated.
    verification: node tests/run.js std && node tests/run.js performance && npm run lint
    status: pending
    todos:
      - id: s9-atom
        content: Add the FNV-1a atom and move routerHashWith and src/map.ts fnv1a onto it, adding a bench for fnv1a first — see WP68 S9 — the FNV-1a step
        status: pending
---

# WP68 — shared libraries, layered like atomic design

## Context
S1 landed: the survey of duplicated helpers, the benches that time each cluster's copies, the tiers (atoms, molecules, organisms, pages) and their import rule — see [the roadmap page](../../docs/roadmap/wp68-shared-libraries.md) (1 of 9 done). Design note: [docs/wp68-shared-libraries.md](../../docs/wp68-shared-libraries.md), whose [section 11](../../docs/wp68-shared-libraries.md#11-stages) gives each stage's baseline, measured gain and non-regression benches. Every stage ends with a `Measured:` trailer. No GitHub issue is assigned to this plan. The owner's decisions D1 to D6 (section 9) all carry a recommendation in the note.

## WP68 S2 — the hex atom and the tier rule
Gain measured in the note: 4.8 to 4.9x over `lower` on mixed bytes, 5.6 to 5.7x over `manifestHexDigit` on random hex, none established on digits alone; 1.5x over `lower` behind a range guard on `i32` code units (`bench/wp68-hex.ts`). Depends on D1, D2, D5 (and D3 for `src/`). Every other stage depends on this one.

### Decision needed
D1: `std/atoms/` and `std/molecules/` (recommended) or one `std/internal/` with the tier in the file name. D2: tag atoms `@internal` (recommended). D3: `src/` imports the tiers directly, under the freeze (recommended). D5: biome `noRestrictedImports` (recommended) with atoms importing nothing and molecules importing atoms only.

## WP68 S3 — the decimal writer
4 percent over `http1PutDecimal` on non-negative values of 1 to 10 digits, 5 percent on three-digit status codes; on signed values `jsonWriterPutDigits64` is the baseline and is not beaten. Depends on S2. Gates: `bench/http1-request`, `bench/pg-decode` params.

## WP68 S4 — the big-endian load atom
No gain over `shifts` is established; the shift form is 1.5x `getU32BE` in the micro-bench. `bench/pg-decode` rows decides what it is worth. Depends on S2 and D6.

### Decision needed
D6: a table lookup indexed by a secret byte is a cache-timing channel, so constant-time crypto keeps its arithmetic copies; a stage that moves a load adds a `ct-asm` spec. Recommended: as stated, recording each crypto caller's input as secret or public. See `docs/security/ct-verification.md`.

## WP68 S5 — the JSON escape molecule
No gain claimed: `jsonWriterPutBytes` already takes runs from 16 bytes. Depends on S2 and D4.

### Decision needed
D4: unify a divergent copy only where every caller is shown to answer the same, otherwise keep a second named atom (recommended). Never widen a lenient copy silently.

## WP68 S6 — the UTF-8 molecule
`wordSkip` is slower on both inputs; the table walk is not measured. Depends on S2 and S5.

## WP68 S7 — the digit predicate
One shape in every copy; consolidated with no gain claimed. Depends on S2.

## WP68 S8 — the byte-buffer grow
The copies differ in policy; which one the shared copy keeps is a D4 question. Depends on S2.

### Decision needed
D4 as above, applied to growth policy: keep each copy's policy as a named variant, or unify where callers are shown to answer the same.

## WP68 S9 — the FNV-1a step
One loop in every copy. `bench/map-vs-stringmap.ts` times a private copy, so a bench for `src/map.ts` `fnv1a` is added first. Depends on S2.

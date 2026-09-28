---
name: WP33 R1 (second half) — the portability diagnostic class
overview: A new NL8xxx warning band, off by default and turned on with --warn-portability, that marks each class-C site of docs/wp33-round-trip.md §3 where a Nish program and its TypeScript reading quietly give different answers. One stage adds the class and registers every code. Three more stages, which run in parallel, add the rows.
stages:
  - id: portability-class
    title: "feat(checker): the portability diagnostic class, NL8xxx, behind --warn-portability"
    goal: The class exists end to end (flag, sink, human and --json forms, band 8 in the registry, the case-golden format, docs), all eleven codes are registered, and one row (NL8005) is live to prove the path.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js port_ && node tests/diagnostic-coverage.js --require-coverage && node scripts/gen-diagnostic-codes.mjs --check && node docs/check-links.mjs
    todos:
      - id: pc-sink
        content: Add the portability kind to src/diagnostics.ts (Diagnostic.json severity portability, the human summary, a reportPortability sink list kept apart from items and from the performance list) — see Stage 1 → Sink and output
      - id: pc-flag
        content: Add --warn-portability to src/compile.ts (usage, help, nish run) and print the list only for a clean compile, independently of --no-warn-performance — see Stage 1 → The flag
      - id: pc-pass
        content: Add src/portability.ts, the post-check pass that runs only under the flag, plus the three row modules as empty stubs with the signature the row stages fill — see Stage 1 → The pass
      - id: pc-codes
        content: Register the portabilityRules table NL8001–NL8011 in src/codes.ts with the fragments in Codes, and teach scripts/gen-diagnostic-codes.mjs band 8 and its gap-free rule — see Stage 1 → Codes
      - id: pc-row-zero-fill
        content: Implement NL8005 (new Array of T with length n is zero-filled) in src/portability.ts with port_array_* cases and a quiet case — see Stage 1 → The first row
      - id: pc-harness
        content: Add the .portability case golden to tests/run.js and teach tests/diagnostic-coverage.js to compile port_* cases with the flag, with unreachable.txt blocks for the codes not yet live — see Stage 1 → Tests
      - id: pc-docs
        content: Document the class, the flag and all eleven rows in docs/LANGUAGE.md, docs/AI.md, AGENTS.md, README.md, docs/wp10-ci.md, .claude/testing.md, and mark R1's second half in docs/wp33-round-trip.md — see Stage 1 → Docs
  - id: portability-numbers
    title: "feat(checker): portability warnings for integer and libm divergences"
    goal: NL8006–NL8011 fire at every site the row describes and nowhere else.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js port_num_ && node tests/diagnostic-coverage.js --require-coverage
    todos:
      - id: pn-division
        content: Flag i32 and fixed-width integer division (NL8006) in src/portability-numbers.ts — see Stage 2
      - id: pn-wrap
        content: Flag wrapping arithmetic (NL8007) on u8/u16/u32, and on i32 only under --wrapping — see Stage 2
      - id: pn-shift
        content: Flag the i32 unsigned shift (NL8008) and 64-bit integer declarations (NL8009) — see Stage 2
      - id: pn-libm
        content: Flag Math.min/max/round on f64 (NL8010) and console.log of an f64 (NL8011) — see Stage 2
      - id: pn-tests
        content: Add port_num_* warning and quiet cases and tests/wordings/nl8006..nl8011 pins, and remove the Stage 2 block from unreachable.txt — see Stage 2
  - id: portability-strings
    title: "feat(checker): portability warnings where UTF-8 string offsets meet an outside fact"
    goal: NL8001 and NL8002 fire where a byte offset or a slice bound decides something the TypeScript reading would decide differently, and stay quiet where offsets only flow between string methods.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js port_str_ && node tests/diagnostic-coverage.js --require-coverage
    todos:
      - id: ps-offsets
        content: Flag a UTF-8 offset or code unit that meets an outside fact (NL8001) in src/portability-strings.ts — see Stage 3
      - id: ps-slice
        content: Flag slice whose bounds are not proven inside the receiver (NL8002), reusing the proof behind the substring clamp — see Stage 3
      - id: ps-tests
        content: Add port_str_* warning and quiet cases and nl8001/nl8002 wording pins, and remove the Stage 3 block from unreachable.txt — see Stage 3
  - id: portability-records
    title: "feat(checker): portability warnings for record copies into arrays and stores over a live element"
    goal: NL8003 and NL8004 fire where the contiguous record layout is observable, which is a later write to or read of the other copy, and stay quiet where it is not.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js port_rec_ && node tests/diagnostic-coverage.js --require-coverage
    todos:
      - id: pr-copy-in
        content: Flag a record copied into an array while the original is written or read afterwards (NL8003) in src/portability-records.ts — see Stage 4
      - id: pr-slot-store
        content: Flag a store into an array slot that a live element reference still reads (NL8004), reusing the element-reference tracking behind reject_arr_element_across_push — see Stage 4
      - id: pr-tests
        content: Add port_rec_* warning and quiet cases and nl8003/nl8004 wording pins, and remove the Stage 4 block from unreachable.txt — see Stage 4
---

## Context

[docs/wp33-round-trip.md](../../docs/wp33-round-trip.md) §5.2 decides a `portability` diagnostic class: a warning at every class-C site (§3), in a new band, off by default. It is the map both directions of WP33 need. On the way in it marks where "the TypeScript tests still pass" stops being evidence. On the way out it lists where `--emit ts` will put a helper. §9 stages it as R1 with the parser work (§5.0). This plan is **R1's second half only**, the class and its rows. The parser is not part of it.

`--compat` (wp28) and `--emit ts` (R4) do not exist yet. So "on under `--compat` and `--emit ts`" becomes an explicit flag now, and those two modes turn it on when they land.

The template is the WP15 §8 `performance` class, which already has the shape this needs. It has a separate sink list ([src/diagnostics.ts](../../src/diagnostics.ts) `warnings`), a severity of its own in `--json`, a registry table `performanceRules` in [src/codes.ts](../../src/codes.ts), a driver print step `reportPerformance` in [src/compile.ts](../../src/compile.ts), and a whole-program post-check hook `reportArenaLoops` in [src/compilation.ts](../../src/compilation.ts).

## Approach

- **Opt-in, never a cost.** The pass runs only under `--warn-portability`. Without the flag the compiler does no extra work, and the output is byte-identical to today with or without it: warnings never reach the IR (§1 rule 6). No `.ll` golden moves and `bench/instructions.json` is not raised. Each PR times `scripts/bootstrap.sh --verify` before and after, and states the number (§9).
- **A flagged site is a silent divergence.** It is a site where the program run as TypeScript, with `runtime/nish.mjs`, compiles, runs, and answers differently with no error. The structural C rows are **not** flagged in R1: `orReturn`, `Ok`/`Err`, ambient host globals, `nish:` specifiers, `export const main`, `enum`. Under plain TypeScript they fail loudly, so the tests do notice them, and `--emit ts` rewrites them regardless. `Float64Array.push` is not flagged either, because R2 closes that row. `toI32` is not flagged, because the prelude's helper already means what native means.
- **Severity `portability`**, and not `warning`, is the mirror of `performance`. `--json` carries `"severity":"portability"`, and the human line is `file:line:col: portability: <text>` with the usual excerpt. Warnings print only for a compilation that checked cleanly, and never change the exit code.
- **Every code registered at once, by Stage 1.** Three stages add rows in parallel. If each appended to `src/codes.ts`, they would collide on the next free number and on the longest-first order. So Stage 1 owns the whole table, with the fragments fixed below, and the row stages must emit messages that contain those fragments verbatim. A code that is not live yet sits in [tests/wordings/unreachable.txt](../../tests/wordings/unreachable.txt) in a block for its stage, and the stage that makes it live deletes its own block. The blocks are separated by comment lines so that deletions from parallel stages merge cleanly.
- **The docs are written once, in Stage 1**, for all eleven rows. In the interim, `unreachable.txt` is the honest record of which rows are live. Acceptance criterion 2 checks that every documented code fires.

## Codes

Band `NL8xxx`, gap-free from NL8001. The message may add names and context around the fragment. The fragment itself is fixed.

| Code | Row (wp33 §) | Stage | Fragment (literal, matched as a substring) | Example message |
| --- | --- | --- | --- | --- |
| NL8001 | UTF-8 offsets (3.2) | 3 | `counts UTF-8 bytes here, and UTF-16 units in TypeScript` | `` `name.length` counts UTF-8 bytes here, and UTF-16 units in TypeScript `` |
| NL8002 | checked `slice` (3.2) | 3 | `panics here outside its receiver's bounds, where TypeScript clamps` | `` `s.slice(a, b)` panics here outside its receiver's bounds, where TypeScript clamps; `substring` clamps in both `` |
| NL8003 | record copy-in (3.3) | 4 | `is copied into the array here, and TypeScript stores the same object` | `` `p` is copied into the array here, and TypeScript stores the same object, so the later write to `p` is not seen through `ps` `` |
| NL8004 | store over a live element (3.3) | 4 | `overwrites the element a reference still reads, and TypeScript replaces the object instead` | `` `ps[0] = q` overwrites the element a reference still reads, and TypeScript replaces the object instead (`r`, line 12) `` |
| NL8005 | zero-fill (3.3) | 1 | `is filled with zeros here, and with holes in TypeScript` | `` `new Array<f64>(n)` is filled with zeros here, and with holes in TypeScript `` |
| NL8006 | integer `/` (3.1) | 2 | `truncates here, and TypeScript divides exactly` | `` this `/` on i32 truncates here, and TypeScript divides exactly `` |
| NL8007 | wrapping (3.1) | 2 | `wraps here, and TypeScript keeps counting past the range` | `` this `+` on u8 wraps here, and TypeScript keeps counting past the range `` |
| NL8008 | i32 `>>>` (3.1) | 2 | `reads back signed here, and unsigned in TypeScript` | `` this `>>>` on i32 reads back signed here, and unsigned in TypeScript `` |
| NL8009 | 64-bit integers (3.1) | 2 | `is a 64-bit integer here, and a double in TypeScript` | `` `total` is a 64-bit integer here, and a double in TypeScript, which rounds past 2^53 `` |
| NL8010 | libm NaN / signed zero (3.1) | 2 | `follows the native NaN and signed-zero rules here, not JavaScript's` | `` `Math.min` follows the native NaN and signed-zero rules here, not JavaScript's `` |
| NL8011 | `console.log` of `-0` (3.5) | 2 | `prints a negative zero as 0 here, and Node's console prints -0` | `` `console.log` prints a negative zero as 0 here, and Node's console prints -0 `` |

## Stage 1 — portability-class

**Owns:** `src/diagnostics.ts`, `src/compile.ts`, `src/compilation.ts`, `src/options.ts`, `src/codes.ts`, `src/checker.ts`, `src/portability.ts` (new), `src/portability-numbers.ts` (new stub), `src/portability-strings.ts` (new stub), `src/portability-records.ts` (new stub), `scripts/gen-diagnostic-codes.mjs`, `scripts/codes-registry.js`, `tests/run.js`, `tests/diagnostic-coverage.js`, `tests/wordings/unreachable.txt`, `tests/wordings/nl8005_*`, `tests/cases/port_array_*`, `tests/nish/cli.ts`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp10-ci.md`, `docs/wp33-round-trip.md`, `AGENTS.md`, `README.md`, `.claude/testing.md`

**Sink and output.** Add a `PORTABILITY` kind beside `PERFORMANCE` in `src/diagnostics.ts`, with its own sink list and its own report ordering. It sorts by file and then by position, and the performance list's `compareWarnings` is reused if it fits. A portability warning must never enter `items`, the performance list, or `hasErrors`. `json()` emits `"severity":"portability"`. `codeFor` gains a `portability` branch that reads `portabilityRules`. The human report is capped the way the performance report is, with its own "N portability warnings" line.

**The flag.** `--warn-portability` is off by default. It goes in the usage string, `--help` and README's flag list, and is accepted by `nish run` the way `--no-warn-performance` is. It is independent of `--no-warn-performance` in both directions. The warnings print on the same streams as performance: stderr for humans, and one object per line on stdout under `--json`. They print only after a clean check, after the performance warnings.

**The pass.** `src/portability.ts` exports the entry that `Compilation` calls after checking, and only under the flag. It walks each analysis unit's checked bodies and hands each node to the three row modules. Each row module exports one function with a fixed signature, and returns findings of `{ node, message }`, as `arenaLoopFindings` does. The stubs return nothing. The worker picks the exact signature, and writes it in the PR body and in a JSDoc on each stub, because Stages 2–4 are written against it. Facts come from the checker's side tables (orientation rule 1). The pass never re-derives a type.

**Codes.** Add `portabilityRules` to `src/codes.ts` with the eleven pairs above, in longest-fragment-first order. Update the header comment's band list. In `scripts/gen-diagnostic-codes.mjs`, add `"8"` to `BANDS`, and require that a portability fragment sits only in `portabilityRules`. Require that the NL8xxx numbers are gap-free from NL8001, mirroring the NL9 rule. Add the matching broken-registry cases to `tests/run.js`, beside the NL9 ones near line 767.

**The first row, NL8005.** Flag `new Array<T>(n)` for a numeric or boolean `T` when `n` is not the literal `0`. Put it in `src/portability.ts` itself, not in a row module. Add `tests/cases/port_array_zero_fill` (warns) and `port_array_quiet` (`[]` and `new Array<T>(0)` stay quiet).

**Tests.** In `tests/run.js`, add a `<name>.portability` golden. When present, the case is also compiled with `--warn-portability --json`, and the portability objects on stdout must equal the file line for line. Its section also checks five things. The flag is off by default, meaning no output and the same `.ll` bytes with and without it. The exit code is unchanged. A program with an error prints no portability warning. `--no-warn-performance` does not silence portability. The human form's line shape is right. In `tests/diagnostic-coverage.js`, compile `port_*` cases with `--warn-portability` so their codes count as provoked, and add `tests/wordings/nl8005_*`. In `unreachable.txt`, add three blocks, each under its own `# --- WP33 R1: lands with <stage-id>` header and separated by a blank comment line: NL8006–NL8011 for `portability-numbers`, NL8001–NL8002 for `portability-strings`, NL8003–NL8004 for `portability-records`. In `tests/nish/cli.ts`, assert that `--warn-portability` is in `--help` and that a warned program still exits 0.

**Docs.** `docs/LANGUAGE.md`: a `portability` entry under Diagnostics beside the performance one, with the flag, the severity and the eleven-row table (code, row, what the TypeScript reading does instead). `docs/AI.md` and `AGENTS.md`: `severity` is `"error"`, `"performance"` or `"portability"`, and the NL8xxx band goes in the band list. `docs/wp10-ci.md`: a band-table row. `.claude/testing.md`: the `.portability` golden. `docs/wp33-round-trip.md`: the status line and §9 say R1's portability half is built. §5.2's "on under `--compat` and `--emit ts`" gains "and `--warn-portability` until they exist".

## Stage 2 — portability-numbers

**Owns:** `src/portability-numbers.ts`, `tests/cases/port_num_*`, `tests/wordings/nl8006_*` … `tests/wordings/nl8011_*`, and its own block in `tests/wordings/unreachable.txt`.

**Depends on:** `portability-class` (development and merge).

| Code | Flag | Quiet (negative case) |
| --- | --- | --- |
| NL8006 | `/` whose operands are an integer type (i32, u8/u16/u32, i64/u64, ranged) | `/` on f64, including under `--number-mode f64` |
| NL8007 | `+ - *` and `++`/`--` on u8/u16/u32, and on i32 only when `--wrapping` is set | i32 `+` without `--wrapping` (class B: overflow is UB natively) |
| NL8008 | `>>>` whose result type is i32 | `>>>` on u32 |
| NL8009 | each binding, parameter, field or return type declared i64/u64, once per declaration and not per use | i32 and f64 declarations |
| NL8010 | `Math.min`, `Math.max`, `Math.round` with an f64 argument | the same calls on integers |
| NL8011 | `console.log` with an f64 argument | `console.log` of an integer or a string |

Each row gets a warning case and a quiet case (`port_num_<row>` and `port_num_<row>_quiet`), plus a `tests/wordings/` pin. The stage deletes exactly its own `unreachable.txt` block.

## Stage 3 — portability-strings

**Owns:** `src/portability-strings.ts`, `src/strings.ts`, `src/bounds.ts`, `tests/cases/port_str_*`, `tests/wordings/nl8001_*`, `tests/wordings/nl8002_*`, and its own block in `tests/wordings/unreachable.txt`.

**Depends on:** `portability-class` (development and merge).

**NL8001.** This follows wp33 §3.2's narrower rule. An offset or code unit (`.length`, `charCodeAt`, `indexOf`, `lastIndexOf`) that only flows back into string methods on the same string is consistent in either unit, and stays quiet. It warns where the value meets an outside fact:

- it is printed, returned from `main`, or stored in a field or an array;
- it is compared with, or used in arithmetic with, an integer literal other than 0, when the string is not provably ASCII (a non-ASCII literal compared with `charCodeAt`, or a hard-coded offset into text);
- it pads or aligns output.

A string whose value is a literal with only ASCII bytes is provably ASCII. The worker writes the exact predicate into the module's JSDoc and into the LANGUAGE.md row's wording. That doc is Stage 1's, so the worker reports any wording change it needs in the PR body rather than editing it.

**NL8002.** A string or array `slice(a, b)` where either bound is a negative literal, or is not proven inside `[0, length]` by the same proof that removes the `substring` clamp (`perf_clamp_*`).

Cases: `port_str_length_printed`, `port_str_offset_roundtrip_quiet`, `port_str_ascii_literal_quiet`, `port_str_nonascii_charcode`, `port_str_slice_negative`, `port_str_slice_proven_quiet`, plus the wording pins.

## Stage 4 — portability-records

**Owns:** `src/portability-records.ts`, `src/arrays.ts`, `src/assignment.ts`, `tests/cases/port_rec_*`, `tests/wordings/nl8003_*`, `tests/wordings/nl8004_*`, and its own block in `tests/wordings/unreachable.txt`.

**Depends on:** `portability-class` (development and merge).

**NL8003.** A record value copied into an array (`push`, an array literal `[p, q]` or `[p, p]`, `ps[i] = p`) where the source binding, or another copy of it, is written after the copy and one of the two is read afterwards. Warn at the copy-in site and name the later write.

**NL8004.** `ps[i] = q` while an element reference `r = ps[j]` of the same array is live and read afterwards. Reuse the element-reference tracking behind `reject_arr_element_across_push` rather than building a second tracker. A conservative answer is allowed: `i` and `j` may be unrelated.

Cases: `port_rec_push_then_write`, `port_rec_literal_twice`, `port_rec_push_never_written_quiet`, `port_rec_slot_store_live_ref`, `port_rec_slot_store_dead_ref_quiet`, plus the wording pins.

## Merge order

`portability-class` merges first, and the other three start only after it lands, because they are written against its pass signature and registry. `portability-numbers`, `portability-strings` and `portability-records` then run in parallel and merge in any order. Their only shared file is `unreachable.txt`, where each deletes a separate block.

## Out of scope

- The parser reading all of TypeScript's syntax (R1's first half, §5.0).
- `--compat`, `--emit ts`, `fix` in `--json`, and `nish fix` (R4–R6).
- The structural C rows and `Float64Array` (see Approach).
- Any change to a lowering, an `.ll` golden, or `bench/instructions.json`.
- Turning the class on for any shipped source, or gating `std/`, `examples/` or `src/` on it.

## Verification

Each stage's `verification` line, plus: an undegraded `npm test` (read the skip count), no `.ll` golden in the diff, and `scripts/bootstrap.sh --verify` timed before and after, with the number in the PR body.

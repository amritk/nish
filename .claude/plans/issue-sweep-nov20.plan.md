---
name: Issue sweep, 2026-11-20 — close what is done, fix what fits in one PR
overview: Of 137 open issues, ~45 are closed by evidence alone (finished /feature trackers, two done issues, one superseded). Seven stages fix the open issues that a Linux container can finish in one PR each with no owner decision and no benchmark hardware. Everything else (hardware measurements, owner decisions, multi-PR designs, work in flight in other runs) is left open and listed.
stages:
  - id: field-init
    title: "feat(checker): allow [] and new expressions as class field initializers (#1631)"
    goal: "`kind: i32[] = []` and `child: Node = new Node()` are accepted as field initializers, stored by the constructor before its body in declaration order; the full construct checklist ships."
    verification: npm run check && npm run lint && node tests/run.js cls_field && node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js
    todos:
      - id: rule
        content: Decide and write the docs/LANGUAGE.md rule for what an initializer may read (this, params, other fields) — see field-init
        status: pending
      - id: impl
        content: Checker accepts [] (element type from the declared field type) and new C(...); emit stores them in declaration order before the body — see field-init
        status: pending
      - id: tests
        content: Golden .ll, llvm-as, native round trip with .out, one negative per refused route — see field-init
        status: pending
      - id: docs
        content: Cookbook entry, docs/guide/language/classes-and-interfaces.md, and the #1640 sentence on whether << counts as constant arithmetic — see field-init
        status: pending
  - id: num-tostring
    title: "fix(checker): name the template-literal spelling when a number's toString is called (#1632)"
    goal: "`n.toString()` on i32/i64/u8/f64 gives a diagnostic whose text says to write `${n}`, pinned by a negative test; AI.md's quote of it and its stale string-enum line (#1639) are updated."
    verification: npm run check && npm run lint && node tests/run.js reject_num && node tests/run.js wordings && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: message
        content: Change the message in src/members.ts for numeric receivers calling toString, keep the quick-fix — see num-tostring
        status: pending
      - id: pin
        content: Negative test pinning the text; grep the old text across the repo and move every pin — see num-tostring
        status: pending
      - id: ai-md
        content: docs/AI.md row at ~214 and the string-enum line #1639 cites (~3153) — see num-tostring
        status: pending
  - id: tests-pins
    title: "test: pin constant tables, the recursion loop's panics, and the long-path cleanup (#1640, #1605, #1422)"
    goal: "Every behaviour #1640 lists is pinned by a test; #1605 item 2's both-modes check exists; #1422's cleanup cannot crash at a 107-byte build/test."
    verification: npm run check && npm run lint && node tests/run.js const_ && node tests/run.js acc_ && node tests/run.js file_open_errors
    todos:
      - id: tables
        content: "#1640: -O2 single-load check, cross-module table, u16/u32 round trips, f64 folded from constants, per-byte class, wasm .d.ts / wasm-host export check, generic/field/closure negatives — see tests-pins"
        status: pending
      - id: acc
        content: "#1605 item 2: run each panicking acc_* case under the loop and --no-elision, compare stdout, stderr and exit — see tests-pins"
        status: pending
      - id: longpath
        content: "#1422: remove the stray only when lstat says it is a socket — see tests-pins"
        status: pending
  - id: docs-language
    title: "docs: forEach on arrays and sets, NL9019's scope, string-enum and stale security lines (#1607, #1573, #1639, #987, #888)"
    goal: "Reference pages show forEach on Array/ReadonlyArray/Set and NL9019's scope; #1639's docs and round-trip pin land; the stale crypto-x509/rsa lines and #888's fuzz record lines are fixed."
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/run.js json_enum_string
    todos:
      - id: foreach
        content: "#1607: doc comments for forEach on Array, ReadonlyArray, Set in runtime/nish.d.ts; regenerate docs/reference — see docs-language"
        status: pending
      - id: nl9019
        content: "#1573: NL9019's scope on its reference page, through its source, regenerated — see docs-language"
        status: pending
      - id: enums
        content: "#1639 (all but the AI.md line): stale lines, combined round-trip document in tests/link/json_enum_string, enumString in the json security record — see docs-language"
        status: pending
      - id: security-lines
        content: "#987: crypto-x509.md 'planned under #987' and crypto-rsa.md 'nothing calls the module yet'; #888: 'Fuzzed, none found' lines in json.md and url.md and the f64-infinity regression note — see docs-language"
        status: pending
  - id: docs-records
    title: "docs: tick WP39's merged stages, mark wp60's in-band cells, and fix stale bench lines (#1609, #1433, #1505, #1728, #953)"
    goal: "Roadmap and records say what main and their recorded runs say."
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: wp60
        content: "#1609: mark cells inside the band as not shown; cite the band for the escape group and timing_tp3 — see docs-records"
        status: pending
      - id: wp39
        content: "#1433: tick G5, G7, G8, E5, E6 on docs/roadmap/wp39-http-server.md with their PRs (#1495, #1473, #1462, #1448, #1446) after checking each — see docs-records"
        status: pending
      - id: misc
        content: "#1505 browser-games minimum-version / .sites.json note; #1728 loadgen 'closed its window' wording; #953 item 3 bcrypt bench build precondition — see docs-records"
        status: pending
  - id: ring-followups
    title: "fix(runtime): ring-in-place bench validation, its deadline claims, and single-process ring pins (#1238)"
    goal: "Every #1238 item that needs no decision is fixed or found already fixed; peekWait and the O(windows) walk are left recorded."
    verification: npm run check && npm run lint && node tests/run.js ring
    todos:
      - id: bench
        content: "bench.ts validates mode and n; run.mjs's mode check fires; body_bytes not integer-divided; drop or back the deadline and 'paced by' claims; summaries include the 1 KB cell — see ring-followups"
        status: pending
      - id: ring-tests
        content: "Single-process test reserving against a partly full ring and placing a marker at nonzero head; a copyBytes lowering pin — see ring-followups"
        status: pending
  - id: relay-flake
    title: "fix: link/net_relay_f64 intermittent failure (#1689)"
    goal: "The flake is reproduced and its cause fixed without a retry, or a draft PR records why it does not reproduce here."
    verification: node tests/run.js net_relay_f64
    todos:
      - id: repro
        content: Reproduce under load (loop the case with CPU stress), localise, fix the race — see relay-flake
        status: pending
---

# Issue sweep, 2026-11-20

Base: `main` @ 936ba0b1. Every stage is one PR. Wave 1 runs `field-init`,
`num-tostring`, `tests-pins`, `docs-language`; wave 2 fills in as they merge:
`docs-records`, `ring-followups`, `relay-flake`. No merge-order edges: the
Owns sets are disjoint. Several open PRs from other runs (#1786, #1782, #1808,
#1784, #1757) also edit `docs/LANGUAGE.md`, `docs/AI.md`, `tests/run.js` and
`runtime/nish.d.ts`; a conflict from one of them merging is resolved by the
slice's worker merging `main`.

Generated (regenerate, never hand-merge): `tests/self/goldens/checked/**`,
`tests/differential/goldens*`, `tests/differential/emit-ts-known.txt`,
`tests/cases/*.ll`, `docs/reference/**`, `tests/shard-costs.json`.

## field-init

Owns: `src/**` except `src/members.ts`; `tests/cases/cls_field_init*`,
`tests/cases/reject_cls_field_init*`, `tests/link/cls_field_init*/**`,
`docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`,
`docs/guide/language/classes-and-interfaces.md`, `tests/nish-cmp.js`.

`tests/run.js` belongs to `tests-pins`. If the construct checklist needs a
check there, say so in the PR body; the lead routes it.

Issue #1631. The construct checklist is `docs/ARCHITECTURE.md` → "How to add a
construct". `src/` may not *use* the new construct (rolling freeze). The
existing refusal `tests/cases/reject_cls_field_init_call.ts` stays for what
the rule still refuses (a call that is not `new`). Also add the one
`docs/LANGUAGE.md` sentence #1640 asks for: whether `<<` counts as the
arithmetic a constant may do (today it is refused as `Unsupported operator`).

## num-tostring

Owns: `src/members.ts`, `tests/cases/reject_num_tostring*`,
`tests/wordings/*tostring*`, `docs/AI.md`, `docs/wp65-lexer-surface.md`.

Issue #1632, the second option: keep `toString` out and make the message name
the supported spelling (the quick-fix to `${n}` already exists; the text does
not say it). Only numeric receivers change; strings and other types keep
today's text. Grep the old text everywhere (CLAUDE.md: a changed diagnostic
message is grepped across the whole repo). Also fix the stale string-enum line
#1639 cites in `docs/AI.md` (~3153), since this stage owns that file.

## tests-pins

Owns: `tests/run.js`, `tests/cases/const_array_*`, `tests/cases/const_table_*`,
`tests/cases/reject_const_table_*`, `tests/link/const_table_*/**`,
`tests/cases/acc_*` (read only unless a case needs an args file).

Issues #1640 (all bullets but the `<<` sentence, which `field-init` writes),
#1605 item 2 only (items 1 and 3 stay open), #1422 (the socket-only removal;
also skip when `stray` ends in `path.sep`).

## docs-language

Owns: `runtime/nish.d.ts`, `tests/wordings/nl9019_kept_memory.ts`,
`scripts/gen-reference.mjs` (only if NL9019's scope cannot come from its
source), `docs/security/json.md`, `docs/security/url.md`,
`docs/security/crypto-x509.md`, `docs/security/crypto-rsa.md`,
`docs/security/README.md`, `docs/guide/using-nish/interop.md`,
`docs/guide/language/types.md`, `docs/wp62-json-schema-classes.md`,
`tests/link/json_enum_string/**`.

Records follow CLAUDE.md "A record states only what its code or its recorded
run does". #888's "panicking target is reported as a crash" test is out of
scope (no record claims it); leave it in the consolidated follow-up issue.

## docs-records

Owns: `docs/wp60-dyn-dispatch.md`, `docs/roadmap/wp39-http-server.md`,
`docs/roadmap/index.md`, `docs/guide/using-nish/browser-games.md`,
`docs/BENCHMARKS.md`, `bench/crypto/bcrypt/run.mjs`.

Check each tick against the merged PR before ticking. BENCHMARKS.md rules in
CLAUDE.md apply: change wording only, no new figures.

## ring-followups

Owns: `bench/ring-inplace/**`, `bench/README.md`, `docs/wp47-shared-memory.md`,
`tests/link/ring_*/**`, `tests/cases/ring_copybytes*`.

Issue #1238, the Bench and Ring test items plus the `copyBytes` lowering pin.
Check #1230 first; some may already be fixed. Not in scope: `peekWait` (a new
API) and the O(windows) walk in `std/sync/shm.ts` (SHM-6); leave both open.

## relay-flake

Owns: `tests/link/net_relay_f64/**`, and `std/net/**` only if the race
is in the library (then its `docs/security/` record and pinned `LINE:COL`s
move with it).

Issue #1689. Reproduce before changing anything. No retries, no longer
timeouts as the fix. If it does not reproduce in the container after a
bounded attempt (about 200 iterations under load), open a draft PR with what
was tried and stop.

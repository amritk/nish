---
name: WP48 stage 3 — the compiler picks compact classes
overview: Turn on the compact-class rule that #1736 built as a report only (`src/compact-rule.ts`, `nish --explain-layout`). First measure the holder-only picks the survey found (every src/ and std/ pick passes test 3 only because a holder shrinks by 8 bytes) and tighten test 3 to what the numbers support. Then codegen narrows what the rule picks exactly as `implements Compact` does, `implements Wide` refuses it, and `--compact off` turns it off for one build. Gate per docs/wp48-ref32-classes.md §8, with the corpus and bench/goose built both ways.
stages:
  - id: s1-rule-on
    title: "feat(codegen): the compiler picks compact classes, with implements Wide and --compact off"
    goal: A native --link build narrows every class the tightened §3.1 rule picks with no source marker; a holder-only 8-byte saving no longer qualifies unless the measurements show it pays; `implements Wide` and `--compact off` refuse; the corpus and bench/goose show no program slower beyond its noise band and every picked class smaller; WP48 stage 3 is ticked.
    verification: npm run check && npm run lint && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/run.js explain_layout && node tests/run.js cli && node tests/run.js compact && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js
    todos:
      - id: wire-flag
        content: Wire the rule's verdict into layout behind `--compact on|off` (default on) so both builds of one compiler can be compared — see S1, "Order of work"
        status: pending
      - id: measure-holders
        content: Measure holder-only picks both ways — the self-build's peak RSS and time, the std benches for HttpServerRequest, JsonTokenizer and Deflater — interleaved, with noise bands — see S1, "Measure"
        status: pending
      - id: p256
        content: Decide P256ProjectivePoint (std/crypto/p256.ts) against the Secret code beside it, and record the decision in docs/security/crypto-ecc.md — see S1, "P256ProjectivePoint"
        status: pending
      - id: tighten-test3
        content: Tighten test 3 in src/compact-rule.ts to what the figures support, with explain_layout cases for the dropped and kept shapes — see S1, "Tighten test 3"
        status: pending
      - id: codegen
        content: Codegen narrows every class the rule picks exactly as `implements Compact` does; `implements Compact` still forces; one decision shared by codegen and --explain-layout — see S1, "Codegen"
        status: pending
      - id: wide
        content: "`implements Wide` from nish:compact (declaration with doc comment) refuses the rule; Wide and Compact on one class is a coded error with a tests/link negative — see S1, Wide"
        status: pending
      - id: flag-docs
        content: "`--compact off`: help rows, guide cli.md, reference regenerated, break-web site rebuilt, a tests/run.js check — see S1, CLI flag"
        status: pending
      - id: gate
        content: Build the nish-cmp corpus and bench/goose with --compact off vs on; no program slower beyond its noise band, every picked class smaller; figures in a Measured trailer — see S1, "Gate"
        status: pending
      - id: declared-goldens
        content: Narrow DECLARED entries in tests/nish-cmp.js for every moved program, goldens regenerated, wasi and performance runs read — see S1, "Generated and pinned"
        status: pending
      - id: docs-tick
        content: docs/LANGUAGE.md, the guide's compact-classes and memory pages, §3.1 of the design note with the tightened test 3 and its figures, roadmap stage 3 ticked — see S1, "Docs"
        status: pending
---

# WP48 stage 3 — the compiler picks compact classes

Sources: `docs/roadmap/wp48-ref32-classes.md` (stage 3 line),
`docs/wp48-ref32-classes.md` §3.1 (the five tests) and §8 (the gate),
`src/compact-rule.ts` (the rule, report-only, from #1736), and the
"Survey" section of #1736's description (the 18 src/ and 7 std/ picks,
all holder-only).

## S1 — the rule on, tightened

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/core.d.ts`,
`std/**` (only a `Wide` marker, if the measurements ask for one),
`tests/**`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/reference/**`,
`docs/wp48-ref32-classes.md`, `docs/roadmap/wp48-ref32-classes.md`,
`docs/roadmap/index.md`, `docs/security/crypto-ecc.md`,
`docs/security/README.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`,
`docs/site/break/**`, `examples/break-web/**`, `scalar.config.json`,
`.claude/plans/wp48-s3-rule.plan.md`.

One PR. It is one stage rather than two because the measurement needs
the rule wired to codegen (compare `--compact off` with on), and the gate
needs the tightened rule.

### Order of work

1. **Wire the flag first.** Feed the rule's verdict into layout, the way
   `implements Compact` already sets it, behind `--compact on|off`. This
   gives one compiler that builds a program both ways, which is what every
   measurement below compares.
2. **Measure, then tighten test 3.**
3. **Then** finish `Wide`, the docs, the gate, the DECLARED entries and the
   goldens, all against the tightened rule.

### Measure

The survey shows the rule picking classes only "through a holder": a
holder's rounded size drops 8 bytes while the class itself stays the same
size (`StructInfo` 176 → 176, holder `FunctionSig` 200 → 192). Such a pick
pays the decode on every link load for a 4% saving on one holder. The real
wins are self-linked nodes (`TreeNode` 24 → 12, `TNode` 16 → 8, sibling
32 → 20).

Measure, interleaved, at least 5 runs per side, each with its noise band
(`.claude/testing.md`, "A `Measured:` trailer"):

- **The self-build**: `build/nish` compiling `src/compile.ts` with `--link`,
  built by a compiler with the rule on and with `--compact off`. Report
  peak RSS (`/usr/bin/time -v`) and wall time.
- **The std benches** for `HttpServerRequest`, `JsonTokenizer` and
  `Deflater`: find the existing bench programs under `bench/`. If none
  exercises a class, write a minimal one under `tests/` or a scratch
  directory and say so. Report time and peak RSS both ways.
- `bench/goose/tree.ts` at n = 24 both ways, as the positive control.

### Tighten test 3

Tighten test 3 to what the figures support. The candidate to test first:
`R`'s own rounded size, or that of a class made in the same loop or
recursion as `R` (test 4's scan), shrinks by at least a threshold. Pick
the threshold from the figures and justify it in §3.1.

`explain_layout` gets cases for a holder-only pick that is now refused
(with its reason text), and for the shapes that are kept. Re-run the
survey (`--explain-layout` over `src/compile.ts` and over the std picks)
and put both pick lists, before and after, in the PR body.

### P256ProjectivePoint

`std/crypto/p256.ts:2537` sits beside `Secret` code. Its coordinates are
secret-dependent during scalar multiplication, even though no field is a
`Secret`, so test 5 does not refuse it. Find out whether compacting it
changes anything the crypto record relies on: where instances are
allocated (the reserved range rather than the heap), what a `wipe` reaches,
and whether the decode or the allocation path is secret-dependent.

Then decide. Either the tightened test 3 already drops it, or it gets
`implements Wide`. A `Wide` marker means checking whether any `src/`
import reaches it, because the seed has no `Wide` (rolling freeze), and
it means std line-move pins (`grep std/crypto/p256.ts:[0-9]`). Record
the decision and its evidence in `docs/security/crypto-ecc.md`, and update
its `docs/security/README.md` row if the counts change.

### Codegen

- Every class the rule picks is narrowed exactly as `implements Compact`
  narrows it today: the `i32` link layout, the encode and decode, the
  4-rounding allocation, and the arena switch.
- `implements Compact` still forces a class compact where the rule says no,
  and still refuses where test 1 or test 5 refuses.
- Codegen and `--explain-layout` read one decision, so the report cannot
  disagree with the IR.
- wasm32, the host page modules and ASAN builds stay uncompressed, as they
  are under 2a.

### Wide

`implements Wide` from `nish:compact` keeps a class wide that the rule
picks. It is erased under Node and `tsc`, and its declaration carries a
doc comment.

Writing both `Compact` and `Wide` on one class is a compile error. It gets
a new diagnostic code, registered, with a `tests/link` negative
(`expected.err`), and its page under `docs/reference/diagnostics/` is
regenerated. `--explain-layout` names `Wide` as the reason.

### CLI flag

`--compact off` (and `on`, the default) works for compile and `nish run`.
It adds help rows in `src/cli-style.ts`, `examples/break-web/help.ts`,
`tests/nish/cli.ts` and the `tests/run.js` flag lists. It is documented
in `docs/guide/using-nish/cli.md` and the guide's compact-classes page,
`docs/reference/` is regenerated, and `docs/site/break` is rebuilt
(`node examples/break-web/build.mjs`).

A `tests/run.js` check shows three things:

- `--compact off` gives IR byte-identical to a build of the same program
  where no class is compact.
- With the flag on, the rule's picks are narrowed.
- `--explain-layout` reports the flag.

### Gate (§8)

Build the nish-cmp corpus and `bench/goose` with `--compact off` and with
it on.

- No program is slower beyond its noise band.
- Every picked class is smaller.

Put the figures, with their noise bands, in the PR body and in
`Measured:`. A program that is slower beyond its band is a gate failure:
tighten the rule further or stop and report, never widen the band.

### Generated and pinned

- **DECLARED entries.** Every nish-cmp program whose IR moves gets a
  narrow `DECLARED` entry in `tests/nish-cmp.js` (program and file). Put
  its `changelog:` text in the PR body under "Squash subject must
  contain", so the squash subject can carry each string verbatim.
- **Goldens.** Regenerate them: `node tests/self/goldens.js --update`, and
  `node tests/differential/goldens.js --update` for any new positive case.
- **Test runs.** Run `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`)
  and `node tests/run.js performance`, and read the skip line. A new
  NL9007 in `src/` fails the ratchet.

### Docs

- **`docs/LANGUAGE.md`**: the compact rule now says the compiler picks
  classes; add `Wide`.
- **The guide**: update the compact-classes page and the memory page.
- **`docs/IR_COOKBOOK.md`**: add an entry if the IR shape is new.
- **The design note** (`docs/wp48-ref32-classes.md`): update §3.1 with the
  tightened test 3 and §5 with the measured figures.
- **The roadmap.** Tick stage 3 and set "Done: 5 of 9", then update
  "Next" and the row in `docs/roadmap/index.md`.

---
name: Unclaimed issues — eight compiler fixes nobody else is on
overview: A sweep of the open issues that no live session, branch, pull request or feature run covers, as of main @ c8a00d6 on 2026-10-20. Each stage fixes one issue in one src/ module, so the stages run in parallel and merge one at a time. The HTTP/3 issues (#700, #699, #473, #472) are left out because lazy-server-slots (#753) and quic-aead-ackskip-ecn (#759) are editing the same std/net files. Issues that wait on an owner's decision (#696, #662, #661, #461, #447, #382), on Node upstream (#732) or on another run (#477, #480), and the epics (#481, #483, #485), are left out too.
stages:
  - id: ctor-readonly
    title: "fix(codegen): keep field-initialiser stores in an empty explicit constructor (#740)"
    goal: A class whose explicit constructor body is empty, or writes no field itself, still runs its field initialisers, natively at -O2 as under Node
    verification: node tests/run.js codegen (or the section holding the new cases) green, the new round trip printing the initialised values at -O2; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: ctor-readonly-repro
        content: Reproduce #740 natively at -O2 and pin which attribute inference in src/attributes.ts marks `this` readonly when the field-initialiser stores are emitted outside the written body
        status: pending
      - id: ctor-readonly-fix
        content: Count the field-initialiser stores (and a discriminated-union variant's tag store) as writes to `this` when inferring the constructor's attributes
        status: pending
      - id: ctor-readonly-tests
        content: Add tests/cases/ctor_empty_init_* cases with goldens and a native round trip at -O2 — an empty constructor, one that writes only a parameter-property, one that calls super — plus a negative check that a truly read-only method keeps `readonly`
        status: pending
  - id: nl2290-alias
    title: "fix(checker): follow a const alias of an element reference in NL2290 (#646)"
    goal: Holding an element reference through a `const` alias across a push is refused with NL2290, as the direct reference already is
    verification: node tests/run.js for the section holding the new cases green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: nl2290-alias-fix
        content: In src/arrays.ts, follow `const` aliases (chains included) of an element reference when deciding whether the reference is live across a growing call
        status: pending
      - id: nl2290-alias-tests
        content: Add negative tests/cases/arr_ref_alias_* for #646's program, a two-step alias chain, and an alias read inside a nested block; a positive case where the alias is dead before the push still compiles
        status: pending
  - id: nl8003-alias
    title: "fix(checker): warn NL8003 on a record copy reached through an alias or a helper (#620)"
    goal: A record copied into an array through a `const` alias or a helper that stores its argument draws NL8003, so native and Node never print different answers silently
    verification: node tests/run.js for the section holding the new cases green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: nl8003-alias-fix
        content: In src/portability-records.ts, follow `const` aliases of the copied record and treat a callee that may store or mutate it as a copy site (conservatively when the callee is not analysed)
        status: pending
      - id: nl8003-alias-tests
        content: Add tests/cases/port_record_alias_* warning cases for #620's alias and helper programs, and a positive case where the alias is never written after the copy and draws no warning
        status: pending
  - id: nl8001-offsets
    title: "fix(checker): carry NL8001 into data-parallel arrows and offset uses (#629)"
    goal: A UTF-8 byte offset produced inside a data-parallel arrow, or used as an index, a call argument or a loop bound, draws NL8001 like the direct cases do
    verification: node tests/run.js for the section holding the new cases green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: nl8001-arrow
        content: In src/portability-strings.ts, apply the walk to a data-parallel arrow's own body so an offset produced inside it is seen
        status: pending
      - id: nl8001-uses
        content: Extend NL8001 to an offset used as an index, passed as an argument, used as a loop bound, or returned from a helper — each of #629's paths
        status: pending
      - id: nl8001-tests
        content: One tests/cases/port_utf8_offset_* warning case per path in #629, and a positive case (an offset only compared to another offset) that stays quiet
        status: pending
  - id: unsafe-capability
    title: "feat(checker): report the `unsafe` capability for nish:unsafe calls (#432)"
    goal: A function that calls uncheckedGet, uncheckedSet or wrappingAdd/Sub/Mul carries the reserved `unsafe` bit, propagated through its callers, in the capability report and `--allow` checks
    verification: node tests/run.js capabilities (and tests/capabilities.js) green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: unsafe-capability-bit
        content: In src/capabilities.ts, make builtinCapability answer bit 10 for the five nish:unsafe exports, and confirm it propagates through the call graph like the others
        status: pending
      - id: unsafe-capability-report
        content: Show `unsafe` in the capability report (src/capability-report.ts) and decide how `--allow`/`--deny` treat it per docs/wp35-capabilities.md §1; update that doc
        status: pending
      - id: unsafe-capability-tests
        content: Cases in tests/capabilities.js for a direct call, a call two frames up, and a module with no unsafe call; a negative for a denied `unsafe`
        status: pending
      - id: unsafe-capability-guide
        content: Update the docs/guide/ page that lists capabilities, and docs/LANGUAGE.md's capability rule
        status: pending
  - id: c-symbols-llvm
    title: "fix(codegen): reserve libm's C99/C23 names in c-symbols past LLVM 18's table (#651)"
    goal: A Nish function named after a libm C99/C23 function LLVM 19+ recognises is renamed like the LLVM 18 ones, and the list says where it comes from
    verification: node tests/run.js c-symbols (or the section running tests/c-symbols) green; npm run check, npm run lint green
    status: pending
    todos:
      - id: c-symbols-list
        content: Add the libm C99/C23 set to src/c-symbols.ts wholesale, and document in its header which sources the list tracks and how to refresh it
        status: pending
      - id: c-symbols-tests
        content: Extend tests/c-symbols with a function named after one of the added names, checked to be renamed in the IR and to run
        status: pending
  - id: parallel-fresh-dest
    title: "fix(checker): accept a fresh parallelMapInto destination beside captured arrays (#612)"
    goal: parallelMapInto accepts a fresh `const` destination that is never stored or passed before the call, even beside a captured fresh array or an object holding an array; every way the destination could alias a capture stays refused
    verification: node tests/run.js parallel (or the section holding the new cases) green; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: parallel-fresh-dest-rule
        content: In src/parallel.ts, treat a fresh `const` destination with no store, pass or capture before the call as disjoint from every capture
        status: pending
      - id: parallel-fresh-dest-negatives
        content: One negative tests/cases/par_into_* case per way in — the destination stored into a captured object, passed to a helper, aliased by another const, captured by the arrow, assigned from a captured array — and run each after churn() natively
        status: pending
      - id: parallel-fresh-dest-positives
        content: Positive cases for #612's two programs, with goldens and native output equal to Node's
        status: pending
  - id: parts-join-arena
    title: "perf(codegen): release a pass's arena when its string goes to a parts + join callee (#503)"
    goal: A string built in a loop pass and passed to a callee that only pushes it to a local `parts` and joins no longer keeps the pass's arena; Arena.used() stays flat over 1,000 passes
    verification: node tests/run.js for the section holding the new cases green, the new case's Arena.used() flat; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
    status: pending
    todos:
      - id: parts-join-rule
        content: In src/attributes.ts, stop counting a parameter that only reaches a local `parts.push` (joined before return) as captured
        status: pending
      - id: parts-join-tests
        content: A tests/cases/perf_parts_join_* golden printing a flat Arena.used() over 1,000 passes, and #500's negatives kept green; a negative where parts escapes and the arena is kept
        status: pending
---

# Unclaimed issues

Base: `main` @ c8a00d6. Every stage reads `CLAUDE.md`, `.claude/orientation.md`
and `.claude/selfhost.md` first, runs `bash scripts/fetch-seed.sh --force`
before building, and puts `Fixes #N` for its issue in its first push.

## Shared and generated files

- **Generated** — regenerate, never edit or hand-merge: `tests/self/goldens/**`
  (`node tests/self/goldens.js --update`), `tests/differential/**`
  (`node tests/differential/goldens.js --update`), each stage's own new
  `tests/cases/*.ll`, and `docs/IR_COOKBOOK.md`'s runtime prelude
  (`docs/cookbook/regen.sh`).
- **`tests/run.js`** is shared: a stage may *add* rows to its tables or new
  `check(...)` calls next to its own section, and never edits another's. A
  textual conflict there at merge time is the merging stage's to resolve.
- Every other path is owned by exactly one stage, below.

## ctor-readonly (#740)

**Owns:** `src/attributes.ts`, `tests/cases/ctor_empty_init_*`, `tests/run.js` (append)

The constructor's attribute inference reads only the written body, so field
initialiser stores emitted before it are invisible and `this` is marked
`readonly`; -O2 then drops the stores.

## nl2290-alias (#646)

**Owns:** `src/arrays.ts`, `tests/cases/arr_ref_alias_*`, `tests/run.js` (append)

## nl8003-alias (#620)

**Owns:** `src/portability-records.ts`, `tests/cases/port_record_alias_*`, `tests/run.js` (append)

## nl8001-offsets (#629)

**Owns:** `src/portability-strings.ts`, `tests/cases/port_utf8_offset_*`, `tests/run.js` (append)

If the arrow walk needs a hook in `src/parallel.ts`, that file belongs to
parallel-fresh-dest: merge after it and touch only the hook.

## unsafe-capability (#432)

**Owns:** `src/capabilities.ts`, `src/capability-report.ts`, `tests/capabilities.js`, `docs/wp35-capabilities.md`, `docs/guide/**`, `docs/LANGUAGE.md`, `tests/run.js` (append)

## c-symbols-llvm (#651)

**Owns:** `src/c-symbols.ts`, `tests/c-symbols/**`, `tests/run.js` (append)

## parallel-fresh-dest (#612)

**Owns:** `src/parallel.ts`, `tests/cases/par_into_*`, `tests/run.js` (append)

A rule that lets a value through pins what it leaves out (`CLAUDE.md`): one
negative per way the destination could alias a capture, run after `churn()`.

## parts-join-arena (#503)

**Owns:** `src/attributes.ts`, `tests/cases/perf_parts_join_*`, `tests/run.js` (append)

Shares `src/attributes.ts` with ctor-readonly, so it starts once that merges.

## Merge order

Free among the stages, one at a time in the order they converge, except
parts-join-arena after ctor-readonly and nl8001-offsets after
parallel-fresh-dest if it touched `src/parallel.ts`. Every merge moves the
checked goldens, so the next stage to merge merges `main` and regenerates them
first.

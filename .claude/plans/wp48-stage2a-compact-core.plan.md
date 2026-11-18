---
name: WP48 stage 2a — `implements Compact`, the i32 link layout and its decode
overview: Add `nish:compact` and `implements Compact` as the only way to make a class compact. A compact class's links (fields typed exactly R or R | null) are i32 offsets into stage 1's reserved range, decoded in loadField and encoded in storeField (zero-based on Linux, based on macOS), the class is 4-aligned and 4-rounded, never stack-promoted, uncompressed under ASAN, and refused where C or Node sees it. TBAA, debug info and the opaque header stay conservative for 2b/2c. No IR moves for a program without the marker.
stages:
  - id: s2a-compact-core
    title: "feat(codegen): lay out an implements Compact class's links as 32-bit offsets"
    goal: A native program with `class R implements Compact` stores its R and R | null fields as i32 offsets in the reserved range and prints what the uncompressed program prints; the four refusals each have a diagnostic code and a tests/link negative; no program without the marker moves; tree.ts at n = 24 with the marker is within 5% of the prototype's RSS and time
    verification: npm run check && npm run lint && node tests/run.js compact && node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && node tests/run.js runtime && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && bash docs/cookbook/regen.sh --check && node tests/self/goldens.js checked && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: module
        content: Add the `nish:compact` module with `Compact` and `Wide` (Wide declared, documented as reserved for stage 3, accepted by the checker as a no-op), with doc comments per CLAUDE.md's reference rule — see The module
        status: pending
      - id: checker
        content: Recognise `implements Compact` in the checker and record the class as compact; refuse it with a new diagnostic code each for a build C or Node sees (rule 1), a `declare class`, a class holding a `Secret`, and a class exported in a C or N-API surface; one tests/link negative with expected.err per code — see The checker
        status: pending
      - id: layout
        content: computeLayout (src/structs.ts) gives a field typed exactly R or R | null, for a compact R, an i32 slot 4 wide and 4 aligned in any class, and a compact class 4 alignment; structTypeDeclarations (src/emit-classes.ts) spells it i32 — see Layout
        status: pending
      - id: decode
        content: Decode in loadField and encode in storeField (src/emit-classes.ts) — zero-based on Linux, based on macOS through @nish_ref_base under !invariant.load — with the 4-rounding allocation for a compact class, and fieldLLVMType reporting the in-memory type — see Decode and encode
        status: pending
      - id: switch
        content: Make hasCompactClass in src/compile.ts true when the program has a compact class on a target that compresses, so stage 1's range runtime links; ASAN builds and wasm32 compile compact classes uncompressed and do not switch the range on — see The switch
        status: pending
      - id: escape-attrs
        content: Refuse stack promotion of a compact class (src/escape.ts holdsNoPointerSlot and the promotion site in src/emit-classes.ts); make every src/attributes.ts and src/emit.ts site that assumes align 8 or 8-byte rounding read the class's alignment; a decoded link is nonnull only once tested — see Attributes and escape
        status: pending
      - id: survey
        content: Walk every "spell field access themselves" site in the design note §6 and add the test each asks for (compound op=, senderStateIn, the Secret wipe, the record memcpy / emitStructCopy / emitNew / arenaObject, writeTrace on wasm32, a compact class as a Map key, JSON round trip, a parallel payload) — see The §6 survey
        status: pending
      - id: construct
        content: Ship the construct checklist — golden .ll (Linux and a darwin triple), llvm-as pass, native round trip with expected stdout, the negatives, the docs/LANGUAGE.md rule, a cookbook entry, a docs/guide/ page with its scalar.config.json route, regenerated docs/reference/ — see The construct checklist
        status: pending
      - id: gate
        content: Measure bench/goose/tree.ts at n = 24 with TNode marked implements Compact (a scratch copy; bench/goose itself is stage 4) against the prototype's zero-compact figures, interleaved on one machine; within 5% on RSS and time; figures in the commit's Measured trailer — see The gate
        status: pending
      - id: roadmap
        content: Split stage 2's box on docs/roadmap/wp48-ref32-classes.md into 2a (this PR, ticked), 2b (the ref32 TBAA node and debug info with pretty-printers) and 2c (the opaque --emit-header output), and move Next to 2b — see Docs
        status: pending
---

# WP48 stage 2a — `implements Compact`, the i32 link layout and its decode

## Context

WP48's design ([`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md),
§3.2, §4, §6, §7) makes a compact class's links 4-byte offsets into one reserved
range. Stage 1 (merged) built the range runtime, switched on by
`hasCompactClass` in `src/compile.ts`, which returns `false` today. Stage 2 is
the emitter; this run lands its **core half (2a)**. 2b (the `ref32` TBAA node,
debug info and pretty-printers) and 2c (opaque `--emit-header` output) are
follow-up PRs. Until they land, 2a keeps those paths **correct but
conservative**: a compressed field uses the existing `i32` scalar TBAA node or
none, debug info describes it as a plain 32-bit integer member or omits it, and
`--emit-header` is refused by rule 1 so no header ever shows a compact class.

Stage 3's rule (the compiler picking classes itself) is out of scope:
`implements Compact` is the only way in, and a program that does not write it
is unchanged down to the byte.

## The module

`nish:compact` exports `Compact` and `Wide` as type-only interfaces (erased
by Node and `tsc`, so `import type { Compact } from "nish:compact"` runs
unmodified under Node). Place it where the other `nish:` modules are declared
(`runtime/nish.d.ts` and the compiler's module table); each declaration gets a
doc comment so `scripts/gen-reference.mjs --check` passes. `Wide` is accepted
and does nothing in 2a; its doc says stage 3 gives it meaning.

## The checker

`class R implements Compact` marks `R` compact. Refusals, each a **new
diagnostic code** registered with `scripts/gen-diagnostic-codes.mjs` and
provoked by one `tests/link/<name>/` negative with `expected.err`:

1. **Rule 1, a build C or Node can see**: `--emit-header`, `--emit-napi`,
   `--emit-napi-async`, a C library output. (wasm32 is not refused: a pointer
   is already 4 bytes there, so per §4 the class compiles to today's IR. Plain
   `.ll`/object output for a native triple compresses, since that is what a
   later `--link` consumes and what the golden `.ll` tests read.)
2. **A `declare class`** marked compact, or a `declare class` holding a field
   of a compact type.
3. **A class holding a `Secret`** (the `src/emit-secret.ts` wipe reads its
   payload directly).
4. **A class exported in a C or N-API surface.**

If one of these turns out to be the same check as another in the code, say so
in the PR and keep a distinct code per reason the user reads.

## Layout

`computeLayout` (`src/structs.ts:167-189`) is the one place layout is
computed (called from `src/structs.ts:1070`, `:1186`, `src/inline-arrays.ts:895`).
For a compact `R`, a field whose declared type is exactly `R` or `R | null`,
in **any** class, is 4 wide and 4 aligned. A compact class's own alignment is
4, so a node of an `i32` and two links is 12 bytes. Nothing else narrows:
locals, parameters, returns, `R[]` elements, `Map` keys/values, other unions
and generic `T` stay full pointers. `structTypeDeclarations`
(`src/emit-classes.ts:526`) spells the slot `i32`.

## Decode and encode

In `loadField` and `storeField` (`src/emit-classes.ts:82`, `:89`):

| target | decode | encode |
| --- | --- | --- |
| Linux (zero-based) | `inttoptr(zext(o) << 2)` | `ptrtoint(p) >> 2`, truncated |
| macOS (based) | `o == 0 ? null : base + 4*o`, `base` from `@nish_ref_base` under `!invariant.load` | `p == null ? 0 : (p - base) >> 2` |

The decoded value is `%struct.R*` everywhere past the load. The allocation of a
compact class rounds its size to 4, not 8 (`@nish_alloc_ref` or the existing
allocator with the class's size and alignment — the worker picks and says
which). Use stage 1's ABI symbol so a compact module cannot link against the
default runtime.

## The switch

`hasCompactClass` (`src/compile.ts:2564`) returns true when the program has a
compact class on a native target that compresses. An **ASAN build compiles
compact classes uncompressed** (the ASAN runtime mallocs every block, which the
range cannot hold) and does not switch the range on; wasm32 likewise.

## Attributes and escape

- `holdsNoPointerSlot` (`src/escape.ts:1893`) and the promotion site
  (`src/emit-classes.ts:105`) refuse a compact class: never on the stack. A
  test pins it.
- `src/attributes.ts:1951`, `:2465`, `:7053-7073` and `src/emit.ts:~2334` read
  the class's alignment and rounding instead of assuming 8. A compact instance
  is `align 4 dereferenceable(size)`. A decoded link is `nonnull` only once
  tested. `nocapture` counts an encoding store as a capture.

## The §6 survey

Each "spell field access themselves" site in §6 gets the test it asks for:
compound `op=` (numeric only — a test that a link cannot reach it),
`senderStateIn` (a `Channel` pointer, not compact — a test), the `Secret` wipe
(refused — the negative above), the record memcpy / `emitStructCopy` /
`emitNew` / `arenaObject` (a copy of a compact-holding record round-trips),
`writeTrace` (wasm32 — a compact program on wasm32 prints the same), TBAA and
debug (conservative, see Context), attributes (above), the interop header and
ABI (refused by rule 1). Also: a compact class as a `Map` key, a JSON
encode/decode round trip, and a compact instance in a parallel task payload.

## The construct checklist

`docs/ARCHITECTURE.md` → "How to add a construct": a golden `.ll` for Linux and
one for a darwin triple (the based shape), an `llvm-as` pass, a native round
trip with expected stdout, the negatives, a `docs/LANGUAGE.md` rule, a cookbook
entry (`docs/cookbook/regen.sh`), a `docs/guide/` page with its route in
`scalar.config.json`, and `docs/reference/` regenerated. Register any new
positive `tests/cases/*` with `node tests/differential/goldens.js --update`
and regenerate `tests/self/goldens/checked/` (CLAUDE.md). The PR body shows the
exact IR for every TypeScript snippet it adds to the tests.

## No IR moves without the marker

nish-cmp must show zero differences and no `DECLARED` entry may be needed. If
the goldens regeneration moves any file other than the new cases' own, that is
a bug in this stage, not a golden to update.

## The gate

`bench/goose/tree.ts` at n = 24 with `TNode` marked `implements Compact`, built
with this branch, against the prototype's `zero-compact` variant (§5.2:
385.5 MB, 1304.0 ms on the note's machine; re-run the prototype on the same
machine interleaved if `bench/wp48-refs/run.mjs` can still build it, and compare
against that). Within 5% on peak RSS and wall time. State the figures and the
noise band in a `Measured:` trailer (`.claude/testing.md` → "A `Measured:`
trailer"). Mark the scratch copy outside `bench/goose/` — porting that
directory is stage 4.

## Docs

Split the stage 2 box on `docs/roadmap/wp48-ref32-classes.md` into 2a / 2b /
2c, tick 2a, update the Done count and Next, and update the work-package index
row if it shows the count.

**Owns:** `src/**`, `std/**`, `runtime/**`, `tests/**`, `docs/**`, `scalar.config.json`, `bench/wp48-refs/**`, `scripts/undocumented.txt`, `THIRD_PARTY_NOTICES.md`

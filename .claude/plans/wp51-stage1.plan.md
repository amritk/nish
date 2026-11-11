---
name: WP51 stage 1 — references to capture-free top-level functions in fields, locals, arrays and returns
overview: Admit a reference to a capture-free top-level function in the strict language, lowered as an i32 tag and a checker-generated dispatcher per place (a switch over the members stored into that place, with direct calls), with the escape-join refusal and a tag check only under --profile debug. Owner decision taken at sign-off — strict, as docs/wp51-function-references.md §8 recommends. Spec is §2 and §9 of that note.
stages:
  - id: stage1
    title: "feat(checker): references to capture-free top-level functions in fields, locals, arrays and returns (WP51 stage 1)"
    goal: A program stores a capture-free top-level function in a field, a local, an array element or a return value, calls through it and compares it with ===, and each call compiles to a direct call of a per-place dispatcher whose facts are its members' join — and a call whose set mixes keeping and non-keeping members is a compile error.
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/run.js fnref && node tests/run.js reject_fn && node tests/run.js reject_arrow && node tests/run.js link && node tests/run.js emit-ts && node tests/run.js performance && node tests/diagnostic-coverage.js --compiler build/nish --require-coverage --strict-refusals && WASI_SYSROOT=/usr node tests/run.js wasi && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    status: pending
    todos:
      - id: s1-types
        content: Admit a function type outside a parameter as an i32 tag in src/annotations.ts and the type layer (llvmType, alignOf, assignable by signature), and refuse it in src/interop-abi.ts, src/interop-wasm.ts and src/interop-napi.ts with reject_fnref_ffi's code — see Types and the C boundary
        status: pending
      - id: s1-sets
        content: Collect each signature's set and its declaration-order numbering in checker pass 1, from value-position names — see Sets and dispatchers
        status: pending
      - id: s1-place-pass
        content: Add the per-place pass after pass 2 over §2.3's store-context table, with the F(S) fallback for any unmodelled store — see Sets and dispatchers
        status: pending
      - id: s1-dispatchers
        content: Generate one dispatcher per distinct place set as a checked function and record its arm calls and every reference call in nodeCallees before ranges, attributes, region rules or the emitter read them — see Sets and dispatchers
        status: pending
      - id: s1-refusals
        content: Refuse every row of §2.2 and the zero-fill refusals of §2.1, each with a new src/codes.ts code and a tests/wordings program, and move the generic zero-fill refusal in std/threads to the user's call as src/parallel.ts does for NL2520 — see Refusals
        status: pending
      - id: s1-escape-join
        content: Add the escape-join refusal after the attribute fixpoint, naming the member and the store, and the performance warning for a set past eight members — see Refusals
        status: pending
      - id: s1-emit
        content: Emit each dispatcher as $ref.S.p with named blocks, lower a reference call to a call of it and === to icmp eq, write the tag check only under --profile debug, and the empty-set trap — see Emitter
        status: pending
      - id: s1-cross-module
        content: Emit a dispatcher copy per module that calls through the place and mark a cross-module member hidden with a flag takesEntryFacts does not read, settling §2.3's two open decisions — see Emitter
        status: pending
      - id: s1-debug-info
        content: Give a reference the DWARF enumeration type and the dispatcher an artificial subprogram in src/debug.ts, with a test that steps into a reference call under gdb and lldb — see Debug info
        status: pending
      - id: s1-tests
        content: Add the goldens, negatives, the flipped negatives, fnref_place_set (case C), fnref_escape_join, fnref_debug_check, tests/link/fnref_cross_module and the 10x RSS checks — see Tests
        status: pending
      - id: s1-wordings
        content: Reword NL2336, NL2334 and NL2337 with their tests/wordings programs, and add tests/nish-cmp.js DECLARED entries for every IR or wording move — see Refusals
        status: pending
      - id: s1-docs
        content: Replace the "a function is not a value" rule in docs/LANGUAGE.md, add the cookbook entry, the docs/guide page and its route, rewrite §6's broken rows and every stale pointer, regenerate docs/reference, and tick stage 1 on the WP51 roadmap page — see Docs
        status: pending
      - id: s1-generated
        content: Regenerate tests/self/goldens/checked, register the new positive cases, and regenerate tests/differential/emit-ts-known.txt only under Node 22.23.4 — see Tests
        status: pending
---

# WP51 stage 1

## Context

Today a function is never a value in Nish. A function-typed parameter exists, but only for a callee the checker can name at the call. [`docs/wp51-function-references.md`](../../docs/wp51-function-references.md) designs and measures references to capture-free top-level functions. It recommends **strict, with three stage-1 ship requirements**: per-place sets, the escape-join refusal, and no tag check in a speed build (§1, §8). The owner accepted strict at this run's sign-off, which clears the "Waiting on a decision" item on [`docs/roadmap/wp51-function-references.md`](../../docs/roadmap/wp51-function-references.md).

**The spec is the design note.** §2 is the rule (§2.1 admitted, §2.2 refused, §2.3 lowering, §2.4 timing), §5 the semantics (`--emit-ts` identity, C ABI, `-g`, rolling freeze), §6 every place that leaned on "no function values", §9 stage 1 and its construct checklist table. This plan does not restate them. Where this plan and the note disagree, the note wins and the PR body says where.

## Approach

**One stage, one PR.** §9 defines stage 1 as one PR that "does not ship until its per-place pass and `fnref_place_set` do". Its pieces form a chain: the emitter, the refusals, the tests and the docs all consume the checker's sets and dispatchers. Splitting it would buy no parallelism, only a second hand-off through `main`, and a language rule cannot land half-admitted. So this run has one worker.

**Strict only.** No `--compat` gate. `src/` uses no reference until the release after this one ships (§5.4, the rolling freeze; CI's `bootstrap` job checks it).

## Stage 1

**Owns:** `src/**`, `tests/**`, `docs/**`, `scalar.config.json`, `.claude/*.md`, `.github/workflows/ci.yml`

`.github/workflows/ci.yml` is owned only to install `gdb`/`lldb` on the `test` job if the debugger test needs them (no gdb or lldb test exists in `tests/run.js` today). `.claude/*.md` is owned only for pointer sweeps (CLAUDE.md: "Moving where a fact lives moves every pointer"). `std/`, `runtime/` and `scripts/` are not owned. If the work turns out to need them, push what you have, open the PR as a draft, and say so.

### Types and the C boundary

§9's checklist rows 3 and 11. In a type position outside a parameter, a function type is an `i32` tag: `llvmType` `i32`, `alignOf` 4, assignable by signature, resolved at `src/annotations.ts:224`. `cType`/`tsKeyword` in `src/interop-abi.ts`, `wasmType` in `src/interop-wasm.ts`, and the N-API readers and boxers in `src/interop-napi.ts` each **refuse** it with `reject_fnref_ffi`'s code rather than leave it unmapped (§5.2). Also refused: any function reachable from a host-visible signature that takes a reference.

### Sets and dispatchers

§2.3 and §2.4. Pass 1 collects `F(S)` from value-position names, numbered in declaration order from 1, with 0 reserved for stage 2's `null`. After pass 2, the per-place pass computes `F(p)` for every place in §2.3's table: locals, parameters, field declarations, `S[]` element types and returns. Interface fields take the union over their implementing classes. Any store context the pass does not model adds `F(S)`. The checker then generates one dispatcher per distinct set as an ordinary checked function, last arm `default`. It records every reference call, as a call of its dispatcher, and every arm call in `nodeCallees`, before `src/ranges.ts`, the attribute fixpoint, the region rules or the emitter read them. A set of one is a direct call. The two-hop argument alignment (tag is param 0, argument `i` is param `i + 1`) is in §2.3.

### Refusals

§2.2's table, §2.1's zero-fill rows, and §9's rows 4–5. Each gets a new code in `src/codes.ts` and a `tests/wordings/` program. The **escape-join refusal** runs after the attribute fixpoint: a call whose set mixes a member that keeps an argument with one that does not is a compile error naming the member and the store (case B's program is `reject_fnref_escape_join`). A set past eight members gets a `performance`-class warning naming the stores that widened it. NL2336, NL2334 and NL2337 are reworded per §6, along with their programs (`nl2336_fnarg_arrow_returned`, `nl2334_fnarg_parameter_as_value`, `nl2337_fnarg_function_type_element`). A generic `new Array<T>(n)` inside `std/threads.ts` with `T` a reference type is refused at the user's call, as `src/parallel.ts:925` does for NL2520 (§10). Every wording or IR move that changes a nish-cmp corpus program gets a narrow `DECLARED` entry in `tests/nish-cmp.js`.

### Emitter

§9 row 6 and §2.3. The dispatcher is written as `$ref.S.p` with named blocks (`sw.case.N`, `sw.default`), a reference call lowers to a direct call of it, and `===`/`!==` lower to `icmp`. Under `--profile debug` only, the dispatcher opens with the tag range check and a panic; a speed or size build's `.ll` contains no check. An empty set lowers to `llvm.trap` + `unreachable`. **Cross-module:** each module that calls through a place gets an `internal` copy of its dispatcher. A member stored into a place another module reads gets `hidden` linkage through a flag `takesEntryFacts` does not read, so it keeps its call-site entry facts. Stage 1 settles §2.3's two open decisions (the trap arm: keep `default`, as measured in §4.4; hidden members keep entry facts) and records them in the design note.

### Debug info

§5.3. A reference's DWARF type is an enumeration of its set's members. The dispatcher is an artificial subprogram, so stepping into a reference call lands in the member. Add a debugger check to `tests/run.js` that steps into a reference call under gdb and under lldb and pins where it stops. It prints a SKIP line, never a failure, when the debugger is absent. If CI's `test` job lacks a debugger, install it there.

### Docs

§9 row 10. Replace "a function is not a value" (`docs/LANGUAGE.md` ~1585) and the function-type rules (~3337, ~3392, ~3409), citing tests. Add a `docs/cookbook/` snippet with the dispatcher's IR and its marker in `docs/IR_COOKBOOK.md`, regenerated with `docs/cookbook/regen.sh` against `build/nish`. Add a `docs/guide/` page on function references with its route in `scalar.config.json`, and rewrite `docs/guide/language/functions.md:195`. Rewrite §6's broken rows in the docs they name. Grep `docs/` (including `docs/guide/`), `.claude/` and `src/` comments for every statement of the old rule. Regenerate `docs/reference/` with `node scripts/gen-reference.mjs`. On [`docs/roadmap/wp51-function-references.md`](../../docs/roadmap/wp51-function-references.md), tick stage 1, move **Next** to stage 2, and clear "Waiting on a decision". Update the WP51 row of [`docs/roadmap/index.md`](../../docs/roadmap/index.md) to "In progress, 2 of 4", and its Up next line.

## Tests

The full list is §9 row 9. In brief:

| Kind | Cases |
| --- | --- |
| goldens (`.ts`, `.ll`, `llvm-as`, `.out`) | `fnref_field`, `fnref_array`, `fnref_eq`, `fnref_escape_join` (case A), `fnref_place_set` (case C: `u0..u2` in the hot place, `u3` in another; golden pins the dispatcher over `{u0,u1,u2}` and `P` an `alloca` in `run`, plus the empty-set variant) |
| per store-context row | one test per row of §2.3's table, storing `u3` through that row's form into the hot place, so the golden shows `u3` in the set |
| profiles | every `fnref_*` runs in speed and `--profile debug`; `fnref_debug_check` panics on a forged tag in debug and has no check in the speed `.ll` |
| memory | `fnref_place_set` and `fnref_escape_join` at 10x their loop length with peak RSS pinned equal |
| link | `tests/link/fnref_cross_module`: dispatcher copy, the member's `hidden` linkage, its entry facts in the `.ll` |
| negatives | `reject_fnref_capture`, `_generic`, `_ffi` (a `declare function`, an open-world export, `--no-strict-exports`, a field reachable from a host-visible signature), `_print`, `_zero_fill`, `_rest`, `_async`, `_json`, `_escape_join` (case B) |
| flipped | `reject_fnarg_field`, `_local`, `_return_type`, `_alias`, `_store`, `_return` and `reject_arrow_as_value`, each rewritten to the refusal that remains |
| emit-ts | one `tests/emit-ts/` fixture for `===` (§5.1) |
| debugger | gdb and lldb step into a reference call (skips when absent) |

Generated: `node tests/self/goldens.js --update`; `node tests/differential/goldens.js --update` per new positive case; `tests/differential/emit-ts-known.txt` only under Node 22.23.4; `node tests/diagnostic-coverage.js --update` for `.err` pins. The PR body shows the exact LLVM IR for every TypeScript snippet the PR adds to the tests (CLAUDE.md).

## Out of scope

Stage 2 (references as arguments to function-typed parameters, `S | null`, `Map` values, `reject_fnarg_not_name`), stage 3 (capture-free arrows in value position), closures, `Function`, references across the C ABI, and any use of references inside `src/`.

## Verification

The stage's `verification` line. `node tests/run.js <filter>` matches by substring. Run `rm -rf build/test` first when comparing counts. CI's eight `test` shards are the full-suite gate.

## Acceptance criteria

Derived from the WP51 design note's §1, §2 and §9 and the owner's sign-off (the run started from "pick up WP51", not from written requirements):

1. A program that stores capture-free top-level functions in a class field, a local, an array element and a function's return, then calls through each, compiles with `build/nish` and prints the expected output natively; `===`/`!==` between references print the expected booleans.
2. That program's `--emit-ts` output, run under Node, prints the same stdout as the native binary.
3. In its `.ll`, which passes `llvm-as` and `opt -passes=verify`, every call through a reference is a direct call to a generated `$ref.*` dispatcher function whose body is a `switch` with direct calls in each arm. No indirect call (`call` through a `ptr` value) appears.
4. Case C: a hot place holding `u0..u2`, with `u3` stored only into another place, compiles to a dispatcher over exactly `{u0,u1,u2}`. The object passed through it stays an `alloca`, and peak RSS is the same at 1x and 10x the loop length.
5. Case B (one member keeps an argument, another in the same set does not) is a compile error whose message names the keeping member and the store that put it in the set.
6. A default (speed) build's dispatcher has no tag check in its `.ll`. A `--profile debug` build panics when given a tag outside the set.
7. Each still-refused form fails to compile with its own NL code: capturing arrow, generic function, `declare function` / host-visible signature, printing or `JSON` of a reference, zero-filled `new Array<S>(n)`, rest/default parameters, `async` function, `<`/arithmetic on a reference.
8. A two-module program that stores a function of module A into a place read and called in module B compiles, links and prints the expected output.
9. Under `-g`, a debugger stepping into a call through a reference stops in the member function.
10. A call site whose set exceeds eight members compiles, with a `performance` warning naming the stores that widened it.
11. Programs that never use a function reference compile to the same IR as before (nish-cmp passes with only the PR's `DECLARED` entries, and `tests/cases` goldens with no reference are unchanged).
12. `docs/LANGUAGE.md` no longer states that a function is not a value. A `docs/guide/` page on function references exists and is routed in `scalar.config.json`. The WP51 roadmap page shows stage 1 ticked, and `gen-reference --check` and `check-links` pass on `main`.

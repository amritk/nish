---
name: WP33 — Option<T>, absence for every type, nesting included
overview: Add a built-in Option<T> with Some(x) and None — narrowed like Result, never allocated, and allowed for every payload including T | null and another Option — so generic code and scalars can say "no value" and "found a null" apart, which T | null cannot. A non-nullable pointer payload lowers exactly as T | null; everything else as a found bit and the value. Queued after WP32; a design note settles the open questions with evidence first.
stages:
  - id: wp33-note
    title: docs(bench) — the WP33 Option design note and its evidence
    goal: Decide Q1–Q16 in docs/wp33-option.md with evidence — a checked tsc corpus, IR sketches, the Node shim's behaviour, and measured prototypes — and compare Option against the two alternatives before any compiler change.
    verification: npm run check && node bench/run.mjs --only option --validate && node tests/run.js bench && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: o-note
        content: Write docs/wp33-option.md answering Q1–Q16 with a recommendation, evidence and rejected alternatives for each — see Stage S1
        status: pending
      - id: o-compare
        content: Compare Option against scalar T | null and a generalised WP32 maybe with the nesting, generics and fidelity evidence — see Why Option
        status: pending
      - id: o-tsc
        content: Add a checked tsc corpus under docs/wp33/ for every accepted and refused spelling, including DOM and script-mode collisions — see Stage S1
        status: pending
      - id: o-protos
        content: Add bench/option_proto_* programs (sentinel, niche, Result pair after O2) with a Node twin and matching checksums — see Stage S1
        status: pending
  - id: option-scalar
    title: feat(checker) — Option<T> for scalar payloads, with Some and None
    goal: Option<T> for every payload that is not a non-nullable pointer, as locals, parameters and returns of functions no host can call — typed from context, narrowed like Result, lowered as a found bit and the value, and never allocated.
    verification: npm run check && node tests/run.js option_ && node tests/run.js reject_option && node tests/run.js arr_bounds_option && node tests/differential/unmodified.js --compiler build/nish && npm test (zero non-environmental skips)
    todos:
      - id: s-type
        content: Add K_OPTION (the next free kind after WP32 S3) to self/types.ts with state-keyed interning, the some. tag, alignOf, typeName and llvmType — see Stage S2
        status: pending
      - id: s-annot
        content: Resolve Option<T> in self/annotations.ts after every declared and imported name, with the payload rules and a not-yet code for a pointer payload — see Stage S2
        status: pending
      - id: s-ctor
        content: Type Some(x) (inferred with no context) and None (context only, after user names) in self/option.ts and self/program.ts — see Stage S2
        status: pending
      - id: s-surface
        content: Check some, value, isSome, isNone, unwrapOr, expect with eager arguments, and the refusals — see Stage S2
        status: pending
      - id: s-gate
        content: Refuse Option in fields, elements, Result payloads, type arguments, module constants, function types and host-visible signatures — see Position gate
        status: pending
      - id: s-lower
        content: Lower the pair in self/emit_option.ts (const and param as SSA, let as an alloca) with a zero payload for None — see Stage S2
        status: pending
      - id: s-analyses
        content: Teach attributes.ts, escape.ts, bounds.ts, generics.ts canonicalArgument and a minimal debug.ts typeRef about the pair — see Stage S2
        status: pending
      - id: s-ambient
        content: Declare Option, Some and None in runtime/nish.d.ts, shim.mjs and nish.mjs, with the TS2339 check for reject_option_value_unchecked — see Stage S2
        status: pending
      - id: s-tests
        content: Add f64-mode option_ goldens with Node agreement, rejects, wordings, the cookbook entry, DECLARED, unfrozen.txt and LANGUAGE.md — see Stage S2
        status: pending
  - id: option-pointer
    title: feat(codegen) — a pointer Option<T> is T | null in the same bits
    goal: Option<T> for a non-nullable pointer payload (class, interface, array, string) lowers exactly as T | null, with every escape, attribute and interop analysis routed through one representation rule, so it is exactly as sound and as fast as a nullable.
    verification: npm run check && node tests/run.js option_ && node tests/run.js mem_ && node tests/run.js option_niche_equal && npm test (zero non-environmental skips)
    todos:
      - id: p-repr
        content: Implement the note's representation rule (reprOf, or K_NULLABLE with an option flag) across the 16 files that read nullables — see Stage S3
        status: pending
      - id: p-escape
        content: Make Some(p), value, unwrapOr and expect flow-through in attributes.ts and escape.ts, and a call returning a pointer Option a pointer result — see Stage S3
        status: pending
      - id: p-tests
        content: Add option_string, option_class, option_interface, option_escape goldens and the IR-equality check against the Node | null twin — see Stage S3
        status: pending
  - id: option-flow
    title: feat(checker) — orReturn and okOr on Option, and Option in fields and generics
    goal: orReturn() propagates None, okOr(e) converts to Result, and an Option may be a class field, a generic type argument and a Map value, with the note's in-memory layout and every analysis taught it.
    verification: npm run check && node tests/run.js option_ && node tests/run.js gen_option && node tests/run.js map_ && node tests/run.js dbg_option && npm test (zero non-environmental skips)
    todos:
      - id: f-orreturn
        content: Check and lower orReturn on Option with the enclosing-return rule, Node divergence noted and the shim naming it — see Stage S4
        status: pending
      - id: f-okor
        content: Add okOr(e) to Result conversion with the same eager argument rule — see Stage S4
        status: pending
      - id: f-memory
        content: Lift the gate for fields, type arguments and Map values with the note's inline layout (structs.ts, generics.ts, parallel.ts reachingPath) — see Stage S4
        status: pending
      - id: f-generics
        content: Prove first<T>(xs) at every payload kind, nullable and nested included, and full DWARF for Option — see Stage S4
        status: pending
  - id: option-abi
    title: feat(interop) — Option across the host boundary
    goal: A host-visible function may take and return Option<T> with the note's public ABI, bridged by --emit-header, --emit-dts, --emit-napi and wasm.
    verification: npm run check && node tests/run.js option_export && node tests/run.js interop_ && npm test (zero non-environmental skips)
    todos:
      - id: a-abi
        content: Implement the public ABI for exported functions, methods of exported classes, hidden functions and --no-strict-exports, lifting the S2 gate — see Stage S5
        status: pending
      - id: a-bridges
        content: Bridge Option in interop_abi.ts, interop_header.ts, interop_dts.ts, interop_napi.ts and interop_wasm.ts, mirroring Result — see Stage S5
        status: pending
  - id: option-adopt
    title: feat(std) — lookup, nullable conversions and find, with Option across the docs
    goal: std gains lookup(m, k), fromNullable, toNullable and find, the docs give one rule for T | null versus Option<T>, and BENCHMARKS.md shows Option costs what a sentinel costs.
    verification: npm run check && node tests/run.js option_ && node tests/run.js map_lookup && node bench/run.mjs --only option && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: d-std
        content: Add lookup to std/map.ts and fromNullable, toNullable and find to a new std/option.ts, each Node-faithful and one probe or one pass — see Stage S6
        status: pending
      - id: d-docs
        content: Update README's comparison row, AI.md, NL2010's wording, LANGUAGE.md cross-links and examples/option.ts — see Stage S6
        status: pending
      - id: d-bench
        content: Record Option against the sentinel and Result in BENCHMARKS.md and bench/instructions.json — see Stage S6
        status: pending
---

# WP33 — `Option<T>`

Pinned to `main` at **e5e0cfe** (#230). Line references are that commit's unless marked.

## Context

Nish has two ways to say "no value", and neither works for a number in generic code.

- **`T | null`** ([LANGUAGE.md → Nullable types](../../docs/LANGUAGE.md#nullable-types)) exists only for pointers (class, interface, array, string), because `null` is the spare pointer value (`resolveNullableUnion`; NL2010 refuses `i32 | null`). In a generic function it is legal only if every instantiation is a pointer.
- **WP32's maybe** (`Map.get` → `V | undefined`, [docs/wp32-map.md](../../docs/wp32-map.md) §3.2; `K_MAYBE` on `feature/wp32-map/map-get`) covers every `V`. But it lives only in a `const`, a `??` or an `=== undefined`, and it never crosses a call.
- **`Result<T, E>`** (WP16/WP17) is the one built-in wrapper. It has the narrowing engine, `orReturn()`, must-handle, and a packed-word ABI; wp18 §6.1 is why it is built in.

So `first<T>(xs: T[])` cannot answer "empty" at `T = i32`, and `indexOf` still answers `-1`. The user asked for Rust's answer.

## Why `Option` — the comparison the note must make

[README.md](../../README.md) :234 describes Nish's null handling as "Kotlin and C# nullable reference types: flow narrowing, not a wrapper type", against "Rust's `Option<T>`". Adding a wrapper needs a reason the two unwrapped alternatives cannot supply.

| | (a) generalise WP32's `V \| undefined` | (b) allow `i32 \| null` (a found bit) | `Option<T>` |
| --- | --- | --- | --- |
| TypeScript idiom | yes, and `tsc --strict` enforces it | yes | no; a declared type, as `Result` is |
| New global names | none | none | `Option`, `Some`, `None`, all shadowable |
| Node fidelity | `===` works | `===` works | `===` must be refused; `orReturn` diverges, as `Result`'s does |
| **Nesting** | collapses: "absent" and "present `undefined`" are one value | collapses: `first<T>` at `T = Node \| null` cannot tell "empty" from "held a null" | **distinct**: `Some(None)` ≠ `None`; `Option<Node \| null>` holds a null |
| Cost to the language | reverses wp23 §9, where banning `undefined` is "a permanent property"; pulls in `?.` and optional parameters | turns NL2010 into an acceptance; the smallest change | a third spelling of absence, with a rule for when to use it |

**The reason is nesting in generic code.** `lookup<K, V>` over a `Map<string, Node | null>` (a map WP32 supports), and `first<T>` over `(Node | null)[]`, must say "found a null" and "found nothing" apart. Only a wrapper does that.

So `Option` allows every payload that makes sense (Q1), nested `Option` and `T | null` included. A refusal that removed nesting would remove the reason for the WP. The note makes the comparison with this evidence and records (b) as the smaller change it rejects.

## Decisions the note confirms or overturns (recommendations)

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | Payloads | Everything except `void` and `CPtr`. Nested `Option`, `T \| null`, interfaces (`Iface \| null` is legal; LANGUAGE.md :371) and enums are all allowed. `Option<Result<…>>` and `Result<Option<…>, E>` are refused with a not-yet code in v1, because must-handle inside a payload needs its own rule; this is the one deferral, and the note justifies it. |
| Q2 | Representation | A **non-nullable pointer** payload is the pointer, with `null` = `None` (Rust's niche). **Everything else** is `{ i1, T }`. A nested niche or a `T \| null` payload is a pair whose `T` is the inner representation. The note shows the IR for `i32`, `f64`, `bool`, an enum, `Node \| null`, `Option<i32>`, `string` and a class. |
| Q3 | The pair's `None` payload | Zero, not `undef`. That keeps `noundef` everywhere (no private-ABI exemption as `Result`'s needs at attributes.ts :2374/:2488) and makes S5's packed word deterministic. |
| Q4 | Pair storage | A `const` or a parameter is two SSA values, as WP32's `emitMaybeLocal` does. A `let` or a loop-carried value is an `alloca { i1, T }`: the emitter builds no phis, and mem2reg does. It is never `nish_alloc_struct`. |
| Q5 | Surface | `Some(x)`, `None`, `o.some`, `o.isSome()`, `o.isNone()`, `o.value` only where proven, `unwrapOr(d)`, `expect(msg)`, `orReturn()` (S4), `okOr(e)` (S4). Refused, each naming the fix: `unwrap`, `map` and friends (wp16 §6), `===`/`!==` (natively a niche compare would say `Some(n) === Some(n)` where Node says false; the refusal names `isNone()`), a template hole, `+`, mutation of `some`/`value`, truthiness (already NL-refused), and a `Map` key. |
| Q6 | Argument evaluation | **Eager**, as JavaScript and Rust evaluate `unwrapOr(d)`, `expect(msg)` and `okOr(e)`. The emitter may sink a *pure, non-panicking* argument into the `None` arm as an optimisation. `Result`'s lazy `unwrapOr`/`expect` (LANGUAGE.md :2594) already diverges from Node, measured by the review: native skips the argument's side effect, Node runs it. That is a separate `fix` for `Result`, filed, not done here. Eager also removes the need for a lazy-argument rule in `bounds.ts`; S2's `arr_bounds_option_*` cases pin that the argument counts as run. |
| Q7 | Typing `Some`/`None` | `Some(x)` with a concrete context takes it. With none, or with only a generic one (`describe(Some(3))`), it is `Option<typeof x>`, as `tsc` infers. `Some`'s and `unwrapOr`'s literal argument takes its type from the payload (`Some(3)` for `Option<u8>`). `Ok`'s no-context rule existed only for stage0 parity (result.ts :140), and the note records the matching `Result` relaxation as a follow-up. `None` needs a context, and `let o = None` is refused, naming an annotation (`tsc` gives TS2322 anyway). |
| Q8 | Name lookup | Innermost first: block scope, then parameters and type parameters, then module declarations and imports, then the built-in. `Option` resolves in `resolveReference` **after** struct templates, imports, aliases, enums and type names (annotations.ts :230 answers `Result` before them, and that ordering is wrong for `Option`). It is **not** added to `builtinTypeName`: reserving a name is a break under LANGUAGE.md :7–14 (precedent 5e5a9a9, `integer`). `Some` follows `isResultConstructor`'s placement after `ctx.signature` (expressions.ts :1102). `None` is resolved in `computeType`'s `N_IDENT` case after scope, constants and builtin imports. No NL3030 analogue: a built-in `Option` emits no `%struct.Option` and no C struct of that name. Diagnostics say "the built-in `Option<i32>`" when a user one exists. |
| Q9 | Must-handle | No, as Rust's `Option` is not `must_use`: a dropped `find()` loses nothing. `okOr` produces a `Result`, which carries its own rule. |
| Q10 | Kind, tag, codes | `K_OPTION` is the next free kind after WP32 S3 lands (19 on today's branch, where `K_MAYBE` = 18). The mangling tag is `some.`, since `opt.` is `T \| null` (types.ts :398) and user structs are `$`-prefixed. Every code is the band's next free number when the stage rebases on `main`; none is assigned in advance (WP32 S3 holds NL2361–NL2371 on its branch). |
| Q11 | Where it may live, by stage | S2: locals, parameters and returns of functions no host can call. S4: class fields, generic type arguments and `Map` values, with the inline layout decided here (clang `struct { bool some; T value; }`; cite #230's `inline_arrays.ts`/`FieldInfo.inline()`). Array elements: the note decides and measures `Option<i32>[]` at 8 bytes per element. `new Array<Option<i32>>(n)` zero-fills to `None` natively and leaves holes under Node, so arrays may stay refused in v1. |
| Q12 | `orReturn` under Node | It throws, as `Result`'s does: the rewriter was deleted in WP19 R6. The shim throws an `Error` whose message names `docs/RUN_UNDER_NODE.md`, not a bare marker object. The docs show the Node-faithful spelling `if (o.isNone()) { return None; }`, and the refusal in a `Result` function suggests `.okOr(e).orReturn()`. |
| Q13 | Pointer representation design | Pick either (a) `K_OPTION` plus one `table.reprOf(type)` helper that every emit and analysis layer calls, or (b) intern a pointer `Option` as `K_NULLABLE` with an option flag that only the checker's surface reads. List the sites either way: `isNullable`/`stripNull`/`K_NULLABLE` appear in 16 `self/` files. |
| Q14 | Public ABI (S5) | Pointer payload: the nullable pointer. A scalar of ≤4 bytes: the WP17 word. An 8-byte scalar (`i64`, `u64`, `f64`) or a nested pair: measure a C `struct { bool some; T value; }` returned in two registers against a pointer. The header, `.d.ts` (`{ some: true, value: T } \| { some: false }`), N-API and wasm spellings. `hidden` functions and `--no-strict-exports` take the public ABI, as `Result`'s do (emit.ts :332, emit_result.ts :338). |
| Q15 | Threads | A `parallelMapInto` return type is already a whitelist (number, boolean, enum), so an `Option` is refused there. `reject_par_result_type` is about a `string` callback, not `Result`. S4 adds `K_OPTION` to `reachingPath` (parallel.ts :293) when fields are allowed. |
| Q16 | Relation to WP32's maybe | They stay separate. `lookup(m, k)` is the bridge, and `??` stays the maybe's alone. |

**The `tsc` evidence already gathered.**
- **Accepted and narrowed** (the lead and the review, `tsc --strict` 5.9.3):
  - `None` against `Option` of a class, `string`, `boolean` and `i32`;
  - `Some(None)` as `Option<Option<i32>>`, with nested narrowing;
  - the generic `first<T>`;
  - `return c ? Some("a") : None`;
  - an early `if (o.isNone()) return`, `if (o.some)`, `!o.some`, `o.some && o.value`, and `!o.isSome()`;
  - `okOr` → `Result`.
- **Refused:**
  - an unproven `.value` (TS2339);
  - a mismatched payload (TS2322);
  - assigning `.some` (TS2540);
  - `let o = None; o = Some(1)` (TS2322).
- **Collisions:** `"lib": ["DOM"]` does not collide, since DOM's `Option` is a value. A script-mode file (no import/export) collides with TS2300/TS2451; every Nish module exports, so the d.ts header notes it.
- **The declaration:** `None` is declared `OptionNone & OptionMethods<never>`, so `None.isSome()` cannot narrow to a `never` value arm.

## Stage S1 — wp33-note

**Owns:**
- `docs/wp33-option.md` (new) and `docs/wp33/` (the `tsc` corpus);
- a row in `docs/README.md`'s index and in `docs/MASTER_PLAN.md` "Next";
- `bench/option_proto_*` and `bench/option_node.mjs` (new), plus the `option` group in `bench/run.mjs`;
- `tests/run.js` (the bench-validate hunk);
- `tests/self/goldens/checked.txt`: new `bench/*.ts` files are corpus programs, as `map_proto` was.

No compiler change.

**The note answers:**
- Q1–Q16;
- the comparison above;
- the `Result` follow-ups it uncovers: the lazy-argument divergence, and `Ok`'s no-context rule.

**The prototypes** are Nish programs, since `bench/run.mjs` builds `.ts`. Nish has no by-value struct to hand-lower a pair with, but `Result<i32, u8>` under the private ABI already *is* `{ i1, i32, i8 }` in registers (`res_by_value.ll`). So the pair is measured through it after `opt -O2`.

| Prototype | Shape |
| --- | --- |
| `option_proto_sentinel` | a search answering `-1` |
| `option_proto_pair` | the same search answering a private-ABI `Result<i32, u8>` |
| `option_proto_niche` | a `Node \| null` search |

- **The workload:** 10k keys, half absent, summing what is found.
- **Node agreement:** a Node twin prints the same checksum, and `--validate` checks all of them.
- **The claim to test:** the pair and the niche each cost what the sentinel costs, within the instruction gate's tolerance.

## Stage S2 — option-scalar (the pair)

**Owns:**
- **Compiler:** [self/types.ts](../../self/types.ts), [self/annotations.ts](../../self/annotations.ts), [self/option.ts](../../self/option.ts) (new), [self/emit_option.ts](../../self/emit_option.ts) (new), [self/program.ts](../../self/program.ts) (the `None` side table), [self/expressions.ts](../../self/expressions.ts), [self/members.ts](../../self/members.ts), [self/statements.ts](../../self/statements.ts), [self/emit.ts](../../self/emit.ts), [self/escape.ts](../../self/escape.ts), [self/attributes.ts](../../self/attributes.ts), [self/bounds.ts](../../self/bounds.ts), [self/generics.ts](../../self/generics.ts), [self/structs.ts](../../self/structs.ts), [self/constants.ts](../../self/constants.ts), [self/debug.ts](../../self/debug.ts), [self/interop_abi.ts](../../self/interop_abi.ts) (explicit `""` answers from `cType`/`tsKeyword`, with a comment), [self/codes.ts](../../self/codes.ts) (and `RULE_COUNT`).
- **Runtime:** [runtime/nish.d.ts](../../runtime/nish.d.ts), [runtime/shim.mjs](../../runtime/shim.mjs), [runtime/nish.mjs](../../runtime/nish.mjs).
- **Tests:**
  - `tests/cases/option_*`, `reject_option_*`, `arr_bounds_option_*`, `dbg_option`, `tests/wordings/nl2*_option*`;
  - `tests/run.js` (the TS2339 check beside the WP16 hunk at :7509; the later "every accepted case" check at :7589 already covers positive `option_*`);
  - `tests/nish-cmp.js` (`DECLARED`, whose changelog words match the PR subject);
  - `tests/differential/goldens/unfrozen.txt`.
- **Docs:** `docs/LANGUAGE.md` (the Option section and the types-table row), `docs/IR_COOKBOOK.md` + `docs/cookbook/option_pair.ts`, `docs/RUN_UNDER_NODE.md`.
- The regenerated stores.

A pointer payload is refused in S2 with a not-yet code; S3 lifts it.

**The work, site by site** (from the research map and the review):

| Piece | Where | What |
| --- | --- | --- |
| kind and interning | types.ts `internAll` :274 | key `K_OPTION` by its proof state (`O_UNKNOWN`/`O_SOME`/`O_NONE`, reusing `states[t]`), as `K_RESULT` is. Otherwise the narrowed and unnarrowed types intern as one id. `alignOf` answers the payload's alignment, not the default 8. |
| annotation | annotations.ts `resolveReference` | `resolveOption` placed after declared and imported names (Q8), with Q1's payload rules |
| constructors | new `self/option.ts`, expressions.ts :1102 and `computeType` `N_IDENT` | `checkSomeConstructor` with Q7's inference; `None` resolved last, from `want` |
| surface and narrowing | option.ts, members.ts, expressions.ts `narrow` :895 | `checkOptionProperty`/`checkOptionMethod`; `narrowOptionTest` chained after `narrowResultTest`; immutability as members.ts :446 |
| lowering | new `self/emit_option.ts`, emit.ts `emitVarDecl`/`emitIdentifier` | Q4's shapes, following WP32's `emitMaybeLocal`. A ternary's `phi` of `llvm(type)` already works for `{ i1, T }` (emit_control.ts :354). |
| attributes | attributes.ts | `noundef` on the pair (Q3); a `collectOptionFacts` recording `expect`'s `nish_write`/`nish_exit` (the `collectResultFacts` twin, :1328–1390); a scalar pair in `returnsScalar` (:1592) |
| escape | escape.ts `isScalarArgument` :958 | a scalar pair whitelisted, so tail marking, loop arena passes (:1296) and parity with the sentinel survive |
| bounds | bounds.ts | with Q6 eager, the argument of `unwrapOr`/`expect` is walked as always run. `arr_bounds_option_unwrap_or`/`_expect` pin that a check is not lost. |
| generics | generics.ts `canonicalArgument` :312 | drop the proof state for `K_OPTION` as for `Result`, or a narrowed `Option` makes a second instantiation with the same symbol |
| DWARF | debug.ts `typeRef` :253 | a minimal two-member composite. Otherwise `-g` on any `Option` local hits `internalErrorFor` (exit 70). |
| Node | shim.mjs, nish.mjs | `NishOption` with `some`/`value`, a frozen `None` singleton, and `provide("Some"/"None")`. `provide` never overrides a module's own name. |

### Position gate

`resolveType` does not know where a type sits, so S2 refuses every position it cannot lay out. Each refusal has a code and a `reject_option_*` case:
- a class or interface field (`_field`);
- an array element (`_element`);
- a `Result` payload (`_in_result`);
- a generic type argument (`_type_argument`);
- a `Map` value (`_map_value`) or key (`_map_key`, which is never lifted, because keys compare by identity under Node);
- a module constant (`_module_const`);
- a function-type parameter (`_function_type`);
- a **host-visible** signature (`_export`).

**Host-visible** means an exported function or a method of an exported class, which is what `cType` bridges. `hidden` functions and `--no-strict-exports` are S5's. Nish-to-Nish calls within a module use the pair. An `export` is host-visible, so cross-module `Option` also waits for S5.

**Tests:**
- **Positive**, each with `.ll`, `llvm-as`, `.out`, `--number-mode f64` in `.args` and `export const main`, so `tests/differential/unmodified.js` runs them against Node (it runs nothing else: :59):
  - `option_find_f64`, `option_i32_payload` (through `toI32`), `option_bool`, `option_enum`, `option_nullable_payload`, `option_nested`;
  - `option_narrow` (every form in Result's table, with `some`/`isSome`/`isNone`);
  - `option_unwrap_or`, `option_expect`, `option_eager_argument` (native and Node print the same side effect);
  - `option_infer` (`describe(Some(3))`), `option_shadow_local` / `_param` / `_type_param` / `_module` (a user `Option`, `Some` or `None` wins);
  - `arr_bounds_option_*`, `dbg_option` (`-g`).
- **Reject:** one per refused form and position in Q5 and the gate, plus `_value_unchecked` (also TS2339 under `tsc`), `_let_none`, `_payload_mismatch`, `_nullish` and `_console_log` (existing codes reused where they apply).
- **Acceptance 2's IR check:**
  - the `.ll` of a function returning `Option<i32>` has no `nish_alloc_struct` or `nish_arena_*` call caused by the `Option`, and returns `{ i1, i32 }`;
  - after `opt -O2 -S -mtriple=x86_64-unknown-linux-gnu`, the function has no `alloca` and no call.

  Precedent for such checks: tests/run.js :2088, :2649.

## Stage S3 — option-pointer (the niche)

**Owns:** [self/types.ts](../../self/types.ts), [self/annotations.ts](../../self/annotations.ts), [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/attributes.ts](../../self/attributes.ts), [self/escape.ts](../../self/escape.ts), [self/expressions.ts](../../self/expressions.ts), [self/members.ts](../../self/members.ts), [self/generics.ts](../../self/generics.ts), [self/debug.ts](../../self/debug.ts), [self/interop_abi.ts](../../self/interop_abi.ts), and whichever of the 16 nullable-reading files Q13's design touches. Also `tests/cases/option_*` and `reject_option_*`, the cookbook `option_niche`, and docs.

**Soundness sites** (from the review; each would be a miscompile if missed):
- **`classifyArgumentUse`** (attributes.ts :785): an argument to `Some(…)` falls through to `USE_NONE` today, so `(p: Node) => Some(p)` would mark `p` `nocapture`. A caller's `calleeCaptures` (escape.ts :611) would then stack-allocate a `new Node()` that is returned, which is a use-after-return. `Some(x)` is flow-through, like `N_PAREN`.
- **Member reads** (attributes.ts :748): `o.value`, `o.unwrapOr(d)` and `o.expect(m)` on a pointer `Option` *are* the pointer, so they flow through; they are not `USE_READ`.
- **`isPointerResult`** (escape.ts :485–496): a call returning a pointer `Option` is a pointer result. Otherwise an automatic arena scope releases returned memory, the `mem_read_or_null_scope` bug class.
- **Q13's representation rule** at every `stripNull`/`isNullable`/`isPointerParam` site. That is what makes the parameter attributes (attributes.ts :2380, :1052–1064) match a nullable's.

**Tests:**
- `option_string`, `option_class` and `option_interface` (a `Point[]` element).
- `option_escape_returned`: `Some(new Node())` returned is `nish_alloc_struct`, not an `alloca`.
- `option_escape_param`: `wrap(p) => Some(p)` leaves `p` without `nocapture`.
- **`option_niche_equal`:** two written programs, `Node | null` / `null` / `p !== null` / `p` against `Option<Node>` / `None` / `o.isSome()` / `o.value`. Their `define` bodies must be identical without `-g`, after stripping value names. DWARF type names differ, and so does mangling where the `Option` type is itself a type argument.

## Stage S4 — option-flow

**Owns:** [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/structs.ts](../../self/structs.ts), `self/inline_arrays.ts`, [self/emit_classes.ts](../../self/emit_classes.ts), [self/generics.ts](../../self/generics.ts), [self/parallel.ts](../../self/parallel.ts), [self/escape.ts](../../self/escape.ts), [self/attributes.ts](../../self/attributes.ts), [self/debug.ts](../../self/debug.ts), [self/checker.ts](../../self/checker.ts) (the perf gate), [self/codes.ts](../../self/codes.ts). Also `tests/cases/option_*`, `gen_option_*`, `map_option_*`, `tests/layout/`, and docs.

**`orReturn()`** mirrors `checkOrReturn`/`emitOrReturn`:
- it branches on the flag;
- the `None` arm runs `emitScopeExit` and returns `None` in the function's own shape;
- it is refused in a non-`Option` function, and in a `Result` function the refusal suggests `.okOr(e).orReturn()`;
- the Node divergence goes in RUN_UNDER_NODE.md and in `unmodified.js`'s `KNOWN`.

**`okOr(e)`** builds a `Result<T, E>`. Its argument is eager (Q6).

**Memory positions**, with the gate lifted:
- class fields, with Q11's layout and `tests/layout/` extended;
- generic type arguments, including `Map<string, Option<i32>>` values;
- arrays, only if Q11 says yes.

Property paths still do not narrow, so a field `Option` is copied to a local first, as a `T | null` field is today. `reachingPath` gains `K_OPTION`.

**Generics:** `first<T>(xs)` at `i32`, `f64`, `bool`, `string`, a class, an interface, `Node | null` and `Option<i32>` (`gen_option_*`). Also full DWARF (`optionComposite`, beside `resultComposite` :423).

## Stage S5 — option-abi

**Owns:** [self/emit_option.ts](../../self/emit_option.ts), [self/emit.ts](../../self/emit.ts), [self/emit_classes.ts](../../self/emit_classes.ts), [self/interop_abi.ts](../../self/interop_abi.ts), [self/interop_header.ts](../../self/interop_header.ts), [self/interop_dts.ts](../../self/interop_dts.ts), [self/interop_napi.ts](../../self/interop_napi.ts), [self/interop_wasm.ts](../../self/interop_wasm.ts), [self/attributes.ts](../../self/attributes.ts), [self/debug.ts](../../self/debug.ts) (`optionWord`). Also `tests/cases/option_export*` and `tests/run.js`'s interop hunks, mirroring "WP17: a `Result` across the host boundary" (:5175–5368).

**The work:**
- **The ABI:** Q14's public ABI for every host-visible signature, `hidden` and `--no-strict-exports` included, which lifts the S2 gate. It must stay in sync with the `internal` linkage decision (emit.ts :355–364), as `privateResultAbi` does.
- **The header:** `Option<Node>` is `struct Node *`, which may be `NULL`; a small scalar is a `nish_option_<T>_word` typedef with a size assert; an 8-byte scalar per Q14.
- **The other bridges:** `.d.ts` is the tagged union; N-API and wasm box and unbox, mirroring `napiResultBoxer`/`wasmResultPack`.
- **Tests:** a `-Werror` C driver, the N-API addon and a wasm build, round-tripping `Option` of `i32`, `f64` and a class.

If Q14 leaves the 8-byte question open, this stage splits off as its own WP, as WP16 did from WP17.

## Stage S6 — option-adopt

**Owns:** `std/map.ts`, `std/option.ts` (new), `std/README.md`, `.github/workflows/release.yml` (the std presence gates), `tests/cases/map_lookup_*`, `tests/cases/std_option_*`, `examples/option.ts` (new), `docs/AI.md`, `README.md` (the comparison row), `self/codes.ts` (NL2010's wording only), `docs/LANGUAGE.md` cross-links, `docs/IR_COOKBOOK.md`, `docs/BENCHMARKS.md`, `bench/option_*`, `bench/instructions.json`.

**Depends on:** S5 (a std function is an export) and WP32's S3 and S5 (`get`, and `std/map.ts`).

**`lookup`:**
```ts
export const lookup = <K, V>(m: Map<K, V>, k: K): Option<V> => {
  const v = m.get(k);
  return v === undefined ? None : Some(v);
};
```
- Legal under `tsc`, faithful under Node, and one probe natively, because `get` is. The IR check is exactly one `probe` call.
- At `V = Node | null`, it answers `Some(null)` for a stored null.

**`std/option.ts`:**
- `fromNullable(p: T | null): Option<T>` and `toNullable(o: Option<T>): T | null`, which are free under the niche;
- `find(xs, (x) => …)`, using the compile-time function parameters #213 landed.

**The rule the docs give:** `T | null` for fields and links between objects; `Option<T>` for the result of an operation that may find nothing, and for any generic or scalar absence.
- The README row becomes "flow narrowing for references; `Option<T>` for results and generic code".
- NL2010's wording points at `Option<i32>`.

**Benchmarks:**
- `examples/option.ts` compiles with `-o` and `--link`, matches Node, and passes `tsc --strict`.
- `BENCHMARKS.md` re-runs S1's prototypes as real `Option` programs.

## Merge order

S1 → S2 → S3 → S4 → S5 → S6.
- S3 and S4 could overlap only if Q13 picks (a).
- The WP starts after WP32 closes, because it takes the kind number and codes after WP32 S3's, and builds on `emitMaybeLocal`.

## Acceptance

1. `first<T>(xs: T[]): Option<T>` compiles at `i32`, `f64`, `bool`, `string`, a class, an interface, `Node | null` and `Option<i32>`. Each passes `tsc --strict`, and each f64-mode build prints what Node prints.
2. A non-exported function returning `Option<i32>`:
   - makes no allocator or arena call because of the `Option`;
   - returns `{ i1, i32 }`;
   - after `opt -O2` has no `alloca` and no call;
   - is within the instruction gate's tolerance of the `-1` sentinel version.
3. The `option_niche_equal` pair of programs has identical `define` bodies (Stage S3).
4. An unproven `o.value` is refused by `nish` and by `tsc` (TS2339).
5. Every refused form and position has a `reject_option_*` case and a stable code.
6. `unwrapOr`, `expect` and `okOr` evaluate their argument exactly as Node does (`option_eager_argument`, f64 mode).
7. `orReturn()` propagates `None` natively. Its Node divergence is in RUN_UNDER_NODE.md and `KNOWN`, and the shim's error names that page.
8. Programs that name none of `Option`, `Some` or `None` are byte-identical: no existing golden moves, and `nish-cmp` shows 0 undeclared differences.
9. Each of these compiles as before natively, under `tsc` and under Node, so the change is not breaking:
   - a user class, alias, enum or function named `Option`;
   - a `function Some`;
   - a `const None`;
   - an imported `Option`;
   - a local, parameter or type parameter of any of the three names;
   - a user `Option` in one module beside the built-in in another.
10. Exported `Option<i32>`, `Option<f64>` and `Option<Node>` functions round-trip through C, N-API and wasm.
11. `lookup(m, k)` is one probe natively, matches Node, and tells a stored `null` from absence.
12. The perf gate stays at zero warnings for std and the examples, and `-g` compiles every `option_*` case.
13. README, AI.md and LANGUAGE.md state one rule for when to use `T | null` and when `Option<T>`.

## Out of scope

- Combinators as methods (`map`, `andThen`, `filter`). They need function values; `std/option.ts`'s `find` is the only top-level one here.
- `?.` and `??` on an `Option`.
- An implicit conversion from a maybe or a `T | null`.
- `Option<Result>` and `Result<Option>` (Q1's deferral).
- Changing `Map.get`, `pop()` or any existing return type.
- `match`.
- Restoring the Node rewriter.
- The `Result` follow-ups the note files: eager `unwrapOr`/`expect`, and contextual `Ok` payloads.

## Verification (every stage)

The definition of done:
- `npm run check`;
- `npm test`, undegraded (only environmental skips);
- `npm run lint`, no worse than `main`;
- `node docs/check-links.mjs` when Markdown changes;
- the PR title passes `node scripts/changelog-gen.mjs --check-subject`;
- the stage's own verification line.

`tests/differential/unmodified.js` needs `npm run build` first, and `npm test` runs it (tests/run.js :10695).

Every construct stage ships its golden `.ll`, `llvm-as`, native `.out`, a `reject_*` case per form, the wording, the `LANGUAGE.md` rule and its cookbook entry in the same PR.

**The rolling freeze:** `self/` does not use `Option`. New `self/` files only regenerate `tests/self/goldens/checked_self.txt`.

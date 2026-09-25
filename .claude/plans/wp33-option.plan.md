---
name: WP33 — Option<T>, absence for every type, modelled on Result
overview: Add a built-in Option<T> with Some(x) and None — narrowed like Result, propagated with orReturn(), and never allocated — so generic code and scalars can say "no value", which T | null (pointer types only) cannot. A pointer payload lowers exactly as T | null; a scalar one as a found bit and the value. Queued after WP32; a design note settles the open questions with evidence before any compiler change.
stages:
  - id: wp33-note
    title: docs(bench) — the WP33 Option design note and the lowering prototypes
    goal: Decide every open question in docs/wp33-option.md with evidence — tsc corpus, IR sketches and hand-written prototypes that need no compiler change — and place Option beside T | null and WP32's maybe type.
    verification: npm run check && node tests/run.js bench && node bench/run.mjs --only option --validate && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: o-note
        content: Write docs/wp33-option.md answering Q1–Q12, each with a recommendation and its evidence — see Stage S1
        status: pending
      - id: o-tsc
        content: Add the ambient Option block to a scratch d.ts and a tsc corpus proving every accepted spelling type-checks and every refused one fails — see Stage S1
        status: pending
      - id: o-protos
        content: Add bench/option_proto_* hand-lowered prototypes (sentinel, Result, pair, niche) with a Node twin and matching checksums — see Stage S1
        status: pending
  - id: option-core
    title: feat(checker) — Option<T>, Some and None, narrowed as Result is
    goal: Option<T> type-checks and lowers for locals, parameters and returns of non-exported functions, with Some/None typed from context, isSome/isNone/.some narrowing, unwrapOr and expect, a pointer payload lowered as T | null and a scalar one as an SSA pair.
    verification: npm run check && node tests/run.js option_ && node tests/run.js reject_option && node tests/differential/unmodified.js --compiler build/nish && npm test (zero non-environmental skips)
    todos:
      - id: c-type
        content: Add K_OPTION to self/types.ts with interning, mangling tag, typeName, assignable and llvmType per the note — see Stage S2
        status: pending
      - id: c-annot
        content: Resolve Option<T> in self/annotations.ts with the note's payload refusals and name shadowing — see Stage S2
        status: pending
      - id: c-ctor
        content: Type Some(x) and None from context in a new self/option.ts, mirroring checkResultConstructor and the null literal — see Stage S2
        status: pending
      - id: c-surface
        content: Check some, value, isSome, isNone, unwrapOr, expect and the refusals (equality, templates, mutation) — see Stage S2
        status: pending
      - id: c-narrow
        content: Hook narrowOptionTest into the narrow default case beside narrowResultTest — see Stage S2
        status: pending
      - id: c-lower
        content: Lower the niche and pair representations in a new self/emit_option.ts, with emit.ts, escape.ts and attributes.ts taught the shape — see Stage S2
        status: pending
      - id: c-ambient
        content: Declare Option, Some and None in runtime/nish.d.ts and runtime/shim.mjs plus nish.mjs, and extend the WP16 tsc hunk to option_ cases — see Stage S2
        status: pending
      - id: c-tests
        content: Add option_ goldens, reject_option_ cases, wordings, DECLARED entries and the LANGUAGE.md section — see Stage S2
        status: pending
  - id: option-flow
    title: feat(checker) — orReturn and okOr on Option, fields and generic payloads
    goal: orReturn() propagates None from a function returning Option, okOr(e) converts to Result, and an Option may be a class field and a generic payload, with every analysis (bounds, escape, DWARF, perf gate) taught the new kind.
    verification: npm run check && node tests/run.js option_ && node tests/run.js gen_ && node tests/run.js dbg_ && npm test (zero non-environmental skips)
    todos:
      - id: f-orreturn
        content: Check and lower orReturn on Option, including the enclosing-return rule and the Node divergence note — see Stage S3
        status: pending
      - id: f-okor
        content: Add okOr(e) to Result conversion, lazy in e as unwrapOr is — see Stage S3
        status: pending
      - id: f-fields
        content: Allow Option fields per the note's in-memory layout, with immutability and narrowing rules for property paths unchanged — see Stage S3
        status: pending
      - id: f-generics
        content: Make Option<T> work in generic functions and classes at every instantiation, including first<T>(xs) for scalar and pointer T — see Stage S3
        status: pending
      - id: f-analyses
        content: Teach bounds.ts, generics.ts origin tracking, parallel.ts, debug.ts DWARF and the perf gate about K_OPTION — see Stage S3
        status: pending
  - id: option-abi
    title: feat(interop) — Option across the host boundary
    goal: An exported function may take and return Option<T>, with the note's public ABI (nullable pointer for a pointer payload, packed word for a small scalar) and matching --emit-header, --emit-dts, --emit-napi and wasm bridges.
    verification: npm run check && node tests/run.js option_export && node tests/run.js interop_ && npm test (zero non-environmental skips)
    todos:
      - id: a-abi
        content: Implement the public by-value ABI for exported Option per the note, lifting S2's not-yet refusal — see Stage S4
        status: pending
      - id: a-bridges
        content: Bridge Option in interop_header.ts, interop_abi.ts, interop_dts.ts, interop_napi.ts and interop_wasm.ts, mirroring Result's — see Stage S4
        status: pending
  - id: option-adopt
    title: feat(std) — lookup(m, k) and Option across the docs, examples and benchmarks
    goal: std/map.ts gains lookup(m, k) returning Option<V> in one probe, the docs say when to use T | null and when Option<T>, and BENCHMARKS.md shows Option costs what a sentinel costs.
    verification: npm run check && node tests/run.js option_ && node tests/run.js map_lookup && node bench/run.mjs --only option && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: d-lookup
        content: Add lookup(m, k) to std/map.ts with a Node-faithful body that compiles to one probe — see Stage S5
        status: pending
      - id: d-docs
        content: Update README's comparison table, AI.md, LANGUAGE.md cross-links, IR_COOKBOOK and examples/option.ts — see Stage S5
        status: pending
      - id: d-bench
        content: Record option vs sentinel vs Result in BENCHMARKS.md and bench/instructions.json — see Stage S5
        status: pending
---

# WP33 — `Option<T>`

## Context

Nish says "no value" two ways today, and neither covers a number in generic code:

- **`T | null`** ([LANGUAGE.md → Nullable types](../../docs/LANGUAGE.md#nullable-types)) exists only for a class, interface, array or string, because `null` is a spare pointer value (`resolveNullableUnion`, [self/annotations.ts](../../self/annotations.ts) :387; NL2010 for `i32 | null`). In a generic function, `T | null` is legal only if *every* instantiation is a pointer.
- **WP32's maybe** (`Map.get` → `V | undefined`, [docs/wp32-map.md](../../docs/wp32-map.md) §3.2) covers every `V`, but only as a `const`, a `??` operand or an `=== undefined` operand; it never crosses a call. The note says relaxing that "would be a new ABI shape".
- **`Result<T, E>`** ([LANGUAGE.md → Result](../../docs/LANGUAGE.md#result-and-error-handling), WP16/WP17) is the one built-in wrapper, with the narrowing engine, `orReturn()`, a must-handle rule and a packed-word ABI that wp18 §6.1 says no library type can declare.

So `first<T>(xs: T[])` cannot say "empty" for `T = i32`, and `indexOf` still answers `-1`. The user asked for Rust's answer: `Option<T>`.

**The stance it has to answer.** [README.md](../../README.md) :234 lists Nish's null handling as "Kotlin and C# nullable reference types: flow narrowing, not a wrapper type", against "Rust's `Option<T>`". This WP keeps that for references: a pointer `Option<T>` *is* `T | null`, in the same bits. What it adds is the wrapper where there is no spare value to use, which is Rust's own niche rule.

## Approach — decisions taken with the user, and the recommendations the note must confirm or overturn

- **A built-in, like `Result`; not a std class.** A library `Option<T>` cannot narrow, cannot `orReturn`, cannot be typed from context (`None` has nothing to infer from; `reject_generic_function`), and is always a heap or stack object (wp18 §6.1, LANGUAGE.md generic-class rules). Every one of those is why `Result` is built in.
- **`Map.get` keeps `V | undefined`** (JavaScript's own signature, which `tsc` and Node fix). `Option` reaches maps through a std function, `lookup(m, k)` (S5).
- **No combinators as methods.** A method cannot take a function (`reject_fnarg_method`), and wp16 §6 declined `map`/`andThen` on purpose. Narrowing plus `orReturn()`/`unwrapOr()` covers them, as it does for `Result`. Top-level std combinators taking a compile-time function argument are possible and are out of scope here.
- **Recommended representation** (the note measures it): a pointer payload is the pointer, with `null` as `None` (Rust's niche). A scalar payload is `{ i1, T }`, carried as two SSA values or a first-class aggregate and never allocated. That is cheaper than `Result`'s arena object, which is a win only because an `Option` has one payload and no error arm.

## Stage S1 — wp33-note

**Owns:**
- `docs/wp33-option.md` (new), plus rows in `docs/README.md`'s index and `docs/MASTER_PLAN.md` "Next".
- `bench/option_proto_*` (new), `bench/option_node.mjs` (new), and the `option` group in `bench/run.mjs`.
- `tests/run.js` (the bench-validate hunk only).

No compiler change.

**The note answers each question with a recommendation, the evidence, and the alternatives it rejected:**

| # | Question | Recommendation to test |
| --- | --- | --- |
| Q1 | Which `T` may `Option<T>` hold? | Every `T` except `void`, `T \| null`, `Option`, `Result`, an interface (stored inline, would be copied) and a `CPtr`. Each refusal gets a code. `Result<Option<T>, E>` is considered and probably deferred. |
| Q2 | Representation | Pointer `T`: the pointer, `null` = `None`, so the bits of `T \| null`. Scalar `T`: `{ i1, T }` by value, never allocated. Show the IR for `i32`, `f64`, `bool`, an enum, `string` and a class. |
| Q3 | Where may one live in S2, S3 and S4? | S2: locals, params, returns of non-exported functions. S3: class fields (inline `{ i8 some; T value }` at clang layout for a scalar, the pointer for a pointer) and generic payloads. S4: exported signatures. Array elements: decide, with the layout cost of `Option<i32>[]` (8 bytes per element) measured. |
| Q4 | Surface | `Some(x)`; `None`; `o.some`; `o.isSome()`/`o.isNone()`; `o.value` only where proven; `unwrapOr(d)`; `expect(msg)`; `orReturn()`; `okOr(e)`. `value` on unproven is refused. The note justifies each against Rust's and `Result`'s, and lists what is refused (`unwrap`, `map`, `===`, templates, mutation). |
| Q5 | Typing of `Some`/`None` | From context, like `Ok`/`Err` and `null`. `Some`'s payload is checked without context, as `Ok`'s is (`reject_res_ok_f64`). A `let o = None` with no annotation is refused, naming the annotation. |
| Q6 | Names and breakage | `Option`, `Some` and `None` are built-in but shadowable: a user's own declaration wins in its module, as `Ok`/`Err` do and as WP32's `Map` does. So no existing program changes meaning, and the change is `feat`, not `feat!`. Check `builtinTypeName` ([self/annotations.ts](../../self/annotations.ts) :432), which today *reserves* `Result`, and decide whether `Option` joins it (that would be a break) or shadows. A user `Option` in one module beside the built-in in another: refuse as NL3030 does for `Map`? |
| Q7 | Mangling | A new tag, because `opt.` is `T \| null` ([self/types.ts](../../self/types.ts) :397). Propose `some.`, and check it against every symbol grammar (`interop_generic_fn`'s `nish_gen_*` names). |
| Q8 | Must-handle? | `Result` must be handled (NL2025/NL2032). Rust's `Option` is not `must_use`. Recommend not, and say why, since a dropped `find()` loses nothing. |
| Q9 | `orReturn()` | Propagates `None` from a function returning `Option<U>`; refused elsewhere, naming the fix. Under Node it throws, as `Result`'s does: the rewriter was deleted in WP19 R6 (`tests/differential/goldens/rewrites.txt` is frozen), so this is a documented divergence, not a gap S2 can close. |
| Q10 | Public ABI (S4) | Pointer `T`: the nullable pointer. Scalar of ≤4 bytes: the WP17 word (bits 0..31 flag, 32..63 payload). An 8-byte scalar (`i64`, `u64`, `f64`): measure a C `struct { bool some; T value; }` returned in two registers against a pointer, and pick one. The header, `.d.ts` (`{ some: true, value: T } \| { some: false }`), N-API and wasm spellings. |
| Q11 | Relation to WP32's maybe | Keep them separate: the maybe is TypeScript's own `V \| undefined` for `get`, and `Option` is the portable wrapper. `lookup(m, k)` is the bridge. Could `const o: Option<V> = m.get(k) ?? None`-style conversion exist? Probably not in v1. |
| Q12 | Threads | Follow `Result`'s rule in `nish/threads` bodies (`reject_par_result_type`); pointer `Option` as `T \| null` does. |

**`tsc` evidence.** The lead checked the shape below under `tsc --strict` 5.9.3:
- `return None` in any `Option<T>` function, `Some(None)`, `if (o.isSome())`, `if (o.some)` and an early `if (o.isNone()) return` all type-check and narrow;
- an unproven `o.value` is TS2339;
- `unwrapOr` and `orReturn` type-check.

The note keeps that as a checked corpus. `lib.dom` declares a *value* `Option` (`HTMLOptionElement`); ours is a type, so the two do not collide. The note proves it with `"lib": ["DOM"]`.

```ts
type OptionSome<T> = { readonly some: true; readonly value: T };
type OptionNone = { readonly some: false };
interface OptionMethods<T> {
  isSome(): this is OptionSome<T> & OptionMethods<T>;
  isNone(): this is OptionNone & OptionMethods<T>;
  orReturn(): T;
  unwrapOr(fallback: T): T;
  expect(message: string): T;
  okOr<E>(error: E): Result<T, E>;
}
type Option<T> = (OptionSome<T> | OptionNone) & OptionMethods<T>;
declare function Some<T>(value: T): Option<T>;
declare const None: Option<never>;
```

**Prototypes.** Four hand-written programs of the same workload: search an `i32[]` for 10k keys, half absent, and sum what is found.

| Prototype | What it is | Question it answers |
| --- | --- | --- |
| `option_proto_sentinel` | returns `-1` | the baseline |
| `option_proto_result` | returns `Result<i32, void>`-shaped, via `Result<i32, u8>` | today's closest |
| `option_proto_pair` | a hand-lowered `{ i1, i32 }` | S2's scalar shape |
| `option_proto_niche` | a `Node \| null` search | the pointer shape |

- A Node twin prints the same checksum.
- `bench/run.mjs --only option --validate` checks all five.
- **The claim to test:** the pair costs what the sentinel costs, within the instruction-count tolerance.

## Stage S2 — option-core

**Owns:**
- **Compiler:** [self/types.ts](../../self/types.ts), [self/annotations.ts](../../self/annotations.ts), [self/option.ts](../../self/option.ts) (new), [self/emit_option.ts](../../self/emit_option.ts) (new), [self/expressions.ts](../../self/expressions.ts), [self/members.ts](../../self/members.ts), [self/statements.ts](../../self/statements.ts), [self/emit.ts](../../self/emit.ts), [self/escape.ts](../../self/escape.ts), [self/attributes.ts](../../self/attributes.ts), [self/codes.ts](../../self/codes.ts).
- **Runtime:** [runtime/nish.d.ts](../../runtime/nish.d.ts), [runtime/shim.mjs](../../runtime/shim.mjs), [runtime/nish.mjs](../../runtime/nish.mjs).
- **Tests:**
  - `tests/cases/option_*`, `tests/cases/reject_option_*`, `tests/wordings/nl2*_option*`;
  - `tests/run.js` (the WP16 ambient hunk at :7408, extended to `option_`);
  - `tests/nish-cmp.js` (`DECLARED`).
- **Docs:** `docs/LANGUAGE.md` (a new "Option" section beside Result, and the types-table row), `docs/RUN_UNDER_NODE.md`.
- The regenerated stores.

**Modelled file by file on `Result`** (research map, origin/main at 0e466d5):

| Piece | Result's | Option's |
| --- | --- | --- |
| kind, intern key, proof state | `K_RESULT`, `R_OK`/`R_ERR` in `states[t]` (types.ts :110, :123) | `K_OPTION = 18`, with `O_SOME`/`O_NONE` reusing the `states` column |
| annotation | `resolveResult` (annotations.ts :358) | `resolveOption`, with Q1's refusals |
| constructors | `checkResultConstructor` (result.ts :114), with the user-signature-first lookup (expressions.ts :1102) | `checkSomeConstructor`; `None` beside the `null` literal's contextual typing |
| surface | `checkResultProperty` / `checkResultMethod` (result.ts :171, :308) | the same, over Q4's list |
| narrowing | `narrowResultTest` (result.ts :346), called from `narrow`'s default (expressions.ts :895) | `narrowOptionTest`, chained after it |
| immutability | members.ts :446 | the same rule |
| lowering | `emit_result.ts` (pointer object) | `emit_option.ts`: the niche (a pointer compare), and the pair (`insertvalue`/`extractvalue`, or two SSA values), with no `nish_alloc_struct` ever |
| escape and attributes | escape.ts :408–497, attributes.ts :2343–2493 | a pair is a value, not an allocation site; `noundef` rules per the note |

**An exported signature holding an `Option`** is refused in S2 with a named not-yet code (NL2361 or the real next free). S4 lifts it. WP32 did the same with `get` (NL2357).

**Tests:**
- **Positive, each with `.ll`, `llvm-as` and `.out`:**
  - `option_find_i32`, `option_find_f64`, `option_bool`, `option_enum`, `option_string`, `option_class` (the golden shows the `T | null` IR);
  - `option_narrow` (every narrowing form in the Result table, with `some`/`isSome`/`isNone`);
  - `option_unwrap_or`, `option_expect`.
- **Negative:** one `reject_option_*` per refused form: unproven `value`, each excluded payload, `===`, a template hole, assignment to `some`/`value`, `let o = None` with no annotation, `Some` with no context, a mismatched payload, an exported signature, and each shadowing clash.
- **Node:** every `option_*` case with an entry point runs through `tests/differential/unmodified.js` (the only live Node check since R6).
- **`tsc`:** every `option_*` case type-checks against `nish.d.ts`, and `reject_option_value_unchecked` fails `tsc` with TS2339, as `reject_result_value_unchecked` does (tests/run.js :7408–7460).

## Stage S3 — option-flow

**Owns:**
- **Compiler:** [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/generics.ts](../../self/generics.ts), [self/bounds.ts](../../self/bounds.ts), [self/parallel.ts](../../self/parallel.ts), [self/debug.ts](../../self/debug.ts), [self/structs.ts](../../self/structs.ts), [self/emit_classes.ts](../../self/emit_classes.ts), [self/escape.ts](../../self/escape.ts), [self/attributes.ts](../../self/attributes.ts), [self/checker.ts](../../self/checker.ts) (the perf gate), [self/codes.ts](../../self/codes.ts).
- **Tests:** `tests/cases/option_*`, `reject_option_*`, `gen_option_*`, `dbg_option`.
- **Docs.**

**What this stage adds:**
- **`orReturn()`**, mirroring `checkOrReturn`/`emitOrReturn` (result.ts :230, emit_result.ts :516): a branch on the flag; the `None` arm runs `emitScopeExit` and returns `None` in the function's own shape.
- **`okOr(e)`**, which builds a `Result<T, E>`. `e` is evaluated only on the `None` arm, as `unwrapOr`'s fallback is (bounds.ts :1585 `lazyResultMethod`). The note must reconcile that with Node, where arguments are evaluated eagerly: refuse a fallback with side effects, or document the divergence.
- **Fields.** The field layout comes from the note. Property paths still do not narrow, so reading a field `Option` needs a local copy first, as `T | null` fields do today (LANGUAGE.md → Nullable types).
- **Generics.**
  - `Option<T>` in a generic function or class, at every instantiation;
  - `unifyAnnotation` (generics.ts :551);
  - origin tracking through the payload (`unwrapsOk`, generics.ts :2516);
  - the headline `first<T>(xs: T[]): Option<T>`, instantiated at `i32`, `f64`, `string` and a class, where the class instantiation must equal the `T | null` IR.
- **DWARF:** `optionComposite`, beside `resultComposite` (debug.ts :416).
- **The perf gate:** std and the examples stay at zero warnings.

## Stage S4 — option-abi

**Owns:**
- **Compiler:** [self/emit_option.ts](../../self/emit_option.ts), [self/emit.ts](../../self/emit.ts), [self/interop_abi.ts](../../self/interop_abi.ts), [self/interop_header.ts](../../self/interop_header.ts), [self/interop_dts.ts](../../self/interop_dts.ts), [self/interop_napi.ts](../../self/interop_napi.ts), [self/interop_wasm.ts](../../self/interop_wasm.ts), [self/attributes.ts](../../self/attributes.ts), [self/debug.ts](../../self/debug.ts) (`optionWord`).
- **Tests:** `tests/cases/option_export*`, and the interop hunks in `tests/run.js` mirroring "WP17: a `Result` across the host boundary" (tests/run.js :5074–5266).
- **Docs.**

**What this stage adds:**
- The public ABI chosen in Q10. The private ABI must stay in sync with the `internal` linkage decision (emit.ts :355–364), as `privateResultAbi` is (emit_result.ts :338).
- **The `--emit-header` spellings:**
  - `Option<Node>` is `struct Node *`, which may be `NULL`;
  - a small scalar is a `nish_option_<T>_word` typedef, with a size assert as `NISH_RESULT_ASSERT` has;
  - a larger scalar is spelled per Q10.
- **`--emit-dts`:** the tagged union.
- **`--emit-napi` and wasm:** boxing and unboxing, mirroring `napiResultBoxer`/`wasmResultPack`.
- **Tests:** a `-Werror` C driver, the N-API addon, and a wasm build, each asserting the round trip.

## Stage S5 — option-adopt

**Owns:** `std/map.ts`, `tests/cases/map_lookup_*`, `examples/option.ts` (new), `docs/AI.md`, `README.md` (the comparison table), `docs/LANGUAGE.md` cross-links, `docs/IR_COOKBOOK.md` and `docs/cookbook/option_*`, `docs/BENCHMARKS.md`, `bench/option_*`, `bench/instructions.json`.

**Depends on:** WP32's S3 (`get`) and S5 (which creates `std/map.ts`).

**What this stage adds:**
- **`lookup(m, k)`:**
  ```ts
  export const lookup = <K, V>(m: Map<K, V>, k: K): Option<V> => {
    const v = m.get(k);
    return v === undefined ? None : Some(v);
  };
  ```
  - That body is legal under `tsc`, runs under Node, and under Nish is one probe, because `get` is.
  - The IR check: exactly one `probe` call.
- **Docs:**
  - **When to use which:** `T | null` for references, links and fields that hold objects; `Option<T>` for generic code, scalars, and "found or not" results. The README row becomes "flow narrowing for references; `Option<T>` where no null exists".
  - **Cookbook:** entries for the niche and the pair.
- **`examples/option.ts`:** compiles with `-o` and `--link`, matches Node, and passes `tsc --strict`.
- **`BENCHMARKS.md`:** the S1 prototypes re-run as real Nish, with `Option<i32>` against the `-1` sentinel and against `Result`.

## Merge order

S1 → S2 → S3 → S4, and S3 → S5. S4 and S5 can run concurrently. The whole WP starts after WP32 closes: S2 builds on WP32 S3's `undefined` and narrowing changes in `self/expressions.ts`, and S5 needs `std/map.ts`.

## Acceptance

1. `first<T>(xs: T[]): Option<T>` compiles at `i32`, `f64`, `bool`, `string` and a class. Each prints what Node prints and passes `tsc --strict`.
2. A non-exported function returning `Option<i32>` allocates nothing: no `nish_alloc_struct` and no struct `alloca` in its IR. Its instruction count is within the gate tolerance of the `-1` sentinel version.
3. `Option<Node>` compiles to the same IR as `Node | null`, the program otherwise equal.
4. An unproven `o.value` is refused by both `nish` and `tsc`.
5. Every refused form has a `reject_option_*` case and a stable code.
6. `orReturn()` propagates `None` natively, and its Node divergence is documented in `RUN_UNDER_NODE.md`.
7. Programs that name none of `Option`, `Some` or `None` are byte-identical: no existing golden moves, and `nish-cmp` shows 0 undeclared differences.
8. A program that declares its own `Option`, `Some` or `None` compiles as before, so the change is not breaking.
9. An exported `Option<i32>` function and an exported `Option<Node>` function round-trip through C, N-API and wasm.
10. `lookup(m, k)` is one probe natively and matches Node.
11. The performance gate stays at zero warnings for std and the examples.
12. README, AI.md and LANGUAGE.md say when to use `T | null` and when `Option<T>`.

## Out of scope

- Combinators (`map`, `andThen`, `filter`): as methods they need function values; as top-level std functions, a follow-up.
- `?.` and `??` on an `Option`; `??` stays WP32's, on the maybe only.
- Converting a WP32 maybe or a `T | null` to an `Option` implicitly.
- Changing `Map.get`, `pop()` or any existing API's return type.
- Pattern matching (`match`), which is not TypeScript.
- Restoring the Node rewriter for `orReturn`.

## Verification (every stage)

The repo's definition of done:
- `npm run check`;
- `npm test`, undegraded (only environmental skips);
- `npm run lint`, no worse than `main`;
- `node docs/check-links.mjs` when Markdown changes;
- the PR title passes `node scripts/changelog-gen.mjs --check-subject`;
- the stage's own verification line.

Every new construct ships with a golden `.ll`, an `llvm-as` pass, a native `.out`, at least one `reject_*` case, a wording, a `LANGUAGE.md` rule and a cookbook entry.

**The rolling freeze:** `self/` does not *use* `Option` until the next release.

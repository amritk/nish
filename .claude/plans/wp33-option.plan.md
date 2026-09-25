---
name: WP33 — Option<T>, absence for every type, nesting included
overview: Add a built-in Option<T> with Some(x) and None — narrowed like Result, never allocated, and allowed for every payload including T | null and another Option — so generic code and scalars can say "no value" and "found a null" apart, which T | null cannot. A non-nullable pointer payload lowers exactly as T | null; everything else as a found bit and the value. Queued after WP32; a design note settles the open questions with evidence first.
stages:
  - id: wp33-note
    title: docs(bench) — the WP33 Option design note and its evidence
    goal: Decide Q1–Q17 in docs/wp33-option.md with evidence — a checked tsc corpus, IR sketches, the Node shim's behaviour, and measured prototypes — and compare Option against the two alternatives before any compiler change.
    verification: npm run check && node bench/run.mjs --only option --validate && node tests/run.js bench && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: o-note
        content: Write docs/wp33-option.md answering Q1–Q17 with a recommendation, evidence and rejected alternatives for each — see Stage S1
        status: pending
      - id: o-compare
        content: Compare Option against scalar T | null and a generalised WP32 maybe with the nesting, generics and fidelity evidence — see Why Option
        status: pending
      - id: o-tsc
        content: Add a checked tsc corpus under docs/wp33/ for every accepted and refused spelling, including DOM, script-mode and TS2315 cases — see Stage S1
        status: pending
      - id: o-protos
        content: Add bench/option_proto_* programs (sentinel, niche, Result pair after O2) with a Node twin and matching checksums — see Stage S1
        status: pending
  - id: option-scalar
    title: feat(checker) — Option<T> for pointer-free payloads, with Some and None
    goal: Option<T> for payloads that contain no pointer (numbers, bool, enums, nested Options of those), as locals, parameters and returns of non-exported functions — typed from context, narrowed like Result, lowered as a found bit and the value, never allocated.
    verification: npm run check && node tests/run.js option_ && node tests/run.js reject_option && node tests/run.js ambient && node tests/run.js dbg_option && node tests/run.js option_debug && node tests/run.js diagnostics && node tests/differential/unmodified.js --compiler build/nish && npm test (zero non-environmental skips)
    todos:
      - id: s-type
        content: Add K_OPTION (next free kind after WP32 S3) to self/types.ts with state-keyed interning, the some. tag, alignOf, typeName and llvmType — see Stage S2
        status: pending
      - id: s-annot
        content: Resolve Option<T> at the two insertion points in resolveReference, with payload rules, the TS2315 twin and a not-yet code for pointer-holding payloads — see Stage S2
        status: pending
      - id: s-ctor
        content: Type Some(x) and None as O_UNKNOWN, inferring Some with no context, None after every user name, and ternary arms from each other — see Stage S2
        status: pending
      - id: s-surface
        content: Check some, value, isSome, isNone and the refusals, and teach unifyAnnotation, containsType and originOfMember about Option — see Stage S2
        status: pending
      - id: s-gate
        content: Refuse Option in every position S2 cannot lay out, in exported signatures, under --no-strict-exports, and as Option | null — see Position gate
        status: pending
      - id: s-lower
        content: Lower the pair in self/emit_option.ts (const and param SSA, let alloca, None as zeroinitializer) with DWARF variables present — see Stage S2
        status: pending
      - id: s-ambient
        content: Declare Option, Some and None in runtime/nish.d.ts, shim.mjs and nish.mjs, with the TS2339 check in the ambient hunk — see Stage S2
        status: pending
      - id: s-tests
        content: Add option_ goldens (f64 and Node-compared, enum cases i32-only), rejects, wordings, the -g loop, cookbook, DECLARED, unfrozen.txt and LANGUAGE.md — see Stage S2
        status: pending
  - id: option-methods
    title: feat(checker) — unwrapOr and expect on Option, with arguments evaluated as JavaScript does
    goal: unwrapOr(d) and expect(msg) on a pointer-free Option, evaluating the argument eagerly as Node and Rust do, with every analysis keeping its facts across an Option method call so Option costs what a sentinel costs.
    verification: npm run check && node tests/run.js option_ && node tests/run.js arr_bounds_option && node tests/run.js option_o2 && npm test (zero non-environmental skips)
    todos:
      - id: m-methods
        content: Check and lower unwrapOr and expect with eager arguments, and record expect's exit in collectOptionFacts — see Stage S2b
        status: pending
      - id: m-analyses
        content: Make Option members inert in bounds.ts and a pointer-free pair scalar in escape.ts isScalarArgument and returnsScalar — see Stage S2b
        status: pending
      - id: m-tests
        content: Add option_eager_argument, arr_bounds_option_loop and friends, and the opt -O2 no-alloca no-call check — see Stage S2b
        status: pending
  - id: option-pointer
    title: feat(codegen) — Option<T> that holds a pointer, sound in every analysis
    goal: Every Option whose representation contains a pointer — the niche for a non-nullable pointer (exactly the bits of T | null), and pairs holding T | null or a nested niche — is admitted with one holdsPointer rule read by every escape, attribute and bounds site.
    verification: npm run check && node tests/run.js option_ && node tests/run.js mem_ && node tests/run.js option_niche_equal && npm test (zero non-environmental skips)
    todos:
      - id: p-repr
        content: Implement the representation rule (reprOf, or K_NULLABLE with an option flag carried into mangling) across the 18 nullable-reading files — see Stage S3
        status: pending
      - id: p-escape
        content: Make Some(p), value, unwrapOr, expect and unwrapOr's argument flow-through, and a call returning a pointer-holding Option a pointer result — see Stage S3
        status: pending
      - id: p-tests
        content: Add option_string, option_class, option_interface, option_nullable_payload, the escape goldens and the niche IR-equality hunk — see Stage S3
        status: pending
  - id: option-propagate
    title: feat(checker) — orReturn and okOr on Option, and Option through function arguments
    goal: orReturn() propagates None, okOr(e) converts to Result, and a compile-time function parameter may take or return an Option.
    verification: npm run check && node tests/run.js option_ && node tests/run.js option_fnarg && npm test (zero non-environmental skips)
    todos:
      - id: f-orreturn
        content: Check and lower orReturn on Option with the enclosing-return rule, the Node divergence noted and the shim naming it — see Stage S4a
        status: pending
      - id: f-okor
        content: Add okOr(e) with an eager argument, escaping when e is a pointer — see Stage S4a
        status: pending
      - id: f-fnarg
        content: Lift the function-type gate so a callback may take or return Option — see Stage S4a
        status: pending
  - id: option-memory
    title: feat(codegen) — Option in fields, arrays, generic arguments and Map values
    goal: An Option may be a class field, an array element, a generic type argument and a Map value, with the inline layout, its C header spelling, and WP32's maybe over an Option value.
    verification: npm run check && node tests/run.js option_ && node tests/run.js gen_option && node tests/run.js map_option && node tests/run.js layout && npm test (zero non-environmental skips)
    todos:
      - id: y-layout
        content: Lay out Option fields and elements inline per the note, with the header's struct spelling and tests/layout — see Stage S4b
        status: pending
      - id: y-generic
        content: Lift type arguments and Map values, fix zeroOf in emit_map.ts, and add reachingPath and full DWARF — see Stage S4b
        status: pending
      - id: y-tests
        content: Prove first<T> at every payload kind, Map<string, Option<i32>> with get, and refuse new Array<Option<T>>(n) — see Stage S4b
        status: pending
  - id: option-abi
    title: feat(interop) — Option across the host boundary
    goal: An exported function or a method of an exported class may take and return Option<T> with the note's public ABI, --no-strict-exports builds included, bridged by --emit-header, --emit-dts, --emit-napi and wasm.
    verification: npm run check && node tests/run.js option_export && node tests/run.js interop && npm test (zero non-environmental skips)
    todos:
      - id: a-abi
        content: Implement the public ABI for exported signatures and --no-strict-exports, lifting the S2 refusals — see Stage S5
        status: pending
      - id: a-bridges
        content: Bridge Option in interop_abi.ts, interop_header.ts, interop_dts.ts, interop_napi.ts and interop_wasm.ts, mirroring Result — see Stage S5
        status: pending
  - id: option-adopt
    title: feat(std) — lookup, nullable conversions and find, with Option across the docs
    goal: std gains lookup(m, k), fromNullable, toNullable and find, the docs give a decision procedure for T | null, V | undefined and Option<T>, and BENCHMARKS.md shows Option costs what a sentinel costs.
    verification: npm run check && node tests/run.js option_ && node tests/run.js map_lookup && node bench/run.mjs --only option && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: d-std
        content: Add lookup to std/map.ts and fromNullable, toNullable and find to a new std/option.ts, each Node-faithful and one probe or one pass — see Stage S6
        status: pending
      - id: d-docs
        content: Update README's comparison row, AI.md, NL2010's wording, LANGUAGE.md's decision procedure and examples/option.ts — see Stage S6
        status: pending
      - id: d-bench
        content: Record Option against the sentinel and Result in BENCHMARKS.md and bench/instructions.json — see Stage S6
        status: pending
---

# WP33 — `Option<T>`

Pinned to `main` at **e5e0cfe** (#230) and to WP32 S3's PR #232 (`feature/wp32-map/map-get`) at 9bf9650. Line references are those commits'. The plan went through four adversarial reviews (two on the draft, one on each revision); each finding it acts on is folded into the section it changes.

## Context

Nish has two ways to say "no value", and neither works for a number in generic code.

- **`T | null`** ([LANGUAGE.md → Nullable types](../../docs/LANGUAGE.md#nullable-types)) exists only for pointers (class, interface, array, string), because `null` is the spare pointer value. `resolveNullableUnion` refuses `i32 | null` with NL2010. In a generic function, `T | null` is legal only if every instantiation is a pointer.
- **WP32's maybe** (`Map.get` → `V | undefined`, [docs/wp32-map.md](../../docs/wp32-map.md) §3.2; `K_MAYBE` = 18 on the map-get branch) covers every `V`. But it lives only in a `const`, a `??` or an `=== undefined`, and it never crosses a call.
- **`Result<T, E>`** (WP16/WP17) is the one built-in wrapper. wp18 §6.1 is why it is built in.

So `first<T>(xs: T[])` cannot answer "empty" at `T = i32`, and `indexOf` still answers `-1`. The user asked for Rust's answer.

## Why `Option` — the comparison the note must make

[README.md](../../README.md) :234 describes Nish's null handling as "Kotlin and C# nullable reference types: flow narrowing, not a wrapper type", against "Rust's `Option<T>`". Adding a wrapper needs a reason the two unwrapped alternatives cannot supply.

| | (a) generalise WP32's `V \| undefined` | (b) allow `i32 \| null` (a found bit) | `Option<T>` |
| --- | --- | --- | --- |
| TypeScript idiom | yes, and `tsc --strict` enforces it | yes | no; a declared type, as `Result` is |
| New global names | none | none | `Option`, `Some`, `None`, all shadowable |
| Node fidelity | `===` works | `===` works | `===` refused; `orReturn` diverges, as `Result`'s does |
| **Nesting** | collapses: "absent" and "present `undefined`" are one value | collapses: `first<T>` at `T = Node \| null` cannot tell "empty" from "held a null" | **distinct**: `Some(None)` ≠ `None`; `Option<Node \| null>` holds a null |
| Cost to the language | reverses wp23 §9, where banning `undefined` is "a permanent property"; pulls in `?.` and optional parameters | turns NL2010 into an acceptance; the smallest change | a third spelling of absence, which needs a decision procedure |

**The reason is nesting in generic code.** `lookup<K, V>` over a `Map<string, Node | null>` (a map WP32 supports), and `first<T>` over `(Node | null)[]`, must say "found a null" and "found nothing" apart. Only a wrapper does that.

So `Option` allows nested payloads and `T | null` payloads (Q1). The note makes this comparison with the evidence, and records (b) as the smaller change it rejects.

## Decisions the note confirms or overturns (recommendations)

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | Payloads, and every refusal | **Where the rules are checked:** in the one constructor every `Option` type goes through (`table.optionOf`, called from annotations, from `Some` inference, from instantiation and from `okOr`'s result type), not only where a type is written — so `Some(r)` with `r: Result`, a template instantiated at `T = Result`, and (before S3) `Some("a")` all hit the same refusal as the written spelling. **Allowed:** any payload but `void` and `CPtr`. That includes nested `Option`, `T \| null`, interfaces (`Iface \| null` is legal, LANGUAGE.md :371) and enums. **Refused in v1, each with a code and a `reject_option_*` case:** `Option<Result<…>>` and `Result<Option<…>, E>`, since must-handle inside a payload needs its own rule; `Option<T> \| null`, since "`Option` already models absence" (Result's NL2151 twin, and under Q13 (b) it would collapse `None` and `null` into one bit pattern); `new Array<Option<T>>(n)`, since native zero-fills to `None` while Node leaves holes (a fill or a push is required); an `Option` map key and a `Set<Option<…>>` element (`sameKey` is `===` under Node, collections.ts :356+), and `indexOf` over an `Option` element (arrays.ts :199 accepts any element type; natively a pair compares by value, under Node by identity; Nish arrays have no `includes`) — all because keys and searches compare by identity under Node. `okOr` on an `Option<Option<U>>` would produce `Result<Option<U>, E>`, so it is refused with the same code as `_in_result` until that deferral lifts. Refused until a later stage, with not-yet codes: memory positions (S4b), host-visible signatures (S5), and `--no-strict-exports` (S5). |
| Q2 | Representation | A **non-nullable pointer** payload is the pointer, with `null` = `None` (Rust's niche). **Everything else** is `{ i1, T }`, where a nested niche or a `T \| null` payload is a pair whose `T` is the inner representation. **`holdsPointer(optionType)`** is true for the niche and for any pair whose payload contains a pointer; it is the one rule S3's analysis sites read. The note shows the IR for `i32`, `f64`, `bool`, an enum, `Option<i32>`, `Node \| null`, `string` and a class. |
| Q3 | The pair's `None` | `{ i1 false, T zeroinitializer }`, not `undef`. That keeps `noundef` everywhere, needing no private-ABI exemption as `Result`'s does (attributes.ts :2374/:2488), and makes S5's packed word deterministic. It is sound for every payload, an enum with no zero member and `-0` included, because the checker never reads an unproven payload and `unwrapOr` selects it away. |
| Q4 | Pair storage and shape | **A `const`:** two SSA values with no slot, like WP32's `emitMaybeLocal` (emit_map.ts :372 on the map-get branch), described in DWARF with `dbg.value`. **A parameter:** one `{ i1, T }` aggregate. Parameters are already SSA and immutable (emit.ts :1076–1080; reassignment is refused). **A `let` or a loop-carried value:** an `alloca { i1, T }`, left to mem2reg, because the emitter builds no phis. **Never** a `nish_alloc_struct` call. |
| Q5 | Surface | **Allowed:** `Some(x)`; `None`; `o.some`; `o.isSome()` and `o.isNone()`; `o.value` only where proven; `unwrapOr(d)` and `expect(msg)` (S2b); `orReturn()` and `okOr(e)` (S4a). **Refused, each naming the fix:** `unwrap` and `map` and friends (wp16 §6); `===`/`!==` (the refusal names `isNone()`; a niche compare would say `Some(n) === Some(n)` where Node says false); a template hole or `+`; mutation of `some` or `value`; truthiness (already refused). |
| Q6 | Argument evaluation | **Eager**, as JavaScript and Rust evaluate `unwrapOr(d)`, `expect(msg)` and `okOr(e)`. The emitter does not sink arguments itself; LLVM already sinks a pure one through the `select`. `Result`'s lazy `unwrapOr`/`expect` (LANGUAGE.md :2594) already diverges from Node: the review measured native skipping the argument's side effect while Node ran it. That is a separate `fix` the note files. Eager means `bounds.ts` walks the argument as always run, which is already its rule for call arguments (bounds.ts :1852–1910). The Option members must also be *inert* (Q17), or every call would wipe the length facts. |
| Q7 | Typing `Some`/`None` | **`Some(x)` with a concrete context:** takes that context. **With none, or only a generic one** (`describe(Some(3))`): `Option<typeof x>`, as `tsc` infers. `Some(3)` with no context is `Option<number>` in the mode's number, exactly as `const x = 3` is: `Option<i32>` in i32 mode, `Option<f64>` in f64 mode. A literal argument to `Some` or `unwrapOr` takes its type from the payload (`Some(3)` for `Option<u8>`); `Ok`'s no-context rule existed only for stage0 parity (result.ts :140), and the note files the `Result` relaxation. **`None`** needs a context, but a ternary supplies one: `checkConditional` checks the non-`None` arm first and makes its type the other arm's `want`, so `const o = c ? Some(1) : None` is accepted, as `tsc` accepts it. A bare `let o = None` is refused, naming an annotation. **Both produce the unknown state `O_UNKNOWN`,** so `const o = Some(3); o.value` is refused, as `tsc` refuses it (TS2339). |
| Q8 | Name lookup | **Innermost first:** block scope, then parameters and type parameters, then module declarations (functions, classes, enums, consts) and imports, then the built-in. **`resolveReference`** (annotations.ts :225–340) splits on argument count, so `Option` has two insertion points. **With arguments:** after `importNamed`; if an alias, enum, type name or type binding holds the name, refuse "`Option` is not generic" (a TS2315 twin, since `tsc` refuses a user non-generic `Option` used with arguments); otherwise `resolveOption`. **Without arguments**, at the tail: "`Option` needs one type argument". **Not in `builtinTypeName`:** reserving a name is a break under LANGUAGE.md :7–14 (precedent 5e5a9a9, `integer`). **`Some`** sits after `ctx.signature`, as `isResultConstructor` does (expressions.ts :1102). **`None`** resolves in `computeType`'s `N_IDENT` case after every user binding, a `class None` included (`tsc` gives TS2322 for one used as a value). **No NL3030 analogue:** a built-in `Option` emits no `%struct.Option` and no C struct of that name, so diagnostics just say "the built-in `Option<i32>`" when a user one exists. |
| Q9 | Must-handle | No. Rust's `Option` is not `must_use`, and a dropped `find()` loses nothing. `okOr` produces a `Result`, which carries its own rule. |
| Q10 | Kind, tag, codes | **Kind:** `K_OPTION` is the next free kind after WP32 S3 lands (19, since `K_MAYBE` = 18). **Tag:** `some.`, since `opt.` is `T \| null` (types.ts :398) and user structs are `$`-prefixed. Under Q13 (b) the mangling must carry the option flag, or `first<Option<Node>>` and `first<Node \| null>` share `opt.`. **Codes:** each is the band's next free number when the stage rebases on `main`, and none is assigned in advance (WP32 S3 holds NL2361–NL2371 on its branch). |
| Q11 | Memory layout (S4b) | **A field or an array element:** inline, as clang lays out `struct { bool some; T value; }`, citing #230's inline layout (`inline_arrays.ts`, `FieldInfo.inline()`); `Option<i32>[]` measured at 8 bytes per element. **The header** spells a field the same way (interop_header.ts :87–114 describes every class, interop_abi.ts :374–400). **A `Map` value** needs arrays, because `Map<K, V>` stores `entryValues: V[]` (std/collections.ts :234/:244). **WP32's `zeroOf`** (emit_map.ts ~:372–430) answers `0` for a pair today and must answer `zeroinitializer`. |
| Q12 | `orReturn` under Node | It throws, as `Result`'s does, because the rewriter was deleted in WP19 R6. The shim throws an `Error` whose message names `docs/RUN_UNDER_NODE.md`. The docs show the Node-faithful `if (o.isNone()) { return None; }`, and the refusal in a `Result` function suggests `.okOr(e).orReturn()`. |
| Q13 | Pointer representation design | **Recommend (a):** `K_OPTION` plus one `table.reprOf(type)` helper that every emit and analysis layer calls. **(b)**, interning a niche `Option` as `K_NULLABLE` with a flag, is unsafe wherever code treats a nullable's `null` as JavaScript's `null`: WP32's `emitCoalesce` (emit_map.ts :447) makes `m.get(k) ?? d` also replace a stored `null` when `V` is nullable, so under (b) a `Map<string, Option<Node>>` holding a stored `None` would take the default natively while Node keeps the `None` object. The note lists the sites on WP32-merged `main`: 19 `self/` files read `isNullable`/`stripNull`/`K_NULLABLE` there (the 18 on e5e0cfe — annotations, arrays, attributes, checker, debug, declarations, emit_arrays, emit_classes, emit_result, escape, expressions, generics, inline_arrays, interop_abi, members, parallel, structs, types — plus emit_map), and names `emitCoalesce` and the checker's `??` / `!== undefined` rule for a nullable `V` as sites that must exclude `Option`. |
| Q14 | Public ABI (S5) | **Pointer payload:** the nullable pointer. **A scalar of ≤4 bytes:** the WP17 word. **An 8-byte scalar, or a nested pair:** measure a C `struct { bool some; T value; }` returned in two registers against a pointer. **Which functions take it:** the public ABI applies only to host-visible signatures, meaning an exported function or a method of an exported class, plus everything under `--no-strict-exports`. A `hidden` function (set late by `exposeTo`, generics.ts :1470–1476) is called only by this compiler's own output, so it keeps the pair, as `Result`'s private ABI already does (`privateResultAbi = strictExports && !exported`, emit_result.ts :338). **The pair-versus-public decision keys on host visibility: exported, defined in the root package, and the build mode** — a std/collections.ts library copy is emitted `internal` into its user (emit.ts :355), and no non-root function reaches a sidecar, so `Map`'s methods and std templates such as S6's `lookup` keep the pair; an instantiation inherits `sig.exported = template.exported` (generics.ts :1168), so an exported *root-package* template instantiated at an `Option` argument is host-visible and is gated until S5. |
| Q15 | Threads | A `parallelMapInto` return type is already a whitelist of number, boolean and enum, so an `Option` is refused there. S4b adds `K_OPTION` to `reachingPath` (parallel.ts :293). |
| Q16 | Relation to WP32's maybe | They stay separate. `lookup(m, k)` is the bridge, and `??` stays the maybe's alone. |
| Q17 | The analyses' view of an Option method | `isSome`, `isNone`, `value`, `unwrapOr` and `expect` store nothing and resize nothing, and `expect`'s failure path is `noreturn`. So they are `callsNothing` (bounds.ts :1604) and inert (`isInertBuiltin`, :2825), keeping every length fact across the call. A pointer-free pair is a scalar in `isScalarArgument` (escape.ts :957) and in `returnsScalar` (attributes.ts :1592), so tail marking and loop arena passes survive. |

**The `tsc` evidence already gathered.** Three reviews and the lead, all with `tsc --strict` 5.9.3.
- **Accepted and narrowed:**
  - `None` against `Option` of a class, `string`, `boolean` and `i32`;
  - `Some(None)`, with nested narrowing;
  - generic `first<T>`;
  - `return c ? Some("a") : None`, and `const o = c ? Some(1) : None`;
  - an early `if (o.isNone()) return`, `if (o.some)`, `!o.some`, `o.some && o.value` and `!o.isSome()`;
  - `okOr` → `Result`;
  - `Option<number> | null` (which Nish refuses, Q1).
- **Refused:**
  - an unproven `.value`, including after `const o = Some(3)` (TS2339);
  - a mismatched payload (TS2322);
  - assigning `.some` (TS2540);
  - `let o = None; o = Some(1)` (TS2322);
  - a user non-generic `Option` used with arguments (TS2315).
- **Collisions:** `"lib": ["DOM"]` does not collide, since DOM's `Option` is a value. A script-mode file collides (TS2300/TS2451); every Nish module exports, and the d.ts header says so.
- **The declaration:** `None` is declared `OptionNone & OptionMethods<never>`.
- **A recorded asymmetry:** `const k: Option<number> = None; if (k.isNone()) {} else { k.value }` is TS2339 under `tsc` (narrowing by assignment makes the else arm `never`), while Nish at `O_UNKNOWN` accepts it. `Result` behaves the same way today; the note says so, and it is the harmless direction (Nish accepts a program `tsc` refuses only where the value is provably absent, and `.value` there is unreachable).
- **Enums under Node:** Node 22's strip-only mode throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on a TypeScript `enum`, so no enum case can be Node-compared; enum cases stay i32-mode (no Node comparison), as every enum case on `main` does.

## Stage S1 — wp33-note

**Owns:**
- `docs/wp33-option.md` (new) and `docs/wp33/` (the checked `tsc` corpus);
- a row in `docs/README.md`'s index and in `docs/MASTER_PLAN.md` "Next";
- `bench/option_proto_*` and `bench/option_node.mjs` (new), plus the `option` group in `bench/run.mjs`;
- `tests/run.js` (the bench-validate hunk);
- `tests/self/goldens/checked.txt`, since new `bench/*.ts` files are corpus programs, as `map_proto` was.

No compiler change.

**The note answers:**
- Q1–Q17;
- the comparison above;
- the `Result` follow-ups it files (eager arguments, contextual `Ok` payloads);
- Q11's element decision, which S4b and Acceptance 1 depend on.

**Prototypes.** They are Nish programs, since `bench/run.mjs` builds `.ts`, and they need no compiler change.

| Prototype | Shape |
| --- | --- |
| `option_proto_sentinel` | a search answering `-1` |
| `option_proto_pair` | the same search answering a private-ABI `Result<i32, u8>`, which already *is* a register pair (`res_by_value.ll`); measured after `opt -O2` |
| `option_proto_niche` | a `Node \| null` search |

- **The workload:** 10k keys, half absent, summing what is found.
- **Node agreement:** a Node twin prints the same checksum, and `--validate` checks all of them.
- **The claim to test:** the pair and the niche each cost what the sentinel costs, within the instruction gate's tolerance.

## Stage S2 — option-scalar (pointer-free payloads)

**Owns:**
- **Compiler:** [self/types.ts](../../self/types.ts), [self/annotations.ts](../../self/annotations.ts), [self/option.ts](../../self/option.ts) (new), [self/emit_option.ts](../../self/emit_option.ts) (new), [self/program.ts](../../self/program.ts) (the `None` side table), [self/expressions.ts](../../self/expressions.ts) (`computeType`, `checkConditional`, `narrow`), [self/members.ts](../../self/members.ts), [self/statements.ts](../../self/statements.ts), [self/emit.ts](../../self/emit.ts), [self/generics.ts](../../self/generics.ts) (`unifyAnnotation`, `containsType`, `originOfMember`), [self/structs.ts](../../self/structs.ts) and [self/constants.ts](../../self/constants.ts) (the gate), [self/debug.ts](../../self/debug.ts), [self/interop_abi.ts](../../self/interop_abi.ts) (explicit `""` from `cType`/`tsKeyword`), [self/codes.ts](../../self/codes.ts) (and `RULE_COUNT`).
- **Runtime:** [runtime/nish.d.ts](../../runtime/nish.d.ts), [runtime/shim.mjs](../../runtime/shim.mjs), [runtime/nish.mjs](../../runtime/nish.mjs).
- **Tests:**
  - `tests/cases/option_*`, `reject_option_*`, `dbg_option`, `tests/wordings/nl2*_option*`;
  - `tests/run.js`: in the `ambient` section (:7520) the TS2339 check for `reject_option_value_unchecked` and "`tsc` accepts every `option_*` case" (the section type-checks only `res_*` by name, :7543–7552); and a hunk gated on `option_debug` that compiles every `option_*` case with `-g` and asserts its variables appear. Wordings and code coverage run under `diagnostics` (run.js :587), which the stage's verification line names;
  - `tests/nish-cmp.js` (`DECLARED`);
  - `tests/differential/goldens/unfrozen.txt`.
- **Docs:** `docs/LANGUAGE.md` (the Option section and the types-table row), `docs/IR_COOKBOOK.md` + `docs/cookbook/option_pair.ts`, `docs/RUN_UNDER_NODE.md`.
- The regenerated stores.

**Scope.** Payloads with no pointer anywhere: numbers, bool, enums, and nested `Option`s of those. A pointer-holding payload is refused with a not-yet code, which S3 lifts.

**The work:**

| Piece | Where | What |
| --- | --- | --- |
| kind and interning | types.ts `internAll` :274, `assignable` :644 | key `K_OPTION` by state (`O_UNKNOWN`/`O_SOME`/`O_NONE`, reusing `states[t]`); `alignOf` answers the payload's alignment; **`assignable` ignores the `Option` state, as its `K_RESULT` branch does** — narrowing re-interns a local under a new id (`scope.narrow(local, table.withState(…))`, result.ts :376), so without it `if (o.isNone()) return None; return o;` and `f(o)` after `o.isSome()` would be refused. `option_narrow` pins both. |
| annotation | annotations.ts `resolveReference` | Q8's two insertion points, Q1's rules |
| constructors | option.ts; expressions.ts :1102, `computeType`, `checkConditional` | Q7 |
| surface and narrowing | option.ts, members.ts, expressions.ts `narrow` :895 | `checkOptionProperty`/`checkOptionMethod` (`some`, `value`, `isSome`, `isNone`); `narrowOptionTest` chained after `narrowResultTest`; immutability as at members.ts :446 |
| generics | generics.ts | an `Option` branch in `unifyAnnotation` (~:535–556), so `describe(Some(3))` binds `T`; `containsType`; `originOfMember` |
| lowering | emit_option.ts; emit.ts `emitVarDecl`/`emitIdentifier` | Q4's shapes, and `None` as `zeroinitializer` (Q3). A ternary's `phi` of `llvm(type)` already works for `{ i1, T }` (emit_control.ts :354). |
| DWARF | debug.ts `typeRef` :253 | a two-member composite; a slotless `const` pair is two SSA values, so it gets two `llvm.dbg.value` calls with `DW_OP_LLVM_fragment` (flag, payload). Otherwise `-g` exits 70 through `internalErrorFor`. |
| Node | shim.mjs, nish.mjs | `NishOption` with `some`/`value`, a frozen `None` singleton, and `provide("Some"/"None")`. `provide` never overrides a module's own name. |

### Position gate

`resolveType` does not know where a type sits, so S2 refuses every position it cannot lay out. Each has a code and a `reject_option_*` case, and is lifted by the stage named:

| Position | Case | Lifted in |
| --- | --- | --- |
| a class or interface field | `_field` | S4b |
| an array element | `_element` | S4b |
| a generic type argument written explicitly — not `Option`'s own payload, so `Option<Option<i32>>` is allowed | `_type_argument` | S4b |
| a generic type argument or array element *inferred* (`id(Some(3))` binding `T = Option<i32>`, `[Some(1), None]`, `new Box(Some(1))`), gated in `instantiate` beside its `rejectForeignPointer` loop (generics.ts :1107), in a new loop in `instantiateStruct` (which has none; the WP27 TODO at :895 says so), and in array-literal typing | `_type_argument_inferred`, `_element_inferred` | S4b |
| an instantiation of an exported root-package template at an `Option` argument | `_export_instance` | S5 |
| a `Map` value | `_map_value` | S4b |
| a module constant | `_module_const` | S4b |
| a compile-time function-type parameter | `_function_type` | S4a |
| an exported function or a method of an exported class | `_export` | S5 |
| any `Option` signature under `--no-strict-exports` | `_no_strict_exports` | S5 |
| an `Option` payload that holds a pointer | `_pointer_payload` | S3 |
| a `Result` payload holding an `Option`, or an `Option` holding a `Result` — written, inferred by `Some(r)`, instantiated, or produced by `okOr` on a nested `Option` | `_in_result`, `_some_result`, `_okor_nested` | never in v1 (Q1) |
| `Option<T> \| null` | `_or_null` | never (Q1) |
| an `Option` map key, or a `Set<Option<…>>` | `_map_key`, `_set_element` | never (Q1) |
| `indexOf` over `Option` elements | `_index_of` | never (Q1) |

An `Option` in a generic *signature* (`first<T>(xs: T[]): Option<T>`) is not a type argument, and is allowed from S2 on, at pointer-free instantiations.

**Host-visible** (the `_export` and `_export_instance` rows) means an exported function or a method of an exported class — what `cType` bridges — decided by **the same rule as Q14: exported, and defined in the root package** — not a `std/` or other non-root module, whose functions and instantiations never reach a sidecar (#229: "the library is a non-root package, so the sidecars never describe it"). The checker can decide it from the declaring module (program.ts :1219 on the map-get branch already records `std/collections.ts`), so `Map`'s methods and S6's `lookup`/`find` instantiations are never refused by either row and always use the pair. S1's note verifies that no non-root function can reach a header, `--emit-napi` or wasm export; if one can, the rule narrows to library copies and S6's `lookup`/`find` fall under S5's fallback, with Acceptance 11 narrowed to a ≤4-byte or non-nullable-pointer `V`.

**Tests.** Every positive case except the enum ones is f64 mode (`.args` `--number-mode f64`) with `export const main`, so `tests/differential/unmodified.js` runs it against Node; it runs nothing else (:59). The enum cases (`option_enum`, and `option_first_generic`'s enum instantiation split out as `option_first_enum`) are i32-mode with no Node comparison, because Node's strip-only mode rejects `enum`.
- **Positive:**
  - `option_find_f64`, `option_i32_payload` (through `toI32`), `option_bool`, `option_enum`, `option_nested`;
  - `option_narrow` (every form in Result's narrowing table, with `some`/`isSome`/`isNone`);
  - `option_infer` (`describe(Some(3))`), `option_ternary_infer`;
  - `option_shadow_local`, `_param`, `_type_param`, `_module` (a user `Option`, `Some` or `None` wins);
  - `option_first_generic` (`first<T>` at `f64`, `bool`) and `option_first_enum` (i32 mode);
  - `dbg_option`.
- **Reject:** every gate row above, plus `_value_unchecked` (also TS2339), `_value_of_some`, `_let_none`, `_payload_mismatch`, `_not_generic` (the TS2315 twin), `_equality`, `_template`, `_nullish` and `_console_log` (reusing existing codes where they apply).

## Stage S2b — option-methods

**Owns:** [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/attributes.ts](../../self/attributes.ts) (`collectOptionFacts`, `returnsScalar`), [self/escape.ts](../../self/escape.ts) (`isScalarArgument`), [self/bounds.ts](../../self/bounds.ts) (Q17), [self/codes.ts](../../self/codes.ts), `tests/cases/option_*`, `arr_bounds_option_*`, `tests/run.js` (a gated `option_o2` hunk), docs.

**What this stage adds:**
- **`unwrapOr(d)` and `expect(msg)`,** with eager arguments (Q6). `collectOptionFacts` records `expect`'s `nish_write`/`nish_exit`, as `collectResultFacts` does (attributes.ts :1328–1390).
- **Q17** in bounds, escape and attributes.

**Tests:**
- `option_eager_argument` (f64): native and Node print the same side effect, in the same order.
- `arr_bounds_option_unwrap_or`, `arr_bounds_option_expect`, and `arr_bounds_option_loop`, which asserts no index check reappears after `o.isSome()` in a loop.
- **The `option_o2` hunk** asserts three things about a non-exported function returning `Option<i32>`: its `.ll` has no `nish_alloc_struct` and no `nish_arena_*` call caused by the `Option`; it returns `{ i1, i32 }`; and after `opt -O2 -S -mtriple=x86_64-unknown-linux-gnu` the *whole module* (the caller included, since an internal callee is likely inlined and deleted, which would make a per-function check pass on nothing) has no `alloca` and no allocator or arena call. Precedent for such checks: tests/run.js :2088, :2649.

## Stage S3 — option-pointer

**Owns:**
- **Compiler:** [self/types.ts](../../self/types.ts), [self/annotations.ts](../../self/annotations.ts), [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/attributes.ts](../../self/attributes.ts), [self/escape.ts](../../self/escape.ts), [self/bounds.ts](../../self/bounds.ts), [self/expressions.ts](../../self/expressions.ts), [self/members.ts](../../self/members.ts), [self/generics.ts](../../self/generics.ts), [self/debug.ts](../../self/debug.ts), [self/interop_abi.ts](../../self/interop_abi.ts), and whichever of the 18 nullable-reading files Q13's design touches.
- **Tests:** `tests/cases/option_*`, `reject_option_*`, `tests/run.js` (a gated `option_niche_equal` hunk).
- **Docs:** the cookbook entry `option_niche`, and docs.

**Scope:** it lifts `_pointer_payload`, admitting every `Option` where `holdsPointer` is true.

**Soundness sites.** Each reads `holdsPointer`, and each would be a miscompile if missed:
- **`classifyArgumentUse`** (attributes.ts :785–816). An argument to `Some(…)`, and the argument of `unwrapOr` on a pointer-holding `Option`, fall through to `USE_NONE` today. So `(p: Node) => Some(p)` and `o.unwrapOr(p)` would mark `p` `nocapture`. A caller's `calleeCaptures` (escape.ts :611) would then stack-allocate a returned `new Node()`: a use-after-return. Both are flow-through (like `N_PAREN`) or `USE_ESCAPE`.
- **Member reads** (attributes.ts :748). `o.value`, `o.unwrapOr(d)` and `o.expect(m)` on a pointer-holding `Option` *are* the pointer, so they flow through; they are not `USE_READ`.
- **`isPointerResult`** (escape.ts :485–496). A call returning a pointer-holding `Option` is a pointer result. Otherwise an automatic arena scope releases returned memory, the `mem_read_or_null_scope` bug class.
- **`isScalarArgument` and `returnsScalar`.** A pointer-holding pair is *not* scalar.
- **Q13's representation rule,** at every `stripNull`/`isNullable`/`isPointerParam` site. That is what makes the parameter attributes (attributes.ts :2380, :1052–1064) match a nullable's.

**Tests.** All positive cases are f64 mode with `export const main`.
- `option_string`, `option_class`, `option_interface` (a `Point[]` element), `option_nullable_payload` (`Option<Node | null>`: `Some(null)` ≠ `None`), `option_nested_niche`.
- `option_escape_returned`: `Some(new Node())` returned is `nish_alloc_struct`, not an `alloca`.
- `option_escape_param`: `wrap(p) => Some(p)` leaves `p` without `nocapture`.
- `option_escape_unwrap_or_arg`.
- **`option_niche_equal`:** two written programs, `Node | null` / `null` / `p !== null` / `p` against `Option<Node>` / `None` / `o.isSome()` / `o.value`. Their `define` bodies must be identical without `-g`, after stripping value names.

## Stage S4a — option-propagate

**Owns:** [self/option.ts](../../self/option.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/generics.ts](../../self/generics.ts) (the function-type gate), [self/attributes.ts](../../self/attributes.ts), [self/escape.ts](../../self/escape.ts), [self/codes.ts](../../self/codes.ts), [runtime/shim.mjs](../../runtime/shim.mjs), `tests/cases/option_*`, `tests/differential/unmodified.js` (`KNOWN`), docs.

**What this stage adds:**
- **`orReturn()`**, mirroring `checkOrReturn`/`emitOrReturn`: it branches on the flag, and the `None` arm runs `emitScopeExit` and returns `None` in the function's own shape. The refusal and the Node divergence are Q12's. The f64 cases go in `KNOWN`.
- **`okOr(e)`**, which builds a `Result<T, E>`:
  - its argument is eager, and `option_eager_argument` is extended to it;
  - a pointer `e` escapes, pinned by `option_escape_okor_arg`.
- **Receivers on a pointer-holding `Option`** (round 3, E): `orReturn`'s receiver flows through (its payload *is* the result), and `okOr`'s receiver is `USE_ESCAPE` (it is stored into the `Result`) — not `USE_READ` as a `Result` receiver is (attributes.ts :745–748), because a niche receiver is the payload itself. Pinned by `option_escape_or_return` and `option_escape_okor_receiver`.
- **Callbacks:** a compile-time function parameter's type may take or return `Option` (a `firstSome<T, U>(xs, (x) => Option<U>)`-style std helper needs it; `find`'s own callback is `(x: T) => boolean` and does not). Pinned by a positive `option_fnarg` case, since the `fnarg` filter only reruns the existing `fnarg_*` cases.

## Stage S4b — option-memory

**Owns:** [self/structs.ts](../../self/structs.ts), `self/inline_arrays.ts`, [self/emit_map.ts](../../self/emit_map.ts) (`zeroOf`, `emitCoalesce`), [self/arrays.ts](../../self/arrays.ts), [self/emit_arrays.ts](../../self/emit_arrays.ts), [self/emit_classes.ts](../../self/emit_classes.ts), [self/emit_option.ts](../../self/emit_option.ts), [self/emit_map.ts](../../self/emit_map.ts) (`zeroOf`), [self/generics.ts](../../self/generics.ts), [self/constants.ts](../../self/constants.ts), [self/parallel.ts](../../self/parallel.ts), [self/escape.ts](../../self/escape.ts), [self/attributes.ts](../../self/attributes.ts), [self/debug.ts](../../self/debug.ts), [self/interop_abi.ts](../../self/interop_abi.ts) and [self/interop_header.ts](../../self/interop_header.ts) (the field spelling only), [self/checker.ts](../../self/checker.ts) (the perf gate), [self/codes.ts](../../self/codes.ts). Also `tests/cases/option_*`, `gen_option_*`, `map_option_*`, `tests/layout/`, and docs.

**What this stage adds:**
- **Lifted positions:** fields, elements, type arguments, `Map` values and module constants, with Q11's layout. `new Array<Option<T>>(n)` stays refused (Q1).
- **The header's field spelling,** so `--emit-header` over a class with an `Option` field is right before S5.
- **Analyses:** `zeroOf` answers `zeroinitializer`; `reachingPath` gains `K_OPTION`; `canonicalArgument` (generics.ts :312) canonicalises an `Option`'s proof state as it does a `Result`'s, or `O_SOME` and `O_UNKNOWN` arguments ask for one symbol under two ids; full DWARF (`optionComposite` beside `resultComposite` :423).
- **The inferred positions** (`_type_argument_inferred`, `_element_inferred`) lift with the written ones. `_export_instance` stays until S5.

Property paths still do not narrow, so a field `Option` is copied to a local first, as a `T | null` field is today.

**Tests:**
- `gen_option_first` (f64 mode, `export const main`, Node-compared): `first<T>(xs)` at `f64`, `i32` (through `toI32`), `bool`, `string`, a class, an interface, `Node | null` and `Option<f64>`; the enum instantiation stays in the i32-mode `option_first_enum`.
- `map_option_get`: `Map<string, Option<i32>>` with `get` and `??`, whose IR assembles.
- `map_option_none_value` (f64, `main`, Node-compared): a `Map<string, Option<Node>>` holding a stored `None`, read with `??`, prints what Node prints — the stored `None` is a value, not a missing key.
- `option_field`, `option_element_push`, and `reject_option_array_new`.

## Stage S5 — option-abi

**Owns:** [self/emit_option.ts](../../self/emit_option.ts), [self/emit.ts](../../self/emit.ts), [self/emit_classes.ts](../../self/emit_classes.ts), [self/interop_abi.ts](../../self/interop_abi.ts), [self/interop_header.ts](../../self/interop_header.ts), [self/interop_dts.ts](../../self/interop_dts.ts), [self/interop_napi.ts](../../self/interop_napi.ts), [self/interop_wasm.ts](../../self/interop_wasm.ts), [self/attributes.ts](../../self/attributes.ts), [self/debug.ts](../../self/debug.ts) (`optionWord`). Also `tests/cases/option_export*`, and `tests/run.js`'s `interop` section, mirroring "WP17: a `Result` across the host boundary" (:5175–5368).

**What this stage adds:**
- **The ABI:** Q14's public ABI, which lifts `_export` and `_no_strict_exports`. It must stay in sync with the `internal` linkage decision (emit.ts :350–364).
- **The header:** `Option<Node>` is `struct Node *`, which may be `NULL`; a small scalar is a `nish_option_<T>_word` typedef with a size assert; an 8-byte scalar is spelled per Q14.
- **The other bridges:** `.d.ts` is the tagged union; N-API and wasm box and unbox, mirroring `napiResultBoxer`/`wasmResultPack`.
- **Tests:** a `-Werror` C driver, the N-API addon, and a wasm build, round-tripping `Option` of `i32`, `f64` and a class.

**If Q14 leaves the 8-byte question open**, S5 ships the nullable pointer and the ≤4-byte word only; an 8-byte scalar (or a nested pair) in a host-visible signature keeps a not-yet refusal, `_export_wide`, for a follow-up WP, as WP17 followed WP16. Acceptance 10 then narrows as it says. S6's `lookup` and `find` are unaffected, because std functions are not host-visible under Q14's rule and keep the pair at every payload, `Node | null` and 8-byte scalars included.

## Stage S6 — option-adopt

**Owns:** `std/map.ts`, `std/option.ts` (new), `std/README.md`, `.github/workflows/release.yml` (the std presence gates), `tests/cases/map_lookup_*` and `std_option_*`, `tests/run.js` (a gated one-probe hunk for `lookup`, and the instruction-gate rows), `examples/option.ts` (new), `docs/AI.md`, `README.md` (the comparison row), `self/codes.ts` (NL2010's wording only), `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/BENCHMARKS.md`, `bench/option_*`, `bench/instructions.json`.

**Depends on:** S5 (a std function is an export) and WP32's S3 and S5 (`get`, and `std/map.ts`).

**`lookup`:**
```ts
export const lookup = <K, V>(m: Map<K, V>, k: K): Option<V> => {
  const v = m.get(k);
  return v === undefined ? None : Some(v);
};
```
- Legal under `tsc`, faithful under Node, and one probe natively, because `get` is. At `V = Node | null` it answers `Some(null)` for a stored null.
- The IR check is exactly one `probe` call.

**`std/option.ts`:**
- `fromNullable(p: T | null): Option<T>` and `toNullable(o: Option<T>): T | null`, which are free under the niche;
- `find(xs, (x) => …)`, on the compile-time function parameters #213 landed.

**The decision procedure the docs give,** naming all three spellings:
1. **A field or link that holds an object:** `T | null`.
2. **Reading a `Map`:** `m.get(k)` gives JavaScript's `V | undefined`, for a `const`, `??` or a test; `lookup(m, k)` gives an `Option<V>` to return or pass on.
3. **Anything else that may be absent:** `Option<T>`. That means an operation's result, a scalar, and any generic `T`.

Existing APIs that predate `Option` (`readFileSyncOrNull`, `pop()`) keep their types, and the docs name them.
- The README row becomes "flow narrowing for references; `Option<T>` for results and generic code".
- NL2010's wording points at `Option<i32>`.

**Benchmarks:**
- `examples/option.ts` compiles with `-o` and `--link`, matches Node, and passes `tsc --strict`.
- `BENCHMARKS.md` re-runs S1's prototypes as real `Option` programs.
- The instruction gate records `Option<i32>` against the `-1` sentinel.

## Merge order

S1 → S2 → S2b → S3 → S4a → S4b → S5 → S6.
- S4a and S4b may run concurrently once S3 lands, but their Owns overlap in `emit_option.ts`, `codes.ts`, `generics.ts`, `attributes.ts` and `escape.ts`, so whichever merges second merges `main` and resolves; merge S4a first.
- The WP starts after WP32 closes: it takes the kind and code numbers after WP32 S3's, builds on `emitMaybeLocal`, and S4b/S6 need WP32's `Map` and `std/map.ts`.

## Acceptance

1. `first<T>(xs: T[]): Option<T>` compiles at `i32`, `f64`, `bool`, `string`, a class, an interface, `Node | null` and `Option<i32>` (S4b). Each passes `tsc --strict`, and each f64-mode build prints what Node prints.
2. A non-exported function returning `Option<i32>` makes no allocator or arena call because of the `Option`, returns `{ i1, i32 }`, and after `opt -O2` the module has no `alloca` and no allocator or arena call (S2b's hunk; a `main` that prints still calls `nish_print`). The instruction gate records it within tolerance of the `-1` sentinel (S6).
3. The `option_niche_equal` programs have identical `define` bodies (S3).
4. An unproven `o.value`, including right after `const o = Some(x)`, is refused by `nish` and by `tsc` (TS2339).
5. Every refused form and position in Q1, Q5 and the gate — the inferred positions, `_export_instance`, `Set<Option>` and `indexOf` over `Option` elements included — has a `reject_option_*` case and a stable code.
6. `unwrapOr`, `expect` and `okOr` evaluate their argument exactly as Node does (`option_eager_argument`, f64 mode).
7. `orReturn()` propagates `None` natively. Its Node divergence is in RUN_UNDER_NODE.md and `KNOWN`, and the shim's error names that page.
8. Programs that name none of `Option`, `Some` or `None` are byte-identical: no `tests/cases` golden moves, and `nish-cmp` shows 0 undeclared differences.
9. Each of these compiles as before, natively, under `tsc` and under Node:
   - a user class, alias, enum or function named `Option`;
   - a `function Some`;
   - a `const None`;
   - an imported `Option`;
   - a local, parameter or type parameter of any of the three names;
   - a user `Option` in one module beside the built-in in another.
10. Exported `Option<i32>` and `Option<Node>` functions round-trip through C, N-API and wasm, and a `--no-strict-exports` build compiles them (S5). `Option<f64>` does too if Q14 settles the 8-byte ABI; otherwise it is refused with `_export_wide`, per S5's fallback.
11. `lookup(m, k)` is one probe natively, matches Node, and tells a stored `null` from absence (S6).
12. The perf gate stays at zero warnings for std and the examples. `-g` compiles every `option_*` case and describes its variables (the S2 hunk).
13. README, AI.md and LANGUAGE.md give S6's decision procedure.

## Out of scope

- Combinators as methods (`map`, `andThen`, `filter`). They need function values; `std/option.ts`'s `find` is the only top-level one here.
- `?.` and `??` on an `Option`.
- An implicit conversion from a maybe or a `T | null`.
- `Option<Result>`, `Result<Option>` and `Option<T> | null` (Q1).
- Changing `Map.get`, `pop()`, `readFileSyncOrNull` or any existing return type.
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

**How `tests/run.js` filters.** `node tests/run.js <x>` matches by substring within each section's own gate (run.js :406/:419). So a stage's gated hunks, such as `ambient`, `interop`, `option_o2` and `option_niche_equal`, are named in its verification line. `tests/differential/unmodified.js` needs `npm run build` first, and `npm test` runs it (run.js :10695).

Every construct stage ships its golden `.ll`, `llvm-as`, native `.out`, a `reject_*` case per form, the wording, the `LANGUAGE.md` rule and its cookbook entry in the same PR.

**Every stage that adds cases also owns** `tests/nish-cmp.js` `DECLARED` (each new program is a seed difference; its `changelog` text matches that stage's PR title), `tests/differential/goldens/unfrozen.txt` (one line per new case with `main`), and the regenerated `tests/self/goldens/*` stores (tests/cases is corpus, tests/self/corpus.js :40), whether or not its Owns list repeats them.

**The rolling freeze:** `self/` does not use `Option`. New `self/` files only regenerate `tests/self/goldens/checked_self.txt`.

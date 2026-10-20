---
name: Refuse an object literal typed as a class with methods
overview: Fixes #656. Today the checker accepts an object literal whose contextual type is a class with methods. Native runs the method, but under Node the literal is a plain object and the call throws. Refuse it with a new NL2556 whose remedy names `new`, with a negative golden for every way a contextual type reaches a literal.
stages:
  - id: refuse-literal
    title: "fix(checker): refuse an object literal typed as a class with methods"
    goal: Every object literal whose contextual type is a class with methods is refused with NL2556, which names new as the remedy; methodless classes, interfaces and the existing NL2515 and NL2545 refusals are unchanged.
    verification: npm run check && npm run lint && node tests/run.js && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: rule-check
        content: Add the NL2556 check to checkObjectLiteral in src/members.ts and register the code in src/codes.ts — see Checker rule
      - id: negatives-required
        content: Add one negative golden per required way in (annotated declaration, return, call argument, array element, record element, generic instantiated at the class) — see Negative goldens
      - id: negatives-siblings
        content: Probe every sibling way in and give each one that reaches the literal its own negative golden; fix any path that bypasses checkObjectLiteral — see Sibling probe
      - id: positive-pins
        content: Add a positive round trip pinning what the rule leaves out (methodless class literal, interface literal, the new-based remedy) with .ll and .out, registered in the differential goldens — see Positive pins
      - id: wording-coverage
        content: Add tests/wordings/nl2556_class_literal.ts and .err so diagnostic coverage provokes the new code — see Checker rule
      - id: docs
        content: State the rule in docs/LANGUAGE.md (Interfaces and object literals, plus the rejection index) and update docs/AI.md and docs/guide/language/classes-and-interfaces.md — see Docs
      - id: regen-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Verification
---

## Context

[`checkObjectLiteral`](../../src/members.ts) (src/members.ts:678) checks an object literal against its contextual type `want` whenever `want` is a struct, and that struct can be a class or an interface. [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) (L4331–4390, "Interfaces and object literals") says a literal "takes its type from the context" of a class or an interface. It does not say what happens when that class has methods. Native lowering gives the literal the struct's layout, so its methods dispatch. Under Node it is a plain object with no prototype, so `c.get()` throws `TypeError` and the two disagree (#656). There is precedent for refusing it: NL2515 refuses a literal for the `nish/threads` classes ([`src/parallel.ts`](../../src/parallel.ts):3803), and NL2545 refuses one for secret holders ([`src/secret.ts`](../../src/secret.ts):311). Both say the class is "made only by `new`".

## Approach

- **Refuse rather than lower as `new`.** LANGUAGE.md does not require literals to work for classes. Lowering a literal as `new` would run a constructor the literal never names, with side effects and initializers out of source order. A refusal changes no program that already agrees across native and Node: the scan found no positive test, `std/` or `src/` code that writes such a literal.
- **Only classes with methods.** A methodless class literal behaves the same under native and Node, so it stays legal and a positive test pins that. "Has methods" means `info.kind === STRUCT_CLASS` and either a non-empty `methodSigs` or a generic method template. Nish has no `extends` and no accessors (LANGUAGE.md L9698), so the rule has no inherited method to chase.
- **One check, at the one place the target is known.** Every context reaches the literal through `checkExpression(…, want)` and then `checkObjectLiteral`. The check sits there, before the field checks, alongside the NL2545 secret check, which keeps its precedence. Threads classes keep NL2515: either skip them (`isThreadsObjectType`) or order the checks so the existing `reject_atomic_literal*` and `reject_thread_literal_*` `.err` files are unchanged.
- **Remedy names `new`.** Proposed wording, final text as the worker finds it reads best: `` An object literal cannot make a `Counter`: the class has methods, and under Node a literal is a plain object without them. Make one with `new Counter(…)` ``. Spell the type with `spelled(ctx, info)` so an instantiated generic reads `Box<i32>`.

## Checker rule

| file | change |
|---|---|
| [`src/members.ts`](../../src/members.ts) | the NL2556 check at the top of `checkObjectLiteral`, via `ctx.errorType(expr, …)` |
| [`src/codes.ts`](../../src/codes.ts) | append the fragment and `NL2556`, longest fragment first, and bump `RULE_COUNT` (`node scripts/gen-diagnostic-codes.mjs --check` must pass) |
| `tests/wordings/nl2556_class_literal.{ts,err}` | provokes the code for `tests/diagnostic-coverage.js --require-coverage` |

`src/` may not use a construct newer than the seed (the rolling freeze), and this change adds none.

## Negative goldens

Write each as `tests/cases/reject_class_literal_<way>.{ts,err}`, using the `Counter` class from #656. The `.err` holds the NL2556 code and the remedy fragment naming `new`.

| way in | case |
|---|---|
| annotated declaration `const c: Counter = { n: 5 }` | `reject_class_literal_decl` |
| `return { n: 5 }` from `(): Counter`, and the concise arrow body `(): Counter => ({ n: 5 })` | `reject_class_literal_return`, `reject_class_literal_arrow_body` |
| call argument `use({ n: 5 })` with `use(c: Counter)` | `reject_class_literal_call_arg` |
| array element `const a: Counter[] = [{ n: 5 }]` | `reject_class_literal_array_elem` |
| record element: a field of an enclosing literal typed `Counter` | `reject_class_literal_record_field` |
| generic instantiated at the class, e.g. `id<Counter>({ n: 5 })` and a generic class `Box<Counter>` field or argument | `reject_class_literal_generic_call`, `reject_class_literal_generic_class` |
| a generic class with methods instantiated at a type, e.g. `const b: Box<i32> = { v: 1 }` | `reject_class_literal_generic_target` |

## Sibling probe

In the same round, compile each sibling below against the fix. Each sibling that reaches a class-typed literal gets its own `reject_class_literal_<way>` golden. A sibling that reaches the literal without NL2556 is a hole: fix it at its root, without adding a second check. A sibling that is already refused for another reason gets one line in the PR body naming the code that refuses it.

- assignment `c = { n: 5 }` and to a field `h.c = { n: 5 }`
- ternary arms `cond ? { n: 1 } : { n: 2 }`, and a parenthesised literal
- a nullable target `Counter | null`
- method-call and `new` arguments `o.set({ n: 5 })` and `new Holder({ n: 5 })`
- array methods `a.push({ n: 5 })` and `a[0] = { n: 5 }`
- `Map<string, Counter>` / `Record`-style `set` arguments
- a class field initializer `c: Counter = { n: 5 }`
- builtin and `Result` arguments: `Ok({ n: 5 })` in a `Result<Counter, E>`, `Some`/optional wrappers
- a class with only a generic method (a method template, empty `methodSigs`)
- an imported class (a class with methods declared in another module or in `std/`)

## Positive pins

`tests/cases/cls_literal_methodless.{ts,ll,out}`: a literal of a methodless class, an interface literal, and the remedy `new Counter(5).get()` all print the expected values. Register it with `node tests/differential/goldens.js --update` in the same commit. The PR body shows its exact `.ll`.

## Docs

- [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md): in "Interfaces and object literals", add the rule that a literal may target an interface or a class without methods, that a class with methods is made only by `new` (NL2556), and cite the goldens. Add a row to the rejection index near L9705.
- [`docs/AI.md`](../../docs/AI.md) near L1513: one rule line, with an example compiled by `npm test`.
- [`docs/guide/language/classes-and-interfaces.md`](../../docs/guide/language/classes-and-interfaces.md): say that a class with methods is created with `new`, and show the diagnostic.
- There is no new construct, so no cookbook entry and no runtime prelude change.

## Out of scope

- Lowering a literal as `new`.
- Changing NL2515 or NL2545.
- Refusing literals of methodless classes.
- Anything in the runtime, codegen or the CLI.

## Verification

- `npm run check`, `npm run lint` (read the exit status, not a piped tail).
- Targeted runs during review rounds: `node tests/run.js` with the relevant section filter (golden cases, `codes:`, the reject oracle).
- Before the PR goes up, an undegraded full `npm test` with the skip count read: `node tests/run.js`.
- `src/` changed, so also run `node tests/run.js wasi` (with `WASI_SYSROOT` set, and its skip line read) and `node tests/run.js performance`.
- Run `bash scripts/fetch-seed.sh --force` before building.
- Regenerate `tests/self/goldens/checked.txt` and `checked-self.txt` only with `node tests/self/goldens.js --update`, and read the diff.

**Owns:** `src/members.ts`, `src/codes.ts`, `src/**` (only where the sibling probe finds a bypass), `tests/cases/reject_class_literal_*`, `tests/cases/cls_literal_methodless.*`, `tests/wordings/nl2556_*`, `tests/self/goldens/**`, `tests/differential/**` (goldens only), `docs/LANGUAGE.md`, `docs/AI.md`, `docs/guide/language/classes-and-interfaces.md`

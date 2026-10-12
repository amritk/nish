---
name: Null-only ?? and ?. chains
overview: Accept `a ?? d` where `a` is a `T | null`, then accept a `?.` chain whose only use is the left operand of a `??`. Both keep tsc, Node and native in agreement and lower to the branch a hand-written `!== null` test already makes.
stages:
  - id: coalesce-null
    title: "?? on T | null"
    goal: Accept `a ?? d` for a nullable left operand, typed by its default, with no new run-time cost
    verification: npm run check, an undegraded npm test, node tests/run.js wasi and node tests/run.js performance green, with the new goldens read
    status: completed
    todos:
      - id: checker-coalesce-nullable
        content: Widen checkCoalesce in src/expressions.ts to a nullable left operand, typed by its default — see Stage 1, Checker
        status: completed
      - id: refuse-element-left
        content: Refuse an element access as the left of `??` with a new NL2 code in src/codes.ts — see Stage 1, The element-access refusal
        status: completed
      - id: maybe-result-type
        content: Type `m.get(k) ?? d` as `T` when `V` is `T | null` and `d` is a `T` — see Stage 1, Checker
        status: cancelled
      - id: emit-coalesce-nullable
        content: Lower a nullable left in emitCoalesce in src/emit-map.ts as a select or a branch and phi — see Stage 1, Lowering
        status: completed
      - id: escape-isold-left
        content: Make isOld in src/escape.ts read both operands of a `??` whose left is not a maybe — see Stage 1, Passes that read ??
        status: completed
      - id: audit-other-passes
        content: Audit the `??` cases in parallel.ts, generics.ts, attributes.ts, arrays.ts, bounds.ts and secret.ts for a non-map left — see Stage 1, Passes that read ??
        status: completed
      - id: tests-coalesce
        content: Add positive and negative cases, flip reject_nullish_nullable, register differential goldens — see Tests
        status: completed
      - id: docs-coalesce
        content: Update LANGUAGE.md, AI.md, IR_COOKBOOK.md, MASTER_PLAN.md and the guide pages types.md and from-typescript.md — see Docs
        status: completed
      - id: goldens-coalesce
        content: Regenerate tests/self/goldens with goldens.js --update and read the diff — see Verification
        status: completed
  - id: optional-chain
    title: "?. chains that end in ??"
    goal: Accept `a?.b?.c ?? d`, a chain of member reads and method calls whose only use is the left of a `??`
    verification: The same commands as stage 1, plus the new negative cases for every place a chain may not go
    status: completed
    todos:
      - id: validator-optional
        content: Keep the Phase 0 refusal in src/validator.ts only for `?.[` and `f?.()` — see Stage 2, Validator
        status: completed
      - id: checker-chain
        content: Type a `?.` link and every link after it as a maybe, welcome only under WANT_MAYBE from checkCoalesce — see Stage 2, Checker
        status: completed
      - id: refuse-never-null
        content: Refuse `?.` on a receiver that is never null, with a new NL2 code — see Stage 2, Checker
        status: completed
      - id: emit-chain
        content: Lower a chain in emitCoalesce as one null test per link that branches to the default block — see Stage 2, Lowering
        status: completed
      - id: chain-call-rules
        content: Pin with negative cases that a method call inside a chain is seen by the lock, region and secret walks — see Stage 2, Calls inside a chain
        status: completed
      - id: tests-chain
        content: Add positive and negative chain cases and flip reject_optional_chain — see Tests
        status: completed
      - id: docs-chain
        content: Update LANGUAGE.md, AI.md, IR_COOKBOOK.md, the guide and add the reversal note to wp23-language-surface.md section 9 — see Docs
        status: completed
      - id: goldens-chain
        content: Regenerate tests/self/goldens and the differential goldens and read the diff — see Verification
        status: completed
---

# Null-only `??` and `?.` chains

## Context

A Nish program is also a TypeScript program: `tsc` checks it and Node runs it, and both must agree with the native build. Today `??` is accepted only after `Map.get` ([`src/expressions.ts`](../../src/expressions.ts) `checkCoalesce`), and `?.` is refused in Phase 0 ([`src/validator.ts`](../../src/validator.ts), NL1049). [`docs/wp23-language-surface.md`](../../docs/wp23-language-surface.md) §9 declined `?.` because `a?.b` evaluates to `undefined`, which is not a value in the language. The guide's own counter-example, `n.next?.value ?? 0` in [`docs/guide/getting-started/from-typescript.md`](../../docs/guide/getting-started/from-typescript.md), is the form this plan makes legal.

## Approach

- **`??` on `T | null` needs no `undefined`.** `null` is nullish, so TypeScript's answer is the default, and its type is `T` when the default is a `T`. Its lowering is the compare and branch a `!== null` test makes, so it passes the "costs nothing at run time" bar the way `type` aliases did (wp23 §1).
- **`?.` is admitted only where `undefined` can never be held.** A chain is a *maybe* (`K_MAYBE`, [`src/types.ts`](../../src/types.ts)), the type `Map.get` already answers, and the only place it is welcome is the left of `??`. Readers already know that rule from `Map.get`. That removes §9's blocker without making `undefined` a value.
- **What stays refused.** `a?.[i]` and `f?.()` stay refused (NL1049): Nish has no nullable function values, and an index brings the out-of-range problem below. The statement `a?.m();` stays refused because it has no `??`, which is §9's legal-as-a-statement objection.
- **Two pull requests.** Stage 1 is self-contained and small. Stage 2 builds on its typing and lowering.

## Stage 1 — `??` on `T | null`

### Checker

`checkCoalesce` currently refuses any left operand that is not a maybe. Widen it as follows.

| Left `a` | Default `d` | Result | Today |
| --- | --- | --- | --- |
| maybe of `V` (`m.get(k)`) | `V` | `V` | unchanged |
| maybe of `T \| null` | `T` | `T \| null`, unchanged | `T \| null` |
| `T \| null`, not an element access | `T` | `T` | NL1048 |
| `T \| null` | `T \| null` | `T \| null` | NL1048 |
| `T` (never null) | any | NL1048, wording unchanged | NL1048 |

- **The `maybe-result-type` todo is cancelled.** Typing `links.get(k) ?? fallback` as `Node` instead of `Node | null` would break programs the last release compiles: `map_get_pointer_value` tests the result against `null`, and comparing a `Node` with `null` is refused. A nullable left operand is new, so it takes `tsc`'s `T` with nothing to break, and the `Map.get` form keeps its type.
- A default that does not fit `T` reuses the existing message: ``The right operand of `??` stands in for a missing value, so it must be `T` …``.
- The left operand is read once, so `n.next ?? d` works on a property path. No narrowing is involved.
- The parser's precedence rule (no mixing with `||` or `&&` unparenthesised, [`src/parser.ts`](../../src/parser.ts) `parseCoalesce`) already covers every `??`.

### The element-access refusal

`xs[i] ?? d` on a `(T | null)[]` would make the targets disagree. With `i` out of range, Node answers `undefined`, which becomes `d`, while native traps on the bounds check. It is also TypeScript's usual idiom for "a default past the end", so people will write it expecting the Node answer.

- Refuse an `N_INDEX` left operand (after parentheses) with a new code, the next free in the NL2 band of [`src/codes.ts`](../../src/codes.ts).
- The message names the rewrite: test the index against `xs.length`, or copy the element into a `const` first.
- `const e = xs[i]; e ?? d` stays legal. An out-of-range read is already a native panic and a silent `undefined` under Node for every element read, so the copy diverges no more than any other read does. The refusal targets only the spelling that reads as a bounds default.

### Lowering

Extend `emitCoalesce` in [`src/emit-map.ts`](../../src/emit-map.ts), and consider moving it to `emit-ops.ts` once it is no longer map-only:

- **Plain default** (`isPlainOperand`): `%p = icmp ne ptr %a, null` then `select i1 %p, ptr %a, ptr %d`.
- **Otherwise**: `br` to `nullish.value` or `nullish.default`, then `phi`. This is the block shape the nullable-`V` map path already emits.

Each new golden `.ll` is quoted in its pull request, per CLAUDE.md.

### Passes that read `??`

Each of these was written when the left operand of `??` was always a map read. Each needs re-reading for a left operand that can be any nullable.

| File | Site | Finding |
| --- | --- | --- |
| [`src/escape.ts`](../../src/escape.ts) `isOld` | `return this.isOld(e.children[1])` | **Wrong for a nullable left.** A fresh object in a local, `fresh ?? old`, would be called old. Fixed to read both operands when the left is not a maybe. Measured: it was not a live use-after-free, because the `escapingNodes` sweep refuses both the per-pass scope and the arena block first, but the fixed rule names the real reason (`reject_using_arena_nullish`), and `nullish_nullable_escapes` pins a default that escapes after `churn()`. |
| `escape.ts` (two parent walks) | treats `??` as a ternary arm | Correct as is. Add a case anyway. |
| [`src/parallel.ts`](../../src/parallel.ts) `handOnRoot` | both operands | Correct. |
| [`src/generics.ts`](../../src/generics.ts) `originOf` | fails closed (`unknownOrigin`) | Sound. Following the left operand would be an improvement, but it is out of scope. |
| [`src/attributes.ts`](../../src/attributes.ts) | hands on whichever operand it answers | Correct. Check it for a `this`-derived left. |
| [`src/arrays.ts`](../../src/arrays.ts) `typedArraySpelling` | both spellings | Correct. |
| [`src/bounds.ts`](../../src/bounds.ts) | short-circuit join | Check that a proof made inside the default does not leak out. |
| [`src/secret.ts`](../../src/secret.ts) | where a `Secret` may not go | Fails closed: both operands are reads, so a `Secret` on either side is the copy refusal (`reject_secret_nullish`). |

## Stage 2 — `?.` chains that end in `??`

### Validator

The `FLAG_OPTIONAL` check in `visit` currently refuses every member, index and call. Narrow it to `N_INDEX` (`a?.[i]`) and to an `N_CALL` whose callee is not an `N_MEMBER` (`f?.()`). NL1049 keeps its wording for those two forms, and [`tests/cases/reject_optional_call.ts`](../../tests/cases/reject_optional_call.ts) (`s.charCodeAt?.(0)`) stays a refusal.

### Checker

- **The chain.** The parser flags only the link written with `?.`, so the checker works out the chain. A member or call belongs to a chain when its receiver, read without crossing an `N_PAREN`, is a `?.` link or already belongs to one. That matches TypeScript, where `(a?.b).c` ends the chain.
- **A link.** `r?.f` with `r: T | null` reads `f` off `T`. A later link reads off the previous link's value type. The chain's type is `maybeOf(type of the last link)`, so `a?.count` with `count: i32` is a maybe of `i32`. That is where a scalar comes from through a nullable path.
- **Where a chain may go.** Only the left of `??`, through the existing `WANT_MAYBE` welcome. Every other place hits `refuseMaybe` and its per-place messages. Two things need checking there: `maybeDefaultFix`'s `isGet` test should offer ` ?? <zero>` for a chain too, and the `const v: T | undefined = a?.b` form is refused for a chain (out of scope).
- **A receiver that is never null.** `s?.length` with `s: string` is legal TypeScript but means nothing. Refuse it with a new NL2 code: ``` `s` is never null; write `.` ```.
- **A nullable field at the end.** `a?.next ?? d` with `next: Node | null` is a maybe of `Node | null`. `??` replaces both missing and `null`, and the result is typed by the default (stage 1's table).

### Lowering

`emitCoalesce` gets a chain case:

```
  %r   = <receiver>
  %rn  = icmp eq ptr %r, null
  br i1 %rn, label %nullish.default, label %chain.1
chain.1:
  %f   = load …  (or the call)          ; one block per later `?.` link
  …
  br label %nullish.end                  ; found edge, or a null test first for a nullable last link
nullish.default:
  %d   = <default>
  br label %nullish.end
nullish.end:
  %v   = phi [ %f, %chain.n ], [ %d, %nullish.default ]
```

Each `?.` is one null test, with all of them branching to the same default block. That is the code the hand-written hoist and narrow produces, and the pull request compares the two goldens to show it.

### Calls inside a chain

`a?.m() ?? d` is still an `N_CALL`, so every walk over calls sees it. The rules CLAUDE.md lists under "a checker rule covers every way in" each get a negative case through a chain, because the call is conditional and a walk that skips conditional calls would miss it:

- the lock rule: a second lock taken by `a?.lock() ?? …` inside a `using` scope;
- the region rule: a channel send from a method reached by `a?.send(x) ?? …` inside a spawn scope;
- the secret rule: a `Secret` reached through `holder?.key ?? …`.

### As built

Three decisions differ from the sketch above, each for a reason found while building it.

- **Phase 0 decides which `?.` is admitted, not the checker.** A chain does not reuse the maybe type: an unannotated `const` welcomes any maybe, and the emitter lowers a maybe only from `get`, so `const v = a?.b` would have compiled to nothing sound. Instead the validator, on reaching a `??`, marks the receiver of every `?.` link on its left operand's spine in `nodeNullTests` (`admitChain`), and refuses every other `?.` (NL1062). That one syntactic rule covers every way in at once: a `const`, an argument, a template hole, an assignment target, an increment, a parenthesis that ends the chain.
- **The receiver is recorded as `T`.** `linkReceiver` (`src/members.ts`) reads a `?.` link's receiver as its `T` and records it so, because by the time the link runs the emitter has tested it, and the emitter finds a field or a method by that type.
- **The null test is one hook in `emitEntering`**, made for every node `nodeNullTests` marks, so no lowering of a field, `length` or call needed to change. Each chain counts its tests against its `?.` links and stops with an internal error on a mismatch, so a lowering that ever evaluates a receiver another way cannot read through `null` silently.

Two more passes assumed the left of `??` always runs, and both were wrong for a chain: `guardStatement` (`src/checker.ts`, where `--fix` places a bounds guard) and `walkBinary` (`src/bounds.ts`). The second was a real soundness hole, measured: without the change `h?.pick(xs[i]) ?? 0` proved the later `xs[i]` in range, and with `h` null and `i` past the end the read went unchecked and printed garbage. The chain is now walked in a copy of the state, and what reaches the default is what `forgetAcross` leaves of the state before it (`optional_chain_bounds`).

A chain that ends in `Map.get` is refused (NL2491) rather than lowered, because one `??` would default a `null` link and a missing key at once.

## Docs

The rule in each document moves with the stage that changes it.

| File | Change |
| --- | --- |
| [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) | The operator table row for `a ?? d` (around line 3492), the forbidden-constructs table (around line 7401), the Nullable types section, and the `??` paragraph under Map and Set. |
| [`docs/AI.md`](../../docs/AI.md) | The rule table row (line 146), the Absence section, the forbidden list (line 1393) and checklist item 8. Its examples are compiled by `npm test`, so add a `nish:ok` and a `nish:err` example. |
| [`docs/IR_COOKBOOK.md`](../../docs/IR_COOKBOOK.md) | A `??` on a nullable entry (stage 1) and a chain entry (stage 2). |
| [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md) | The forbidden list (line 134) and the wp23 summary (line 467). |
| [`docs/guide/language/types.md`](../../docs/guide/language/types.md) | Replace "`?.` and `??` are not available on a nullable" with the two rules and an example. |
| [`docs/guide/getting-started/from-typescript.md`](../../docs/guide/getting-started/from-typescript.md) | The "No `?.` or `??`" section becomes the rule. The `n.next?.value ?? 0` example becomes `nish:ok`, and a refused bare `a?.b` is the `nish:err`. |
| [`docs/wp23-language-surface.md`](../../docs/wp23-language-surface.md) §9 | A reversal note (stage 2): what changed, and why the `undefined` blocker no longer applies. |

## Out of scope

- A bare `a?.b` held, returned or passed. A `T | undefined` value outside `Map.get` stays refused.
- `const v: T | undefined = a?.b; if (v !== undefined)`, the const-and-test form `Map.get` has. It could be added later on the same maybe machinery.
- `a?.[i]`, `f?.()`, the statement `a?.m();`, and `??=`.
- Following the left of `??` in `generics.ts` `originOf`.
- Using either operator in `src/` itself before the release that ships it (the rolling freeze).

## Tests

Mirror the `map_get_*` and `reject_nullish_*` families in [`tests/cases/`](../../tests/cases). Each positive case has a `.ts`, a golden `.ll` and an `.out`, and is registered with `node tests/differential/goldens.js --update` in the same commit.

| Stage | Positive | Negative |
| --- | --- | --- |
| 1 (landed) | `nullish_nullable` (select and branch shapes, string and class), `nullish_nullable_field` (`n.next ?? d`), `nullish_nullable_default_null` (a nullable default, an interface left), `nullish_nullable_default_context` (`xs ?? []`, an object literal, a ternary with `null`), `nullish_nullable_escapes` (after `churn()`), cookbook `mem-nullish` | `reject_nullish_nullable` (a nullable narrowed to `T`), `reject_nullish_element` and wording `nl2489_nullish_element`, `reject_nullish_nullable_default_type`, `reject_using_arena_nullish`, `reject_secret_nullish` |
| 2 (as built) | `optional_chain_field`, `optional_chain_order` (evaluation order, interfaces, `length`, a method answering a nullable, a parenthesised `??` receiver), `optional_chain_generic`, `optional_chain_bounds`, cookbook `mem-optional-chain` | `reject_optional_chain` (no `??`), `_paren`, `_argument`, `_assign`, `_template`, `_never_null`, `_narrowed`, `_this`, `_namespace`, `_element` (`?.[i]`), `_link_nullable`, `_element_last`, `_map_get`, `_lock`, `_channel`, `_secret`; `reject_optional_call` unchanged; wordings `nl1062`, `nl2490`, `nl2491` |

## Verification

```bash
bash scripts/fetch-seed.sh --force
npm run check
npm test                                   # read the skip count: undegraded only
node tests/run.js wasi                      # WASI_SYSROOT=/usr where wasi-libc is installed; read its skip line
node tests/run.js performance
node tests/self/goldens.js --update        # then read the diff of checked.txt and checked-self.txt
node tests/differential/goldens.js --update
npm run lint
```

Commit subjects (the changelog entries):

- Stage 1: `feat(checker): accept ?? on a nullable value`
- Stage 2: `feat(checker): accept a ?. chain that ends in ??`

Each body states the rule, the agreement with `tsc` and Node, and a `Measured:` line comparing the chain's IR and timing with the hand-written narrow inside the noise band.

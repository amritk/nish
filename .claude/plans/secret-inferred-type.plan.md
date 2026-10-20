---
name: Unannotated secret(...) compiles (amritk/nish#613)
overview: An unannotated binding of `secret(v)` (array, class or interface payload) passes the checker and then emits IR that uses an undefined `%struct.Secret$...`. Register the layouts an imported generic's instantiated signature names, so the inferred `Secret<T>` is defined, keep every refusal working on the unannotated forms, and fix NL2445's "the plain array" wording.
stages:
  - id: fix
    title: "fix(codegen): define the struct an imported generic's inferred result names"
    goal: Every unannotated `secret(...)` form the checker accepts emits IR that assembles and runs, every form it refuses is refused unannotated too, and NL2445 names the payload's real shape
    verification: npm run check && npm run lint && node tests/run.js secret && node tests/run.js wasi && node tests/run.js performance && npm test
    todos:
      - id: register-instance-layouts
        content: Register the struct layouts named by an imported generic's instantiated signature in `instantiate` (src/generics.ts) — see Fix
      - id: positive-cases
        content: Add positive golden cases binding `secret(...)` unannotated for array, class and interface payloads, and the generic `Box<T>` import — see Tests
      - id: negative-cases
        content: Add one negative golden per way the value is written (literal, const alias, call result, field), unannotated — see Tests
      - id: nl2445-wording
        content: Make NL2445 name the moved value's shape instead of always "the plain array" in `movedMessage` (src/secret.ts, src/codes.ts) — see NL2445
      - id: o2-pin
        content: Pin the `-O2` wipe of an unannotated `Secret` with a new check in the "secret wipe survives -O2" section of tests/run.js — see O2 pin
      - id: docs
        content: Update docs/LANGUAGE.md Secrets (inference sentence + test names), the docs/guide page for nish:secret, and docs/security/secret.md if a row applies — see Docs
      - id: goldens
        content: Regenerate tests/self/goldens and register new cases with tests/differential/goldens.js --update — see Generated files
---

## Context

[Issue #613](https://github.com/amritk/nish/issues/613) and its comment: `const key = secret([1, 2, 3])` (no `Secret<...>` annotation), and the same with a class or interface value, passes the checker, then llvm-as/clang fails with "base element of getelementptr must be sized" (NL0002, exit 3). The `.ll` uses `%struct.Secret$arr.i32` / `%struct.Secret$Leaf` without defining it. Annotated, the same program compiles.

Reproduced on `main` at c8a00d6 with `build/nish run`, default `--number-mode i32`:

| argument written as | annotated `const k: Secret<T>` | unannotated `const` / `let` |
|---|---|---|
| literal / `new` in the call (`[1,2,3]`, `new Array<u8>(3)`, `new Leaf(1,2)`) | runs | FAIL-IR |
| const alias (`const raw: T = ...; secret(raw)`) — incl. interface `Pt` | runs | FAIL-IR |
| call result (`secret(makeKey())`) | runs | FAIL-IR |
| field (`secret(h.buf)`) | NL2447 | NL2447 |

`secret({x:1,y:2})` with no contextual type is already refused ("Object literal needs a contextual class or interface type"); an unannotated `[1,2,3]` is `i32[]` (i32 mode) or `f64[]` (f64 mode, NL2428 at the call).

## Approach — infer, do not refuse

docs/LANGUAGE.md "Secrets" defines `Secret<T>` as holding an integer array or an all-integer class/interface, and `secret(v)` as `v` wrapped; nothing there makes the annotation part of the rule. The checker already infers `Secret<i32[]>` (`checkVariableList`, src/statements.ts:244-310, records it in `nodeLocals`). The defect is in emission, and it is not secret-specific: an imported generic `box = <T>(v: T): Box<T> => new Box<T>(v)` used as `const b = box(7)` dies with "emitter: unknown struct `Box$i32`". So the fix is to define the type, and the unannotated forms then follow the same refusals as the annotated ones.

## Fix

- `structTypeDeclarations` (src/emit-classes.ts:413-475) emits only the user module's `program.structList`.
- An annotation reaches `instantiateStruct` (src/generics.ts:934-951), which calls `registerForeignLayouts(ctx, info, home, true)` when `home !== ctx`.
- A call goes through `checkGenericCall` → `instantiate` (src/generics.ts:1147-1166), which only calls `useExternalInstance(ctx, sig)`: the `Secret<T>` minted inside the home module (`instantiateStructHere`, `addStruct` at src/generics.ts:1082) never reaches the asker.
- Fix in `instantiate`: when `home !== ctx` and `sig !== null`, collect the struct names in `sig.returnType` and `sig.paramTypes` (`noteStructNames`) and `registerForeignLayouts` each, as `noteJsonRoute` does (src/generics.ts:1752-1767). Decide `symbols` per case: library copies (`emitLibraryCopies`, src/emit-map.ts:324) already emit the functions; an ordinary imported generic module needs the `declare`s. The `Box<T>` case decides it.
- `src/` is built by the seed (rolling freeze): the fix may not *use* a construct newer than the last release.

## NL2445

`movedMessage(name)` (src/secret.ts:483-485, text also in src/codes.ts:436) always ends "the plain array would be key material outside the `Secret`'s rules". Both call sites (src/secret.ts:1260, :1445) have `local.type`; pass it and say "the plain array" for an array and "the plain `Leaf`" (the class or interface name) otherwise. `reject_secret_moved.err` pins only the prefix; add a class case that pins the new tail.

## O2 pin

CLAUDE.md: secret material is wiped by a volatile store `tests/run.js` pins under `-O2`. The section `"secret wipe survives -O2"` (tests/run.js:8449-8492) pins `secret_wipe_o2` (a plain `u8[]`, no `Secret`) and `secret_field_wipe_o2`. Add a case `secret_wipe_o2_inferred` that binds `const k = secret(new Array<u8>(8))` unannotated, fills it and reads it through `expose`, then wipes it, plus a `secret_wipe_o2_inferred_plain` twin that zeroes a plain `u8[]` with `fill(0)`; add a `check("nish:secret: ...")` that requires the volatile store/memset in its `@nish_main` after `opt -O2` and none in the twin. Its exact `check(...)` string goes in the PR body and, if a security-record row is added, in that row's Tests list.

## Tests

Mirror `tests/cases/secret_flow.ts` and the `reject_secret_*` pairs (.ts + .err). Each new positive ships `.ts`, golden `.ll` (llvm-as passes) and `.out` (native round trip).

Positive:
- `secret_inferred` — unannotated `const` and `let` from a literal, a `new Array<u8>`, a const alias, a call result; class payload; interface payload (alias and call forms); each read through `expose` and wiped; prints the lengths/sums.
- `generic_import_instance` (name to match neighbours) — imported `box<T>` used unannotated; the non-secret face of the same gap.

Negative, each unannotated, one per way written:
- literal — `secret([1.5])` under f64 mode is NL2428, or the closest literal refusal the harness can express (the case must bind unannotated);
- const alias — the alias read after `secret(raw)` is NL2445 (class payload, pins the new wording) and `const alias = raw; const k = secret(raw)` is NL2512;
- call result — `secret(keep())` whose callee answers a non-fresh value is NL2512;
- field — `const k = secret(h.buf)` is NL2447.

Each `.err` pins code and message. Show the exact LLVM IR for every new TypeScript snippet in the PR body (CLAUDE.md).

## Docs

- docs/LANGUAGE.md "Secrets": one sentence that `const k = secret(v)` infers `Secret<T>` from `v` (no annotation needed), and the new test names in the table/lists.
- docs/guide/: the page covering `nish:secret` — show the unannotated form works; add nothing if no page covers it (check `scalar.config.json`).
- docs/IR_COOKBOOK / cookbook entry only if the IR shape is new (it is not: same `Secret$` struct).
- docs/security/secret.md: add a row only if the record treats invalid IR as a finding; if so, anchors at the PR's base commit and Tests by exact `check(...)` string.

## Generated files

`tests/self/goldens/checked.txt`, `checked-self.txt` — `node tests/self/goldens.js --update` (never by hand); new positive cases — `node tests/differential/goldens.js --update` in the same commit. Before building: `bash scripts/fetch-seed.sh --force`.

## Out of scope

- Inferring a contextual type for a bare object literal passed to `secret(...)` (already refused with a clear message).
- Inferred return types for arrows (NL2096 stands).
- `secret(...)` passed straight to a parameter (NL2439 stands).

## Verification

`npm run check`, `npm run lint`, `node tests/run.js secret`, `node tests/run.js wasi` (read its skip line; `WASI_SYSROOT=/usr` if wasi-libc is installed), `node tests/run.js performance`, then the full `npm test` — undegraded, skip count read — before the PR opens and again after the last `main` merge.

## Stage fix — define the struct an imported generic's inferred result names

**Owns:** `src/generics.ts`, `src/secret.ts`, `src/codes.ts`, `src/emit-classes.ts`, `src/emit-map.ts`, `tests/cases/secret_*`, `tests/cases/reject_secret_*`, new files under `tests/cases/` or `tests/link/` for the `Box<T>` import case (wherever a two-module case lives), `tests/run.js`, `tests/self/goldens/**`, `tests/differential/**`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/security/secret.md`

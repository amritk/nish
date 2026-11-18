---
name: WP67 — every error keeps its cause chain
overview: Nish errors are Result values, and today a function that converts one failure into another drops the original (the guide's own example does), std flattens causes into message text, and expect prints only its own message. Libraries keep typed error classes with a cause field; applications get a built-in Failure and r.context(message), which converts any error and keeps it as the cause; expect prints every link; and a conversion that drops the failure it converts is a compile error.
stages:
  - id: s0-proposal
    title: S0 — the WP67 proposal (docs only)
    goal: docs/wp67-error-causes.md and docs/roadmap/wp67-error-causes.md exist, every claim checked against main, the std and guard-hit inventories recorded, preconditions P1 to P6 answered, owner decisions D1 to D7 recorded.
    verification: npm run lint && node docs/check-links.mjs
    todos:
      - id: inventory-sites
        content: Inventory all 54 std Err( lines (8 files) plus the null-fault sites, each as pass-through, conversion that keeps, flattens or drops — see S0 — the proposal
        status: pending
      - id: inventory-guard-hits
        content: Count where the S4 guard would fire in std/, examples/, tests/cases, tests/link and the docs/guide snippets — see S0 — the proposal
        status: pending
      - id: check-preconditions
        content: Answer preconditions P1 to P6 and name the stage that lifts any that fail — see S0 — the proposal
        status: pending
      - id: design-note
        content: Write docs/wp67-error-causes.md with the error-type rule, Failure and context, the chain builtins, the expect format, the guard, std adoption, the compiler stage and D1 to D7 — see S0 — the proposal
        status: pending
      - id: roadmap-page
        content: Write docs/roadmap/wp67-error-causes.md (stages S1 to S6 unticked) plus its docs/roadmap/index.md rows, scalar.config.json route and docs/MASTER_PLAN.md and docs/README.md rows — see S0 — the proposal
        status: pending
  - id: s1-cause-rule
    title: S1 — the error-type rule, Failure, context and the chain builtins
    goal: The error-type rule is enforced with two new codes; Failure and r.context(message) convert any error while keeping it; errorChain(e) and errorText(e) render every link, stopping at a revisited link or after 64.
    verification: node tests/run.js err_chain && node tests/run.js res_context && node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint, each summary read for a nonzero case count
    todos:
      - id: lang-rule
        content: Add the error-type and cause-field rule, Failure and context to docs/LANGUAGE.md under Result and error handling — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: rule-codes
        content: Add the two new codes to src/codes.ts (cause field of a non-error type, errorChain or context of a non-error type), each with a tests/link negative and expected.err — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: failure-type
        content: Declare Failure in runtime/nish.d.ts and lay it out in src/runtime.ts with its runtime/nish.h twin, so tests/run.js sees both sides agree — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: context-method
        content: Add r.context(message) to the Result surface beside expect in src/result.ts and src/emit-result.ts, allocating only on the error arm — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: builtin-check
        content: Declare errorChain and errorText in runtime/nish.d.ts, check them in src/builtins.ts, list them in src/capabilities.ts and lower them per E in src/emit-builtins.ts — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: builtin-emit-ts
        content: Give Failure, context and both builtins an --emit-ts lowering in src/emit-ts-*.ts through walk.typeAt, or refuse them there with a named reason — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: chain-cycle-cap
        content: Stop the walk at a link already visited or after 64 links and end with a truncation line (D4) — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: chain-escape
        content: Escape C0 controls and DEL in each link, and add the docs/security record and its docs/security/README.md row — see S1 — the rule, Failure, context and the builtins
        status: pending
      - id: s1-cases
        content: Add tests/cases/err_chain_* and res_context_* with .ll goldens, llvm-as and .out, and register them with node tests/differential/goldens.js --update — see Tests
        status: pending
      - id: s1-docs
        content: Add the IR cookbook entries and a docs/guide section, and regenerate docs/reference with node scripts/gen-reference.mjs — see S1 — the rule, Failure, context and the builtins
        status: pending
  - id: s2-expect
    title: S2 — expect prints the error and every cause
    goal: r.expect(msg) on an Err prints msg, the error and one caused-by line per link on stderr without allocating, with exit status 1 unchanged.
    verification: node tests/run.js res_expect_chain && node tests/run.js panics && node tests/run.js c-symbols && node tests/run.js wasi && node tests/nish-cmp.js
    todos:
      - id: expect-runtime
        content: Add a panic that writes its message in pieces (claim, one write per link, exit) to runtime/runtime.c and runtime/runtime-wasm.c, reserved in src/c-symbols.ts — see S2 — expect prints every cause
        status: pending
      - id: expect-lowering
        content: Lower expect's error arm in src/emit-result.ts through that panic, one piece per link — see S2 — expect prints every cause
        status: pending
      - id: expect-case
        content: Add tests/cases/res_expect_chain with a stderr and exit-status check, and keep panics_expect and panics_oom passing — see S2 — expect prints every cause
        status: pending
      - id: expect-goldens
        content: Regenerate the .ll and --emit-panics goldens that move and add DECLARED entries in tests/nish-cmp.js — see S2 — expect prints every cause
        status: pending
  - id: s3-std
    title: S3 — std keeps every cause
    goal: Every std conversion site in the S0 inventory stores the original as a cause instead of folding it into text.
    verification: node tests/run.js std && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/nish-cmp.js
    todos:
      - id: std-fetch
        content: Export HttpClientFault with doc comments, make it FetchError.cause at std/net/fetch.ts:3288, decide the text field and FetchSyncClient.errorText — see S3 — std keeps every cause
        status: pending
      - id: std-string-errors
        content: Replace the flattened strings at std/crypto/bcrypt.ts:2005 and std/regex.ts:4968 with exported error classes carrying the original — see S3 — std keeps every cause
        status: pending
      - id: std-other-classes
        content: Add a cause to SqliteError and ShmError only where S0 found an underlying failure, and leave PgError alone unless S0 found a site — see S3 — std keeps every cause
        status: pending
      - id: std-records
        content: Update the docs/security records whose scope names fetch, bcrypt, regex, sqlite and shm, and their README rows — see S3 — std keeps every cause
        status: pending
      - id: std-regen
        content: Regenerate docs/reference and the checked goldens, add DECLARED entries for moved IR, and add one case per module that shows the chain reaching the original — see S3 — std keeps every cause
        status: pending
  - id: s4-guard
    title: S4 — the guard against a dropped cause
    goal: A return Err(x) in a branch narrowed to an error arm is a compile error unless x keeps the original, and the whole repo builds clean under it.
    verification: node tests/run.js link && node scripts/gen-diagnostic-codes.mjs --check && node tests/run.js std && node tests/run.js guide, plus each examples/ program S0 counted rebuilt with build/nish
    todos:
      - id: guard-check
        content: Add the dropped-cause check beside narrowResultTest in src/result.ts with the next free code in src/codes.ts and a fix that rewrites to .context — see S4 — the guard
        status: pending
      - id: guard-negative
        content: Add tests/link negatives with expected.err for each narrowing spelling and for an interpolated r.error, plus positives — see S4 — the guard
        status: pending
      - id: guard-repo-clean
        content: Fix every hit S0 counted in examples/, tests/cases, tests/link and the guide snippets in the same PR — see S4 — the guard
        status: pending
  - id: s5-guide
    title: S5 — the user guide and the agents' idiom
    goal: docs/guide/language/errors.md teaches typed causes for libraries, Failure and context for applications, the chain and the guard, and its ConfigError.BadPort example keeps its cause.
    verification: node tests/run.js guide && node docs/check-links.mjs && npm run lint
    todos:
      - id: guide-page
        content: Rewrite Passing a failure up in docs/guide/language/errors.md and add the docs/AI.md idiom — see S5 — the guide
        status: pending
      - id: roadmap-tick
        content: Tick each stage on docs/roadmap/wp67-error-causes.md in the PR that lands it — see S5 — the guide
        status: pending
  - id: s6-self
    title: S6 — the compiler keeps its own causes
    goal: Once a release ships S1 to S4, src/ is built under the guard with zero hits and each of its error conversions keeps its cause.
    verification: bash scripts/fetch-seed.sh --force && node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js --update && npm run check
    todos:
      - id: self-wait-release
        content: Start only after the release carrying S1 to S4 is the seed in build/seed — see S6 — the compiler
        status: pending
      - id: self-inventory
        content: List every src/ site that converts one Result error into another — see S6 — the compiler
        status: pending
      - id: self-adopt
        content: Keep the cause at every listed site (context or a cause field), then turn the guard on for src/ — see S6 — the compiler
        status: pending
---

# WP67 — every error keeps its cause chain

## Context

Nish has no `Error`, no `throw` and no `try` ([`docs/LANGUAGE.md`](../../docs/LANGUAGE.md), "Result and error handling"). A failure is the `E` of a `Result<T, E>`: a `string`, an enum or a class. Classes have no inheritance (`reject_cls_extends`), and there is no dynamic dispatch yet (WP60, proposed). So ES2022's `Error.cause` has nothing to attach to, and causes are lost in three places:

| Where | What happens today | Evidence |
| --- | --- | --- |
| A conversion between error types | The original is dropped. The guide teaches it: `if (r.isErr()) { return Err(ConfigError.BadPort); }` | [`docs/guide/language/errors.md`](../../docs/guide/language/errors.md), "Passing a failure up" |
| std wrapping | A lower failure's text is folded into a message string | [`std/net/fetch.ts:3288`](../../std/net/fetch.ts) (keeps the code, flattens the fault's text), [`std/crypto/bcrypt.ts:2005`](../../std/crypto/bcrypt.ts), [`std/regex.ts:4968`](../../std/regex.ts) |
| `r.expect(message)` | Prints only `message`; the error itself never reaches stderr | `nish_panic`, [`runtime/runtime.c:835`](../../runtime/runtime.c) |

`orReturn()` already passes an error through unchanged, so a propagated chain is intact. Causes are lost only at a conversion, and that is because conversion is awkward: `orReturn()` needs the caller's error type to match, so every mismatch is a hand-written `isErr()` branch, and in that branch dropping the original is the easiest thing to type.

## Approach

Make keeping the cause the easy path, then make dropping it an error. This is the split Rust settled on: typed errors in libraries, a general error with context in applications.

1. **Libraries keep typed errors.** std and package APIs return error classes (`FetchError`, `SqliteError`) with structured fields and a statically typed `cause`. A caller can still branch on what happened.
2. **Applications use `Failure`.** It is a built-in error class (`message`, `cause`, optional `code`). Most programs never declare an error type; they return `Result<T, Failure>`.
3. **`r.context(message)` converts any error into a `Failure` and keeps the original as its cause.** It takes a string, not a callback, so it fits the function-reference rule that rules out `map` and `andThen`. It allocates only on the error arm. Converting and propagating become one line, with nothing to drop:
   ```ts
   const port = parsePort(text).context("parsing the port").orReturn();
   ```
4. **Any other conversion must keep the cause, or it does not compile** (S4, D2). The fix the diagnostic offers is `.context(...)`.

Causes are typed statically, not erased. A typed `cause` field names a concrete type, so the compiler knows each link's type and walks the chain with direct code, monomorphised per `E` the way `Result` is. `Failure.cause` is the one place a cause of any type is held: `context` renders the original's chain into `Failure` links as it converts. So the design needs no vtable and does not wait on WP60 (D5).

A library error, written by hand:

```ts
class ParseError {
  message: string;
  constructor(message: string) { this.message = message; }
}

class ConfigError {
  message: string;
  cause: ParseError | null;
  constructor(message: string, cause: ParseError | null) {
    this.message = message;
    this.cause = cause;
  }
}

const loadPort = (text: string): Result<i32, ConfigError> => {
  const r = parsePort(text); // Result<i32, ParseError>
  if (r.isErr()) {
    return Err(new ConfigError("bad port", r.error)); // the guard accepts this
  }
  return Ok(r.value);
};
```

An application, with `Failure`:

```ts
const loadPort = (text: string): Result<i32, Failure> => {
  return Ok(parsePort(text).context("bad port").orReturn());
};

errorChain(e); // ["bad port", "cannot parse 'x'"]
errorText(e);  // "bad port\ncaused by: cannot parse 'x'"
```

`r.expect("loading config")` on either Err prints:

```
loading config: bad port
caused by: cannot parse 'x'
```

## S0 — the proposal

This stage is one PR and changes docs only, the way WP62 and WP66 began. It writes [`docs/wp67-error-causes.md`](../../docs/wp67-error-causes.md) and [`docs/roadmap/wp67-error-causes.md`](../../docs/roadmap/wp67-error-causes.md), and registers them in `docs/roadmap/index.md`, `scalar.config.json`, `docs/MASTER_PLAN.md` and `docs/README.md`.

**Inventories.**
- **std sites.** A grep finds 54 `Err(` lines in 8 std files: bcrypt 26, bcrypt-batch 7, regex 4, sqlite 5, ring 4, term-io 4, shm 3, fetch 1. Postgres has none. The inventory sorts each one, and each null-fault site such as fetch's, into one of four kinds: pass-through, conversion that keeps the cause, conversion that flattens it, or conversion that drops it. S3 and S4 are measured against this list.
- **Guard hits.** Count where the S4 guard would fire in `std/`, `examples/`, `tests/cases`, `tests/link` and the guide's `nish:ok` snippets. Each hit's fix is either `.context(...)`, when its function may return `Failure`, or a typed `cause` field. That count sizes S4.

**Preconditions.** Each is answered with a test or a citation:

| | Question | Why it matters |
| --- | --- | --- |
| P1 | May a class field be `Self \| null`? LANGUAGE.md states no rule either way. | `Failure.cause: Failure \| null` and self-typed chains |
| P2 | May a discriminated union of classes be nullable? | A cause that can be one of several classes |
| P3 | A union variant's tag must be its first field (NL2523). Can a variant also carry `message` and `cause`, and can the walk narrow per variant? | The union walk |
| P4 | How do `src/emit-ts-*.ts` lower a builtin and a Result method, and must an untyped walk refuse them (`walk.missType()`)? | `--emit-ts` |
| P5 | Can expect's panic print a chain without allocating? `panics_oom` panics with no memory left. | S2's runtime design |
| P6 | Where does a built-in class live (`src/runtime.ts` and `runtime/nish.h`, or a `nish:` module), and what does `Failure` cost a program that never uses it? | Pay only for what you use |

**Decisions for the owner:**
- **D1, decided.** The field is named `cause`, matching ES2022 and `--emit-ts`.
- **D2, decided.** The guard is an error, not a warning. It has no opt-out: the only way past it is to keep the cause.
- **D3, decided.** Changing `expect`'s stderr is not treated as a breaking change for now.
- **D4, decided.** The chain walk stops at a link it has already visited (a chain that loops back, `a.cause = b; b.cause = a`) or after 64 links, and prints `(cause chain truncated)`. A cycle needs `cause` to be assigned after construction, since fields stay mutable. Making `cause` settable only in the constructor would rule cycles out, but it needs read-only fields, which Nish does not have.
- **D5, decided.** Do not wait for WP60. Concrete typed causes and `Failure` cover every case S0 found. A `Dyn<I>` cause becomes one more allowed cause type when WP60 stage 3 lands, with nothing to rework.
- **D6, decided.** `src/` adopts causes for its own errors once the rolling freeze allows it (S6).
- **D7, decided.** Add `Failure` and `r.context(message)` (S1), so that keeping the cause is the easy path.

## S1 — the rule, Failure, context and the builtins

**The error-type rule.**
- An *error type* is a `string`, an enum, a discriminated union of error classes (P3), or an *error class*: a class with a `message: string` field.
- An error class may also have a `cause` field. Its type is `string | null`, `C | null` for an error class `C` (P1 allows `C` to be the class itself), or a nullable union of error classes (P2).
- An enum is never a cause field's type, because an enum cannot be nullable (`reject_nullable_scalar`). An enum is still a valid top-level `E`.
- The rule is structural: no annotation and no base class. Two new codes:
  - one for a `cause` field of a non-error type;
  - one for `errorChain`, `errorText` or `context` on a non-error type.
- Each code lands with a `tests/link` negative that has an `expected.err`. An inline `tests/cases/reject_*` check does not count for this.

**`Failure`.**
- `class Failure { message: string; cause: Failure | null; code: i32 }`, declared in [`runtime/nish.d.ts`](../../runtime/nish.d.ts) with a doc comment per member.
- If P6 places it in the compiler, its layout lives in [`src/runtime.ts`](../../src/runtime.ts) and [`runtime/nish.h`](../../runtime/nish.h) together.
- `new Failure(message)` and `new Failure(message, cause)` construct one directly.

**`r.context(message)`.**
- Returns a `Result<T, Failure>`.
- On Ok, it is the same value with no allocation.
- On Err, it builds `Failure(message)` whose cause is the original, converted link by link: a `string` or an enum member becomes a `Failure` with that text; an error class becomes a `Failure` with its `message`, and its own `cause` is converted the same way; a `Failure` is linked as it is.
- Checked and lowered beside `expect` in [`src/result.ts`](../../src/result.ts) and [`src/emit-result.ts`](../../src/emit-result.ts). It joins the surface table in LANGUAGE.md.

**The chain builtins.** `errorChain<E>(e: E): string[]` and `errorText<E>(e: E): string` are free-function builtins:
- declared in `runtime/nish.d.ts` with `@param` and `@returns`;
- checked in [`src/builtins.ts`](../../src/builtins.ts) beside `parseInt`, and listed in [`src/capabilities.ts`](../../src/capabilities.ts);
- lowered per `E` in [`src/emit-builtins.ts`](../../src/emit-builtins.ts).

The walk renders each link as follows:
- A string is itself.
- An enum member is its name.
- An error class is its `message`, followed by its `cause`.
- A union narrows to each variant in turn and renders that variant.

**`--emit-ts`.** `Failure`, `context` and both builtins get a lowering through `walk.typeAt`, calling `walk.missType()` when the walk is untyped, or are refused there with a named reason (P4).

**Termination (D4).** The walk stops at a link it has already visited or after 64 links, and its last line says `(cause chain truncated)`.

**Escaping.** Causes carry peer text (an HTTP reason phrase, a TLS alert, a SQLite message), so each rendered link escapes C0 controls and DEL. This is attacker-facing output, so it lands with a `docs/security/` record and its row in `docs/security/README.md`. `node scripts/security-scope.mjs` must pass.

**Done also means:**
- IR cookbook entries;
- a guide section;
- `docs/reference` regenerated;
- the new cases registered as differential goldens.

`src/` may not use any of this until a release ships it (S6).

## S2 — expect prints every cause

`r.expect(m)` on an Err writes `m: <link 0>`, then one `caused by: <link n>` line per further link. The first-panic claim, `NISH_FUZZ_ABORT` and exit 1 are all unchanged.

A joined string would need a heap allocation, and `panics_oom` must still be able to panic. So the runtime gains a panic that writes in pieces (P5):
1. Claim the first panic.
2. Write each piece straight to fd 2.
3. Exit.

It is added to [`runtime/runtime.c`](../../runtime/runtime.c) and reserved in `src/c-symbols.ts` (`node tests/run.js c-symbols`). [`runtime/runtime-wasm.c`](../../runtime/runtime-wasm.c) gets the same entry: under wasm-host it emits each piece through `NISH_PANIC_MESSAGE` (runtime-wasm.c:590), and without wasm-host it stays a trap.

`panic(message)` takes no error and does not change. `tests/cases/res_expect_chain` asserts the stderr text and exit status, and `panics_expect` and `panics_oom` keep passing. Every `expect` site's IR moves, so the goldens, the `--emit-panics` goldens and the `DECLARED` entries in `tests/nish-cmp.js` move with it.

## S3 — std keeps every cause

std stays typed (Approach, point 1). `Failure` is for applications, and a std API does not return it.

| Site | Today | After |
| --- | --- | --- |
| [`std/net/fetch.ts:3288`](../../std/net/fetch.ts) | `FetchError(fault.code, "${name}: ${fault.text}")`. The code is kept and the fault's text is flattened. | `HttpClientFault` (fetch.ts:1698, not exported today) is exported with doc comments and becomes `FetchError.cause`. S3 decides whether `FetchError.text` keeps the flattened form, and checks the `FetchSyncClient.errorText` path (fetch.ts:2201). |
| [`std/crypto/bcrypt.ts:2005`](../../std/crypto/bcrypt.ts) | ``Err(`bcrypt: lane ${k}: ${why}`)`` | An exported `BcryptLaneError(lane, cause)` |
| [`std/regex.ts:4968`](../../std/regex.ts) | ``Err(`regex: ${p.error} at byte ${p.errorAt}`)`` | An exported `RegexError(message, at)` |
| `SqliteError`, `ShmError` | No cause | A `cause` only where S0 found an underlying failure |
| `PgError` | `lastError` and `lastNotice` fields; no `Err(` site | Unchanged unless S0 finds a conversion |
| Pass-through: bcrypt.ts:875, 896, 1861, 1923, 2076, bcrypt-batch.ts (per S0) and term-io.ts:1035 | `Err(x.error)` | Unchanged; they already keep the chain |

Turning a string error into a class is a breaking API change on 0.x (`feat(...)!`). Its release-note words go into `DECLARED`, and the squash subject carries them. Each touched file's `docs/security/` record and its README row are updated.

## S4 — the guard

**What it checks.** Inside a branch where `r` is narrowed to its error arm (`isErr()`, `!r.ok`, or the else of `isOk()`), a `return Err(x)` is a compile error (D2) unless the original is *kept*. Kept means exactly one of:
- `x` is `r.error` itself;
- `x` is a `new C(...)` whose argument for the parameter `C`'s constructor assigns to `this.cause` is `r.error`;
- `x` is a `new Failure(message, r.error)`.

Reading `r.error` anywhere else, such as in a template literal, `.length` or `startsWith`, does not count. So the flattening at bcrypt.ts:2005 is caught.

**The message and its fix.**
- The message is `` the failure in `r` is dropped: keep `r.error` as the new error's `cause`, or write `r.context("…")` ``.
- When the function returns `Result<T, Failure>`, the `--json` fix rewrites the branch to `.context(...)`.

**Placement.** The check sits beside `narrowResultTest` in [`src/result.ts:356`](../../src/result.ts), with the next free code in `src/codes.ts`, never reused and never moved.

**Out of its reach.** A null-fault site (fetch's `res === null` with an out-parameter fault) is not a narrowed Result, so S3 fixes those by hand.

**Landing clean.** S3 lands first. S4 fixes every hit S0 counted in `examples/`, `tests/` and the guide snippets in the same PR, so `node tests/run.js guide` stays green.

## S5 — the guide

[`docs/guide/language/errors.md`](../../docs/guide/language/errors.md), "Passing a failure up", teaches the Approach's two halves:
- `Failure` and `.context()` for applications, as the default;
- a typed error class with a `cause` for a library whose callers branch on the error.

The `ConfigError.BadPort` example keeps its cause. The page also shows `errorText`, the new `expect` output and a `nish:err` block for the guard. Every page that shows `expect` output or an old std error message is grepped and updated, along with the `docs/AI.md` idiom.

## S6 — the compiler

Per D6, the compiler adopts causes for its own errors once the rolling freeze allows it. `src/` may not use `Failure`, `context`, the chain builtins or a `cause` the guard checks until a release ships them and that release is the seed. S6:
1. waits for that release;
2. lists every place `src/` converts one Result error into another;
3. keeps the cause at each one;
4. turns the guard on for `src/`.

A change to `src/` also runs `node tests/run.js wasi` and `node tests/run.js performance`, and regenerates the checked goldens.

## Out of scope

- `throw`, `try`, `Error`, inheritance and `AggregateError`.
- `map`, `andThen` and `orElse`.
- Implicit conversion (`From<E>`); `context` is an explicit call.
- Finding a cause by type (Go's `errors.As`), which can come later as `causeOf<C>(e)`.
- Stack traces.
- Compiler diagnostics' own related-notes field.
- N-API bridging of class errors, which today carries only number and boolean payloads.

## Tests

- **S1.**
  - `tests/cases/err_chain_{string,enum,class,self,union,cycle,cap,escape}` and `tests/cases/res_context_{ok,string,enum,class,failure}`, each with a `.ll` golden, an `llvm-as` pass and a `.out`. Mirror `res_basic`, `res_propagate` and `res_unwrap`.
  - `res_context_ok` shows the Ok arm allocates nothing.
  - The two new codes, each provoked by a `tests/link` negative with an `expected.err`.
- **S2.** `tests/cases/res_expect_chain` (stderr and exit 1), mirroring `panics_expect`. `panics_oom` must still pass.
- **S3.** For each changed std module, a case that provokes the failure and asserts that `errorChain` reaches the original link.
- **S4.**
  - `tests/link` negatives, each with an `expected.err`: one per narrowing spelling, plus one for an interpolated `r.error`.
  - Positives for pass-through, a stored cause and `.context()`.

A `tests/run.js` filter is a substring match and passes with zero matching cases. Each stage's run is read for its case count, not only its exit status.

## Verification

Each stage's `verification` line, plus the definition of done in `CLAUDE.md`:

- `npm run check` and `npm run lint`, each run bare.
- For `src/` changes: `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance`.
- For `runtime/` changes: `node tests/run.js c-symbols`.
- For new positive cases: `node tests/self/goldens.js --update` and `node tests/differential/goldens.js --update`.
- For `std/` and `nish.d.ts` changes: `node scripts/gen-reference.mjs`.
- `node tests/nish-cmp.js` wherever IR moves.
- All eight CI shards green.

---
name: WP67 — every error keeps its cause chain
overview: Nish errors are Result values, and today a function that converts one failure into another drops the original (the guide's own example does), std flattens causes into message text, and expect prints only its own message. Give error classes a typed cause field, a builtin that renders the whole chain, make expect and std keep and print every link, and make it a compile error for a conversion to drop the failure it converts.
stages:
  - id: s0-proposal
    title: S0 — the WP67 proposal (docs only)
    goal: docs/wp67-error-causes.md and docs/roadmap/wp67-error-causes.md exist, every claim checked against main, the std conversion-site inventory recorded, owner decisions D1 to D6 recorded (D5 still open).
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: inventory-sites
        content: Inventory every error conversion site in std/ (an isErr branch or null fault that returns a new Err) with file, line and what it keeps or drops — see S0 — the proposal
        status: pending
      - id: check-preconditions
        content: Confirm a class may hold a nullable field of its own type and of a class union, and how expect and panic reach nish_panic — see S0 — the proposal
        status: pending
      - id: design-note
        content: Write docs/wp67-error-causes.md with the cause rule, the chain builtin, the expect format, the guard, std adoption and decisions D1 to D6 — see S0 — the proposal
        status: pending
      - id: roadmap-page
        content: Write docs/roadmap/wp67-error-causes.md (stages S1 to S5 unticked) plus its docs/roadmap/index.md rows, scalar.config.json route and docs/MASTER_PLAN.md and docs/README.md rows — see S0 — the proposal
        status: pending
  - id: s1-cause-rule
    title: S1 — the cause field and the chain builtin
    goal: A class with message and a typed cause field is an error class, and errorChain(e) returns every link's text, ending on a cycle or at the depth cap.
    verification: node tests/run.js err_chain && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    todos:
      - id: lang-rule
        content: Add the error-class rule (message plus optional cause of an error type) to docs/LANGUAGE.md under Result and error handling — see S1 — the cause field and the chain builtin
        status: pending
      - id: builtin-chain
        content: Add errorChain and errorText to runtime/nish.d.ts with doc comments, checked in src/members.ts and lowered per E in src/emit-result.ts — see S1 — the cause field and the chain builtin
        status: pending
      - id: chain-cycle-cap
        content: Stop the walk on a revisited link or after 64 links and say so in the last line — see S1 — the cause field and the chain builtin
        status: pending
      - id: chain-escape
        content: Escape control bytes in each link so peer-supplied text cannot drive the terminal — see S1 — the cause field and the chain builtin
        status: pending
      - id: s1-tests
        content: Add tests/cases/err_chain_* (string, enum, class, union cause, cycle, cap) with .ll goldens and .out, plus reject_err_chain_* negatives — see Tests
        status: pending
  - id: s2-expect
    title: S2 — expect prints the error and every cause
    goal: r.expect(msg) on an Err prints msg, the error and one caused-by line per link on stderr, exit status 1 unchanged.
    verification: node tests/run.js res_unwrap && node tests/run.js res_void && node tests/run.js panics && node tests/run.js wasi
    todos:
      - id: expect-lowering
        content: Lower expect's error arm through errorText before nish_panic in src/emit-result.ts — see S2 — expect prints every cause
        status: pending
      - id: expect-wasm
        content: Carry the same text through NISH_PANIC_MESSAGE in runtime/runtime-wasm.c under wasm-host — see S2 — expect prints every cause
        status: pending
      - id: expect-goldens
        content: Regenerate the .ll goldens and the --emit-panics goldens that move and add DECLARED entries in tests/nish-cmp.js — see S2 — expect prints every cause
        status: pending
  - id: s3-std
    title: S3 — std keeps every cause
    goal: Every std error class has a cause field and every conversion site in the S0 inventory stores the original instead of folding it into text.
    verification: node tests/run.js std && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/nish-cmp.js
    todos:
      - id: std-classes
        content: Add cause to FetchError, HttpClientFault, SqliteError, ShmError and PgError with doc comments — see S3 — std keeps every cause
        status: pending
      - id: std-string-errors
        content: Replace string concatenation at std/crypto/bcrypt.ts:2005 and std/regex.ts:4968 with an error class carrying the original as cause — see S3 — std keeps every cause
        status: pending
      - id: std-fetch
        content: Keep the HttpClientFault as FetchError.cause at std/net/fetch.ts:3288 and update its docs/security record — see S3 — std keeps every cause
        status: pending
      - id: std-reference
        content: Regenerate docs/reference with node scripts/gen-reference.mjs and the checked goldens with node tests/self/goldens.js --update — see S3 — std keeps every cause
        status: pending
  - id: s4-guard
    title: S4 — the guard against a dropped cause
    goal: A return Err(x) inside a branch narrowed to r.isErr() whose x never reads r.error is a diagnostic with a fix that stores it as the cause.
    verification: node tests/run.js link && node scripts/gen-diagnostic-codes.mjs --check && node tests/run.js std
    todos:
      - id: guard-check
        content: Add the dropped-cause check to the Result narrowing pass in src/expressions.ts with the next free code in src/codes.ts — see S4 — the guard
        status: pending
      - id: guard-negative
        content: Add a tests/link negative with expected.err that provokes the new code, and positives for pass-through and stored causes — see S4 — the guard
        status: pending
      - id: guard-std-clean
        content: Build std/ and the examples under the guard with zero hits — see S4 — the guard
        status: pending
  - id: s5-guide
    title: S5 — the user guide and the agents' idiom
    goal: docs/guide/language/errors.md teaches the cause field, the chain and the guard, and its ConfigError.BadPort example keeps its cause.
    verification: node tests/run.js guide && node docs/check-links.mjs && npm run lint
    todos:
      - id: guide-page
        content: Rewrite Passing a failure up in docs/guide/language/errors.md and add a cookbook entry and docs/AI.md idiom — see S5 — the guide
        status: pending
      - id: roadmap-tick
        content: Tick each stage on docs/roadmap/wp67-error-causes.md in the PR that lands it — see S5 — the guide
        status: pending
  - id: s6-self
    title: S6 — the compiler keeps its own causes
    goal: Once a release ships errorChain and the guard, src/ is built under the guard with zero hits and each of its error conversions keeps its cause.
    verification: bash scripts/fetch-seed.sh --force && node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js --update && npm run check
    todos:
      - id: self-wait-release
        content: Start only after the release carrying S1 to S4 is the seed in build/seed — see S6 — the compiler
        status: pending
      - id: self-inventory
        content: List every src/ site that converts one Result error into another — see S6 — the compiler
        status: pending
      - id: self-adopt
        content: Give each src/ error class a cause and store it at every listed site, then turn the guard on for src/ — see S6 — the compiler
        status: pending
---

# WP67 — every error keeps its cause chain

## Context

Nish has no `Error`, no `throw` and no `try` ([`docs/LANGUAGE.md`](../../docs/LANGUAGE.md), "Result and error handling"). A failure is the `E` of a `Result<T, E>`: a `string`, an enum or a class. Classes have no inheritance (`reject_cls_extends`), and there is no dynamic dispatch yet (WP60, proposed). So ES2022's `Error.cause` has nothing to attach to, and causes are lost in three places:

| Where | What happens today | Evidence |
| --- | --- | --- |
| A conversion between error types | The original is dropped. The guide teaches it: `if (r.isErr()) { return Err(ConfigError.BadPort); }` | [`docs/guide/language/errors.md`](../../docs/guide/language/errors.md), "Passing a failure up" |
| std wrapping | The cause is folded into message text, and its code and fields are lost | [`std/net/fetch.ts:3288`](../../std/net/fetch.ts), [`std/crypto/bcrypt.ts:2005`](../../std/crypto/bcrypt.ts), [`std/regex.ts:4968`](../../std/regex.ts) |
| `r.expect(message)` | Prints only `message`; the error itself never reaches stderr | `nish_panic`, [`runtime/runtime.c:835`](../../runtime/runtime.c) |

`orReturn()` already passes an error through unchanged, so a propagated chain is intact. Only a *conversion* loses information, and nothing detects it.

## Approach

Causes are typed statically, not erased. With no inheritance or `Dyn<I>`, a cause field names a concrete error type: a `string`, an enum, an error class or a discriminated union of error classes. So the compiler knows each link's type and can walk the chain with direct code, monomorphised per `E` the way `Result` itself is. The design needs no vtable and does not wait on WP60. When `Dyn<I>` lands, `cause: Dyn<Failure> | null` becomes one more allowed cause type (D5).

```ts
class ConfigError {
  message: string;
  cause: ParseError | null;      // any error type, nullable; optional field
  constructor(message: string, cause: ParseError | null) { … }
}

const loadPort = (text: string): Result<i32, ConfigError> => {
  const r = parsePort(text);
  if (r.isErr()) {
    return Err(new ConfigError("bad port", r.error));   // the guard accepts this
  }
  return Ok(r.value);
};

errorChain(e);   // string[]: ["bad port", "cannot parse 'x'"]
errorText(e);    // "bad port\ncaused by: cannot parse 'x'"
```

`r.expect("loading config")` on that Err prints:

```
loading config: bad port
caused by: cannot parse 'x'
```

## S0 — the proposal

This stage is one PR and changes docs only, the way WP62 and WP66 began. It writes [`docs/wp67-error-causes.md`](../../docs/wp67-error-causes.md) and [`docs/roadmap/wp67-error-causes.md`](../../docs/roadmap/wp67-error-causes.md), and registers them in `docs/roadmap/index.md`, `scalar.config.json`, `docs/MASTER_PLAN.md` and `docs/README.md`.

- **Inventory.** List every std site that returns a new `Err` from inside an `isErr()` branch or after a null fault, with file:line and what it keeps (pass-through, text, nothing). Today's grep finds 44 `Err(` sites across 8 std files. The note records the complete list, and S3 and S4 are measured against it.
- **Preconditions.** Confirm that a class field may be `Self | null` and a union of classes (no sidecar flag), and trace how `expect` and `panic` lower to `nish_panic`. If a precondition fails, the note names the stage that lifts it.
- **Decisions for the owner:**
  - D1, decided: the field is named `cause`, matching ES2022 and `--emit-ts`.
  - D2, decided: the guard is an error, not a warning. It has no opt-out: the only way past it is to keep the cause.
  - D3, decided: changing `expect`'s stderr is not treated as a breaking change for now.
  - D4, decided: the chain walk stops at a link it has already visited (a chain that loops back, `a.cause = b; b.cause = a`) or after 64 links, and prints `(cause chain truncated)`.
  - D5, open: whether a cause of any error type (`Dyn<Failure>`) waits for WP60 stage 3. The recommendation is not to wait: ship concrete typed causes now and add `Dyn` as one more cause type when WP60 lands.
  - D6, decided: `src/` adopts causes for its own errors once the rolling freeze allows it (S6).

## S1 — the cause field and the chain builtin

- **Rule.** An *error type* is a `string`, an enum, a discriminated union of error classes, or a class with a `message: string` field. Its optional `cause` field has an error type, nullable. This is a structural rule with no annotation and no base class. A `cause` field of a non-error type is refused (negative test).
- **Builtins.** `errorChain<E>(e: E): string[]` and `errorText<E>(e: E): string`, declared in [`runtime/nish.d.ts`](../../runtime/nish.d.ts) with `@param`/`@returns` (`scripts/gen-reference.mjs --check`). The walk renders each link as follows:
  - A string is itself.
  - An enum member is its name.
  - A class is its `message`.
  - A union switches on its tag.
- **Termination.** Classes are references, so a cycle is possible. The walk stops at a link it has already visited, or after 64 links, and its last line says `(cause chain truncated)`.
- **Escaping.** Causes carry peer text (an HTTP reason phrase, a TLS alert, a SQLite message), so each link escapes C0 controls and DEL before it is printed. Because this is attacker-facing output, the change lands with a `docs/security/` record row.
- **Freeze.** `src/` may not call either builtin until the next release ships them.

## S2 — expect prints every cause

`r.expect(m)` on an Err writes `m: <link 0>`, then one `caused by: <link n>` line per further link, through the existing `nish_panic`. The first-panic claim, `NISH_FUZZ_ABORT` and exit 1 are all unchanged. Under wasm-host the same text goes through `NISH_PANIC_MESSAGE`; without it, the trap stays a trap. `panic(message)` takes no error and does not change. This moves IR for every `expect` site, so it needs regenerated goldens, `--emit-panics` goldens and `DECLARED` entries in `tests/nish-cmp.js`.

## S3 — std keeps every cause

| Site | Today | After |
| --- | --- | --- |
| `std/net/fetch.ts:3288` | `FetchError(code, "${name}: ${fault.text}")` | `FetchError(code, name, fault)` with `cause: HttpClientFault \| null` |
| `std/crypto/bcrypt.ts:2005` | ``Err(`bcrypt: lane ${k}: ${why}`)`` | `BcryptLaneError(k, parsed.error)` |
| `std/regex.ts:4968` | ``Err(`regex: ${p.error} at byte ${p.errorAt}`)`` | `RegexError(p.error, p.errorAt)` |
| `SqliteError`, `ShmError`, `PgError` | No cause | `cause` where an underlying failure exists |
| Pass-through sites (`bcrypt.ts:875…2076`, `term-io.ts:1035`) | `Err(x.error)` | Unchanged; they already keep the chain |

Changing a string error to a class is a breaking API change on 0.x (`feat(...)!`), and its release-note words go into `DECLARED`. For the std/net and std/crypto files, check the scope of their [`docs/security/`](../../docs/security/README.md) records and update them.

## S4 — the guard

Inside a branch where `r` is narrowed to its error arm (`isErr()`, `!r.ok`, or the else of `isOk()`), a `return Err(x)` whose expression never reads `r.error` is a compile error (D2) with this message: `` the failure in `r` is dropped: keep `r.error` as the new error's `cause` ``. Passing `r` itself or `r.error` anywhere in `x` satisfies the guard. The check sits beside the existing Result narrowing in `src/expressions.ts`, with the next free number in its band in `src/codes.ts` (never reused, never moved). It ships with a `tests/link` negative that has an `expected.err`. S3 lands first, so std builds clean under the guard.

## S5 — the guide

The guide's `ConfigError.BadPort` example becomes the `ConfigError(message, cause)` shown above. The page also shows `errorText`, the new `expect` output and an `nish:err` block for the guard. Every page that shows `expect` output or an old std error message is grepped and updated, along with `docs/AI.md` and the IR cookbook.

## S6 — the compiler

Per D6, the compiler adopts causes for its own errors once the rolling freeze allows it. `src/` may not use `errorChain`, `errorText` or a `cause` the guard checks until a release ships them and that release is the seed. S6 waits for that release, lists every place `src/` converts one Result error into another, gives each error class a `cause`, and turns the guard on for `src/`. A change to `src/` also runs `node tests/run.js wasi` and `node tests/run.js performance`, and regenerates the checked goldens.

## Out of scope

- `throw`, `try`, `Error`, inheritance and `AggregateError`.
- `map`, `andThen` and `orElse`.
- Implicit conversion (`From<E>`) or an `orReturn` that wraps.
- Stack traces.
- Compiler diagnostics' own related-notes field.
- N-API bridging of class errors, which today carries only number and boolean payloads.

## Tests

- **S1.** `tests/cases/err_chain_{string,enum,class,union,cycle,cap,escape}`, each with a `.ll` golden, an `llvm-as` pass and a `.out`. Negatives are `reject_err_cause_type` and `reject_err_chain_non_error`. Mirror `res_basic` and `res_propagate`.
- **S2.** Stderr and exit-status checks in `tests/run.js`, mirroring the `r.status === 1` checks near line 1884. Also update the `res_unwrap` and `res_void` goldens and the `panics_*` cases.
- **S3.** For each changed std module, add a case that provokes the failure and asserts that the chain reaches the original link.
- **S4.** One `tests/link` negative per narrowing spelling, and positives for pass-through and stored causes.

## Verification

Each stage's `verification` line, plus the definition of done in `CLAUDE.md`:

- `npm run check` and `npm run lint`, each run bare.
- `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance` for `src/` changes.
- `node tests/self/goldens.js --update` and `node tests/differential/goldens.js --update` for new positive cases.
- `node scripts/gen-reference.mjs` for `std/` and `nish.d.ts`.
- All eight CI shards green.

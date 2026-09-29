# WP33: The round trip — TypeScript into Nish, and back out

**Decided (§7, 2026-09-28); R1's portability half is built: the class, its
flag and all eleven codes, with NL8005 live and the other rows landing in their
own stages.** This is the plan of record for one
requirement with two directions, and one constraint on both:

1. **In.** A team with an ordinary TypeScript project can move it to Nish, and
   an agent can do most of that move by driving the compiler, with the
   project's own test suite still answering "is it the same program?" at every
   step.
2. **Out.** A Nish program can always go back to TypeScript that runs on Node,
   Bun or a browser and means what the native build meant, so adopting Nish is
   never a one-way door.

The constraint: **neither direction may cost the native build anything.** No
instruction, no attribute, no byte of layout, in a program that uses none of
it. The round trip is paid for at compile time and on the TypeScript side,
never in the binary (§1 rule 6).

And a rule for the language itself, which is the part that outlives any tool:
**every decision is made with the TypeScript reading of the program in view**
(§2), so the distance between the two stays small and every remaining difference
is written down with its translation.

[LANGUAGE.md](LANGUAGE.md) stays normative, and this note adds no rule to it;
where they disagree, LANGUAGE.md wins. The way in is
[wp28-compatibility-mode.md](wp28-compatibility-mode.md)'s job, and this note
does not restate it. It adds the three things wp28 does not have: a ledger of
where the two readings differ (§3), the compiler output an agent needs (§5),
and the way out (§4). The way out is also the successor to WP13's rewriter
([wp13-differential.md](wp13-differential.md)), which died with stage0
([wp19-stage0-retirement.md](wp19-stage0-retirement.md), whose frozen
`tests/differential/goldens/rewrites.txt` is all that is left of it).

Every divergence in §3 was reproduced for this note: `nish` 0.12.0 against
Node 22.22 with `runtime/nish.mjs`, and Bun 1.3.11, in `--number-mode f64`
unless the row says otherwise.

---

## 1. The decision

**Build both directions on one mechanism: the checker's facts, written out as
edits to the source text.** Six rules:

1. **A Nish program is a TypeScript program, and every place its meaning
   differs is a ledger row with a mechanical translation.** A difference with
   no translation is a bug in the language, not a limitation of the tool (§2,
   class D).
2. **The way out is a patch over the source, not a pretty-printer.** The
   checker records the span and type of every expression. `--emit ts` takes the
   original text and rewrites only the class-C sites (§3), so comments,
   formatting, names and module structure survive untouched. Code that already
   means the same thing is not reprinted at all.
3. **The way in uses the same edit format.** A diagnostic whose fix is
   mechanical carries that fix as edits in `--json` (§5.1). The agent applies
   the safe ones, reasons about the rest from the diagnostic's own rewrite hint,
   and reruns. In both directions the compiler states facts and proposes edits,
   and the agent or the person decides.
4. **Every intermediate state of a migration is still runnable TypeScript.**
   This is what makes the way in safe without a rewriter: the project's own
   test suite, run under Node, is the oracle after every step. It stays an
   oracle only while the code is in classes A and B. So the compiler must say
   where each class-C site is (§5.2), and those are the only places where "the
   tests still pass" proves nothing.
5. **The way out is tested by the corpus.** Every program with a `main` is
   emitted as TypeScript, run under Node, and compared with its native binary.
   That replaces the frozen rewrites and restores the fuzz differential that
   WP19 lost (§4.5).
6. **The native build pays nothing.** Everything in this note is a compile-time
   analysis, a diagnostic, or TypeScript the compiler writes out. None of it is
   a change to the IR a program already compiles to. Where the two readings
   differ because Nish's meaning is the fast one (i32 arithmetic, a checked
   `slice`, contiguous records, UTF-8 strings), **Nish's meaning stays**, and
   the difference becomes a translation on the way out and a flagged site on
   the way in. Two existing tests hold every stage to it: the `.ll` goldens
   must not move, since no stage here changes a lowering, and
   `bench/instructions.json`'s gate (21 programs under cachegrind, 0.1%
   tolerance, run by `npm test`) must not rise. A proposal that needs either to
   move is out of scope for this note, and goes through its own measured work
   package the way every lowering does.

The thesis, because it is the argument for spending on this at all:

> **An exit path is what makes the way in cheap to say yes to.**

A team does not adopt a compiler for a subset of its language if leaving means
rewriting. With `--emit ts`, trying Nish on one hot module costs a branch, and
backing out costs one command. The ledger in §3 is what makes that promise
honest rather than hopeful.

MASTER_PLAN §1 lists "JS semantics for `number` overflow" as a non-goal and
interop "in one direction only". Neither changes. The way out does not give
Nish JavaScript's meaning. It writes Nish's meaning in JavaScript
(`(a + b) | 0` is an `add i32`). Interop is about linking a binary to a host,
which §4.4 uses as-is.

---

## 2. The TypeScript reading, in four classes

Take a Nish program, strip the types, and run it as TypeScript. Every
construct, builtin and layout decision falls into exactly one class:

| Class | What it means | Allowed? | The oracle |
| --- | --- | --- | --- |
| **A — identical** | Same source, same output. | Always. | TS tests prove it. |
| **B — safety net** | Native stops (exit 1, or a compile error) where TS carries on with `undefined`, `NaN` or a wrong value. A program that never trips the check prints the same thing both ways. | Always. It is Nish being stricter, never different. | TS tests prove it for every program that passes them. |
| **C — translated** | The two readings differ, and `--emit ts` writes Nish's meaning in TS at that site. | When Nish's meaning is measurably faster, or taking TS's would cost the native build anything, and only with its translation stated in the same change. | TS tests prove nothing *at that site*. §5.2 names it. |
| **D — untranslatable** | The two readings differ, and no local rewrite recovers Nish's meaning. | **Never.** One found is a bug to close. | — |

B is what the bounds check is. `a[i]` out of range is a panic natively and
`undefined` in TS. No correct Nish program can depend on the `undefined`,
because `a[i]` is typed `T`, never `T | undefined`, so the check only ever stops
a program that is already wrong. The same holds for `pop()` on an empty array,
`charCodeAt` past the end, integer division by zero, and every compile-time
rejection (a rejected program has no TS reading to disagree with).

C is where both directions pay, and **C is where speed lives**. Every
performance decision the language has made that departs from JavaScript is a C
row: wrapping i32, the checked `slice`, contiguous records, UTF-8. Moving any
of them to A would mean giving up the speed, so they stay C. The cost lands
outside the binary instead. On the way out, each C row is a helper or an idiom
in the emitted TS. On the way in, each C row is a place where TS code that
passed its tests can compile to a Nish program that answers differently, with
no error. That second cost decides whether a C row is acceptable: **the way in
must be able to flag every site where it applies**, which is a type question
the checker already answers.

---

## 3. The ledger

Every known difference between the two readings, its class, and what closes or
translates it. "Resolution" is a proposal, and the owner's decisions are
collected in §7.

### 3.1 Numbers

| Divergence | Reproduced | Class | `--emit ts` writes | Resolution |
| --- | --- | --- | --- | --- |
| `number` is `i32` by default: `+ - *` wrap (or are UB without `--wrapping`), `/` truncates | LANGUAGE.md | C | `(a + b) \| 0`, `Math.imul(a, b)`, `idiv(a, b)` | Keep. The translation is one token per operator, and the way in must default to f64 (wp28 §5.3), so ingested code never silently truncates. |
| `u8` / `u16` / `u32` wrap | LANGUAGE.md | C | `& 0xff`, `& 0xffff`, `>>> 0` | Keep. |
| `i64` / `u64` are native 64-bit | the prelude throws at the first mixed arithmetic | C | `bigint`, `BigInt.asIntN(64, …)` / `asUintN` | Keep. The type becomes `bigint`, which is also the honest TS type. |
| `i32 >>> n` reads back signed | `-1 >>> 0` is `-1` | C | `(a >>> n) \| 0` | Keep. It is the documented wart that `u32` exists for. |
| `toI32` from `f64` saturates | `toI32(5e10)` | C | a runtime helper, already in `shim.mjs` | Keep. |
| `Math.min` / `max` with a NaN operand, `Math.round(-0.3)` | known-failures | C | runtime helpers, `min`/`max`/`round` | Keep. Cheap to translate exactly. |
| 1-ulp `sin` / `cos` / `log` / `pow` | known-failures | — | nothing | Platform noise, not a language difference: two native targets can disagree the same way. Stated, not translated. |
| integer divide by zero, `MIN / -1` | known-failures | B | `idiv`, which panics as native does | — |
| signed overflow is UB without `--wrapping` | LANGUAGE.md | B | wrapping, via the `\| 0` above | A program that overflows is wrong natively, and the TS reading picks one defined answer. |

### 3.2 Strings

| Divergence | Reproduced | Class | `--emit ts` writes | Resolution |
| --- | --- | --- | --- | --- |
| `.length`, `charCodeAt`, `indexOf`, `slice`, `substring` count **UTF-8 bytes** | `"héllo".length` is 6 natively, 5 in TS | C | `utf8.length(s)`, `utf8.slice(s, a, b)`, … | **Keep it (§7 Q1).** Out is easy, since the helpers are exact. In is narrower than it looks: code that only passes offsets between string methods is consistent in either unit, and it breaks only where an offset or code unit meets a fact from outside. That means a length printed or stored, a non-ASCII literal compared with `charCodeAt`, or a hard-coded offset into non-ASCII text. Those are the sites §5.2 flags. |
| `slice(a, b)` panics outside `[0, length]`, where JS clamps, and takes no negative index | `"abcdef".slice(2, 10)` panics natively and is `cdef` in TS; `slice(-2, 6)` panics natively and is `ef` in TS | C | a `slice` helper that panics | **Keep it.** [wp15-performance.md](wp15-performance.md) §4 measured the clamp at 13 x86-64 instructions per call (1.18x on a lexer-shaped scan). A check can be proven away and a clamp cannot: `opt -O2` deletes every `slice` check on constant offsets. `substring` already keeps JS's exact clamping, so the way in has a spelling for code that depends on it. The ingest fix rewrites `s.slice(-n)` to `s.slice(s.length - n)`, and `slice(a, b)` that may overrun to `substring` (`review`: they differ when `a > b`). |
| `parseInt`, `parseFloat`, `Number(s)` follow Nish's rules | RUN_UNDER_NODE.md | C | runtime helpers | Keep. The prelude today replaces the *global* `parseInt`, which changes other JS in the same process. The helpers in §4.3 are imports instead. |

### 3.3 Arrays and records

| Divergence | Reproduced | Class | `--emit ts` writes | Resolution |
| --- | --- | --- | --- | --- |
| **A record put into an array is copied** (`push`, `[p, q]`, `ps[i] = p`, per [Arrays of records are contiguous](LANGUAGE.md#arrays-of-records-are-contiguous)) | `ps.push(p); p.x = 9` then `ps[0].x` is `1` natively and `9` in TS; `[p, p]` then writing `ps[0].x` leaves `ps[1].x` alone natively and changes it in TS | C | `{ ...p }` at each copy-in site (the copy is shallow natively too: a nested record field is a pointer, so the spread is exact) | Keep the layout, which is what makes `Point[]` vectorise. **On the way in, flag the aliasing** (§5.2): a write to a record, or to an element, while the other copy is still read afterwards. |
| **A store into a slot overwrites what an element reference sees** | `const r = ps[0]; ps[0] = q` then `r.x` is `q.x` natively and the old value in TS | C | a field-by-field copy into the existing element: `ps[0].x = q.x; ps[0].y = q.y` | As above. Together the two translations are exact: a copy in is a fresh object, and a store is a write into the object already in the slot. |
| `new Array<T>(n)` zero-fills | `new Array<f64>(3)` then `a[1] + 1.0` is `1` natively and `NaN` in TS | C | `new Array<T>(n).fill(0)` (`false` for `boolean`) | Keep. The translation is exact and obvious to a reader. |
| `Float64Array` and the other three typed-array names are `f64[]`, with `push` and `pop` | `t.push(5.0)` is a `TypeError: t.push is not a function` in TS | C | `number[]` for a binding that ever calls `push` or `pop`, the typed array otherwise | **Open, §7 Q4.** The alternative is to refuse `push`/`pop` on the four names, which makes the row A. |
| `dst.set(src, offset)` on an array of numbers ([Bulk writes](LANGUAGE.md#bulk-writes-set-and-fill), WP34 N2) | a `u8[]` is a plain `Array` under Node, and `Array` has no `set`: a `TypeError` without the prelude. `runtime/nish.mjs` adds `Array.prototype.set` with the typed array's copy-first meaning and the native panic, and the `bytes_*` programs agree byte for byte under it | C (A under the prelude) | an imported `set(dst, src, at)` helper, the prelude's own | Keep. `fill` needs no row: `Array.prototype.fill` already has `TypedArray.prototype.fill`'s meaning for every argument Nish admits, so it is class A (§3.6). A range past the end panics natively and under the prelude, where a real typed array throws a `RangeError`: class B, as `a[i]` is. |
| `ctSelect` / `ctEq` over `u64` ([Constant time](LANGUAGE.md#constant-time-ctselect-and-cteq), WP34 N6) | a `u64` is a BigInt under `runtime/nish.mjs` and a bare `u64` literal a `number`, so a call mixing the two throws a `TypeError` there; over BigInts alone the prelude's answers are the native ones, which `ct_prelude` in `tests/run.js` checks against `ct_u64` | C, as all 64-bit arithmetic is | BigInt operands throughout, as `--emit ts` writes every `u64` | Keep. Over `u32` both are class A (§3.6): pure functions whose answers the prelude puts back in range with `>>> 0`, and `ct_select_u32` and `ct_eq_u32` agree unmodified. The timing is not part of any reading: Node promises no constant time. |
| `a[i]` out of range, `pop()` on empty, `charCodeAt` past the end | panics natively; `undefined` / `NaN` in TS | B | nothing | — |
| a ranged integer, `integer<Lo, Hi>`, leaves its range | an exit-1 panic natively, silent in TS, where `runtime/nish.d.ts` makes it `number` ([wp31-ranged-integers.md](wp31-ranged-integers.md) §6) | B | nothing | The check is what lets the compiler drop other checks, so it is a speed feature as well as a safety net. |

### 3.4 Control flow and errors

| Divergence | Reproduced | Class | `--emit ts` writes | Resolution |
| --- | --- | --- | --- | --- |
| `x.orReturn()` returns from the caller | an uncaught exception under the prelude | C | `const t = x; if (t.isErr()) return Err(t.error); … t.value` hoisted to the statement | Keep. It is the language's `?`, and the rewrite is local to its statement. The checker already knows the statement and the function's `Result` type. |
| `Ok`, `Err`, `Result` | globals the prelude installs | C | an import from the runtime (§4.3) | Keep. |
| `panic(msg)` | exit 1 | A with an import | an import | — |

### 3.5 The host

| Divergence | Reproduced | Class | `--emit ts` writes | Resolution |
| --- | --- | --- | --- | --- |
| `write`, `readFileSync`, `getenv`, `spawnSync`, `monotonicNanos`, `toI32`, `Arena`, … are **ambient globals** | they need `runtime/nish.mjs` installed first | C | named imports from the runtime (§4.3) | Keep the ambient spelling in the language, and emit imports. The globals are why the source cannot be bundled or tree-shaken as it stands. |
| `nish/<module>` and `nish:fs` specifiers | resolved by a Node loader hook | C | the package's own specifiers (`@amritk/nish/threads`, …; `package.json` already exports `./*` to `std/*.ts`) | — |
| `export const main` is the entry, and its return is the exit code | nothing calls it under Node | C | a two-line entry module that calls `main` and exits with its answer | — |
| `enum` | Node's `--experimental-strip-types` refuses it (not erasable); Bun accepts it | C | a `const` object and a type of the same name | — |
| `console.log` prints `String(x)` | Node's console inspects: `-0` prints as `-0` | C | the runtime's `log` | — |
| the prelude needs Node | Bun cannot load it (`registerHooks` is not in Bun's `node:module`); a browser cannot load `shim.mjs` (`node:fs`, `node:child_process`, `process`) | — | — | Split the runtime by host (§4.3). |
| scoped tasks, `using s = scope()` | the tasks run one after another at each `spawn` under Node, and together at the block's end natively; the checker refuses every program where the two could print differently ([LANGUAGE.md](LANGUAGE.md#scoped-tasks-using-s--scope)) | A | the source as written | Node 22 needs `--js-explicit-resource-management` for `using`, and Node 24 has it natively. `--emit ts` output targets the host's `using` support, or lowers the block to a `try`/`finally` for a host without it. |
| `declare function` (FFI) and `CPtr` | no JS counterpart (`ffi_scalar` in known-failures) | not a TS program | the module stays native and is imported through `--emit-napi` or wasm (§4.4) | This is the only row with no TS reading, and it is not D: the interop layer already gives it a *JS* reading, one module at a time. |

### 3.6 Identical, for the record

Class A today, and each one is a rule to keep A: `Map` and `Set` (insertion
order, `get` answers `V | undefined`); `T | null` and narrowing; classes
(reference semantics, static dispatch, which cannot differ now that there is no
inheritance); compile-time function parameters and non-capturing arrows;
`for...of` over an array; `fill` on an array of numbers, clamped ends and
all; `ctSelect` and `ctEq` over `u32`; template literals; f64 arithmetic; `std/threads.ts`'s
parallel calls, whose std bodies are their sequential meaning; ASI.

---

## 4. The way out: `--emit ts`

```
nish src/main.ts --emit ts -o out/      # one .ts per module, and out/entry.ts
node out/entry.ts                       # or bun, or a bundler for a browser
```

### 4.1 What it writes

- **One `.ts` per module, at the same relative path, with the same exports.**
  An import between two emitted modules stays as it was written.
- **The source text, with edits only at class-C sites.** The checker already
  records every expression's span and type, and the edit list is a side table
  like every other fact the emitter reads (orientation rule 1). A class-A file
  is copied byte for byte. That makes the output reviewable as a diff against
  the input, which is how a team will read it.
- **Types kept.** `i32`, `u8` and the rest become `number`, through
  `import type { i32 } from "@amritk/nish/runtime"`, so the intent survives as
  documentation. `i64` and `u64` become `bigint`.
- **The emitted TS type-checks under `tsc --strict`**, and a test holds it to
  that.

### 4.2 Faithful first, idiomatic by ratchet

The output is faithful: it means what the native build meant, helpers
included. A team that is leaving for good then removes helpers one by one,
because each one is a place where it chooses JS's meaning over Nish's. That is
wp28's ratchet run backwards, and the number of runtime imports left is the
dashboard. A `--emit ts` flag for "idiomatic, drop the helpers" is declined
(§8): it would be the only way to leave that changes the program's meaning
without saying where.

### 4.3 The runtime, split by host

Today's `runtime/shim.mjs` is one module that imports `node:fs`,
`node:child_process` and `node:os`. It becomes:

- **`@amritk/nish/runtime`**: the host-agnostic core. Integer helpers, UTF-8
  string helpers, `Result`, `Ok`, `Err`, `panic`, `log`, `parseInt`,
  `parseFloat`, the conversions and `Arena` as no-ops. No `node:` import and no
  `process`, so it bundles for a browser.
- **`@amritk/nish/runtime/node`**, **`…/bun`**, **`…/browser`**: the file
  system, environment, process and clock. The browser adapter answers what a
  browser can (`monotonicNanos` from `performance.now`, `getenv` as `null`),
  and a file-system call there is a `panic` that names the host.

`runtime/nish.mjs`, the prelude for running source unmodified, keeps working and
becomes a thin layer over these. The package's `exports` already maps
`./runtime/*`, so no new package is needed.

### 4.4 Leaving one module at a time

A module that declares C functions, or one a team wants to keep fast, stays
native. The rest of the program imports it through the addon or wasm module the
compiler already emits (`--emit-napi`, `--emit-dts`, wasm). That makes the way
out incremental in the same shape as the way in: a program can be half TS and
half Nish for as long as the team likes, and the boundary is a module import on
both sides.

### 4.5 How it is tested

`tests/differential/` gains a live mode again. Every program in the corpus with
a `main` is emitted with `--emit ts`, run under Node, and compared with its
native binary on stdout, stderr and exit status. Class-B programs (the ones
that panic) must still exit 1 with the same message, because the helpers panic
as the native build does. `known-failures.txt` shrinks to the libm row and the
FFI rows. The fuzz differential against Node, which WP19 lost with the
rewriter, runs over `--emit ts` output instead. And `tsc --strict --noEmit`
over the emitted corpus keeps the output honest TypeScript.

---

## 5. The way in, for an agent

wp28 decides what the compiler *accepts* in compat mode and how the ratchet
works. This section is what the compiler *tells an agent* while it does the
work, and none of it waits for compat mode. It is useful against strict today.

### 5.0 Every refusal names its rule

The agent's first input is the diagnostic, and today the diagnostic for most of
ordinary TypeScript is the wrong one. The parser stops at syntax the language
forbids before Phase 0 can name the rule (wp19's declared divergence 602). So
the rule's message, its code and its rewrite hint never reach the agent.
`nish` 0.12.0, `--json`, one construct each; a row R1 has closed gives what
the compiler says since:

| Written | First diagnostic | Count | The rule LANGUAGE.md documents |
| --- | --- | --- | --- |
| `var x = 1` | `NL1036`, the rule (R1, stage 1) | 1 | `` `var` is forbidden; use `let` or `const` `` |
| `a == 1` | `NL0001` syntax error: expected `)`, found `==` | 8 | `NL1047` Loose equality is forbidden; use === / !== |
| `o?.x` | `NL0001` syntax error: expected `;`, found `?.` | 3 | Optional chaining `?.` is forbidden … (narrow with `!== null` instead) |
| `try { } catch (e) { }` | `NL1033`, the rule (R1, stage 1) | 1 | `` `try`/`catch`/`finally` is forbidden … use `Result<T, E>` `` |
| `typeof 1` | `NL0001` syntax error: expected `;`, found `NUMBER` | 1 | `` `typeof` is forbidden in Nish (no runtime type tags) `` |
| `async (): void => {}` | `NL0001` syntax error: expected `;`, found `:` | 3 | `` `async` functions are forbidden in Nish … `` |
| `for (const k in a)` | `NL1056`, the rule (R1, stage 1) | 1 | `` `for...in` is forbidden … use `for...of` ``, a code of its own since R1 ([Rejected statements](LANGUAGE.md#rejected-statements)) |
| `throw 1` | `NL1001`, the rule | 1 | reached |

**The parser must read all of TypeScript's syntax**, and refuse each construct
in the phase that owns its rule, with one diagnostic per construct. wp19 costed
this at grammar for 43 constructs, and it is the precondition for everything
else in this section: a fix cannot be attached to a cascade of syntax errors. It
also makes LANGUAGE.md's forbidden-construct table true for these rows, which it
is not today.

### 5.1 Fixes in `--json`

A diagnostic with a mechanical rewrite carries it:

```json
{"file":"src/a.ts","line":4,"column":9,"endLine":4,"endColumn":13,"severity":"error","code":"NL1047","message":"Loose equality is forbidden; use === / !==","fix":{"safety":"exact","edits":[{"line":4,"column":11,"endLine":4,"endColumn":13,"text":"==="}]}}
```

- **`safety: "exact"`**: applying it cannot change what the program means
  (`var` to `let` where the binding is not hoisted across a use, `==` to `===`
  where both sides have one type, an inferred return type written out). An
  agent applies these without review, and so does `nish fix`.
- **`safety: "review"`**: the rewrite is what the program almost certainly
  means, but it touches a class-C row (`.length` on a string the agent cannot
  prove is ASCII, a copy into a record array). An agent applies it and checks
  the site.
- **no `fix`**: a judgement call (a closure to a top-level function, a
  `try` to a `Result`, a union to a class). The message already carries the
  rewrite in words (wp28 §3's `= rewrite:` line), which is what an agent needs.

`fix` is one new optional field on the existing flat object. A consumer that
ignores unknown fields is unaffected, but the shape is part of the contract
(orientation rule 7), so §7 Q5 asks for it explicitly.

### 5.2 The `portability` diagnostic class

A warning at every class-C site in the program, with `--json` and a code in a
new band, off by default and on under `--compat` and `--emit ts`, and
`--warn-portability` until they exist. It prints in the shape every
diagnostic has, the summary line and the excerpt, with `portability` as the
kind ([LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags)):

```
src/table.ts:41:17: portability: `name.length` counts UTF-8 bytes here, and UTF-16 units in TypeScript
  41 |   const width = name.length;
     |                 ^~~~~~~~~~~
```

Under `--json` it is one object with `"severity":"portability"` and its NL8xxx
`code`.

It is the map both directions need. On the way in, it lists exactly where "the
tests still pass" stops being evidence, which is what an agent should look at
by hand or cover with a new test. On the way out, it is the list of places
`--emit ts` will put a helper. Most of the facts are the checker's already
(the type of `name`, which array a record was copied into), so the class is
cheap. Two rows need a new analysis. Record aliasing reuses the
element-reference tracking behind `reject_arr_element_across_push`. The string
row (§3.2) follows where an offset or a code unit flows, and flags it only
where it meets an outside fact. Both are warnings, so neither changes the IR
(§1 rule 6).

### 5.3 The loop an agent runs

1. Compile with `--compat --json` (wp28), or with `--json` against strict
   before compat exists.
2. Apply every `exact` fix. Rerun.
3. For each `review` fix and each `portability` warning, apply or rewrite, and
   add a test where the site's meaning is not already covered.
4. For each diagnostic with no fix, rewrite by hand from its `= rewrite:` line.
5. Run the project's TS test suite under Node after every step. Since
   everything the agent writes is still TypeScript, the suite is the oracle for
   every class-A and class-B change.
6. When it compiles, run the same tests natively. Where the project has none,
   `--emit ts` output under Node against the native binary is the differential.
7. Narrow `nish.compat` (wp28 §5.2) until it is empty.

[AI.md](AI.md) gains a section that states this loop, and an agent skill can
wrap it. Neither is worth writing before §5.1 and §5.2 exist.

---

## 6. The rule for every future change

This is what "keep it in mind as we design the language" means in practice.

1. **Every new construct, builtin or semantics decision states its TypeScript
   reading: A, B or C, and for C the translation.** It goes in the PR and in
   the construct's LANGUAGE.md rule. Once `--emit ts` exists, a C construct
   ships with its translation and its `portability` warning in the same PR, the
   way a construct ships with its golden `.ll` today. The step is in
   [ARCHITECTURE.md](ARCHITECTURE.md#how-to-add-a-construct).
2. **No new D.** A construct with no TS reading is refused, or given one first.
3. **Prefer A only when it is free.** Take JavaScript's meaning when it costs
   the native build nothing, measured: the `.ll` goldens of the programs that
   do not use the construct unchanged, and `bench/instructions.json` not
   raised. Anything more and the row stays C. `substring` is the example of
   both at once: it has JS's clamping at a measured cost, and `slice` stays
   beside it as the fast, checked one (§3.2).
4. **A layout decision must be invisible in the TS reading, or a C row with a
   flag.** Inline array fields already meet the first standard ("no program can
   tell the two layouts apart"). Contiguous record arrays do not (§3.3), which
   is why they need the `portability` flag. `Map` refused interface values for
   exactly this reason ([wp32-map.md](wp32-map.md) §1, row 7).
5. **A divergence must buy something measured.** i32 buys integer speed,
   contiguous records buy vectorisation, the checked `slice` buys 13
   instructions a call, and UTF-8 buys memory and C interop. Each is priced in
   its own note. A C row with no number beside it becomes A, **unless becoming
   A would cost the native build**, in which case the number gets measured and
   written down.
6. **Compatibility work never changes a lowering.** A stage of this note that
   moves a `.ll` golden or an instruction count is wrong by construction.
   Changes to how something compiles go through their own work package, with
   the measurement every lowering needs.

---

## 7. Decisions

The owner took every recommendation below on 2026-09-28, with not losing
performance as the deciding constraint (§1 rule 6). Each row is now the plan,
and the stages in §9 build it.

| # | Question | Options | Decision |
| --- | --- | --- | --- |
| Q1 | String offsets | (a) keep UTF-8 bytes, C row, flagged on the way in; (b) keep UTF-8 storage but make `.length` and offsets UTF-16 units, with an "all ASCII" bit in the string header; (c) UTF-16 storage | **(a).** (b) and (c) both cost the native build: (b) puts a header bit test on every `.length` and `charCodeAt` and makes offsets O(n) on non-ASCII text, and (c) doubles the memory of ASCII text and breaks C interop. Rule 6 rules both out. (a) keeps MASTER_PLAN §3.4's decision, and §3.2's narrower flag keeps the way in reviewable. |
| Q2 | Default `number` | i32 in strict and f64 in compat (wp28 §5.3), or f64 everywhere | **Leave it as wp28 has it.** Strict keeps i32's speed, and the way out handles it in one token per operator. Ingested code starts in f64, where it means what it meant. Moving a module to i32 is then a step on wp28's ratchet: a measured speed-up, with the §5.2 flags as the checklist of what could change. |
| Q3 | Record copies | (a) C row, flagged on the way in (§3.3); (b) a checker rule that rejects every observable aliasing; (c) store records by pointer, as JS does | **(a).** (c) gives up the contiguous layout that makes `Point[]` vectorise. (b) costs nothing natively, but it refuses programs that are fine, and the flag already names the site. |
| Q4 | Typed-array names | (a) translate to `number[]` where `push`/`pop` is used; (b) refuse `push`/`pop` on the four names | **(b).** A compile-time refusal, so the IR of every program that still compiles is unchanged. It is breaking but small, and it makes the row A. A program that pushes writes `f64[]`, which is what it meant. |
| Q5 | `fix` in `--json` | a nested `fix` field on the diagnostic; or separate `{"severity":"fix"}` lines | **The field.** One object per diagnostic is the contract, and the fix belongs to the diagnostic. |
| Q6 | `slice` | JS clamping and negative indices, or keep the panic | **Keep the panic** (§3.2). The clamp is measured at 13 instructions a call and can never be proven away. `substring` is the JS-exact spelling. |

---

## 8. Declined

- **An "idiomatic" `--emit ts` that drops the helpers.** It changes what the
  program means with no record of where. The ratchet in §4.2 gets there one
  reviewed site at a time.
- **A JS-to-Nish transpiler that accepts arbitrary TypeScript.** wp28 §2.2
  refuses the dynamic tier permanently, and nothing here changes that. The way
  in is for statically typed TypeScript, which is what an agent can bring into
  that shape.
- **Emitting JavaScript instead of TypeScript.** TS keeps the types, and a
  stripper turns it into JS in one step on every host. The reverse direction
  loses the types for good.
- **Printing the AST.** It loses comments and formatting, and it makes every
  file look changed. The source-patch approach in §1 rule 2 keeps both, and the
  output diff against the input shows what actually changed.

---

## 9. Staging

| Stage | What | Why in this order |
| --- | --- | --- |
| **R0** | This note; the ledger in [RUN_UNDER_NODE.md](RUN_UNDER_NODE.md) brought up to date; the TypeScript-reading step in ARCHITECTURE.md's checklist | Makes the rule binding before any tool exists. |
| **R1** | The `portability` class (§5.2); the parser reading all of TypeScript's syntax (§5.0) | Both directions need the map, it is cheap, and it is useful on its own. The parser is what makes every diagnostic an agent reads name its rule. |
| **R2** | Close the rows that are free to close: typed-array names (Q4), a compile-time refusal. | Every row closed now is a helper `--emit ts` never needs and a warning an agent never reads. Only compile-time changes qualify (§1 rule 6). |
| **R3** | The runtime split by host (§4.3) | `--emit ts` imports from it, and Bun and the browser need it anyway. |
| **R4** | `--emit ts` (§4), with the live differential (§4.5) | The exit door, and the oracle §5.3 step 6 leans on. |
| **R5** | `fix` in `--json` and `nish fix` (§5.1); the AI.md section | The agent loop, once the compiler can say where the risks are. |
| **R6** | wp28's compat mode, on wp28's own staging | The way in widens once there is a safe way back out. |

**R1's portability half is built.** `--warn-portability` runs the pass
(`src/portability.ts`), the band is NL8xxx with every row's code registered
(`portabilityRules` in `src/codes.ts`), and the rows are documented in
[LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags). NL8005, the
zero-filled `new Array<T>(n)`, is live; the number, string and record rows are
three stages written against the pass's row signature, and
`tests/wordings/unreachable.txt` names the ones not live yet. The parser half
(§5.0) is not started.

R4 comes before R5 on purpose. The way out is what makes the way in low-risk,
and it is also what gives R5 its differential.

Every stage is held to §1 rule 6 by the tests `npm test` already runs: no
`.ll` golden moves, and the instruction gate stays green without its baseline
being raised. R1's parser work and R5's fixes also touch the compiler's own
speed, which nothing gates today. A stage that changes the parser or the
checker times the compiler building itself (`scripts/bootstrap.sh --verify`)
before and after, and says the number.

What the native build does not pay, the TypeScript side does. `--emit ts`
output is slower than hand-written TypeScript wherever a helper stands in for
a Nish meaning, and the UTF-8 string helpers are the expensive ones. The i32
idioms (`| 0`, `Math.imul`) are the ones V8 already optimises best. That is
the right place for the cost: a team runs the emitted TypeScript because it is
leaving, or while it decides, and §4.2's ratchet removes each helper once the
team chooses JS's meaning at that site.

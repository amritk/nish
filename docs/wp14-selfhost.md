# WP14 — Self-hosting

The goal that closes the project: **a compiler for StaticTS, written in
StaticTS, that compiles its own source.** Everything below is the definition
of that claim, the proof we will accept for it, and the ordered list of what
is missing today.

This note is the plan of record for the work. `docs/LANGUAGE.md` stays
normative for what the language *is*; this file says what it must become and
why.

---

## 1. What "compiles itself" means here

Two compilers exist by the end, and only the second one is self-hosted.

| | Source | Written in | Built by |
| --- | --- | --- | --- |
| **stage0** | `src/` | TypeScript on Node, parsing with the `typescript` package | `tsc` |
| **stage1** | `self/` | StaticTS | stage0 |
| **stage2** | `self/` | StaticTS | stage1 |
| **stage3** | `self/` | StaticTS | stage2 |

stage0 is not going away. It is the bootstrap seed, it is what `npm install
-g statictsc` ships today, and it stays the reference implementation: a
program that stage0 and stage1 disagree about is a bug in one of them, and
saying which is a diff.

stage1, stage2 and stage3 are *the same program* — `self/`. They differ only
in which compiler built the binary. So:

```
IR(stage1, self/)  ==  IR(stage2, self/)      byte for byte
```

is the self-hosting proof. If the compiler stage0 built and the compiler
stage1 built emit the same text for the same input, the source has reached a
fixed point and nothing about stage0 leaks into the result any more. stage3
exists only so the binaries can be compared as well as the IR; it must be
byte-identical to stage2.

There is a second, stronger equality worth aiming at but not worth blocking
on:

```
IR(stage0, self/)  ==  IR(stage1, self/)
```

That says the TypeScript implementation and the StaticTS implementation agree
on the IR for the self-hosted compiler's own source. It only holds while
`self/` uses no construct the two lower differently, so it is a check we
enable per-file as the port lands, not a milestone.

### The test

The WP14 section of `tests/run.js` runs the stages and compares. It is
skipped, not failed, without LLVM, the same as every other toolchain-dependent
check (`.claude/testing.md`). Until stage1 exists it is a compile gate — stage0
must compile every module of `self/` cleanly — so it is green from the first
commit and grows one stage comparison at a time. That gate is not a formality:
it fails the moment `self/` reaches for something the language does not have,
which is rule 1 of §5 enforced by the suite rather than by good intentions.

---

## 2. StaticTS-0: the subset `self/` is written in

The trap in every bootstrap is writing the compiler in more language than the
compiler implements. **StaticTS-0** is the fixed, deliberately small subset
that `self/` may use, and the closure condition is that StaticTS-0 is a subset
of what `self/` compiles. Every line of `self/` is checked against that.

StaticTS-0 is today's language plus §3, minus everything `self/` does not need.
Notably `self/` is written **without**:

- generics, arrow functions, closures, nested functions, function values;
- `type` aliases, `enum`, `namespace`, `static` members, getters/setters;
- `try`/`catch` — diagnostics are collected into an array and a failed parse
  returns a sentinel node, the way the error recovery in a real front end
  works anyway;
- inheritance and downcasts, because of the decision in §2.1.

### 2.1 One `Node` class, not a class hierarchy

StaticTS has single inheritance (WP2b) but no downcast, and adding one would
mean a runtime tag check, a `T | null` result, and a new rule in the checker
for a cast that can fail. A bootstrap compiler does not need any of that.

`self/` uses **one `Node` class** with a `kind: i32` discriminant and the union
of the fields any node needs — children in a `Node[]`, a `text: string`, a
couple of numeric payloads. Field access is unchecked by the type system and
guarded by `kind` instead, exactly as `switch (node.kind)` already reads. It
costs memory we do not care about and it removes downcasting from the critical
path entirely.

The same trick applies to types and symbols: one `TypeInfo`, one `Symbol`,
each with a `kind`.

### 2.2 No hash-map builtin

Name lookup is a `StringMap`: a class in `self/` over parallel `string[]` and
`i32[]` arrays with FNV-1a hashing and linear probing. Beyond the bitwise
operators of A5 it needs no language feature that is not already listed here,
so it is library code, not compiler work. Resist the urge to add `Map<K, V>` to the language for it — that would
drag in generics, which is a work package of its own and is not on the path.

### 2.3 String building

The emitter produces text, and `s = s + t` in a loop is quadratic. `self/`
builds output through a `StringBuilder` over a `string[]` plus one `join` at
the end. `join` is therefore a language requirement (§3), not a convenience.

---

## 3. The gap, in dependency order

What the language is missing before `self/` can be written. Each row is a
construct and ships with everything in the `docs/ARCHITECTURE.md` checklist:
a golden `.ll`, an `llvm-as` pass, a native round trip, a `reject_*` case, a
`docs/LANGUAGE.md` rule and a cookbook entry.

### Wave A — the front end cannot be written without these

| # | Construct | Why `self/` needs it |
| --- | --- | --- |
| A1 | `switch` / `case` / `default` | Every phase is a dispatch on a node kind. Without it each table is an `if` chain. |
| A2 | `charCodeAt`, `substring`, `indexOf`, `startsWith`, `endsWith`, `String.fromCharCode` | A lexer is `charCodeAt` in a loop and `substring` at the end. |
| A3 | Module-level `const` | Token kinds, node kinds and keyword tables. Today they would be magic numbers repeated at every use site. |
| A4 | `pop`, `indexOf`, `join` on arrays | `pop` is the scope stack and the block stack; `join` is §2.3. |
| A5 | `& \| ^ ~ << >> >>>` and their compound forms | The `StringMap` of §2.2 hashes with FNV-1a, which is a multiply and an XOR. These were never forbidden — they fell through the checker's operator table into the "not implemented" bucket. |

### Wave B — the back end and the plumbing

| # | Construct | Why `self/` needs it |
| --- | --- | --- |
| B1 | `readFileSync` returning the whole source, `writeFileSync`, `process.argv` | Present already (WP7); confirm they are enough for a real CLI and fix what is not. |
| B2 | Integer formatting and parsing round trip | `${n}` covers formatting; parsing needs `parseInt` on a substring. |
| B3 | Whatever the port turns up | Kept honest by rule: a missing construct is added to the language, with its tests, before the line of `self/` that wanted it is written. |

Nothing in Wave A or B is a new *kind* of thing — no generics, no closures, no
GC, no exceptions. That is the point of §2: the subset was chosen so that
self-hosting needs no change to the model, only more of the same.

---

## 4. Milestones

| | Deliverable | Proof |
| --- | --- | --- |
| **S1 Lexer** | `self/lexer.ts` tokenises StaticTS-0 | A token dump of every `tests/cases/*.ts` matches a golden; the lexer built by stage0 runs natively |
| **S2 Parser** | `self/parser.ts` builds the `Node` tree of §2.1 | The tree dump matches stage0's `--emit-ast` for the corpus, modulo the documented shape differences |
| **S3 Checker** | `self/checker.ts` — types, scopes, the side tables | Every `reject_*` case in `tests/cases/` is rejected by both compilers with the same message |
| **S4 Emitter** | `self/emit.ts` — IR text | `IR(stage0, p) == IR(stage1, p)` for a growing whitelist of `tests/cases/` |
| **S5 Bootstrap** | `self/` compiles `self/` | `IR(stage1, self/) == IR(stage2, self/)`, and stage3 is byte-identical to stage2 |

S1–S4 are each useful on their own and each testable against stage0, which is
what keeps this from being a single unlandable change. S5 is the day the
compiler compiles itself.

---

## 5. Rules for this work package

These are in addition to `docs/MASTER_PLAN.md` §7, not instead of it.

1. **A construct enters the language before it enters `self/`.** Wanting it
   for the port is not a reason to skip its `reject_*` case or its cookbook
   entry. `self/` is the customer, not the exception.
2. **`self/` is a StaticTS program.** It follows `docs/LANGUAGE.md` and the
   StaticTS half of `.claude/typescript.md` — `function` declarations,
   `interface` for structs, no arrow functions, no `type` aliases. The house
   rules for `src/` do not apply to it, and `biome.json` must exempt it the
   way it already exempts `examples/` and `bench/`.
3. **stage0 is the oracle.** Every `self/` phase is tested by comparing it
   with the corresponding stage0 output over `tests/cases/`, not by a golden
   written by hand. A disagreement is triaged before the next phase starts.
4. **The runtime budget still holds.** Self-hosting is not a licence to grow
   `runtime.c` past §2 of the master plan. Lower inline instead.
5. **StaticTS-0 does not grow quietly.** Adding a construct to the subset in
   §2 is an edit to this file and a line in `CHANGELOG.md`, because every
   addition is something stage1 must then implement in order to compile
   itself.

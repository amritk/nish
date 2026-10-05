# WP14 — Self-hosting

**Status: complete.** S1–S4 landed one milestone at a time; S5, the compiler
compiling itself to a fixed point, landed in #6. The TypeScript twin, stage0,
was frozen at S5 and deleted in WP19 R6 (#150, released in 0.7.0); the record
of that is [wp19-stage0-retirement.md](wp19-stage0-retirement.md). This note
keeps the definitions, decisions and measurements that still explain `src/`.
The working map of the compiler is [`.claude/selfhost.md`](../.claude/selfhost.md);
`docs/LANGUAGE.md` stays normative for what the language is.

---

## 1. What "compiles itself" means here

`src/` is the compiler, written in Nish. The seed builds stage1 from it,
stage1 builds stage2, and stage2 builds stage3:

```
IR(stage1, src/)  ==  IR(stage2, src/)      byte for byte
stage3            ==  stage2                byte for byte, as files
```

The first equality is the self-hosting proof: if the compiler the seed built
and the compiler stage1 built emit the same text for the same input, the source
has reached a fixed point and nothing about the seed leaks into the result. The
second compares the binaries as well as the IR.

While stage0 was the seed there was a third, stronger equality,
`IR(stage0, src/) == IR(stage1, src/)`: two independently written
implementations agreeing on the self-hosted compiler's own source. It held for
every module from S5 until R6. With a released `nish` as the seed it would only
ask whether codegen changed since that release, so `tests/self/bootstrap.js`
no longer asserts it and `scripts/bootstrap.sh --verify` reports it
(wp19 §3, G3).

### The test

`tests/self/bootstrap.js` runs the chain and compares; `npm test` runs it, and
it skips rather than fails without LLVM. It began as a compile gate — every
module of `src/` must compile — and that gate is the point: it fails the moment
`src/` reaches for something the compiler does not implement, which is rule 1
of §6 enforced by the suite.

---

## 2. Nish-0: the subset `src/` is written in

The trap in every bootstrap is writing the compiler in more language than it
implements. **Nish-0** is the fixed subset `src/` may use. It is written
**without** generics, closures, nested functions or function values (a
top-level `const` bound to an arrow is a declaration, not a value, and is how
`src/` declares a function since WP22 stage C); `type` aliases, `enum`,
`namespace`, `static` members, getters and setters; `try`/`catch`; and
inheritance or downcasts. The current list, kept in step with this one, is in
`.claude/selfhost.md`; adding to it is rule 5 of §6.

### 2.1 One `Node` class, not a class hierarchy

Nish has single inheritance but no downcast, and adding one would mean a
runtime tag check, a `T | null` result and a checker rule for a cast that can
fail. So `src/` uses **one `Node` class** with a `kind: i32` discriminant and
the union of the fields any node needs (`src/nodes.ts`). Field access is
guarded by `kind`, exactly as `switch (node.kind)` reads. It costs memory and
removes downcasting from the critical path. Types and symbols follow the same
pattern: a type is an `i32` interned in a `TypeTable`.

### 2.2 No hash-map builtin

Name lookup is `StringMap` / `StringSet` in `src/map.ts`, library code over
parallel arrays with FNV-1a hashing. Adding `Map<K, V>` to the language for
it would have dragged in generics, which were not on the path. (WP18 later
added generics and WP32 a global `Map`, whose layout `src/map.ts` now shares;
Nish-0 still uses neither.)

### 2.3 String building

`s = s + t` in a loop is quadratic, so `src/` builds its output through a
`StringBuilder` and one `join`. That made `join` a language requirement (§3),
not a convenience.

---

## 3. The gap, measured

The gap between the language and what a compiler needs was taken from two
sweeps that agreed: a census of stage0's 53 files (every library facility and
every string and array method it used) and probe programs compiled against
the language of the day. Every row shipped with the full
`docs/ARCHITECTURE.md` checklist, and all of them are done.

- **Wave A, the front end:** `switch` (lowered to LLVM's `switch`, so a jump
  table), the string methods a lexer needs (`charCodeAt`, `substring`,
  `indexOf`, `startsWith`, `endsWith`, `String.fromCharCode`), module-level
  `const`, array `pop` / `indexOf` / `join`, and the bitwise operators.
- **Wave B, the back end:** `f64ToBits` / `bitsToF64` (LLVM accepts only
  float literals that round-trip, so the emitter writes `double 0x...`),
  `console.error` and a newline-free write, `readFileSyncOrNull` (a file read
  that can fail without exiting the process), and contextual `[]` in a field
  assignment.
- **Wave C, library code with no language change:** `src/strings.ts`
  (`StringBuilder`, byte-wise `compareStrings`, `jsonQuote`, the LLVM `c"..."`
  escape, hex float formatting), `src/map.ts` and `src/paths.ts`, plus a
  stable merge sort for the golden-compared diagnostic order. Two shape
  decisions remain load-bearing: `StringMap` iterates in **insertion order**,
  because a hash order would make a golden-compared dump depend on the table
  size; and `src/paths.ts` matches `node:path` **exactly, quirks included**,
  because D3's failure mode is a `..` normalised differently. The test is
  `tests/self/support-oracle.js`, which compares against `node:path`,
  `JSON.stringify` and the other implementations each function mirrors.

**`join` is a hard requirement.** Building 88 KB of IR text by repeated `+`
cost **180 MB of peak RSS**, because every concatenation copies and the arena
never reclaims. `join` is therefore the fast shape: one pass summing the
lengths, one allocation, one `memcpy` per part.

**Deliberately not added:** nullable *field* narrowing (a sound rule would
have to invalidate on every call; `const p = n.parent; if (p !== null)` is one
line and one load), and the constructs §2 designs around.

## 3a. Decisions this forces

**D1. Error recovery without exceptions.** stage0 threw `CompileError` from
292 sites and caught it in six load-bearing places. `src/` uses
error-value threading — a diagnostic array, an `ERROR` sentinel type and
status returns — which is genuinely worse than `try`/`catch` (a caller can
forget to test a sentinel) but keeps WP10's multi-error guarantee. `panic(msg)`
was added so internal invariants keep their messages; the parser still reads
`throw` and `try` so it can refuse them by name.

**D2. A central `switch`, not dispatch tables.** stage0 added a construct by
registering it in a table, touching no other file. `src/` dispatches with one
`switch` on the node kind per layer, because it is the smallest shape and it
compiles to a jump table. The cost, accepted: a construct is an entry in the
central `switch` as well as in its family's module, and pairings that locality
used to enforce (a builtin's `emit` and its `callees`) sit side by side in
`src/emit-builtins.ts` and need a test.

**D3. Module resolution is a hazard, not tedium.** Module identity is the
resolved path, and a `..` normalised differently from Node loads one file
twice, stops cycles terminating and invents duplicate-symbol errors. Hence
§3's exact `node:path` match. A module's *name* is resolved against the name
the importer was given, so it stays relative and the output does not depend on
the working directory; its *identity*, the key it is loaded once under, is the
path made absolute and lexically normalised (`Compilation.identityOf`), which
closed the case of one file reached as `./types.ts` and as `types.ts` (#197).

**D4. stage1 should not link.** Linking meant `spawnSync` and `mkdirSync`
builtins and runtime growth, so stage1 first emitted `.ll` only and a wrapper
script linked. That was right for the proof, which compares IR, and for the
order of the work. It was reversed at the end, with the bill in §7a.

**D5. Measure peak memory before S5, not after.** `src/` allocates everything
from a bump arena it never releases while the AST lives. Measured at S5, below:
it does not matter at this size.

## 4. Milestones

| | Deliverable | Proof at the time |
| --- | --- | --- |
| **S1 Lexer** | `src/lexer.ts` | Token stream equal to the `typescript` scanner's: 482 of 482 files (`tests/lexer-oracle.js`) |
| **S2 Parser** | `src/parser.ts`, the `Node` tree of §2.1 | Tree equal to the `typescript` parser's, span for span: 447 of 447 files (`tests/parser-oracle.js`) |
| **S3 Checker** | `src/checker.ts`, types, scopes, side tables | Every `reject_*` case refused with the same message (`tests/self/reject-oracle.js`); the `--emit-checked` dump equal to stage0's |
| **S4 Emitter** | `src/emit.ts`, IR text | `IR(stage0, p) == IR(stage1, p)` over the whole corpus, no whitelist |
| **S5 Bootstrap** | `src/` compiles `src/` | The equalities of §1 |

S1 and S2 were new code — stage0 had no lexer or parser of its own — so they
went first and the project was re-decided at a gate after them on three
questions: did Nish-0 hold, how far off was the line count, and what did the
oracle cost. Nish-0 held at every milestone with nothing added except, at S5,
the parenthesised type (`(Local | null)[]`, `N_TYPE_PAREN`), which entered the
language with its golden, negative, rule and cookbook entry first. The ports
came in near the size of the code they replaced rather than at twice it, and
the oracles found real bugs on both sides cheaply: four in S1–S2, all the
front end "having opinions" the scanner did not (the lexer now lexes `==` and
`?.` and leaves the refusing to the parser); wrong *attributes* in stage0 at
S4, the class a golden `.ll` is worst at catching. The escape analysis wanted
parent links, which `src/parents.ts` builds once as a side table indexed by
`Node.id`; the checker threads the contextual type down instead.

Most of those oracles compared against stage0 and went with it in R6;
`tests/lexer-oracle.js`, `tests/parser-oracle.js`, `reject-oracle.js` and
`support-oracle.js` survive, and wp19 records what replaced the rest.

**D5, measured.** Compiling the whole of `src/` at S5 — 41 modules, 16,700
lines, 4 MB of IR — cost stage1 **86 MB of peak RSS and 91 ms**, against
stage0's 178 MB and 786 ms: a factor of 8.6 in time and half the memory. The
never-released arena does not matter at that size. The same run also caught
`src/lexer.ts` breaking §2.3 inside its own string scan (fixed: 400 KB of
literal text went from 408 MB and 392 ms to 2.4 MB and 10 ms).

**The module header.** stage0 resolved module names against `process.cwd()`;
stage1 has no working directory to ask and resolves against the name it was
given (D3). For an entry named relatively the two agree string for string,
which is why the comparison was byte for byte rather than normalised.

### `-g` on both sides

`src/debug.ts` is the DWARF emitter: a compile unit, a `DISubprogram` per
function, a `DILocation` on every instruction, `llvm.dbg.value` /
`llvm.dbg.declare`, and the type mapping down to the packed `Result` word a
call boundary carries (WP17). `-g` reaches `scripts/build.sh` too, so the DWARF
survives the link. A `DIFile`'s directory is written as `.`, as clang's
`-fdebug-compilation-dir=.` writes it, so a `-g` build depends only on the
command line and not on where it ran. A struct is described against the file
that declares it, so a program with imports has more than one `DIFile`.
`tests/cases/dbg_locals` and `dbg_result` pin it.

---

## 5. Performance is the tiebreaker

The project's northern star is the speed of what the compiler produces. Where
a language decision has two defensible answers, the faster lowering wins, and
"faster" means measured. Three examples:

- **Shift counts are masked** (`shl x, (b & 31)`), matching JavaScript and
  removing LLVM's out-of-range-shift UB. `llc -O3` emits byte-identical
  assembly for the masked and unmasked forms on x86-64 and aarch64, because
  both ISAs mask in hardware. Free, so it stays.
- **`switch` is integer-only**, so it lowers to LLVM's `switch` and a jump
  table. A string `switch` would be a chain of `nish_str_eq` calls wearing a
  `switch`'s clothes; `if`/`else` says that honestly.
- **String methods lower inline**: `charCodeAt` is a bounds check and a
  `load i8`. That keeps `runtime.c` in budget and lets LLVM optimise through
  the operation.

Self-hosting serves the same star: the compiler is a native binary with no
Node process to start.

## 6. Rules for this work package

In addition to `docs/MASTER_PLAN.md` §7.

1. **A construct enters the language before it enters `src/`**, with its
   golden, `llvm-as` pass, native round trip, negative case, `LANGUAGE.md` rule
   and cookbook entry. Once meant "stage0 first"; amended by
   [wp19 §1a](wp19-stage0-retirement.md#1a-the-doubling-ends-before-r6), and
   today it is the rolling freeze: `src/` may not *use* a construct until the
   seed that builds it is a release that compiles it.
2. **`src/` is an Nish program**, following `docs/LANGUAGE.md` and the Nish
   half of `.claude/typescript.md`.
3. **Each phase is tested against an independent implementation, not a
   golden written by hand.** Until R6 that was stage0 (the S1–S4 oracles of
   §4); since then it is the scanner and parser oracles, `node:path` and the
   rest for the support library, and goldens regenerated and read.
4. **The runtime budget still holds.** Lower inline rather than growing
   `runtime.c` past `docs/MASTER_PLAN.md` §2.
5. **Nish-0 does not grow quietly.** Adding a construct to the subset in §2 is
   an edit to this file (and `.claude/selfhost.md`) and a line in
   `CHANGELOG.md`, because every addition is something the compiler must then
   implement to compile itself.
6. **A new construct is lowered for speed, and the lowering is checked** by
   reading the assembly when the choice is not obvious.

---

## 7. Shipping it: the bootstrap script and the wrapper

S5 proved the fixed point inside the harness and left no compiler behind.
`scripts/bootstrap.sh` builds the chain of §1 outside it: the default output is
**stage2**, the first binary no part of the seed emitted; `--stages 1` stops
sooner; `--verify` checks the equalities with `cmp`. Since WP19 the seed is a
parameter (`NISH_BOOTSTRAP`, or the last release in `build/seed/`).

Until §7a a 195-line `scripts/nish.sh` wrapper supplied what D4 kept out of
stage1 — `-o <dir>/`, `--link`, `--profile` and the directories — mirroring
stage0's file layout exactly. The interop sidecars (`--emit-header`,
`--emit-dts`, `--emit-napi`) were ported to `src/interop-*.ts` module for
module at no runtime cost; the N-API shim's records of closures became records
with a kind tag and a `switch`, the trade D2 made.

**`--emit-ast` was not mirrored.** stage0's dump printed the `typescript`
package's node names and line:column spans; matching it would have meant
carrying a mirror of `ts.SyntaxKind` inside the self-hosted compiler to imitate
an implementation detail of the seed. WP19 R1 answered the flag with the
compiler's own tree and its own golden (`src/ast-text.ts`) instead.

The machine-readable surfaces were not equal at first: an internal error's
`--json` object (`NL0003`) was stage0's alone until `src/ice.ts` took a `json`
flag, and a syntax error's `--json` object differed on 178 programs until #117
(wp19 §A8). Both compilers then wrote the same objects.

---

## 7a. D4 reversed: the compiler links its own output

`scripts/nish.sh` is deleted. A compiler that needs a shell script beside it
to produce an executable is self-hosting in the IR and not in the artifact, and
the cost of closing that was measured rather than assumed. `mkdirSync` and
`spawnSync` — the two builtins D4 named — entered the language under rule 1 of
§6, and `src/compile.ts` now plans its own output, makes every directory in
the way and runs `bash scripts/build.sh` for `--link`. The bootstrap chain runs
on it: every stage is one `--link` by the stage before.

| | Answer | Why a value and not an exit |
| --- | --- | --- |
| `mkdirSync(path): boolean` | one directory, not recursive; true when one is there afterwards | no exceptions, so the driver phrases its own diagnostic, as with `readFileSyncOrNull` |
| `spawnSync(argv): number` | the exit status, `128 + n` for a signal, `-1` when nothing ran | a missing linker is a message, not a crash |

`spawnSync` is the first builtin whose pointer argument the runtime keeps (no
`nocapture`) and the first that is not `willreturn`. The bill was **257 bytes
of `.text`** at `-Oz` (2,287 → 2,544 against the 4,096 budget of the day), and
`examples/hello.ts` at the `size` profile linked to the same 4,696 bytes with
and without them, because `--gc-sections` drops what a program does not call.

**What was left, and what closed it.** Four things stayed stage0's when the
package closed; all four have since closed:

| | What closed it |
| --- | --- |
| `--emit-ast` | WP19 R1: the compiler's own tree, not a mirror of stage0's (§7) |
| `--target host` | `process.platform` and `process.arch`, runtime calls answering a constant string (`readnone willreturn`, not `noalias`), 8 bytes of `.text` each; `src/target.ts` composes the triple |
| exit **70** for an internal error | `src/ice.ts`, below |
| `-o <dir>` without a trailing slash | `isDirectorySync(path)`, one question rather than a `stat` struct |

### The three builtins, and the runtime they cost

`process.platform`, `process.arch` and `isDirectorySync` each entered the
language under rule 1 of §6. The two machine properties are runtime calls
rather than compile-time constants because the `.ll` is target-neutral unless
`--target` says otherwise, and a cross build compiles `runtime.c` for the
target. `nish_is_dir` is `effect: "write"`, like `nish_mkdir`, because a
failed `stat` stores `errno`. Together they took `.text` from 2,544 to 2,561
bytes.

### Exit 70: which design costs the language less

Two designs were costed: a second `panic` that exits 70, or
`process.exit(70)` at each site. The second costs the **language** nothing:
`panic(m)` already means "this message, then exit 1" and `process.exit(n)`
"this code, now", while a second panic would bake one compiler's reporting
policy (version line, issue tracker, the word "internal") into the language
every program uses. Each site is the single statement
`process.exit(internalErrorFor(message, json))`, which cannot be half-written,
because a site that dropped the exit would fail the definite-return analysis.
With no exceptions the report is made at the site, so it carries no stack;
`NISH_DEBUG` says so rather than promising one. `tests/self/ice.ts` pins the
lines and the 70.

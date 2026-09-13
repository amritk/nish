# WP14 — Self-hosting

The goal that closes the project: **a compiler for Nish, written in
Nish, that compiles its own source.** Everything below is the definition
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
| **stage1** | `self/` | Nish | stage0 |
| **stage2** | `self/` | Nish | stage1 |
| **stage3** | `self/` | Nish | stage2 |

stage0 is not going away. It is the bootstrap seed, it is what `npm install
-g nish` ships today, and it stays the reference implementation: a
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

That says the TypeScript implementation and the Nish implementation agree
on the IR for the self-hosted compiler's own source. It only holds while
`self/` uses no construct the two lower differently, so it was a check to
enable per file as the port landed rather than a milestone. **It holds for
every file**, and `tests/self/bootstrap.js` asserts it alongside the proof
itself.

### The test

The WP14 section of `tests/run.js` runs the stages and compares. It is
skipped, not failed, without LLVM, the same as every other toolchain-dependent
check (`.claude/testing.md`). It began as a compile gate — stage0 must compile
every module of `self/` cleanly — and grew one oracle at a time until
`tests/self/bootstrap.js` closed it: build stage1 with stage0, stage2 with
stage1, stage3 with stage2, and compare. That gate is not a formality:
it fails the moment `self/` reaches for something the language does not have,
which is rule 1 of §5 enforced by the suite rather than by good intentions.

---

## 2. Nish-0: the subset `self/` is written in

The trap in every bootstrap is writing the compiler in more language than the
compiler implements. **Nish-0** is the fixed, deliberately small subset
that `self/` may use, and the closure condition is that Nish-0 is a subset
of what `self/` compiles. Every line of `self/` is checked against that.

Nish-0 is today's language plus §3, minus everything `self/` does not need.
Notably `self/` is written **without**:

- generics, arrow functions, closures, nested functions, function values;
- `type` aliases, `enum`, `namespace`, `static` members, getters/setters;
- `try`/`catch` — diagnostics are collected into an array and a failed parse
  returns a sentinel node, the way the error recovery in a real front end
  works anyway;
- inheritance and downcasts, because of the decision in §2.1.

### 2.1 One `Node` class, not a class hierarchy

Nish has single inheritance (WP2b) but no downcast, and adding one would
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

## 3. The gap, measured

This list is not a guess. It comes from two independent sweeps that agree:
a **census of `src/`** (all 53 files, 11,799 lines — every library facility and
every string and array method it uses), and a set of **probe programs** compiled
against today's language to find what it actually refuses. Counts below are
call sites in `src/`.

Each row ships with everything in the `docs/ARCHITECTURE.md` checklist: a
golden `.ll`, an `llvm-as` pass, a native round trip, a `reject_*` case, a
`docs/LANGUAGE.md` rule and a cookbook entry.

**Every row below is now done**, and so is the `panic(msg)` of D1. The
language gap is closed, and wave C below has landed too, so what remains
between here and S5 is the port itself and the four decisions of §3a, which
are about how `self/` is written rather than about what Nish can
express.

### Wave A — the front end cannot be written without these

| # | Construct | Evidence |
| --- | --- | --- |
| A1 | `switch` / `case` / `default` **Done.** | Every phase is a dispatch on a node kind. `src/` has 21 `switch`es plus ~30 dispatch tables that all become switches. Lowers to LLVM's `switch`, so the backend builds a jump table — the fast shape, not an `if` chain. |
| A2 | `charCodeAt`, `substring`, `indexOf`, `startsWith`, `endsWith`, `String.fromCharCode` **Done.** | A lexer is `charCodeAt` in a loop and `substring` at the end. `src/` itself never lexes (the `typescript` package does), so this set is sized for `self/`'s lexer, not for `src/`. |
| A3 | Module-level `const` | **Done.** Token kinds, node kinds, and the 14 string-literal union types that become `i32` constants. |
| A4 | `pop`, `indexOf`, `join` on arrays **Done.** | `join` has **66 call sites** and is not optional: see the measurement below. `pop` 4, `indexOf` 7 — five of those seven search by *identity* over AST nodes, which `===` on class values already gives. |
| A5 | `& \| ^ ~ << >> >>>` and their compound forms **Done.** | The `StringMap` of §2.2 hashes with FNV-1a, and the emitter formats `f64` constants as hex (see B1). Never forbidden — they fell through the checker's operator table into the "not implemented" bucket. |

**`join` is a hard requirement, not a convenience.** Building 88 KB of IR text
by repeated `+` costs **180 MB of peak RSS**, because every concatenation
allocates a fresh copy and the arena never reclaims. Quadratic in both time and
memory. A self-compile emitting ~1 MB of IR that way would need tens of
gigabytes. `join` must therefore be the fast shape: one pass to sum the lengths,
one allocation, one `memcpy` per part.

### Wave B — the back end cannot be written without these

| # | Addition | Evidence |
| --- | --- | --- |
| B1 | `f64ToBits(x: f64): i64` (and `bitsToF64`) **Done.** | **A blocker, and the least obvious one.** LLVM only accepts decimal float literals that round-trip exactly, so the emitter writes `double 0x400921FB54442D18` — today via `Buffer.writeDoubleBE`. Nish has no way to see a double's bits, so without this the self-hosted emitter cannot emit any `f64` constant. One `bitcast` in the IR: zero instructions, zero runtime. |
| B2 | `console.error(x)` and a newline-free write **Done.** | Every one of the 16 diagnostic writes goes to **stderr**, and two dumps write without a trailing newline. `console.log` is stdout-and-newline only. Without these, every `.err` golden and the runner's stream expectations have to be re-baselined — a worse outcome than two five-line runtime functions. |
| B3 | A file read that can fail **Done.** | `readFileSync` **exits the process** on a missing file, so a compiler cannot turn it into its own `` Cannot find module `./x` `` diagnostic and carry on loading the other imports. Smallest fix: `readFileSyncOrNull(path): string \| null` — it subsumes `existsSync`, has no time-of-check race, and needs no new type. |
| B4 | Contextual `[]` in a field assignment | **Done.** `this.children = []` in a constructor did not take its element type from the field, which every container class hits on its first line. |

### Wave C — library code in `self/`, no language change

Written once in Nish and then just there. Listed so nobody mistakes them
for language work: `StringMap` / `StringSet` (~200 `Map`/`Set` sites),
`StringBuilder` (§2.3), a **stable** sort (the diagnostic order is
golden-compared) and a byte-wise `compareStrings` (Nish has no `<` on
strings, deliberately), `jsonQuote` matching JSON escaping exactly, hex
formatting for B1, and a `resolvePath` that normalises `.` and `..` the way
Node does — see D3.

**Landed**, in 598 lines and with no language change, which is the claim this
wave was making: `self/strings.ts` (`StringBuilder`, `compareStrings`,
`jsonQuote`, the LLVM `c"..."` escape, `f64Hex` / `f32Hex` over B1's
`f64ToBits`, `splitByte`), `self/map.ts` (`StringMap`, `StringSet`) and
`self/paths.ts` (`normalizePath`, `resolvePath`, `resolveModule`, `dirname`,
`basename`). The stable sort landed with the diagnostics it orders
(`DiagnosticSink.sorted`, a bottom-up merge sort), so the wave is complete.

Two shape decisions are worth carrying forward:

- **`StringMap` is open addressing over a dense entry list**, not keys in the
  buckets: `slots` holds entry indices and the entries live in insertion order
  in parallel `string[]` / `i32[]`. Iteration is therefore insertion order,
  which is what a golden-compared dump needs — a hash order would make the
  output depend on the table size — and `""` is an ordinary key rather than a
  sentinel to get wrong. There is no `delete`; scopes are popped whole, so the
  probe loop needs no tombstones.
- **`self/paths.ts` matches `node:path` exactly, quirks included**, because
  D3's failure mode is a `..` that normalises differently, and "differently"
  has no small version. `dirname("/a//b")` is therefore `"/a/"`, not `"/a"`.
  The one function that is deliberately *not* Node's is `basenameWithout`:
  `path.basename(p, ext)` answers `"///"` for `basename("///", ".ts")` and
  disagrees with itself about `".ts"`, and a module's name is not the place
  to inherit that.

The test is `tests/self/support_oracle.js`, and rule 3 holds for it without a
`src/` phase to diff against: every line has an implementation on the other
side that was written first — stage0's own `escapeBytes` and `f64Constant`
for the IR escapes (a disagreement there *is* stage1 emitting a different
module), `node:path`'s POSIX side for the paths, and `JSON.stringify`,
`Buffer.compare` and `Map` for the rest. Both sides read the same case table,
so they cannot drift onto different inputs. 863 lines agree.

### What is deliberately *not* being added

- **Nullable field narrowing.** `if (n.parent !== null) { n.parent.kind }` does
  not narrow; only locals do. A sound rule would have to invalidate on every
  call, because the checker runs before the effect facts that could prove a
  callee harmless. The idiom `const parent = n.parent; if (parent !== null)` is
  one line, provably safe, and one load instead of two. The diagnostic names it
  with the reader's own expression.
- **Generics, closures, function values, `try`/`catch`, a `Map` builtin.** Each
  is designed around in §2. None is on the path.

## 3a. Decisions this forces

Five things the census turned up that are choices, not omissions.

**D1. Error recovery is the hard one.** `CompileError` is thrown from 292 sites
and caught in six, every one load-bearing: `DiagnosticSink.recover` (10 call
sites, per-declaration recovery), per-statement recovery in `checkStatements`,
and `checkVariableDeclarationList`, which catches, *declares the variable with
its annotated type anyway*, and rethrows so later statements do not cascade
`Unknown identifier`. Nish `throw` traps and discards the value.

The plan is error-value threading: a diagnostic array, an `ERROR` sentinel type,
and status returns. Be honest that this is **genuinely worse** than
`try`/`catch` — it is the classic recursive-descent recovery tax, ~292 edit
sites, and it will cost real bugs where a caller forgets to check a sentinel.
The alternative, reporting only the first error, would delete WP10's multi-error
guarantee and stop stage1 being diff-comparable with stage0 on the
`reject_multi_*` cases. A `panic(msg)` builtin, so the 16 internal
invariants keep their messages, is **done**.

**D2. Switching the dispatch tables costs self-registration.** Today
`checker/arrays.ts` adds `for...of` by writing one line into a table and
touching no other file. With a central `switch`, one `checkExpression` must name
every construct, so `checker/` becomes a core plus helpers rather than a set of
peers. Take the central `switch` — it is smallest and it is the shape that
compiles to a jump table — but note that the paired `BuiltinCall { emit,
callees }` invariant stops being enforced by locality, so it needs a test.

**D3. Module resolution has a real hazard, not just tedium.** Module identity is
the absolute resolved path; a hand-written `resolve` that normalises `..`
differently from Node makes one file load twice, cycles stop terminating, and
bogus duplicate-symbol errors appear. Separately, `src/` imports *directories*
(`from "../checker"` at 15 sites) and re-exports (`export * from`) — neither of
which Nish resolves, so the barrels must go.

**D4. stage1 should not link.** `--link` shells out to `bash scripts/build.sh`
and `-o dir/` creates directories, which would mean `spawnSync` and `mkdirSync`
builtins and real runtime growth against §5 rule 4. Drop `--link`, `--profile`
and directory creation from stage1: it emits `.ll`, and a wrapper script links.
Costs nothing for the bootstrap proof, which compares IR.

*Reversed, deliberately and with the bill in §7a below.* D4 was right about the
proof and about the order of the work — the fixed point never needed a linker,
and the wrapper carried the deployment path through four milestones for 195
lines of `bash`. What it was measuring was the wrong thing at the end: the
cost of the two builtins is 249 bytes of runtime, and what they buy is the last
sentence of §1. A compiler that cannot produce an executable without a shell
script beside it is self-hosting in the IR and not in the artifact, and
"`self/` compiles `self/`" then means a `.ll` a third program has to finish.
It now means `nish self/compile.ts --link nish`. The two builtins are
`mkdirSync` and `spawnSync`, exactly the two D4 named, and they are ordinary
language now rather than compiler plumbing: rule 1 of §6 applies to them like
anything else, with their goldens, their negatives, their `docs/LANGUAGE.md`
rules and their cookbook entries.

**D5. Measure peak memory before S5, not after.** `self/` allocates every node,
type, string and array from the bump arena and never releases it — an
`Arena.reset` is unsafe while the AST lives. Add to that `IRModule.toString()`
building the whole module text in memory before one write. Peak is roughly AST +
all interned IR text + the final string. Probably fine at hundreds of MB; the
point is to know rather than to find out at the last milestone.

*Answered at S5, below: **86 MB and 91 ms** for the whole compiler, against
stage0's 178 MB and 786 ms. The arena never being released does not matter at
this size.*

## 4. Milestones

| | Deliverable | Proof |
| --- | --- | --- |
| **S1 Lexer** | `self/lexer.ts` tokenises Nish-0 **Done.** | Its token stream agrees with the `typescript` scanner's over every `tests/cases/*.ts`; the lexer built by stage0 runs natively |
| **S2 Parser** | `self/parser.ts` builds the `Node` tree of §2.1 **Done.** | Its tree matches the `typescript` parser's, span for span, for every program in the corpus that Nish-0's grammar covers |
| **S3 Checker** | `self/checker.ts` — types, scopes, the side tables **Done.** | Every `reject_*` case in `tests/cases/` is rejected by both compilers with the same message |
| **S4 Emitter** | `self/emit.ts` — IR text **Done.** | `IR(stage0, p) == IR(stage1, p)`; it holds for the whole corpus rather than a whitelist |
| **S5 Bootstrap** | `self/` compiles `self/` **Done.** | `IR(stage1, self/) == IR(stage2, self/)`, and stage3 is byte-identical to stage2 |

S1–S4 are each useful on their own and each testable against stage0, which is
what keeps this from being a single unlandable change. S5 is the day the
compiler compiles itself.

### The bootstrap, and what it says

`tests/self/bootstrap.js` runs the stages and compares them. All three
equalities hold over the whole of `self/` — 54 modules, 6,977,900 bytes of IR
(41 modules and 4,095,128 bytes when S5 first closed; the port has since taken
on DWARF, the interop sidecars, its own link step and WP19 R1's parity work).
Fewer than the files in `self/`, because `dump_tokens.ts`, `dump_ast.ts` and
`dump_checked.ts` are the oracles' own entry points and reach the same
modules from their own roots:

```
IR(stage0, self/) == IR(stage1, self/)     the two implementations agree
IR(stage1, self/) == IR(stage2, self/)     the fixed point: self-hosted
stage3            == stage2                byte for byte, as files
```

The middle line is the proof §1 defined. The first is the stronger equality §1
said was worth aiming at and not worth blocking on: it holds for every module,
so the TypeScript implementation and the Nish one are the same compiler and
not merely two compilers that agree about the tests. The third compares the
binaries rather than the text.

**S5 needed one addition to Nish-0, and it was grammar rather than
semantics: the parenthesised type.** `self/program.ts` writes
`(Local | null)[]`, and it has to, because `Local | null[]` groups the other
way. stage0 has always accepted it (`ParenthesizedType` in `src/types.ts`);
the S2 parser had no rule for it and the parser oracle recorded the gap as a
skip, which is exactly what that skip count is for. It is now `N_TYPE_PAREN`,
transparent in `resolveType` as it is in stage0, with
`tests/cases/cls_parenthesized_type`, `reject_paren_union_type`, a
`docs/LANGUAGE.md` rule and a cookbook entry — rule 1 of §6, which says a
construct enters the language before it enters `self/`.

**D5, measured rather than guessed.** Compiling the whole of `self/` — 41
modules, 16,700 lines, 4 MB of IR out — costs stage1 **86 MB of peak RSS and
91 ms**. stage0 needs 178 MB and 786 ms for the same input, so self-hosting
bought a factor of 8.6 in time and half the memory, which is §5's northern star
pointing at the compiler itself. The arena never being released was the worry;
at this size it does not matter.

That number is the measurement S5 closed with, over the 41 modules `self/` had
then. Today's tree is the 51 modules above, and stage1 costs **128.9 MB of
peak RSS and about 214 ms** for it, against stage0's 204 MB and 2.1 s: the
factor in time has gone *up* rather than down as the port grew. The peak RSS
is the figure to compare across machines; the times were taken on a shared one
and are indicative.

**§2.3 caught `self/` breaking its own rule, and the compiler is what caught
it.** The `performance` diagnostic class (WP15 §8) warned about `self/lexer.ts`
itself: `scanString` and `scanTemplate` appended `text = text + <one byte>`
inside their scan loop, so every byte of every literal copied the whole
accumulator — the quadratic §2.3 exists to forbid, in the loop that reads every
file the compiler compiles. Both scans now keep a `chunk` cursor and move whole
runs, and share one `StringBuilder` held by the lexer: a literal with no escape
in it costs one `substring` of its whole span and never touches the builder,
which is the case nearly every literal is. Before the fix the same run cost
131.8 MB and about 226 ms, so this is where 2.9 MB of the figure above went;
the token streams are byte-identical either way, over 678 files including the
malformed ones the lexer oracle cannot judge. On a source whose literals are
long rather than short the quadratic shows its real size: 400 KB of literal
text cost 408 MB and 392 ms to lex, and now cost 2.4 MB and 10 ms.

**D3's hazard did not fire.** Module identity is the specifier resolved against
the name the importer was given, so it stays relative and needs no working
directory (`self/paths.ts`'s `resolveModule`, and `relativePath` for the output
stems, both checked against `node:path` by the support oracle). stage0 resolves
against `process.cwd()` and prints a cwd-relative name; for an entry named
relatively the two agree string for string, which is why the module headers
match and the whole-program comparison is byte for byte rather than
normalised.

The `tests/self/ir_oracle.js` corpus grew with the driver: it now compiles
**whole programs** rather than single modules, `tests/link/` included, and
compares every module of each — the module *set* too, so a stage that emitted
one module fewer has not agreed about the rest. 289 of 289 programs, 1,305
modules, 2,048,420 lines of IR (280 programs and 989 modules when S5 closed).

### The skips S5 left behind, closed

The driver landed, but two oracles went on skipping every file that imports,
with the reason "needs the S5 driver" — a skip that had stopped being true.
All three now measure what they say they measure:

| Oracle | Before | When they closed |
| --- | --- | --- |
| `checked_oracle.js` | 225 agree, 48 skipped (42 imports, 6 stage0 rejects) | **272 agree**, 1 skipped |
| `reject_oracle.js` | 181 agree, 44 skipped (39 parser, 5 imports) | **194 agree**, 42 refused by the parser, 1 skipped |
| `ir_oracle.js` | 275 agree, 22 skipped (17 stage0 rejects) | **280 agree**, 6 skipped, 11 negatives |

What changed:

- `self/dump_checked.ts` drives `self/compilation.ts` instead of one `Checker`,
  so `--emit-checked` is compared over **whole programs**: every module in load
  order, what pass 1b bound each import to, and each module's own constants,
  structs and functions. The 42 modules of `self/` are compared against stage0
  by the dump as well as by their IR.
- `reject_oracle.js` reads the `tests/link/` negatives too, because a rejection
  that needs more than one module — a name imported twice, `main` outside the
  entry — cannot be provoked by a single file. Two rules were missing from
  stage1's pass 1b and are ported: "`f` is already imported from `./a`" and
  "Only the entry module may declare `export function main`".
- Every oracle now gives a program the flags it is compiled with everywhere
  else, from its `.args` sidecar or its `// smoke: args` line
  (`tests/self/corpus.js`). Six files were being refused by stage0 for want of
  `--number-mode f64` and counted as though the *port* could not reach them.
- Fixing that turned up one real divergence, in stage1's contextual typing of a
  bare numeric literal: `checkOperator` preferred the type the whole expression
  was being checked into over the other operand's, where stage0 consults only
  the operand (`src/checker/math.ts`). In f64 mode that made
  `toF64((ij * (ij + 1)) / 2 + i + 1)` mix widths at every `+`.

One skip is left per oracle and each is a fact about the corpus rather than the
port: `tests/parser/precedence.ts` is a parser fixture whose `c || d` no checker
accepts, and `tests/link/no_main` is refused by `--link`, which is stage0's
(§3a D4). `ir_oracle.js` counts the three cases that ask for a dump flag apart
from its skips, as dumps, because those write no IR on either side; the two
that ask for `-g` it compares like any other program, now that stage1 emits
DWARF too ("`-g` on both sides", below). It names the 11 `tests/link`
negatives as negatives rather than skips, since `reject_oracle.js` compares
them in full.

**The same equality now also runs on programs nobody wrote.** That corpus is
checked in, so it is finite and both compilers have been adapted to it;
`tests/differential/fuzz.js --stage1` takes the WP13 random-program generator
and asks *both* compilers for the IR of each program it invents, comparing the
texts byte for byte with the module set, through `ir_oracle.js`'s own `build`
and `compare` (docs/wp13-differential.md, "The fuzzer"). It links one stage1
binary per run and then costs about a third of a second per program; a
disagreement saves the program as
`build/test/differential/fuzz-stage1-fail-<seed>.ts` and reproduces with
`--stage1 --seed <seed> --count 1`. The WP14 block of `npm test` runs 16
programs from a fixed seed; **300 programs from seed 20261001 agreed on every
one of 141,098 lines of IR** (108 s), which is the first time the two
compilers have been compared on input neither of them was written against.

### What S4 cost

`self/` is 16,496 lines of Nish, and the emitter half of it — the IR
builder, the runtime ABI table, the targets, the escape analysis, the
attribute fixpoint, the six construct families, the module assembly and the
driver — is 6,761 of them, against the 5,686 lines of `src/codegen/` it
replaces. The ratio S2 measured is holding: the port comes in near the code it
replaces rather than at twice it.

The proof is the one §4 asked for, and it turned out to be affordable in one
go rather than as a whitelist: `tests/self/ir_oracle.js` compares the two
compilers' **whole output, byte for byte**, over every import-free program in
the corpus — **206 of 206 files agree over 19,452 lines of IR**. That is every
attribute group, every block label, every SSA number and the order the
declarations come out in, which is the half of the output a golden `.ll` reads
past. The 49 skips are 39 files that need the S5 module driver, 6 that stage0
itself rejects without the flags the harness passes, and 4 that ask for `-g` or
a dump flag stage1 does not have.

Four things are worth carrying into S5:

1. **Nish-0 held for the fourth time.** Nothing was added to the language
   for the emitter either. The one place the subset genuinely pushed back was
   `src/`'s `factCollectors` array — a list of *functions* each `emit/*.ts`
   registers into — which became one collector class in `self/attributes.ts`.
   D2 predicted exactly that, and predicted the cost: the `BuiltinCall
   { emit, callees }` pairing is no longer enforced by locality, so the two
   halves sit side by side in `self/emit_builtins.ts` and the IR oracle is
   what keeps them honest.
2. **The escape analysis wanted parent links, and got a side table.** S3's "no
   parent pointers" is a statement about the checker, which threads the
   contextual type down. `classifyUse` genuinely reads upwards — "what does the
   enclosing construct do with this value?" — so `self/parents.ts` builds the
   links once, as an array indexed by `Node.id`, which is the shape every other
   side table already has. The AST still carries syntax only.
3. **The oracle paid for itself again, and this time in soundness.** Three
   stage0 bugs came out of writing this, all of them wrong *attributes* rather
   than wrong instructions, which is the class of bug a golden `.ll` is worst
   at catching: `readFileSyncOrNull` was not an allocation site, so a function
   returning the bytes could still get an arena scope that released them; and a
   compound integer division (`x /= k`, `p.f %= k`) contributed no
   `nish_panic_div` callee, so its caller kept `willreturn` and `readnone` over
   a call that writes and never returns. Both are fixed with cases in
   `tests/cases/`. Three S3 leftovers came out too — `p.f++`, `p.f |= 1` and
   `a[i] &= 1` were accepted by stage1 and refused by stage0 — and they are
   fixed with `reject_*` cases that now pin both compilers.
4. **stage1 emitted no debug info yet.** `-g` was left to stage0 at S4, for
   the same reason D4 drops `--link`: a DWARF metadata builder was not on the
   path to the bootstrap proof, and the driver reported the flag rather than
   ignoring it. *That gap is now closed — see "`-g` on both sides" below.*

### What S3 cost

`self/` is 9,702 lines of Nish, and the checker half of it — types,
diagnostics, scopes, the side tables, annotations, declarations, structs,
constants, expressions, statements, members, arrays, builtins, definite
assignment and Phase 0 — is about 5,000 of them, against the ~5,100 lines of
`src/checker/` plus `src/validator.ts` it replaces. That is the ratio S2's
gate asked about, holding for the port as it did for the new code.

The proof is both halves of what a checker does, and the second one is the
half a dump cannot see:

- **What it accepts.** `tests/self/checked_oracle.js` compares the
  `--emit-checked` dump both compilers write, over every positive program in
  the corpus: **207 of 207 files agree over 2,079 lines** — every struct's
  size, alignment and per-field byte offsets, every signature and symbol,
  every folded constant, and every body's locals and resolved callees. The 30
  skips are 24 files that need the S5 module driver and 6 that stage0 itself
  rejects without the flags the harness passes.
- **What it refuses.** `tests/self/reject_oracle.js` runs every `reject_*`
  case through stage1 and requires the fragments the case's own `.err` file
  pins — the same assertion the suite already makes of stage0: **165 of 165
  agree over 168 fragments.** The 44 skips are 39 cases the S2 parser refuses
  by name rather than by Phase 0's wording, which is the deliberate difference
  §4 recorded at S2, and 5 that need the driver.

Three decisions are worth carrying into S4:

1. **Nish-0 still held.** Nothing was added to the language for the
   checker either. Two stage0 bugs and one contextual-typing gap came out of
   writing it — an imported class's or function's layouts not reaching the
   importer, a reachability closure that depended on module order, and a
   numeric literal in a ternary arm not inheriting its context — and all
   three are fixed with cases in `tests/`.
2. **The central `switch` of D2 cost what D2 said it would**, and no more: a
   construct is now an entry in `checkExpression` or `checkStatement` as well
   as in its family's module.
3. **No parent pointers.** The contextual type is threaded down instead of
   walked up, which is a better fit for a checker that is one pass, and the
   only place stage0's parent walk had no substitute is "this call must be a
   statement" — answered by one field the statement checker sets.

### What S1 cost, and what it says

`self/tokens.ts`, `self/lexer.ts` and `self/dump_tokens.ts` are **1,222 lines
of Nish**, and the four numbers the gate wants are already forming:

- **Nish-0 held.** The lexer needed no language addition beyond the ones
  §3 already lists. It is written with `switch`, `charCodeAt`, `substring`,
  `push`/`pop`, `join`, the bitwise operators and module constants — that is,
  with wave A, which is the first evidence that the census measured the right
  thing.
- **It agrees with the oracle exactly.** `tests/lexer_oracle.js` runs the
  `typescript` scanner over `tests/cases/`, `examples/`, `self/`,
  `docs/cookbook/`, the differential corpus and `tests/lexer/`, prints the
  token stream in `dump_tokens`' format and diffs it: **482 of 482 files,
  50,968 tokens, no disagreement.** That includes every `reject_*` case, whose
  forbidden syntax the lexer has to tokenise without an opinion, and files with
  multi-byte characters, where the scanner's UTF-16 offsets are mapped through
  the source's byte prefix.
- **The oracle cost almost nothing to keep.** Two mismatches, both real bugs in
  the same direction: the lexer had opinions. It refused `==` and `!=` where
  the scanner tokenises them, and it split `?.`, `??`, `...`, `**`, `@` and
  `#name` into pieces. The fix was to lex what is written and leave the
  refusing to the parser, which is better diagnostics anyway ("`??` is
  forbidden; narrow with `!== null`" rather than a complaint about a stray
  `?`). One divergence stands by design: the scanner hands back a bare `>` so
  the parser can close nested type arguments one at a time, and this lexer
  merges `>>` and `>>>` because Nish-0 has no nested type argument list —
  the oracle asks for `reScanGreaterToken` to match, and the parser will have
  to split a `>>` where it wants two closers.
- **It is not slow.** Over 129 KB of the compiler's own source, the native
  binary reads the file, lexes 14,000 tokens, formats and writes the dump in
  **5 ms**; the `typescript` scanner alone, warm, takes 4 ms — after the 258 ms
  it costs to load.

### What S2 cost, and the gate's four numbers

`self/nodes.ts`, `self/parser.ts` and `self/dump_ast.ts` bring `self/` to
**2,817 lines of Nish**. `tests/parser_oracle.js` is the lexer oracle one
level up: it walks the `typescript` tree, prints it in `dump_ast`'s format and
diffs, so what is compared is not "did it parse" but "is it the same tree, out
of the same pieces, with the same spans".

**447 of 447 files agree, 53,673 nodes, 43 skipped — and every one of the 43
is a `reject_*` case.** Every positive program in `tests/cases/`, `examples/`,
`self/`, `docs/cookbook/`, `bench/`, the differential corpus and the new
`tests/parser/` fixtures parses to exactly the tree TypeScript builds.

So the gate's questions have answers:

1. **Did Nish-0 hold?** Yes, again, and this time under more pressure: a
   recursive-descent parser with no exceptions, no closures, no generics and
   no `Map`. The one-`Node`-class decision of §2.1 paid for itself — a fixed
   child layout per kind with `N_LIST` for the variable-length groups and
   `N_EMPTY` for the absent ones reads as well as a class hierarchy would and
   needs no downcast. Nothing was added to the language for S1 or S2.
2. **How far off was the line count?** `src/` is 13,757 lines; the lexer and
   parser are 2,817, and they replace the ~1,558 `ts.*` calls that `src/` gets
   from a 60,000-line package. That is roughly the ratio the plan assumed. The
   port of the checker and the emitter is the remaining ~11,000 lines of
   `src/`, and there is now a measured basis for expecting it to be about that
   again rather than twice it.
3. **What did the oracle cost?** Four bugs across S1 and S2, all found in
   minutes, all in the same direction — the front end having opinions the
   scanner does not. `==` and `?.` refused instead of tokenised; `>` merged
   where the scanner splits (kept, and the parser splits it back where a type
   argument list closes); `super` missing from the model although the language
   has inheritance; and `from` and `of` made hard keywords when they are
   contextual, which `tests/cases/cls_nested.ts` catches with a field called
   `from`. None of them needed a redesign. That is the strongest evidence for
   S3: the oracle habit works, and it is cheap.
4. **How fast is it?** Over 84 KB of `self/`'s own source the native binary
   reads, lexes, parses and writes a 30,000-line tree dump in **7 ms**; the
   `typescript` parser alone, warm, takes 14.5 ms for the same input — before
   the 258 ms it costs to load.

The 43 skips are the honest remainder, and they are all one thing: **grammar
for constructs Nish forbids**. Stage0 rejects those by name in its
Phase 0 validator, *after* the `typescript` package has parsed them, so for
stage1 to produce the same message this parser must read them and turn them
down itself. The tally, largest first: `try` (1), `enum` (2), `namespace` (2),
`typeof` (2), `as` and `<T>x` casts (2), arrow functions and generics (7
across functions, classes and imports), `void`/`delete`/`await` (3), getters
(1), `static` (1), decorators (1), labels (1), `with` (1), `debugger` (1),
regex literals (1), spread (1), computed keys (1), `export default` (1),
`?.`/`??`/`==`/`!=` in expression position (4), and top-level statements (2).
That is a bounded list — roughly 25 constructs, each a few lines of
read-and-refuse — not an open-ended one, which is the answer the gate needed
about how much of TypeScript `self/` ends up parsing.

### The gate at S2

S1 and S2 are done first and the project is re-decided there, because they
carry the risk the other three do not. S3, S4 and S5 are a *port*: `src/`
already contains a checker and an emitter, and the question is only whether
Nish-0 can express them. S1 and S2 are **new code** — `src/` has no lexer
and no parser, because the `typescript` package is the parser, and 1,558 of
the references in `src/` are calls into it. That code has to be written from
nothing and then made to agree with a 60,000-line scanner well enough for the
IR equality of §1 to mean anything.

So the sequencing puts the unknown first, and both artifacts are worth having
whichever way the gate goes: a lexer and a recursive-descent parser are the
largest Nish program in existence, which is the dogfooding evidence the
language wants, and they belong in `bench/` as a workload that is neither
numeric nor synthetic.

At the gate, three things decide it:

1. **Did Nish-0 hold?** If S1 and S2 needed language additions beyond §3,
   S3–S5 will need more, and each one is something stage1 must then implement
   in order to compile itself.
2. **How far off was the line count?** `src/` is 13,757 lines. If the lexer and
   parser came in near the estimate, the rest can be estimated; if they came in
   at twice it, the port is a different project from the one costed here.
3. **What did the oracle cost?** S1 and S2 both compare against stage0. If
   keeping them in agreement is a steady drip of one-off differences, S3, whose
   proof is *every* diagnostic matching, is much worse than it looks.

The honest case against continuing past the gate is that self-hosting serves
the compiler's own speed, not §5's northern star, and that maintaining two
implementations doubles the cost of every construct added afterwards. The
answer to the second half is that stage0 is **frozen** at S5 rather than
retired: it stays buildable as the bootstrap seed and as the differential
oracle, but new constructs land in `self/` only, so the doubling is bounded by
the language as it stands on that day. Deciding that now is what makes the
tax finite, and it is why §1's "stage0 is not going away" means *kept*, not
*kept up to date*.

**Frozen is not the end state, and the sequel has its own plan.** The day the
freeze becomes a deletion — `src/`, the `typescript` dependency and Node out of
the compiler, the bootstrap seed moved from a second implementation to the
previous released `nish`, which is rustc's arrangement and Go's — is
[WP19](wp19-stage0-retirement.md). It lists what stage0 still owns beyond
compiling (the oracles, the npm package, the diverse-double-compiling
property), the six gates that must close before any of it is deleted, and the
four builtins §7a's leftovers need. Nothing there is scheduled: it is the price
list, so that the decision when it comes is a decision and not a discovery.

**What the first construct after the freeze actually cost.**
`Result<T, E>` (WP16) is that construct, and it landed in *both* compilers
rather than in `self/` alone, because stage0 is still what `dist/` ships and
what every golden in `tests/cases/` is compiled by: a construct stage0 cannot
compile has no goldens, no differential coverage and no released
implementation. So the doubling was paid in full — a type model entry, a
checker, a lowering, escape sites and pointer facts on each side.

The oracles are what made that cheap rather than frightening. The S4 IR
oracle refuses to skip a program stage1 rejects, so the port could not be
quietly narrowed; and once the two sides disagreed only in attributes, the
byte diff named the missing fact collector directly. Every disagreement found
this way was a real omission in stage1, and none was a difference of opinion
about the language. That is the evidence for the §5 claim above being about
*effort* and not about *risk*: the second implementation is work, but it is
work an oracle can check line by line.

**And what the second one cost.** WP17 — carrying a small `Result<T, E>` in
a register ([wp17-result-abi.md](wp17-result-abi.md)) — is an *ABI* change
rather than a construct, and that turned out to be the cheaper kind to
mirror. It touched the same five files on each side (`types.ts`,
`result.ts`/`emit_result.ts`, `emit.ts`/`emitter.ts`, `escape.ts`,
`attributes.ts`), added nothing to Nish-0 — rule 5 of §6 did not fire, and
`self/` is written in exactly the subset it was written in before — and the
IR oracle caught the divergences the same way: the two sides have to agree on
every SSA number of the pack and the unpack, so a shift emitted in a
different order is a byte diff rather than a latent difference of opinion.
The by-value *parameter* half went the same way: it needed a real addition to
the escape analysis on both sides — the callee unpacks the word into an
object, and whether that object may be an `alloca` is the same `localOutcome`
walk a local holding an allocation gets — and the oracle is what said the two
walks agreed, over 274 of 274 programs, before the bootstrap was allowed to
close.
The interop sidecars and `-g` stayed stage0's while WP17 landed, as D4 said
they would: the DWARF and the C header for a `Result` were stage0-only changes,
and the driver reported those flags by name rather than ignoring them. Both
have since been ported — the sidecars in §7, `-g` in the section below — so
what a `Result` is spelled as in a generated header, and how it is described in
DWARF, are two-sided changes like every other.

### `-g` on both sides

`self/debug.ts` is the port of `src/codegen/debug.ts`: the same compile unit,
the same `DISubprogram` per function, the same `DILocation` on every
instruction, the same `llvm.dbg.value` / `llvm.dbg.declare`, and the same type
mapping down to the packed `Result` word a call boundary carries (WP17).
`self/ir.ts` grew the metadata list the builder writes into, `-g` is a flag of
`self/compile.ts` — which hands it to `scripts/build.sh` as well, so the DWARF
survives the link — and `tests/cases/dbg_locals` and `tests/cases/dbg_result`
are compared by `tests/self/ir_oracle.js` byte for byte, metadata numbering
included, rather than skipped.

**One thing had to change on stage0's side, and it is the same shape as §4's
module-header problem.** A `DIFile` carries a filename and a directory, and
stage0 spelled the directory `process.cwd()`. stage1 has no working directory
to ask for, and D4 will not grow the runtime for one string, so *both*
compilers now write `.` — which is what clang's `-fdebug-compilation-dir=.`
writes, and which makes a `-g` build depend only on the command line rather
than on where it ran. For a relatively-spelled entry the two agree on the whole
`DIFile`, exactly as they already agreed on the module header.

Writing the port also found a stage0 bug of the kind §4 said the oracle is for.
A class reached through an import — `tests/link/reachable_struct`, where
`Entry` is never named by the importer — was described with the *importer's*
`DIFile` and with its declaration offset looked up in the *importer's* line
table, so a debugger was pointed at a line in the wrong file. Both compilers
now describe a struct against the file that declares it, which is why a program
with imports has more than one `DIFile`.

The two disagreed on one more thing, and it was stage1's: `IRBlock.terminated`
spelled `src/`'s `^(ret|br|switch|unreachable)\b` as "the word, then a space or
the end", which is not `\b`. With `-g` an `unreachable` is written
`unreachable, !dbg !9`, the test said "not a terminator", and the emitter added
a second one. It is a word-boundary test now.

All three came out of the same one-off experiment, which is worth recording
because the suite does not run it: the oracle's own corpus compiled by both
compilers with `-g` **forced on every file**, rather than only on the two cases
whose `.args` ask for it. That is 278 programs — the corpus as it stood that
day — and `self/` itself, and it is
what turned "the two `-g` goldens match" into "the two compilers agree about
DWARF". The suite compares the two cases that ask for `-g`, because forcing the
flag over the whole corpus would double the oracle's four minutes for a
property the port is not going to lose quietly.

---

## 5. Performance is the tiebreaker

The project's northern star is the speed of what the compiler produces. Where a
language decision here has two defensible answers, the faster lowering wins, and
"faster" means measured rather than assumed. Three worked examples, because the
rule is only worth stating if it changes something:

- **Shift counts are masked** (`x << b` lowers to `shl x, (b & 31)`), which
  makes `i32` shifts exactly JavaScript's and removes LLVM's
  out-of-range-shift undefined behaviour. That looked like a correctness/speed
  trade until it was measured: `llc -O3` emits **byte-identical assembly** for
  the masked and unmasked forms on both x86-64 and aarch64, because both ISAs
  mask in hardware and the backend drops the `and`. Free, so it stays.
- **`switch` is integer-only**, so it lowers to LLVM's `switch` instruction and
  the backend builds a jump table. A string `switch` would have been a chain of
  `nish_str_eq` calls wearing a `switch`'s clothes; `if`/`else` says that
  honestly.
- **String methods lower inline, not to calls.** `charCodeAt` is a bounds check
  and a `load i8`; `substring` is a length computation, a bump allocation and a
  `memcpy`. That keeps `runtime.c` inside its budget *and* lets LLVM optimise
  through the operation instead of across a call boundary. Both goals point the
  same way, which is the usual case.

Self-hosting serves this star directly rather than competing with it: stage1 is
a native binary with no Node process to start and no TypeScript parser to load,
so the compiler's own speed is one of the things self-hosting buys.

Both of the performance questions this section used to leave open have since
been answered by WP15 §3: `--strict-exports` (internal linkage for non-exported
functions, which unlocks inlining and specialisation) and `--nsw` are both on
by default, with `--no-strict-exports` and `--wrapping` as the opt-outs. What
each is worth on the benchmark suite is still a `bench/` question rather than
an opinion.

## 6. Rules for this work package

These are in addition to `docs/MASTER_PLAN.md` §7, not instead of it.

1. **A construct enters the language before it enters `self/`.** Wanting it
   for the port is not a reason to skip its `reject_*` case or its cookbook
   entry. `self/` is the customer, not the exception.
2. **`self/` is an Nish program.** It follows `docs/LANGUAGE.md` and the
   Nish half of `.claude/typescript.md` — `function` declarations,
   `interface` for structs, no arrow functions, no `type` aliases. The house
   rules for `src/` do not apply to it, and `biome.json` must exempt it the
   way it already exempts `examples/` and `bench/`.
3. **stage0 is the oracle.** Every `self/` phase is tested by comparing it
   with the corresponding stage0 output over `tests/cases/`, not by a golden
   written by hand. A disagreement is triaged before the next phase starts.
4. **The runtime budget still holds.** Self-hosting is not a licence to grow
   `runtime.c` past §2 of the master plan. Lower inline instead.
5. **Nish-0 does not grow quietly.** Adding a construct to the subset in
   §2 is an edit to this file and a line in `CHANGELOG.md`, because every
   addition is something stage1 must then implement in order to compile
   itself.
6. **A new construct is lowered for speed and the lowering is checked.** Read
   the emitted assembly, not just the IR, when the choice is not obvious — §5
   exists because one such reading changed nothing and another would have.

---

## 7. Shipping it: the bootstrap script and the wrapper

> **Superseded in part by §7a.** The wrapper this section describes is gone:
> the compiler answers `-o`, `--link` and `--profile` itself now, and makes its
> own directories. What still holds is the file layout it describes — the two
> compilers leave the same files in the same places — and the reasoning about
> `--emit-ast`, which is still stage0's. Read this for how the deployment path
> was reached and §7a for what it is.


S5 proved the fixed point inside the test harness. It did not leave a compiler
behind: `tests/self/bootstrap.js` builds four of them in a temporary directory,
compares them and deletes the lot. So the last step between "self-hosting
holds" and "the self-hosted compiler is the one you run" is a build recipe that
is not a test, and the command line D4 said a wrapper would supply.

```bash
npm run bootstrap                         # build/nish, stage2, speed profile
scripts/nish.sh hello.ts --link hello && ./hello   # the wrapper; deleted in §7a
```

**`scripts/bootstrap.sh` builds the chain.** stage0 (`dist/index.js`) builds
stage1, stage1 builds stage2, stage2 builds stage3, and `-o` copies the stage
asked for. The default is **stage2**, because that is the first binary in the
chain no part of stage0 emitted: stage0 built the compiler that built it.
`--stages 1` stops at the seed's own output — the same program, two links
sooner — and `--verify` runs the three equalities of §1 with `cmp` rather than
with the suite's reporting, which makes the script self-checking for anyone
building it outside a checkout of the tests. All three when the seed is stage0,
as it is here; seeded with a released `nish` it asserts the last two and
*reports* `IR(seed) == IR(stage1)`, which between two releases is a codegen
freeze rather than the stronger equality of §1
([wp19-stage0-retirement.md](wp19-stage0-retirement.md) §3, G3).

**`scripts/nish.sh` is the command line.** D4 kept `--link`, `--profile`
and directory creation out of stage1, on the grounds that a wrapper could
supply them for nothing; this is that wrapper, and D4's bet is settled at 120
lines of `bash` with no runtime growth at all. It mirrors stage0's spelling
exactly — `-o <file.ll>`, `-o <dir>/`, `--link <exe>` writing `<exe>.ll` for a
single module and `<exe>.modules/` for a program with imports — so the two
compilers leave the same files behind and a build script can be pointed at
either, `-g` included: the wrapper passes it to stage1, which puts the DWARF
in the `.ll`, and on to `scripts/build.sh`, which compiles `runtime.c` with it
and skips the strip step. `--json`, `--emit-checked` and `--version` go
straight through: stage1 answers them itself, and the two that print text
rather than IR skip the output planning and the link entirely. The one flag
that is stage0's rather than missing, `--emit-ast`, is refused **by name**,
with what to run instead: a flag that is silently ignored is how a build ends
up not carrying the thing it asked for.

**The interop sidecars are stage1's too.** `--emit-header`, `--emit-dts` (which
writes its companion `.mjs` loader beside the declarations) and `--emit-napi`
are ~1,900 lines of `self/` ported from `src/interop/`, module for module, and
they cost the runtime nothing: a sidecar is derived from the checked program
after the IR and written with the `writeFileSync` stage1 already had, to the
path it was given. D4 is untouched — stage1 still makes no directory, spawns
no linker — so the wrapper creates the sidecar's directory the way it creates
the IR's, and passes the three flags straight through.
`tests/self/interop_oracle.js` is the oracle: both compilers over the WP8
corpus, all four generated files compared byte for byte, and `--all` runs the
same comparison over every whole program in the tree (287 programs, 1,148
sidecars, 16.9 MB of generated C, TypeScript and JavaScript, no difference;
18 skipped, every one of them a program stage0 itself rejects). The one host-shaped
generator was the N-API shim, whose readers and boxers are records of closures
in `src/`; here they are records with a kind tag and a `switch` that writes
the same lines, which is the same trade D2 made for the dispatch tables.

**`--emit-ast` is stage0's by design, not by backlog.** Its dump prints the
`typescript` package's node names and line:column spans; stage1's tree is the
flattened single-`Node` one of §2.1, with its own vocabulary and byte offsets,
and `tests/parser_oracle.js` translates TypeScript *into* that vocabulary
rather than the reverse. Matching stage0's dump would mean carrying a mirror of
`ts.SyntaxKind` inside the self-hosted compiler to imitate an implementation
detail of the seed — the opposite of what §1 means by the two being the same
compiler. `self/dump_ast.ts` keeps the shape its own oracle compares.
`--emit-checked` is the other way about, and that is why it *is* stage1's: the
dump is the compiler's own tables, and `tests/self/checked_oracle.js` already
proves stage1 writes them byte for byte as stage0 does over 279 whole
programs.

What the wrapper is not is a second implementation of the driver. It plans no
output, resolves no module and reads no source; it makes a directory, runs the
compiler, and hands `scripts/build.sh` the `.ll` files that came out — which
is why the whole of it can be read in one sitting and why nothing in it can
disagree with stage1 about the language.

**The suite checks the artifact, not just the proof.** The WP14 section builds
a compiler with `scripts/bootstrap.sh --stages 1` and then uses it, through the
wrapper, to compile, link and run `examples/hello.ts` (one module, `<exe>.ll`)
and `examples/multi/main.ts` (two modules, `<exe>.modules/`, exit code 49).
One stage rather than three, because what is being tested here is the
deployment path and not the fixed point — the bootstrap check above owns that,
and this one would only pay for the same two links again.

**stage0 stays the published package.** `npm install -g nish` still ships
`dist/`, and it has to: it is the seed every bootstrap starts from and the
oracle every `self/` phase is compared against. What it is no longer is the
only one that emits DWARF or the interop sidecars; what is still only stage0's
is the AST dump, and the `--json` object for an *internal compiler error*
(`NL0003`). The second is a language limit rather than a decision to skip work:
`self/ice.ts` is a library module, so `process.argv` is out of reach there —
it needs an `export function main` — and Nish has no mutable module
state to stash the flag in, so the only way to get it to `internalError` is a
parameter on all 39 of its callers, which are broken invariants scattered
through every phase. Both compilers print the same human report; only stage0
also prints the machine-readable line. Every other `--json` object, the codes
included, is byte-identical between the two and `tests/run.js` proves it.
What changed is that
a checkout can now produce
the self-hosted compiler in one command, and that compiler compiles the same
programs about eight times faster (§4, D5).

---

## 7a. D4 reversed: the compiler links its own output

`scripts/nish.sh` is deleted. `mkdirSync` and `spawnSync` — the two builtins
§3a D4 named as the reason not to do this — are in the language, and with them
`self/compile.ts` plans its output, makes every directory in the way and runs
`bash scripts/build.sh` for `--link`, which is the same script `src/index.ts`
spawns and has always been.

```bash
npm run bootstrap                       # build/nish, stage2, no wrapper after it
build/nish self/compile.ts --link nish
cmp nish build/nish                 # the fixed point, reached by the artifact
```

**What D4 got right, and what it was measuring.** Dropping the link step was
the correct order of work: the proof of §1 compares IR and never needed a
linker, and 195 lines of `bash` carried the deployment path from S5 through
four landings for nothing. What it costed wrongly was the end state. "`self/`
compiles `self/`" with a wrapper in the way means the compiler produces a `.ll`
that a third program has to finish — self-hosting in the IR and not in the
artifact. The bill for closing that is 257 bytes of `.text`.

**The two builtins are language, not plumbing.** Rule 1 of §6 applies: each
entered `src/` first with a golden, a native round trip, two negatives, a
`docs/LANGUAGE.md` rule and a cookbook entry, and only then `self/`.

| | Answer | Why a value and not an exit |
| --- | --- | --- |
| `mkdirSync(path: string): boolean` | one directory, not recursive (Node's `fs.mkdirSync(p)` with no options); true when a directory is there afterwards, whoever made it | the same reason `readFileSyncOrNull` answers `null` (§3 B3): there are no exceptions, so the driver has to phrase its own diagnostic |
| `spawnSync(argv: string[]): number` | `argv[0]` run through `PATH` with `argv` as its vector, waited for; the exit status, `128 + n` for a signal, `-1` for an empty vector or a program that would not start | as above; a linker that is not installed is a message, not a crash |

`spawnSync` is the first builtin whose pointer argument the runtime keeps:
`nish_spawn` copies each element's bytes pointer into an arena vector that
outlives the call, so `classifyUse` in `attributes.ts` reports `USE_ESCAPE` for
it and the declaration carries no `nocapture`. It is also the first that is
*not* `willreturn` — the child may never exit, and `waitpid` waits — which is a
fact about the world rather than a conservative guess.

**The bill, measured.** `clang -Oz -c runtime/runtime.c`:

| | Before | After | Budget |
| --- | ---: | ---: | ---: |
| `.text` | 2,287 | 2,544 | 4,096 |
| `size` text (counts `.eh_frame`) | 3,944 | 4,297 | — |
| source bytes | 10,928 | 12,707 | — |

§5 rule 4 said self-hosting is not a licence to grow `runtime.c`, and it is
still the rule. What changed with it is the metric, in `docs/MASTER_PLAN.md`
§2: the budget is `.text` at `-Oz`, because that is the half a linked binary
pays for and because `-ffunction-sections -Wl,--gc-sections` means it pays only
for what it calls. The check on that claim is a number rather than an argument:
`examples/hello.ts` at the `size` profile is **4,696 bytes with these two
functions in the runtime and 4,696 bytes without**, the same to the byte.

**What the compiler now does that it did not.** `-o <file.ll>` and `-o <dir>/`
with stage0's rules and stage0's refusal when two modules would go to one file;
`--link <exe>`, writing `<exe>.ll` for one module and `<exe>.modules/` for a
program with imports; `--profile speed|size|debug|wasi`, validated before
anything is compiled; every directory in the way of the IR, of a sidecar, or of
the binary; `<module>.ll` beside the source when nothing is named, which is
stage0's default and replaces stage1's older "one module to stdout"; and the
`--link` refusal for a program with no `export function main`, before the emit
rather than after the linker. It finds `scripts/build.sh` and `runtime.c` from
the path it was invoked by (`<prefix>/bin/nish` and `build/nish` both put
the root one level up), falling back to the working directory, and says which
two it looked in when neither has them.

**The bootstrap chain runs on it.** `scripts/bootstrap.sh` used to compile each
stage with `--out-dir` and then call `scripts/build.sh` itself, which made it a
second driver with its own opinion about where the IR goes. Every stage is one
`--link` now, by the stage before it, and the equalities read the
`<exe>.modules/` directory that `--link` already writes — so the chain that
proves the fixed point is the same command a user runs, and `link_stage` is
gone.

Nothing about the *platform* came in with any of this, which is the part D4
overestimated: the `uname -s`, the profile flag sets and the wasi sysroot
search are in `scripts/build.sh` and always were, for both compilers alike.
`--target host` was still stage0's when this was written, and is stage1's now
(see below): the machine is asked once, through two builtins, and the triple is
composed the way `src/codegen/target.ts` composes it. `--emit-ast` is still
stage0's for the reason §7 gives — refused by name now by the compiler itself
rather than by a wrapper, so a build that asks for it is told rather than
quietly given nothing.

**What was left, and what closed it.** Four things were listed here, none of
them about compiling. Three are closed; the first is closed *as a decision*,
which is not the same thing:

| | Why | What it cost |
| --- | --- | --- |
| `--emit-ast` | §7: the dump prints the `typescript` package's node names, and this compiler's tree is its own. **Closed by WP19 R1** — not by mirroring the names, which stays refused, but by answering the flag with stage1's own tree and a golden of its own | a mirror of `ts.SyntaxKind` inside the self-hosted compiler, which is the opposite of what §1 means |
| `--target host` | it asked the machine what it is, and nothing in the language did. **Done** | `process.platform` and `process.arch` as builtins, **8 bytes of `.text` each** as costed; `self/target.ts` composes the triple exactly as `src/codegen/target.ts` does |
| exit **70** for an internal error, and `NISH_DEBUG` | a broken invariant reached `panic(msg)`, which the language defines as the message and exit 1. **Done**, with `process.exit(internalError(...))` and `self/ice.ts` | 28 sites edited and no language change; the two the design costed are weighed below |
| `-o <dir>` for an existing directory **without** the trailing slash | stage0 `stat`s the path; the trailing slash was the only spelling here. **Done** | `isDirectorySync(path)`, the smallest `stat` that answers the question, and one byte of `.text` net once `nish_mkdir` was rewritten to call it |

### The three builtins, and the runtime they cost

Rule 1 of §6 applies to all three: each entered the language and `src/` first,
with a golden, a native round trip, negatives, a `docs/LANGUAGE.md` rule and a
cookbook entry, and only then `self/`.

| | Answer | Why a value and not an exit, or a call and not a constant |
| --- | --- | --- |
| `process.platform: string` | `"linux"`, `"darwin"`, or `"unknown"` — Node's spellings | a *runtime* call, not a compile-time constant: the `.ll` is target-neutral unless `--target` says otherwise, so only the machine the program runs on can answer, and a cross build compiles `runtime.c` for the target, which is what makes the answer the target's |
| `process.arch: string` | `"x64"`, `"arm64"`, or `"unknown"` | as above |
| `isDirectorySync(path: string): boolean` | whether a directory is at `path` right now | the same reason `mkdirSync` and `readFileSyncOrNull` answer values (§3 B3): there are no exceptions, so the driver phrases its own diagnostic. It answers *one* question rather than handing back a `stat` struct, because one question is what `-o <dir>` asks |

Both machine properties answer the address of a string in the runtime's own
constant data, so nothing is allocated and nothing is loaded: the declarations
carry `readnone willreturn`, a function built only from them stays pure, and
two reads in one function fold into one. Deliberately **not** `noalias` — every
call answers the same pointer, and `noalias` promises the opposite.
`nish_is_dir` is `nounwind willreturn` and `effect: "write"`, the same as
`nish_mkdir` and for the reason `nish_parse_number` is not `readonly`: a
failed `stat` stores `errno`, and the file system is not memory LLVM may
reason about, so a caller must not be hoisted across anything that could change
it.

**The bill, measured.** `clang -Oz -c runtime/runtime.c`:

| | Before | After | Budget |
| --- | ---: | ---: | ---: |
| `.text` | 2,544 | 2,561 | 4,096 |
| source bytes | 12,707 | 14,797 | — |

Eight bytes each for `nish_platform` and `nish_arch` (a `lea` and a `ret`),
and one byte net for `nish_is_dir`, because `nish_mkdir` lost its own copy of
the `stat` to it.

### Exit 70: which design costs the language less

§7a costed two: a second `panic` that exits 70, or `process.exit(70)` at the
sites where the definite-return analysis reads `panic` as a terminator. The
second is much the cheaper **for the language**, which is the budget that
decides it, and by a wide margin:

- `panic(m)` already means "this message, then exit 1", and `process.exit(n)`
  already means "this code, now". The status one program wants for its own bugs
  needs no new construct: the language is already complete for it, and every
  other Nish program would carry a builtin it has no use for.
- A second panic would have to bake this compiler's *reporting policy* — the
  version line, the issue tracker, the word "internal" — into the language that
  compiles it, or else print a bare message and lose the report.
- The cost of the other side of the trade is 28 statements in `self/`, and they
  are `self/`'s own. `self/ice.ts` holds the report and answers the status, so
  every site is the single statement `process.exit(internalError("..."))`
  rather than a report call followed by an exit: the pair could be
  half-written, and this cannot, because `process.exit(...)` is what the
  definite-return analysis reads as a terminator and a site that dropped it
  would not compile.

**What stage1 honestly cannot say.** stage0 catches the failure in one
`try`/`catch` at the top of its driver, where the command line is still in hand
and the exception carries a stack, and prints both — the stack only under
`NISH_DEBUG=1`. stage1 has neither, for one reason: with no exceptions the
report is made *at the site* instead of at the top. There is no stack to
unwind, and no `process.argv` to read either, because that builtin requires an
entry `main` and the modules that report internal errors (`self/types.ts`,
`self/emit.ts`, ...) are compiled on their own as well, as whole programs of
the corpus. So the report names the compiler and its version, the invariant
that broke, and `NISH_DEBUG` — saying there is nothing behind it here rather
than promising a stack a rerun would not produce — and then asks, in stage0's
own words, for the input file and the command line, which is the half stage0
was echoing anyway. `tests/self/ice.ts` and the WP14 block of `tests/run.js`
pin the lines and the 70.

Seven sites still call `panic` and still exit 1: the four in `self/emit_ops.ts`
and the three in `self/interop_napi.ts`. The conversion there is the same one
line for one line, and it is the only thing between this and every internal
error in stage1 answering 70.

`--emit-ast` is the one that stays. It is a refusal with a message, not a
program one compiler can build and the other cannot, which is the line §1 drew.

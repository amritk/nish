# WP19 — Retiring stage0

WP14 §6 decided that stage0 is **frozen rather than retired**: kept buildable
as the bootstrap seed and as the differential oracle, but not kept up to date.
That was the right call at S5 and it is still the right call today. It is not
the end state.

This package writes down what has to be true before the freeze becomes a
deletion — before `src/`, the `typescript` dependency and Node leave the
*compiler*, and `self/` becomes the only implementation of Nish. It is a
checklist, not a schedule. Nothing here says when; everything here says what.

---

## 1. The shape we are moving to, and whose it is

Every self-hosted compiler faces the same question — what compiles the compiler
the first time — and there are only four answers in the wild.

| Project | The seed | What happened to it |
| --- | --- | --- |
| **rustc** | `rustboot`, in OCaml | deleted in 2011, months after rustc first compiled itself. The seed is now **the previous release of rustc**, downloaded as a binary by `x.py`; stage1 is built by it, stage2 by stage1 and ships, stage3 exists only to be compared against stage2 |
| **Go** | the Plan 9 C toolchain | machine-translated into Go for Go 1.5 and deleted. The seed is now **a previously installed Go**, on a published schedule: Go 1.N requires Go 1.M where M is N−2 rounded down to an even number |
| **GCC** | any C++ compiler | never needed one. `make bootstrap` builds three stages and `make compare` fails the build unless stage2 and stage3 are byte-identical |
| **Zig, OCaml** | a checked-in artifact (`zig1.wasm`, `boot/ocamlc`) | kept in the tree as a blob, refreshed occasionally, maintained by nobody |

We have a fifth arrangement that none of them has: a seed that is a *second,
independently written implementation*, kept alive and compared against
per phase. It bought six stage0 bugs during S3 and S4 that a golden `.ll` would
not have caught (§4 of `wp14-selfhost.md`), and it buys the stronger equality
`IR(stage0, self/) == IR(stage1, self/)`, which no project in the table above
asserts — it is the second half of Wheeler's *diverse double-compiling*, and it
is why a Thompson-style backdoor cannot presently hide in either compiler.

It also costs a full second implementation of every construct, forever.

**The target shape is Rust's and Go's**: `self/` is the compiler, and the seed
is the previous released `nish` binary. This document is the price list.

### 1a. The doubling ends before R6

The gates below are about *deleting* `src/`. They are not what stops the second
implementation costing a second implementation, and reading them as though they
were is what kept the doubling in place after the port had finished: every
construct since S5 has been written twice, and the last three were 125/112,
354/487 and 371/415 lines of `src/` against `self/`. Half of every compiler
change is the second implementation.

**None of that is required by the gates.** Work out what actually forces a
construct into `src/` and there are two things, both of them mechanical:

1. **`tests/run.js` compiles a case with stage0**, so a construct stage0 does
   not have cannot have a golden `.ll`, and the definition of done requires
   one.
2. **The oracles compare stage0 with stage1 over the corpus**, so a case stage0
   refuses is recorded as `stage0 rejects it` and *skipped* — and a skip in an
   oracle is a fact about how far the port has got (`.claude/selfhost.md`),
   printed only under `--verbose`. A construct landing in `self/` alone would
   quietly shrink the comparison rather than declare that it had.

Neither is about the seed, which is the thing people reach for first. The seed
compiles `self/`'s *source*, and `self/`'s source does not use a construct the
day it lands — G4's rolling freeze already says it may not until the next
release. stage0 can go on being the local seed exactly as long as it can
compile `self/`, and nothing here changes that.

So the answer is a register. `tests/self/stage1_only.txt` names the cases
whose implementation is `self/`'s alone, and every tool that would otherwise
have been silent reads it:

| Tool | What a registered case does |
| --- | --- |
| `tests/run.js` | compiles it with a **stage1** binary built from `self/` by the seed; its golden, `llvm-as` pass and native round trip are stage1's |
| `ir_oracle.js`, `checked_oracle.js` | counts as `stage1-only` in the summary, apart from the skips: no stage0 answer exists, by decision |
| `interop_oracle.js` | skipped with the register as the named reason, on the `--all` path — the only one of its two corpora that can reach a `tests/cases` program |
| `parity.js` | one declaration, the only one keyed on the program rather than the surface, matched *after* the others so an ordinary difference is still attributed to its own reason |
| `nish-cmp.js` | expected while the seed is older than the construct, and compared normally from the release that has it |
| `tests/nish/run.ts` | skipped by name: that runner spawns stage0 and cannot build a stage1 |

**What it costs is one line of the ledger and no more.** Diverse double
compiling stops growing: the construct is proved by a golden and by
`nish-cmp.js` rather than by two implementations agreeing. Everything already
in the corpus is still compiled by both and compared byte for byte, `self/`'s
own 56 modules included, so §2D's property holds over what it always held
over. That is the trade §6 prices, taken one construct at a time and reversibly
— writing the `src/` half later removes the line — instead of all at once at
R6.

**What it does not change**: the construct's tests, its `LANGUAGE.md` rule, its
cookbook entry, its `CHANGELOG.md` line, and the rolling freeze. A register
entry buys one thing, the second implementation, and pays for it in the one
currency this document has been keeping accounts in since §1.

The register has a fixture, `stage1_probe`, and it is there for the reason a
gate nobody can fail is a wish: with an empty register the whole path above is
machinery nobody has driven. The fixture is an ordinary case both compilers can
compile, registered so that the stage1 path is walked on every run — and
because both compilers *can* do it, `tests/run.js` also compiles it with stage0
and requires the same bytes, which is a stronger check than any real
stage1-only case can offer.

### Two things retirement is not

**It is not "Node leaves the repository."** `tests/run.js` (2,900 lines), the
oracles, `tests/differential/fuzz.js` and `bench/run.mjs` are Node programs and
stay Node programs. rustc's build is driven by Python and Go's by bash to this
day; a compiler is self-hosted when it compiles itself, not when nothing else
in the tree is written by anyone else. Porting the harness is a separate
question and this package does not open it.

**It is not "Nish-0 dissolves."** The subset does not disappear when
stage0 does — its *reference point* moves. Today `self/` may only use what
stage0 compiles, permanently. After retirement `self/` may only use what **the
last released `nish`** compiles, which is rustc's `#[cfg(bootstrap)]` window
with a longer period. The freeze stops being permanent and starts rolling, and
that — not the deleted code — is the actual prize: a construct added in 0.N
becomes available to `self/` in 0.(N+1) instead of never.

---

## 2. What stage0 still owns

Four buckets. Only the first is about compiling, which is why the port looks
finished and is not.

### A. Compiler behaviour stage1 does not have

`wp14-selfhost.md` §7a lists these in full; they are reproduced here as work
rather than as trivia, because each is a gate. **All four of §7a's have now
closed, and so have the three that building G1's check found** — which
is the argument for building the check before declaring the gate met, and the
reason those rows are in the table rather than in someone's memory. Two of the
three came from asking a question no oracle asks and the corpus half of
`--parity` cannot ask either: *what flags does each compiler say it has?*
Three closed as WP14 §7a work rather than alongside the generics of WP18 as
this package first expected: `process.platform` and `process.arch` closed
`--target host`, `isDirectorySync` closed the `-o <dir>` spelling, and
`process.exit(internalError(...))` closed exit 70. `--emit-ast` closed here, as
R1. They are left in the table so the count stays honest.

| | State today | What closing it needs |
| --- | --- | --- |
| `--emit-ast` | **closed** | stage1's own dump over `self/nodes.ts`'s vocabulary, with a checked-in golden (`tests/self/dump_ast.golden`). **Not** a mirror of `ts.SyntaxKind` — §7 was right about that, and what shipped is a different dump, not the same one: both compilers answer the flag, each about its own tree, and the printer is `self/ast_text.ts`, shared with `self/dump_ast.ts` so the flag and the parser oracle cannot drift |
| `--target host` | **closed** | `process.platform` / `process.arch`, composed exactly as `src/codegen/target.ts` composes them (`tests/cases/io_host`), at the 8 bytes of `.text` §7a predicted and measured |
| exit **70** on an internal error, and `NISH_DEBUG` | **closed** | `process.exit(internalError(...))` at each of the 35 sites, with the report in `self/ice.ts`; no second `panic` builtin, so the language did not grow for it. stage1 has no stack to print, and says so rather than promising one |
| `-o <dir>` without the trailing slash | **closed** | `isDirectorySync(path: string): boolean`, the `stat` beside `mkdirSync` (`tests/cases/io_is_directory`) |
| `--no-warn-performance`, and the WP15 §8 warnings themselves | **closed, found by the flag-set diff** | stage1 had the whole class — the analysis in `self/checker.ts`, the second list in the sink, the report in `self/diagnostics.ts` — and its driver never printed a word of it, so `build/nish` compiled a quadratic string loop in silence where `nish` named it. The driver reports them on stage0's streams and takes the flag that silences them. No oracle could see it: a warning goes to stderr on a compile that succeeds, and none of them reads that stream on a success |
| `--out-dir` | **closed, by removal** | the one difference that ran the other way: stage1's own spelling for `-o <dir>/`, which stage0 has never had, kept because three oracles passed it. They pass `-o <dir>/` to both compilers now and the flag is gone — parity without the frozen compiler growing anything |
| `--emit-checked`'s later-phase lines | **closed** | it was the port this row predicted: `self/compilation.ts` grew stage0's memoised `analyze()`, `self/dump.ts` grew `factsText` in stage0's format, and `checked_oracle.js`'s `LATER_PHASES` filter is deleted — 314 programs agree over 297,074 dump lines with nothing filtered out. It earned its keep immediately, catching a lost `nish_panic_div` fact that the compound-assignment fix below had just introduced |

### A2. What `--parity` found on its first run

The mode of G1 was run over `tests/cases` — 172 programs × 14 variations,
2,408 runs — before this section was written, and the point of writing the
numbers down is that they are the argument for the gate. **206 undeclared
differences, from five root causes, none of which any oracle could have
caught**: every oracle compiles a program with the flags that program already
carries, and none of these programs carries the flag that exposes it.

| Found | What it is | State |
| --- | --- | --- |
| `unwrapOr`'s fallback took a contextual type in stage1 | in f64 mode `r.unwrapOr(-1)` on a `Result<i32, string>` compiled in stage1 and was refused by stage0. `docs/LANGUAGE.md`'s contextual-literal table is an enumerated list and this is not one of its positions, so stage1 was in the wrong | **fixed**, `reject_res_unwrap_or_f64` |
| `Ok(...)`'s payload and an object literal's field, same cause | `` `Ok(...)` expects i32 for Result<i32, i32>, got f64 `` and `` Field `code` of `IoError` is i32, got f64 `` — stage0 refuses, stage1 compiles (`res_by_value_param`, `res_export`, `res_struct_error` under `--number-mode f64`) | **fixed**, `reject_res_ok_f64` and `reject_struct_field_f64`. The payload was the one-line shape this row predicted; the field was not. stage0 answers that position from *three* walks — the object-literal one names it, the numeric and array ones do not — and stage1 threads one contextual type down, so it was also compiling `{ b: 255 }` for a `u8` field and `{ xs: [] }`, in the default mode with no flag involved (`reject_struct_field_u8`, `reject_struct_field_empty_array`). A nested object literal and a `null` still take the field's type |
| a fixed-length stack array is sized from an IR operand, not a constant | `new Float32Array(2)` in f64 mode reaches `emitData` as a register rather than digits, because the length has been through a conversion. stage0 writes `alloca [NaN x float]` — **IR that `llvm-as` refuses, from a compiler that exited 0** — and stage1 writes `alloca [0 x float]`, which assembles and then stores two floats past a zero-element stack slot. Both are wrong and stage1's is the more dangerous, because it builds and runs (`f32_struct.ts --number-mode f64`) | **fixed**, `arr_stack_f64`. Both emitters read the length from the literal now, through the same `literalLength` the escape analysis used to decide the site was stackable, so the two answers cannot differ; a stack site whose length is not a literal is an internal error rather than a silent zero |
| the first diagnostic differs | `cf_switch_break.ts` in f64 mode: stage1 reports the `case` label against the discriminant at 12:12, stage0 an operand mismatch at 36:10. Both refuse the program | **open, and misnamed here**: the first diagnostic is the same on both sides (`switch` wants an integer discriminant, 8:13) and always was. What differs is what comes *after* it — stage1 reports the `case` label as well, stage0 throws out of the `switch` and never looks at it. It is the error-recovery row of the table below, not a disagreement about which check fires first, and reading only the first line is what made it look closed |
| a compound operator loses its spelling | `div_compound_attributes.ts` in f64 mode: stage0 says ``Operator `/=` requires…``, stage1 says ``Operator `/` requires…`` | **fixed**, `reject_cf_compound_string` and `reject_cf_compound_widths`. Not the one-word fix it looks like: stage1 was routing a compound arithmetic assignment through the *binary operator's* rule, which is where the spelling was lost and also why `s += "b"` compiled there — stage0 has one numeric-only rule for the construct, and stage1 has it now, for a local, a field and an element alike |

The remaining 193 rows are all the `--emit-checked` row of §2A above, which is
one cause counted once per program, and it is closed too: stage1 prints the
facts, and `checked_oracle.js` compares them.

**Four of the five are fixed, and the count they were found at is the point.**
Between them they cost four one-line refusals, one shared `literalLength`, one
rule moved out of `checkOperator` and one ported dump — and finding them cost a
cross product nobody had run. Two of the four turned out to be wider than this
table recorded (the object literal's field, and the compound operator), which
is the ordinary way of it: a difference found under one flag is rarely only
under that flag. The fifth was recorded wrongly and is a different problem than
the row says, which §A3 takes up.

Fixing them turned up a sixth of the same family, which nothing had reported
because no corpus program is written that way: **the context around a binary
operator reached its operands in stage1**, so `const b: u8 = 1 + 2` compiled
there and is refused by stage0 — in the default mode, under no flag at all.
All six are one design difference seen from six directions. stage0 decides a
contextual type by walking *up* from the literal through three functions with
enumerated positions (`contextType` in `src/checker/math.ts` for numbers,
`contextualType` in `classes.ts` for object literals and `null`, another in
`arrays.ts` for `[]`); stage1 threads a single `want` *down*, because
Nish-0 has no parent pointers (`.claude/selfhost.md`). One channel where
stage0 has three is more permissive by construction, and every difference here
is stage1 handing `want` to a position stage0's walk does not name. That is the
shape to look for next time, and `--parity` under a flag that changes what a
bare literal means (`--number-mode f64`) is what makes it visible.

Two of the five were in the compilers' *output* rather than their diagnostics,
and the stack-array one was a bug in the shipped compiler that predates this
package entirely. That is the case for the gate stated as plainly as it can
be: a cross product over flags the suite already uses, run once, found a
miscompile that eleven oracles and 1,161 checks had not.

### A3. What `--parity` says over the whole corpus

§A2 was `tests/cases` — 172 programs, 2,408 runs. The mode's own default is the
whole corpus that `tests/self/corpus.js` enumerates: `self/`, `examples/`,
`docs/cookbook/`, `bench/`, `tests/parser/` and `tests/link/` as well. That is
**593 programs and 8,302 runs, and it reports 13,800 undeclared differences**
after everything above is fixed. The number is not a surprise waiting to
happen; it is five classes, none of them a wrong-code bug, and writing them
down is what turns "R1 is nearly done" into a list:

| Rows | Class | What it is | How it closed |
| --- | --- | --- | --- |
| 12,209 | **a path inside the IR** | `; ModuleID = '...'` and `-g`'s `!DIFile(filename: ...)`. Handed the same absolute path, stage0 rewrote it cwd-relative (`displayName`) and stage1 printed what it was given. The oracles never saw it because they pass relative paths to both compilers | **stage0 changed.** An imported module is named by the specifier resolved against the name the *importer* was given (`importedName`), which is stage1's rule and needs no working directory. Named relatively no golden moves; named absolutely the two now write the same bytes. It also takes the cwd out of the emitted IR, which is what makes a build reproducible. `runtime.c` had eight bytes left of its 4 KB budget then, so a `cwd` builtin was never available to buy the other direction (the live ceilings, one per translation unit, are in `docs/wp7-runtime.md` §"Runtime additions and budget") |
| 602 | **the parser refuses before Phase 0 does** | `var x = 1` is `` syntax error: expected `;` `` from stage1 and `` `var` is forbidden; use `let` or `const` `` from stage0. By design (`.claude/selfhost.md`: lex and parse what is written, refuse in the phase that owns the rule) — `reject_oracle.js` counts these apart | **declared.** The narrow form: it applies only when stage1's first diagnostic is a syntax error *and* stage0 refuses the same file, and it covers stderr only — exit status, stdout and every file written are still compared, and stage0 accepting a program stage1 refuses is a failure rather than this. Closing it in code means grammar for 43 constructs the language forbids, which is a parser rewrite, not a fix |
| ~950 | **error recovery after the first refusal** | stage0 `throw`s out of the statement and unwinds; stage1 threaded an error value and kept checking. Both refuse, with the same first diagnostic, and stage1 said more after it. Mostly `--number-mode f64` over programs written for i32 mode, where one bad type cascades. `cf_switch_break` in §A2 is this, not what its row said | **stage1 changed.** `errored` in `self/context.ts` is the throw in a language without one: set by `error`, cleared per statement, and consulted where the throw would have unwound. Measuring it turned up four more contextual-type differences and one message, all listed in `CHANGELOG.md` |
| 40 | **`--emit-ast` on a program Phase 0 refuses** | stage0 validates before it dumps and exits 1; stage1 dumped the tree it parsed and exited 0 | **stage1 changed.** A dump flag does not turn a refused program into a compiling one (`tests/cases/dump_ast_reject`) |
| 13 | **one wording** | unary `+` is `` Unary `+` is forbidden; it converts, and Nish has no conversions `` in stage1 and `` Unsupported unary operator `+` `` in stage0 | **stage0 changed**, to the better sentence: it says *why* (`tests/cases/reject_unary_plus`) |

**Four of the five closed in code and one by declaration**, and the direction
each closed in is the interesting part. Twice it was the *frozen* compiler that
moved, because it was the one in the wrong: cwd-relative names in the IR and a
refusal that did not say why are both worse than what stage1 did, and "stage0
is the oracle" is a rule about who decides a disagreement, not a claim that
stage0 is right. Once it was a declaration, because the difference is a design
this repository already argued for. And the big one was stage1 adopting an
exception's control flow without exceptions — which then exposed four more
contextual-type divergences and a message, none of which anything had reported,
because a compiler that reports every consequence of a mistake buries the ones
that are its own.

**None of this was a miscompile, and none of it was reachable from §A2's
numbers.** That is the argument for running the mode over the corpus it
defaults to rather than the directory the first run happened to use.

### A4. The gate, green

> **Read §A5 before quoting this section.** The run below was real and its
> number was true on the day it was measured. It was false again by the time
> anybody read it: `--parity` was red on `main` at 045c8f8, on two separate
> `-g` defects, both of them stage0's. §A5 is what that cost and what it says
> about a gate that lives outside `npm test`.

```
parity: 8358 runs over 597 programs; 0 undeclared difference(s), 1523 declared
```

Five declarations stand, and they are the whole of what the two compilers
are allowed to differ about:

| Rows | Surface | What is decided |
| --- | --- | --- |
| 602 | stderr | stage1's parser refuses syntax the language forbids before Phase 0 can name the rule. Closing it in code is grammar for 43 constructs that never compile, which is a parser rewrite rather than a fix |
| 548 | `--emit-ast` stdout | each compiler dumps its own tree; a golden per compiler pins each |
| 349 | `--emit-checked` stdout | the `module <path>` header only, where stage0 relativises against a working directory stage1 does not have |
| 13 | stderr | stage0 reports an inheritance cycle once per class, from a marker its throw leaves behind; reproducing that without exceptions makes stage1 loop |
| 11 | exit | the parser refusal again, on the status a dump flag reaches |

Everything else — every diagnostic, every span, every byte of IR, every
sidecar, every exit code, under every flag the suite uses — is identical.
Getting there took the count from 13,800 to 503 to 189 to 28 to 0, and one
step of it went *backwards*, from 28 to 53, on a rule about stage0 inferred
from two experiments and wrong in two ways. The mode is what caught that
too.

### A5. The gate reopened, and the correction §A4 needed

**R1 and G1 were recorded as done on "an empty difference set", and that claim
stopped being true without anyone editing it.** On a clean `main` at 045c8f8,
`node tests/run.js --parity` was red. The program:

```typescript
export const add = (a: i32, b: i32): i32 => a + b;

export const main = (): number => add(2, 3) - 5;
```

Compiled with `-g` by each compiler, three `!DILocation` columns differed:

```
!8  = !DILocation(line: 1, column: 20, scope: !7)     stage0
!8  = !DILocation(line: 1, column: 1,  scope: !7)     stage1
!16 = !DILocation(line: 3, column: 21, scope: !15)    stage0
!16 = !DILocation(line: 3, column: 1,  scope: !15)    stage1
!22 = !DILocation(line: 3, column: 21, scope: !21)    stage0
!22 = !DILocation(line: 3, column: 1,  scope: !21)    stage1
```

stage0 took a function's position from the `ArrowFunction`, whose own start is
its parameter list; stage1 took it from the declaration, because its parser
normalises both spellings into one `N_FUNCTION` that begins at `export`
(WP22 §8).

**stage0 was the wrong side, and the argument is not a preference about
debuggers.** stage0 gave *the same function* two different positions depending
on which spelling declared it: `export function add(…)` landed at column 1 and
`export const add = (…) => …` at column 20, from one compiler, for one program.
That is precisely the identity WP22 stage A was declared done on — "the two
spellings of one program emit byte-identical IR" — and under `-g` it had not
held since arrows landed. The divergence is also wider than the three columns
the corpus happened to show. Whenever the arrow does not begin on the `const`'s
own line, stage0 named the wrong **line** as well, in the `DISubprogram`, in
`scopeLine`, and in every parameter's `DILocalVariable`:

```typescript
export const add =
  (a: i32, b: i32): i32 =>
    a + b;
```

```
!7 = distinct !DISubprogram(name: "add", …, line: 2, …, scopeLine: 2, …)   stage0
!7 = distinct !DISubprogram(name: "add", …, line: 1, …, scopeLine: 1, …)   stage1
```

A debugger asked where `add` is declared should answer where a reader would say
it is, which is line 1 — and the answer may not depend on the spelling.

**The fix is `FunctionSig.declSite`**, recorded by the checker and read by
`src/codegen/debug.ts`: the node the declaration *begins* at, which is `decl`
itself for a `function`, a method and a constructor, and the `VariableStatement`
for the arrow form. It is recorded rather than re-derived for the reason
everything here is recorded — the emitter may not climb to a parent to find out
what a node is part of. Stage1 needed no change and gained a comment saying
why. This is the same family as the two concise-body bugs of
`docs/wp22-arrow-functions.md` §8a and resolves the same way: the pass that was
climbing to a parent node was the one in the wrong, and stage0 is the compiler
that climbs.

**How a closed gate reopened in silence.** Three things had to hold at once,
and all three still hold for whatever reopens it next:

1. **An empty difference set is a fact about the corpus, not about the
   language.** The cross product runs every corpus program under fourteen flag
   variations, and it cannot ask a question no program in the corpus poses.
   Every `-g` case was written in the `function` spelling, so in 8,358 runs
   nothing ever compiled an arrow-declared function with `-g`. The number in
   §A4 measured the corpus of the day it was run.
2. **`--parity` is not a section of `npm test`.** It is a mode, run explicitly,
   for the reasons G1 gives: it is a cross product and it links a stage1
   binary. Nothing on the way to `main` runs it, so the gate records the last
   day somebody remembered to.
3. **WP22 was moving the corpus underneath it.** Arrows are already the
   declaration form for every example, the README, the cookbook and
   `docs/LANGUAGE.md`, and stage C converts `self/`'s ~603 declarations — so
   the divergence was spreading by the file while the record said the
   difference set was empty. `tests/cases/dbg_enum` (WP23) was written in the
   `function` spelling *because of* this bug, which is the shape of a defect
   that has started to bend the work around itself.

`tests/cases/dbg_arrow` closes the first of the three: a `-g` case in the arrow
spelling, pinning the line as well as the column, so `tests/self/ir_oracle.js`
and the corpus half of `--parity` both ask the question from every run onwards.

#### And the run that proved the fix found a second one

The run that proved the arrow fix came back with **10** undeclared differences
still standing, and they were one root cause with nothing to do with arrows: a
`!DILocation` column after a **non-ASCII character**.

```
self/checker.ts  -g  checker.ll  line 9202:
  stage1 !2528 = !DILocation(line: 1305, column: 36, scope: !2476)
  stage0 !2528 = !DILocation(line: 1305, column: 34, scope: !2476)
```

`self/checker.ts:1305` is a performance-warning string with an em dash in it —
three UTF-8 bytes, one UTF-16 code unit, and the two columns differ by exactly
two. stage1 counts bytes, because every offset in `self/` is a byte offset;
stage0 counted the code units the `typescript` API hands it.

**stage0 was wrong again, and clang settles it rather than taste.** Given a
line whose comment holds a three-byte em dash, `clang -g` puts the `return`
after it at **column 13** — the byte count — where a code-unit count says 11. A
DWARF column is read back against the file's bytes, so bytes is the answer, and
stage1 had it. `locationOf` counts UTF-8 bytes now (`tests/cases/dbg_utf8`).
stage0's *diagnostic* columns are deliberately untouched and stay code units:
an editor is the consumer there, a debugger is the consumer here.

The header of `self/debug.ts` had written this divergence down and then
dismissed it — "every line of every `-g` case is ASCII, where the two counts
are equal". That was true of `tests/cases` and false of the corpus, which is
§A4's mistake in miniature: **a caveat retired on the strength of the test
directory, by a mode that compiles `self/` too.** Two defects, one shape —
a claim about the corpus quietly read as a claim about the language.

#### The gate, green again

```
parity: 9345 runs over 623 programs (2304.0 s); 0 undeclared difference(s), 1669 declared
```

The declarations are §A4's five, unchanged in kind and larger only because the
corpus is: nothing here is a new thing the two compilers are allowed to differ
about. Quote this with its date, the way §A4 should have been quoted, and run
the mode again before quoting it at all.

#### A6. Green again, on a corpus a fifth larger — and the third way this gate lied

```
parity: 11460 runs over 764 programs (1686.9 s); 0 undeclared difference(s), 2506 declared    2026-09-13
```

The corpus grew by the ninety `reject_*` cases G2.4's wording work added, and
the mode found **84 undeclared differences** in them: no wrong lowering and no
wording, but five places where stage1 puts the caret somewhere stage0 does not
— a `for...of` head reported at its first declarator rather than at the
`const`, a duplicate function at the name rather than at the statement, an
empty import list nowhere at all (`closeList` spans a list by its elements, and
an empty one has none), and a field whose refused initializer then tripped the
definite-assignment pass into a second complaint about the same line. Every one
of them is a case nobody had written before, which is §A5's first lesson again:
an empty difference set is a fact about the corpus.

**And one of the 84 was the mode itself.** `build()` returned
`build/self/compile` whenever the file existed, so the run compared today's
stage0 with whatever stage1 was last linked — a fix on one side reading as a
difference, a fix on the other reading as agreement. It links a fresh compiler
every run now, forty seconds against half an hour. §A5 lists two ways a closed
gate reopens in silence; this is a third, and the worst of them, because it can
report *green* against a compiler nobody has rebuilt. The other oracles were
checked and none of them caches: `ir_oracle.js`, `checked_oracle.js` and
`goldens.js` all link their binary unconditionally, and `goldens.js` says why in
its own header — "a golden compared against a stale binary is a golden
comparing itself with yesterday".

#### Should `--parity` run in CI?

**Yes, and not in the `test` job — and it does now.**
`.github/workflows/parity.yml` runs the corpus half nightly at 06:17 UTC and
on `workflow_dispatch`, and writes its summary line into the run summary with
the date, because that number is a fact about the corpus on the day it was
measured. The flag-set half stays where it was, inside `npm test`. The costs
below are what the arrangement was decided on, and they are left as measured:

- **What it costs.** A full run is 9,000-odd compilations by each compiler over
  623 programs, plus linking a stage1 binary first — about forty minutes on
  this machine, against roughly three minutes for `npm test`. It grows with
  every flag: WP20's `--threads` added a fifteenth variation and 637 runs to
  the cross product on its own. On a hosted runner it is the longest single
  thing in the repository.
- **Where it fits.** Not in `test`, which every push waits on. `--flags-only`
  — the half that found `--no-warn-performance` and `--out-dir` — takes seconds
  and sits in `test` already. The corpus half went to a nightly `schedule:`
  trigger rather than beside `bootstrap`, because `bootstrap` runs on every
  push and pull request too: a nightly names the day a difference appeared
  without making every branch wait forty minutes to hear it. A schedule fires
  on the default branch only, so a branch is asked about by hand
  (`workflow_dispatch`, or `node tests/run.js --parity` locally).
- **What it buys.** The failure mode this defect demonstrates: a gate recorded
  as closed, reopened by an unrelated feature, spreading with every file the
  feature converts, and invisible until somebody ran the mode by hand. Between
  §A2 and §A3 this mode found a miscompile that eleven oracles and 1,161 checks
  had not. A gate that only runs when remembered is a gate that measures
  memory.


### B. The oracles

Twelve comparisons keep the two implementations honest. Retiring stage0 does
not blind all of them, and knowing exactly which is the difference between a
decision and a leap:

| Oracle | Compares against | After stage0 |
| --- | --- | --- |
| `lexer_oracle.js` | the `typescript` package's scanner | **survives** — it never read `src/`, and since G2.3 it does not build with it either. Costs one devDependency |
| `parser_oracle.js` | the `typescript` package's parser | **survives**, same reason |
| `support_oracle.js` | `node:path`, `Buffer`, `Map`, `JSON.stringify` | **survives, less two families.** This row was wrong: the oracle also compares `irEscape` and `f64Hex` / `f32Hex` against stage0's own `dist/codegen/emit/*.js`. Those lines are dropped from both sides, counted and named, when there is no `dist/` — recovering them as a golden is unfinished G2.4 work |
| `tests/differential/` default mode | the same program rewritten to JS and run under Node (WP13) | **survives** — it is a *semantic* oracle and never needed a second compiler |
| `reject_oracle.js` | each case's own `.err` fragments | **survives**; the fragments are checked in, not derived from stage0 |
| `tests/cases/*.ll` (150 goldens) | checked-in IR | **survives**, and becomes the primary regression net |
| `types_oracle.js` | `src/types.ts` | **dies** |
| `diagnostics_oracle.js` | `src/diagnostics.ts` | **dies** |
| `symbols_oracle.js` | `src/checker/scope.ts` | **dies** |
| `checked_oracle.js` | stage0's `--emit-checked`, 308 programs | **dies** |
| `ir_oracle.js` | stage0's IR, 312 programs byte for byte | **dies** |
| `interop_oracle.js` | stage0's sidecars, 60 of them | **dies** |
| `fuzz.js --stage1` | `IR(stage0, p) == IR(stage1, p)` on generated programs | **dies in that form** |
| `bootstrap.js`, first equality | `IR(stage0, self/) == IR(stage1, self/)` | **dies** |
| `bootstrap.js`, second and third | the fixed point, stage3 == stage2 | **survive** — they never involved stage0's output |

Six oracles and one fuzzer mode die. The replacement is Go's `toolstash -cmp`:
compare **the seed release against HEAD** over the same corpus, byte for byte,
and require a named reason for every file that differs. That is a weaker
property — it catches regressions rather than disagreements, and it cannot find
a bug both versions share — but it is the property Rust and Go actually run,
and it is the only one available once there is one implementation.

#### What each dying oracle covered, and what covers it now

G2 item 4 asks for the numbers in this document on the day. Measured at the
commit that added `tests/self/goldens.js`, with all four oracles green — so
what the goldens record is the *agreed* behaviour of both implementations, not
one implementation's opinion:

| Dying oracle | Covered | Recovered as | Size |
| --- | --- | --- | --- |
| `checked_oracle.js` | 319 programs, 303,096 dump lines of `--emit-checked` | `goldens/checked.txt` (262 programs outside `self/`, verbatim) and `goldens/checked_self.txt` (57 `self/` programs, stored by module) | 283 KB + 1,057 KB |
| `types_oracle.js` | 119 lines: every LLVM type, alignment, printed name, flag and assignable pair | `goldens/types.txt`, verbatim | 3.6 KB |
| `diagnostics_oracle.js` | 570 lines: the line/column index over every offset, the excerpt rendering, the `--json` shape, the sink's order and its cut | `goldens/diagnostics.txt`, verbatim | 19 KB |
| `symbols_oracle.js` | 25 lines: what a name resolves to, what it reads as, where a narrowing ends | `goldens/symbols.txt`, verbatim | 1.0 KB |

The `self/` dumps are 19.9 MB raw because a `self/` program is loaded whole and
each of the 57 entries re-dumps every module it imports; the distinct content
is 1.0 MB. **Storing it by module is a storage decision and not a coverage
one**: the check still runs all 57 programs and compares every one of those
19.9 MB of bytes. A module that ever dumps differently under two entries is a
hard error naming both, so the deduplication cannot quietly become a loss.
`tests/self/goldens.js` names neither `src/` nor `dist/`, and it was watched
passing with both moved aside while all four oracles failed to start.

#### The wording gap, and what closing it turned up

The gate singles out diagnostic wordings, "presently proved by comparison and
otherwise proved by nothing". **The four goldens above close none of that gap**,
which was measured rather than assumed: every registry fragment was matched
against each file, `checked.txt` contains one registry wording (`NL2099`) that
a `reject_*` case already covers, the other four contain none, and
`diagnostics.txt` pins the diagnostic *machinery* rather than any rule's words.

So the gap was measured again, this time by a command anybody can re-run rather
than by a number in a commit message:

```bash
node tests/diagnostic_coverage.js --report      # every code, covered or not
```

`tests/diagnostic_coverage.js` reads the registry out of `self/codes.ts` — the
half that outlives stage0 — compiles the negatives, the `perf_*` positives and
its own corpus, and reads the `code` field of every `--json` object. It never
matches the compiler's source against a table copied out of it, which is the
only way the measurement still means something after R6.

**The starting number was 176, not 196, and the registry was 351 codes, not
344.** The note's figures were right when they were written; seven codes and
twenty-seven covered wordings had landed since, which is the argument for a
tool over a tally — and the argument keeps making itself, because the registry
has grown three more times while this branch waited. The left column is the
measurement that opened the gap; the right is what the tool answers today, and
the way to re-derive it is to run the tool rather than to read this table:

| | When the gap was measured | Now |
| --- | --- | --- |
| registry codes | 351 | 399 |
| provoked by something that outlives stage0 | 175 | **338** |
| provoked by nothing | 176 | 0 |
| unreachable, each with a reason on file | — | 61 |

What moved it is `tests/wordings/`, 126 cases: one small program per code,
named for the code it pins (`nl2200_empty_import_list.ts`), with the whole
message in its `.err`. A reword fails it twice — the message no longer matches, and the
generator gives the new words a new number, so the code no longer matches
either — and the tool refuses to go green while any registry code is neither
provoked nor named in `tests/wordings/unreachable.txt`. That last rule is the
part that keeps the gap closed: a diagnostic added next year arrives with a
case or with a sentence saying why it cannot have one.

**61 codes are unreachable, and that is a finding about the compiler rather
than a test nobody wrote.** In six kinds, all listed with reasons in
`tests/wordings/unreachable.txt`:

| | What it is |
| --- | --- |
| 28 | **retired**: the fragment matches nothing the compiler prints any more. Mostly the inheritance and `super(...)` rules WP25 removed, plus two long forms of WP15 §8 warnings, the `case` label rule WP23 reworded to admit an enum member (`NL2123`, superseded by `NL2284`), Phase 0's blanket generic sentence before WP18 named the kind it is on (`NL1045`, superseded by `NL1054` and `NL1055`), and one — `NL2287` — that never fired at all, because WP23 reserved the number and no message in either compiler produces the fragment. The generator keeps the number on purpose, so these cost a string and are correct as they stand |
| 13 | **not diagnostics at all**: `scripts/gen-diagnostic-codes.mjs` scans for `fail(`/`error(` calls, and catches the driver's `console.error` usage errors (`unknown option:`, `--target: unsupported target`, the four lines of the exit-70 report) and the `fail(...)` helper that writes the N-API shim's *generated C*. No `--json` object can ever carry one. Their wordings are real and are pinned — by the WP12 block of `tests/run.js` and by the interop checks — but they are not rules, and `RULE_COUNT` is about four percent larger than the number of rules a user can be shown |
| 11 | **preempted**: Phase 0 owns `async`, generators, generic type parameters and labels, so the checker's sentences for them never fire — including its own `Generic classes are not supported yet`, which `NL1054` reaches first; a class name is registered before any function signature, so `NL2075` cannot precede `NL2074`; the single-module `check()` path is not the driver's |
| 4 | **shadowed**: `codeFor` walks the table longest fragment first, and these four fragments are substrings of a longer fragment *of the same message* (`NL1022` under `NL1005`, `NL1041` under `NL1007`, `NL2019` under `NL2095`, `NL2031` under `NL2118`) |
| 3 | **structurally impossible**: no import syntax reaches `NL2211`; `NL2216` is an internal invariant; the `new` dispatch has a `*` fallback, so `NL2252`'s table never misses |
| 2 | **backstops**: WP18's two instantiation caps, which need 257 tuples for one template or 4,097 in a module. Reachable, and the only entries here that are a judgement about what this corpus should carry rather than a fact about the compiler — which is why they say so, and why they are the first place to look if this list starts growing |

#### What the corpus found on its way, which is the part worth reading

Writing a program per code asks the two compilers a question no oracle asks,
for the same reason §A2 gives about flags: **every oracle compiles the programs
that are checked in, and none of these programs was.** Forty-three of the 126
cases do not get the same answer from both compilers, and they are in
`tests/wordings/parser_refusals.txt` and `tests/wordings/stage1_divergence.txt`
rather than in anybody's memory. **Both counts are the ones
`node tests/diagnostic_coverage.js --compiler build/nish --strict-refusals`
prints at the end of its run**, and both have moved since this section was
written — 58 of 124 then, 43 of 126 now — so re-derive them rather than quoting
this paragraph:

- **41 are declared and expected**, from 45 when the member-header family
  closed (R3 in §5). stage1's parser refuses the syntax by name before the
  phase that owns the rule can state it — §A3's 602-row class. The consequence
  is exact and is the reason the count is carried apart: **those 41 wordings do
  not survive R6.** They are stage0's, this corpus pins them while stage0
  lives, and after the deletion a user sees stage1's syntax error instead,
  which `reject_oracle.js` already pins.
- **2 are not declared anywhere, and one of those is not about wording at
  all**, from 13 when this was written. stage1 *compiles* one program stage0
  refuses: WP18's `<T, T>`, a generic declaring the same type parameter twice,
  which is a checker gap rather than a wording one. Eleven of the thirteen
  closed in the meantime — the two 2^53 literals, `new Point<i32>()`, the three
  `for...of` head rules, `++` on a string, the void ternary, the two clash
  wordings and the generic imported across modules, which WP18's
  monomorphisation closed — each of them now the same sentence at the same
  column on both sides with a `reject_*` case of its own. The other one refuses
  the program with a different sentence that carries **no code at all** —
  stage1 says ``Unsupported statement `;` `` where stage0 says the coded one.
  That is what the tool's `uncoded=` count is measuring: five for stage1
  against four for stage0, where the four are the same `tests/link/` messages
  on both sides.
- One smaller thing, recorded here rather than in a list: stage0 prints a
  syntax error as a `--json` object on stdout and stage1 prints it only on
  stderr, and `--json` is not one of `--parity`'s fourteen variations. The
  spans differ on `NL2200` as well (stage0 points at the `{}`, stage1 at the
  whole statement).

None of this is fixed here — a code is keyed on its message text, so rewording
one retires the code — and all of it is now a line somebody has to delete when
they do fix it, because `npm test` runs the tool over stage1 with
`--strict-refusals` and a case that starts agreeing fails.

### C. Distribution

`npm install -g nish` ships `dist/`. `--version` reads `package.json` at
runtime. `wp12-release.md` lists "prebuilt binaries of the compiler itself"
under *Not in this work package*, on the grounds that the compiler is a Node
program and the tarball is the artefact. All three of those statements are
about stage0 and all three stop being true on the day it goes.

### D. Provenance

`IR(stage0, self/) == IR(stage1, self/)` is the diverse-double-compiling
property. It holds today over all 54 modules and 6,977,900 bytes of IR. When
stage0 goes, it goes, and it cannot be re-established later without writing a
second compiler again.

---

## 3. The gates

Six. Each has a check that `npm test` or CI can run, because a gate nobody can
fail is a wish.

### G1 — Parity: no program and no flag is stage0's

`self/` compiles every program stage0 compiles, and answers every flag stage0
answers, with the same output and the same exit code. Concretely, the four rows
of §2A are closed and the "stage0 rejects it" / "stage1 rejects it" counters in
every oracle read **zero**, with the three documented skips of
`.claude/selfhost.md` closed or re-justified in writing.

**The check, in two halves.** `node tests/run.js --parity`
(`tests/self/parity.js`). The first half asks each compiler what flags it has,
by reading its own `--help`, and diffs the two sets: that is the half that
found `--no-warn-performance` and `--out-dir`, and nothing else in the tree
asks the question, because every oracle compiles programs with flags rather
than enumerating them. The second half
runs the corpus through both compilers on every flag variation the suite uses
— the fourteen of `VARIATIONS`, each of them a flag some `.args` sidecar or
`tests/run.js` already passes — and compares *everything the command line
produces*: exit status, stdout, stderr's `error:` lines, and every file
written, byte for byte. It prints a table rather than asserting silently, and
it is a mode rather than a block in `npm test` because it is a cross product
and it links a stage1 binary.

A difference is a failure unless it is **declared** in the driver with a
reason, and a declaration has to *earn* itself: it normalises away exactly the
bytes that are allowed to differ, and anything still differing afterwards is
reported. A declaration that swallowed a surface whole would hide the next real
divergence on it, which is the failure this mode exists to prevent — the one
`whole` declaration is `--emit-ast`'s stdout, where every byte differs by
design and there is nothing finer to say.

**Why it blocks.** A retirement that leaves one flag behind is a regression
shipped to users who were told the two compilers were the same compiler. §A2
is what that reads like in practice: the first run of this check found five
disagreements, one of them a miscompile, and every one of them had been
sitting under a flag combination nothing had ever tried.

**This gate is met by running it, not by having run it**, and what changed is
who remembers to run it. `.github/workflows/parity.yml` runs the corpus half
nightly (§A5's costing is why it is nightly and why it is not in `test`), so
"G1 is green" now dates from last night rather than from whenever somebody last
typed the command. That is not the same as green on a branch: a schedule fires
on the default branch only, so a change that reopens the gate is caught the
morning after it merges, not before. Re-run `node tests/run.js --parity`
against a branch that touches either compiler, and quote a number with the
date it was measured on.

### G2 — Oracle succession: the replacement runs before the original is deleted

Every row of §2B is either surviving, replaced, or written off with a reason.
Specifically:

1. `nish-cmp` exists and is green: the last released `nish` and HEAD are
   compared over the whole corpus, byte for byte, and a difference must be
   named in `CHANGELOG.md` before CI goes green. This is Go's `toolstash -cmp`
   and it is the successor to `ir_oracle.js` and `interop_oracle.js`.
2. `fuzz.js --stage1` is repointed to the same pair — random programs, seed
   release versus HEAD — so the generated corpus keeps its comparison.
3. The four surviving oracles are repointed to build their stage1 binary with
   the **seed** rather than with stage0, and stay green. **Done.**
   `tests/self/seed.js` resolves one seed for all of them — `--seed`, then
   `NISH_BOOTSTRAP`, then `build/nish` — and `tests/run.js` passes today's in,
   so the oracles themselves name no compiler. Run by hand with no seed
   anywhere they fall back to stage0 and *say so on stderr*, because a run that
   proved something weaker than its summary line suggests is worse than a run
   that refused. Two stage0 dependencies inside the oracles went with the
   build: `reject_oracle.js` asked stage0 whether a `tests/link` case compiles
   at all, which the seed answers as well, and `support_oracle.js`'s escape
   comparison is now a named skip rather than a module-level import that would
   stop the file loading after R6.
4. The coverage lost by `checked_oracle.js`, `types_oracle.js`,
   `diagnostics_oracle.js` and `symbols_oracle.js` is measured and recovered as
   checked-in goldens *before* they are deleted — in particular every
   diagnostic wording, which is presently proved by comparison and would
   otherwise be proved by nothing.

**The check.** The numbers, in this document, on the day: how many programs
each dying oracle covered, and what covers them afterwards. For the wordings
the check is a command rather than a paragraph —
`node tests/diagnostic_coverage.js --report` — and it is wired into `npm test`
over both compilers, so the gate cannot be met once and then drift: a registry
code that no program provokes fails the run until somebody writes the case or
writes the reason.

**State: item 4 is met.** The four goldens are in `tests/self/goldens/` with
their numbers in §2B, and the wording half is closed — 338 of the 399 registry
codes are provoked by a program that outlives stage0, and the other 61 are
unreachable with a reason on file. What is left behind on purpose is named in
§2B too: 41 wordings that are stage0's because stage1's parser refuses the
syntax first, and 2 programs the two compilers do not answer the same way, one
of which stage1 compiles. Both lists are meant to shrink and both have: the
wordings from 45, when the *member header* family closed (see R3 below), and
the divergences from 13 to 3 and then to 2. Every number in this paragraph is one
`node tests/diagnostic_coverage.js` prints — the registry grows, so read them
from a run rather than from here.

**Why it blocks.** This is the one everybody gets wrong. Deleting the seed is
easy; noticing six months later that nothing checks the diagnostics is not.

### G3 — The seed protocol exists and CI uses it

`scripts/bootstrap.sh` accepts a seed compiler — `NISH_BOOTSTRAP=<path>`,
Go's `GOROOT_BOOTSTRAP` by another name — instead of assuming `dist/index.js`.
CI builds `self/` with the **last released binary** on every run, on both
operating systems, and that build is a required check.

**Why it blocks.** The rolling freeze of §1 is enforced by this job and by
nothing else. Nish has no conditional compilation and will not grow any:
there is no `#[cfg(bootstrap)]` to write, so the discipline is "do not use it
yet", and a discipline that CI does not check is a comment.

**State: the script half is done, the Linux half of the CI half is done and
honest, and the second operating system is short two things rather than one.**
`scripts/bootstrap.sh` reads `NISH_BOOTSTRAP`, `ci.yml`'s `seeds` job asks the
last release which seed binaries it attaches, and its `bootstrap` job builds
`self/` with each one. A release attaches `x86_64-linux` and nothing else, so
that is one row, on Linux.

The `test` row on macOS is **not** back, and for the first time the reason is a
measurement rather than an estimate. It was run on 2026-09-13 and `npm test`
fails there with five failures in four families, all of them checks that encode
an ELF/Linux assumption and none of them a compiler bug: an empty `.debug_line`
in a Mach-O executable (DWARF lives in the `.o` files until `dsymutil` runs,
twice), a `--threads` link that ld64 *accepts* where ELF refuses it, and
`stage3 == stage2` failing at identical size because Mach-O's debug map records
each `.o`'s path and mtime. The bash 3.2 defects that used to block the row are
genuinely fixed; these are what is behind them
([wp10-ci.md](wp10-ci.md#ci-matrix)). The fourth family also stands between the
release workflow and a darwin binary, because
`scripts/bootstrap.sh --verify` asserts that same comparison.

**A seed the job cannot find is no longer green, and "there is no seed" is not
one state.** The gate has been wrong in both directions here, a round apart,
and the correction is to stop asking one job to say three things with two
colours.

It first named the asset it wanted, warned, and exited 0 — and a warning above
a green check is a green check. That is this document's own §A5 in a second
place: a gate wearing the colour of a gate that held, while nothing had been
checked. The correction for *that* made every missing seed red, which is the
other error and a worse one: `release.yml`'s `release` job is `needs: ci`, so a
repository with no release could never cut the release that would supply the
seed the gate is waiting for. That is the 0.1.0 base case
([wp12-release.md](wp12-release.md#release-procedure)) and it is every fork on
the day it is forked — and it is the same argument that keeps the macOS `test`
row out, applied to a job sitting on the release path.

So the lookup is a job of its own, `seeds`, and `bootstrap` is a **matrix over
its answer** — one row per seed the last release actually attaches. A platform
with no seed has no row, and when there is no release at all there are no rows
and `bootstrap` is skipped:

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | the freeze was checked with that seed, on that seed's own platform, and it held |
| `seeds` green, no row for a platform | the freeze was *not* checked there, and nothing is wrong: no release carries a seed for it yet. The `seeds` summary names every platform in both states |
| `seeds` green, `bootstrap` **skipped** | the same for every platform at once: there is no release at all |
| `seeds` **red** | a seed that should exist does not — a release missing an asset `release.yml` attaches |
| a `bootstrap` row **red** | `self/` does not build with the last release: the rolling freeze broken, which is what the pair exists to catch |

Which missing seed is which is decided by **platform**, because the two cases
are genuinely different, and the decision is data rather than prose:
[`.github/seed-targets.json`](../.github/seed-targets.json) marks a platform
`attached` when `release.yml` builds a seed for it. A release that attaches no
`nish-<version>-x86_64-linux.tar.gz` is a regression in `release.yml` or in the
asset name, and costs the freeze its only check, so it is red — with the
recovery in the annotation, since that red also blocks the release that would
fix it. A release that attaches nothing for **darwin** is neither: nothing
builds that binary yet, which is [G5](#g5--distribution-does-not-need-node), so
there is no row and the `seeds` summary says the freeze is unchecked there.
Each of the other three platforms joins the red list on the day `release.yml`
starts building its binary and the file is marked to say so.

**The lookup is a file rather than a `run:` block, and `npm test` runs it.**
`.github/seed-matrix.sh` is the step body, and the WP19 block of `tests/run.js`
drives it against a stand-in for `gh` through each state: the seed present, the
`attached` seed missing (exit 1, with the `::error::`), no release at all, and
a seed appearing for a platform that had none — which is the claim that the
macOS row arrives with no edit to `ci.yml`, checked rather than asserted in a
comment. Both times this logic was got wrong it was inline shell in a workflow
that nothing could run.

That file is also where the asset name is spelled, once. `release.yml` looks
its own up rather than writing it out, and the same block of `tests/run.js`
checks every row against the compiler's own target table: each `triple` is one
`src/codegen/target.ts` calls canonical, and each `asset` is that triple with
the vendor and the ABI dropped (`x86_64-unknown-linux-gnu` → `x86_64-linux`,
`aarch64-apple-darwin` → `aarch64-darwin`). The four spellings used to live in
two comments calling each other a contract, and two of them — `aarch64-darwin`
and `x86_64-darwin` — were described there as triples the compiler accepts,
which it never has: it knows `aarch64-apple-darwin` and `x86_64-apple-darwin`,
and their `-macosx` and `arm64-` aliases.

On Linux this is the ordinary path rather than the interesting one: v0.2.0 is
released with `nish-0.2.0-x86_64-linux.tar.gz` attached, so the job downloads a
real seed and a red one would be a regression. (v0.1.0 is a tag with no release
behind it and no assets, so it is not a seed and never was — see
[wp12-release.md](wp12-release.md#release-procedure) step 2.)

**So the darwin half of G3 is short two things, and the runner is neither of
them:**

1. the **seed** — a release attaches `nish-<version>-x86_64-linux` and nothing
   else, so there is no darwin binary to bootstrap from, which is
   [G5](#g5--distribution-does-not-need-node); and
2. the **ld64 fixed point** — the fourth family above. `--verify` asserts
   `stage3 == stage2` byte for byte, and without that fixed a `bootstrap` row
   on macOS would be red on the day its seed arrived, which is the other way a
   gate lies about itself. That comparison now carries a note at the site
   saying what was measured on Mach-O, so the next person to reach it does not
   have to find it from a workflow comment.

Neither is a line in `ci.yml`, and neither is claimed here. The matrix is the
release's answer rather than a list in the workflow, so the macOS row appears
on the day a release carries a darwin seed — which is the day the second of
those two has to be true.

#### What the seeded run proves, and what it does not

**It proves that the seed can build `self/`, and that is the whole of the
freeze.** stage1 compiling and linking is the check: a `self/` that reaches for
a construct the seed has never heard of does not compile, does not link, and
the job fails on the spot naming the rule. Nothing later in the run is needed
for that, which matters because everything later in the run is about something
else.

**It does not prove `IR(seed) == IR(stage1)`, and must not be asked to.** With
stage0 as the seed that equality is diverse double-compiling — two
independently written implementations of *the same source revision* agreeing
byte for byte — and it is asserted, by `npm test` on every run
(`tests/self/bootstrap.js`, which seeds with stage0 deliberately) and by
`scripts/bootstrap.sh --verify`. With a **released binary** as the seed the
same comparison silently becomes a different assertion: that the IR this
working tree emits for `self/` is the IR the last release emitted for it. That
is one implementation at two points in time. It is not a bootstrap property at
all — it is a freeze on codegen between releases, and it forbids exactly the
changes a release exists to carry.

It broke the first time one landed. A flow-sensitive bounds analysis
(`wp15/ranged-types`) proved 46 of `self/`'s 1,206 index checks redundant; 20
of 56 modules changed, 143,468 lines of IR became 143,008, and the seeded job
reported a broken bootstrap because an optimisation had worked. The fixed point
was untouched throughout: `IR(stage1) == IR(stage2)` held over all 56 modules
and stage3 was byte-identical to stage2.

So `scripts/bootstrap.sh --verify` asserts the seed equality **only when the
seed is stage0** — by identity, so naming this checkout's own `dist/index.js`
in `NISH_BOOTSTRAP` still counts as stage0 — and with any other seed reports
the difference as a note and carries on. The two seed-independent equalities
are asserted whatever the seed is. The script's header carries the long form of
the argument, and `tests/run.js`'s WP14 block pins both halves of the decision
so it cannot drift back.

This is §A5's lesson on a second subject. There a gate's claim stopped being
true while its record said it held; here a gate's claim quietly changed into a
*different* claim, under one spelling, while the record still described the
old one. A gate is worth exactly what its meaning is written down as.

### G4 — The seed policy is written before it is needed

One sentence in `wp12-release.md`, decided now rather than at the first
awkward release: **`nish` 0.N is built by the last patch release of
0.(N−1)**. Go publishes its version of this and it is why nobody argues about
it during a release.

The consequence, stated where contributors will read it: a construct added in
0.N cannot be used by `self/` until 0.(N+1). Rule 1 of `wp14-selfhost.md` §6
("a construct enters the language before it enters `self/`") survives
retirement unchanged — only its subject changes, from stage0 to the seed.

### G5 — Distribution does not need Node

- The release workflow builds `nish` for `x86_64`/`aarch64` × `linux`/`darwin`
  from the seed release and attaches the four binaries to the GitHub release.
- Installing the package keeps working: it becomes a thin installer that
  fetches the binary for the host, or ships it. Whichever, the check in
  `tests/run.js`'s WP12 block — pack, install into a temporary prefix, link a
  hello-world from an unrelated directory — must still pass. **This bullet
  used to read `npm install -g nish` and that spelling was never true**: the
  registry name `nish` belongs to an unrelated package from 2014, so the
  installer this gate wants has no name to be installed under yet. Which name
  it takes is an open decision with its own section in
  [wp12-release.md](wp12-release.md#open-decision-the-npm-name-is-taken); the
  gate does not depend on the answer, only on there being one.
- `--version` has a source that is not `package.json`.
- `docs/INSTALL.md` and `wp12-release.md` §"Not in this work package" are
  rewritten in the same commit.

**Why it blocks.** Retiring stage0 without this does not remove Node from the
compiler; it removes the compiler.

**State: all four binaries, the package unchanged, and no registry name to
install it under.** The release workflow builds `nish-<version>-<asset>` for
`x86_64`/`aarch64` × `linux`/`darwin` — each stage2, `--verify`d, and
smoke-tested from an unrelated directory before it ships, because each is the
seed its own platform's rolling-freeze check bootstraps from. Each is built on
a runner of its own architecture rather than cross-compiled, which is forced
rather than chosen: `bootstrap.sh` runs stage1 to build stage2 and a stage1 for
another architecture does not run on the builder, and `scripts/build.sh` has no
`--target` passthrough for the same reason. The upshot worth keeping is that
"built" and "smoke-tested" mean the same thing on every row: there is no tier
produced for a machine nobody ran it on. The release job `needs` the whole
matrix, so a broken target stops the release instead of shipping three of four.

Nothing in that workflow names a platform. The matrix, the asset list and
`ci.yml`'s `seeds` job all read `.github/seed-targets.json`, which carries each
platform's canonical triple, the asset name derived from it, the runner label
that provides it, and the version from which a release attaches it;
`tests/run.js` checks every one of those against the compiler's own target
table, against a denylist of runner labels GitHub has retired, and against
`release.yml`'s own text.

What this closes beyond its own bullet is the darwin half of
[G3](#g3--the-seed-protocol-exists-and-ci-uses-it), and it takes **two** things
to close rather than one. The seed is this bullet. The other is the ld64 fixed
point: `--verify` asserted `stage3 == stage2` as raw bytes, which does not hold
on Mach-O because ld64 writes a debug map naming each `.o` by path and mtime,
so a macOS `bootstrap` row would have been red on the day its seed arrived.
That comparison now lives in `scripts/verify-binaries.sh` and **narrows** on
Darwin rather than lifting — same size, and identical once the debug
information is stripped, both asserted — because an arm that accepted any
difference would accept a stage3 that is a different compiler, which is the one
thing the comparison is for. `ci.yml`'s `bootstrap` job grows its macOS row
from `seed-targets.json` with no edit to the workflow, on the first release at
or after that platform's `attachedSince`.

The qualification that matters for reading this row: what is done is the
*workflow*, and a release already published cannot grow an asset. v0.2.0, the
current release, attaches `x86_64-linux` alone; the other three carry
`attachedSince: 0.3.0` and first exist on that release, and until then G3's
macOS row and [INSTALL.md](INSTALL.md)'s table both say so rather than
promising a 404. That is the same distinction §A5 and §A7 are about — a claim
about the tree read as a claim about the world — so it is written down here
rather than left to be noticed.

`attachedSince` is a version rather than a boolean for that same reason, and
the boolean it replaced is a small §A5 of its own: `attached: true` says *the
workflow builds this*, `seeds` reads it as *that release carried this*, and the
two part company in exactly this commit. Flipping the flag while teaching
`release.yml` to build the asset turns `seeds` red against v0.2.0, and
`release.yml`'s `release` job is `needs: ci` — so the release that would carry
the asset could not be cut, and the flag could not be cleared until it was.
A version dates the claim, and `.github/seed-due.sh` is the one place two of
them are compared.

**What is still open is the second bullet, and it is open on a decision rather
than on work.** The package is still the Node tarball rather than a thin
installer, and it is published nowhere — the release's `.tgz` is the only way
to install it — so `nish` today is Node-free only if you take the binary. The
installer needs a registry name and `nish` is somebody else's since 2014; the
options and what each costs are in
[wp12-release.md](wp12-release.md#open-decision-the-npm-name-is-taken) and the
choice is not one this package makes. `--version` already has a source that is
not `package.json` — `VERSION` in `self/branding.ts`, which `tests/run.js` pins
against `package.json` — so that bullet is met by the binary the moment it is
the product. This gate closes when the installer lands, and the installer
waits on the name.

### G6 — The provenance is recorded before it is lost

The last commit at which both `IR(stage0, self/) == IR(stage1, self/)` and the
fixed point hold is **tagged** (`ddc-<version>`), and the procedure for
re-verifying the property from that tag — check out, `npm ci`, `npm run build`,
`node tests/self/bootstrap.js` — is written down in this file. Zero maintenance
cost: it is a tag and a paragraph. It is the difference between "we gave up
diverse double-compiling" and "we can no longer say anything about it".

**The procedure.** From a clone of the repository, on a machine with Node
22.18 or newer (`package.json#engines` at the tag) and an LLVM 18 `clang` on
`PATH`, because each stage is linked:

1. `git checkout ddc-<version>` — a detached checkout of the tag. The tree
   there still contains `src/`, the TypeScript implementation that R6 deleted
   from the branch, which is why this runs at the tag and nowhere else.
2. `npm ci` — the devDependencies as the lockfile at the tag pins them,
   including the `typescript` package stage0 parses with.
3. `npm run build` — `tsc` into `dist/`. That is stage0.
4. `node tests/self/bootstrap.js` — builds stage1 with stage0, stage2 with
   stage1 and stage3 with stage2, and compares every module byte for byte.
   `--verbose` names each module as it is compared.

The script exits 0 and prints one line — `<N> modules, <N> bytes of IR:
IR(stage0)==IR(stage1)==IR(stage2), stage3 == stage2 (<N> bytes)` — or prints
`FAIL <reason>` naming the first module and line that differ, and exits 1.

**A pass** re-establishes diverse double-compiling at that commit: two
independently written implementations of Nish emit identical IR for every
module of `self/`, and the compiler built from that IR reaches its fixed point.
The property is demonstrated again rather than taken on trust from the tag,
which is the only reason the tag is worth having.

**A failure does not mean the tag is wrong.** It means the demonstration is no
longer reproducible and the claim that rests on it is lost. Read the
environment first — the Node version, the LLVM version, what `npm ci` actually
resolved — because the tree at the tag is fixed and everything around it is
not. If the tree builds cleanly and the IR still differs, nothing on the branch
can repair it: the property comes from a second implementation and
re-establishing it means writing one again (§2D). What can be said afterwards
is that we can no longer say anything about diverse double-compiling, which is
a worse position than having given it up deliberately.

**Why it blocks.** It costs nothing and it is unrecoverable afterwards.

---

## 4. The language features the gates need

Every one of these lands in **stage0 first**, with a golden `.ll`, an `llvm-as`
pass, a native round trip, at least one negative, a `docs/LANGUAGE.md` rule and
a cookbook entry — rule 1 of `wp14-selfhost.md` §6, which applies to the
retirement exactly as it applied to the port. The seed has to be able to
compile the compiler that replaces it, so the last thing stage0 ever does is
grow the features that make it unnecessary.

All four have landed: three as WP14 §7a work rather than with WP18, and
`getenv` as this package's own. They are kept here so the gate reads complete:

| Builtin | Signature | Gate | Where |
| --- | --- | --- | --- |
| host platform | `process.platform: string`, `process.arch: string` | G1 (`--target host`) | **Landed (WP14 §7a).** Read-only members, like `process.argv`. `self/target.ts` composes the triple exactly as `src/codegen/target.ts` does. 8 bytes of `.text`, measured in §7a |
| directory test | `isDirectorySync(path: string): boolean` | G1 (`-o <dir>`) | **Landed (WP14 §7a).** A value, not an exit, for the reason `mkdirSync` answers a boolean and `readFileSyncOrNull` answers `null`: there are no exceptions, so the driver phrases its own diagnostic. It is a `stat`, so a plain file answers `false` |
| environment | `getenv(name: string): string \| null` | G5 (`CC`) | **Landed (WP19 R1).** A call and not `process.env.X`, because member access on a dynamic key is exactly what Phase 0 forbids. Nullable, narrowed like any other `T \| null`, and `null` is not `""`: an unset variable and one set to nothing are different answers and a driver acts on the difference. The `NISH_DEBUG` half of this row is struck: §2A's exit-70 work closed it by the other design, and `self/ice.ts` names the variable to say there is no stack behind it here rather than reading it (`tests/cases/io_getenv`) |
| internal error | none: `process.exit(internalError(msg))` | G1 (exit 70) | **Landed (WP14 §7a), by the other design.** This row proposed a second terminator builtin rather than 40 rewrites, to spare the definite-return analysis. What shipped is the rewrite: `panic(m)` already means "this message, then exit 1" and `process.exit(n)` already means "this code, now", so the status a compiler wants for its own bugs needs no new construct, and a second panic would put one compiler's reporting policy — the version line, the issue tracker, the word "internal" — inside the language that compiles it. The report is `self/ice.ts`; the cost was 35 statements, and they are `self/`'s own |

`--emit-ast` needed no builtin — it needed `self/dump_ast.ts` promoted from an
oracle entry point to a CLI flag, with its own goldens. That was the one item
in §2A that was a deliverable rather than a lowering, and it landed as
`self/ast_text.ts`: the printer moved out of the oracle entry point so that
`compile.ts` and `dump_ast.ts` share it, the entry point kept its output byte
for byte (the parser oracle compares against it), and the flag adds the module
path on the root line the way stage0's `SourceFile <path>` header does.

**Deliberately not on this list**: `readdirSync`, a monotonic clock, and
recursive directory removal. They are what a *harness* needs, not what a
compiler needs, and §1 says the harness stays on Node. Adding them to close a
gate nobody has opened is how a runtime budget dies.

---

## 5. Order

| | Milestone | Done when |
| --- | --- | --- |
| **R1** | Parity | **done.** §4's builtins landed in both compilers, the seven rows of §2A closed, §A2's five closed (four fixed, the fifth re-read as §A3's recovery class), and §A3's five classes are closed or declared: `--parity` is green over the whole corpus with an empty difference set (§A4) — though that claim was recorded once while it was not true, and §A5 is the correction and what it cost |
| **R2** | The seed protocol | **mostly done.** `NISH_BOOTSTRAP` is in `scripts/bootstrap.sh`, `ci.yml`'s `bootstrap` job builds `self/` with the last release, and the policy sentence is in `wp12-release.md`. The seeded run asserts what a seed can prove — stage1 builds and links, the fixed point, the identical binaries — and *reports* `IR(seed) == IR(stage1)` instead of asserting it, because with a released seed that is a codegen freeze between releases rather than diverse double-compiling (G3, "What the seeded run proves"). A seed the job cannot find no longer passes with a warning, and no longer fails either: the lookup is its own `seeds` job, `bootstrap` is a matrix over the seeds a release actually attaches, and only a seed that *should* exist and does not is red — which is §A5's lesson applied without deadlocking the release train that supplies the first seed. That lookup is a script `npm test` runs against a stand-in for `gh` in each of its states, and the four asset spellings are one file both workflows read rather than two comments calling each other a contract. The Linux seed has arrived: v0.2.0 is released with `nish-0.2.0-x86_64-linux.tar.gz` attached, the line v0.1.1 started, because v0.1.0 was tagged and never built (G3, G4). Outstanding is the **second operating system**, and on a *measurement* rather than an estimate for the first time: the `test` row on macOS fails five checks in four families, all of them encoding an ELF assumption, and one of those four — `stage3 == stage2` at identical size, from Mach-O's debug map — is the comparison `--verify` makes, so it stands between this gate and a macOS `bootstrap` row as well as between G5 and a darwin release binary. That row needed two things and not one, and **both have now landed**: the darwin seed, which `release.yml` builds and attaches from 0.3.0 (G5), and that fixed point, which `scripts/verify-binaries.sh` narrows rather than lifting — same size, and identical with ld64's debug map stripped, asserted rather than reported ([wp10-ci.md](wp10-ci.md#ci-matrix)). So the macOS `bootstrap` row appears by itself on the first release that carries its seed, and the other three families of the `test` row are what still keeps `macos-latest` out of the test matrix |
| **R3** | Oracle succession | **mostly done.** `tests/nish-cmp.js` agrees with `ir_oracle.js` over the corpus and has been watched failing; `fuzz.js --stage1` is repointed; the four dying oracles' coverage is recovered as `tests/self/goldens/` with the numbers in §2B. The wording half is closed too: the gap was 176 codes rather than the 196 this document used to say — the tool that measures it is `tests/diagnostic_coverage.js`, and the number is now 0, with 338 codes provoked by `tests/wordings/` and the surviving negatives and 61 unreachable with a reason on file (§2B). The four survivors are repointed too: they build their stage1 binary with the seed through `tests/self/seed.js` and name no compiler of their own, and all four were watched green with `dist/` moved out of the tree. Both carried lists are shrinking rather than sitting. The wordings stage1's parser refuses before Phase 0 can state them are **41, from 45**: the member-header family — `x?: T`, `x!: T`, `m?()` and `static` — closed together, because stage1's parser records the marker or the modifier as a flag and the checker states the rule, which is the phase that knows whether the member is a field or a method and which class it is in. The family is every member a header can sit on, the constructor included: ``static constructor()`` is ``Constructor of class `C`: `static` members are not supported`` on both sides (`tests/cases/reject_cls_ctor_static`), and it is in the register because a modifier the *parser* stops refusing has to reach a member the *checker* asks about, or the program is simply accepted — which `static constructor()` was, and ran, as the instance constructor, between the two halves of this change. **What the move costs is the limit worth stating rather than discovering: a rule the checker owns is a rule the member has to parse to reach.** Eight shapes do not reach it — `m?()` with no return type, `x? = 5` with no annotation, `static x;`, `static` alone, `static x: i32 = 0` with no `;` before the `}`, `static m(): i32;`, `static m() { }` and `static { }` — and each is a stage1 syntax error about the *other* defect where stage0 names the member and its rule. Those sentences moved out of stage1's reach rather than into it, which is §A3's declared class seen from the inside, counted by `reject_oracle.js` and declared by `--parity` (`tests/cases/reject_cls_method_optional_untyped`, `reject_cls_field_optional_untyped`, `reject_cls_static_field_untyped`, `reject_cls_static_block`, and `self/parser.ts`'s `parseMemberModifiers` for the rest). Putting a copy of the rule back in the parser would restore an uncoded sentence in the phase that cannot name the member, which is the duplication the change removes; the shapes are named here and there instead. **One caveat on that declaration**: the two lists are shrink-only under `--strict-refusals`, but the reject oracle's parser bucket is a count in a summary line and nothing compares it to a ceiling, so the next rule that leaves the parser's reach migrates a case into the bucket silently. Read the bucket's number across such a change. The modifiers themselves now agree in full: `readonly` on a method or a constructor is ``unsupported modifier `readonly` `` from both compilers rather than accepted by stage1 (`reject_cls_method_readonly`, `reject_cls_ctor_readonly`, `reject_cls_method_readonly_optional`), and because stage0 reports the first modifier in *source* order the parser records which of `static` and `readonly` came first, so `static readonly m()` and `readonly static m()` get different sentences and each gets the same one from both (`reject_cls_method_static_readonly`, `reject_cls_method_readonly_static`). An *interface* field takes the same modifiers, for the reason the checker takes one function for both: `readonly x: i32` compiles on both where stage1's parser used to refuse it, and `static x: i32` is ``Field `x` of interface `I`: `static` members are not supported`` on both. What is still one-sided and older than this work is `class C { constructor: i32 = 0; }`, which stage1 compiles and the `typescript` package calls a syntax error — the direction `stage1_divergence.txt` calls serious, recorded in `parseMember` because no corpus program has the shape and nothing measures it. The remaining 41 go with stage0 at R6 unless the same trick reaches them. The programs the two compilers answer differently are **2, from 13** — one of which stage1 compiles — and what is left is not more of the same: one is WP18's (`<T, T>`) and belongs to that package rather than to this one, and the other is `;` as a statement, where agreeing would mean stage1 printing the `typescript` package's `EmptyStatement` — someone else's node names inside the self-hosted compiler, which is the trade `.claude/selfhost.md` turns down for `--emit-ast` and turns down here for the same reason |
| **R4** | Distribution | **the binaries are done; the installer is not.** One native compiler per supported target is built and smoke-tested by `release.yml` — each on a runner of its own architecture, so nothing is cross-compiled and "built" and "smoke-tested" mean the same thing on every row — and `INSTALL.md` and `wp12-release.md` are rewritten around them; `--version` already has a source that is not `package.json`. Which targets a given release carries is `attachedSince` in `.github/seed-targets.json`, compared against that release's version by `.github/seed-due.sh`: `x86_64-linux` from 0.1.1, the other three from 0.3.0, because v0.2.0 was published before this landed and a release already published cannot grow an asset. That also hands G3's macOS row a seed, on the first release at or after 0.3.0. Outstanding, and outstanding on a **decision with a human in it** rather than on work: the package becoming an installer, which first needs a registry name, since `nish` is taken ([wp12-release.md](wp12-release.md#open-decision-the-npm-name-is-taken)) (G5) |
| **R5** | Provenance | the re-verification procedure is written (G6); the `ddc-<version>` tag is cut at release time |
| **R6** | The deletion | `src/`, the `typescript` runtime dependency, the six dead oracles, and every rule that names stage0 |

R1 through R5 are all reversible. R6 is not, which is why it is last and why it
is one commit that does nothing else.

---

## 6. What retirement costs, stated plainly

1. **Diverse double-compiling ends.** Nobody in §1's table has it and we would
   be giving up something real: after R6 a wrong lowering that the compiler
   itself depends on can survive a release, because the only thing checking the
   compiler is a compiler built from the same source. G6 archives the last
   point at which that was not true; it does not extend it.
2. **The diagnostics lose their oracle.** 308 whole programs of `--emit-checked`
   and every diagnostic wording are presently proved by agreement between two
   implementations. Afterwards they are proved by goldens someone wrote, which
   is what every other compiler in §1 does and is strictly weaker.
3. **The bug-finding direction reverses.** Six stage0 bugs came out of S3 and
   S4 — all of them wrong *attributes* rather than wrong instructions, the
   class a golden `.ll` is worst at catching. That mechanism stops.
4. **One implementation is one bus factor**, and the language becomes whatever
   `self/` does, with no second reading to appeal to.

Against that: every construct is written once instead of twice, `self/` gets a
one-release lag instead of a permanent freeze, the compiler stops depending on
Node and on someone else's parser, and the install stops being 134 files of
JavaScript. WP14 §6 already priced the first half of that trade — "the
doubling is bounded by the language as it stands on that day" — and `Result<T,
E>` and WP17 both showed the doubling being paid in full anyway, because a
construct stage0 cannot compile has no goldens and no released implementation.

## 7. When not to do this

While the language is still moving, the second implementation is buying real
bugs and the doubling is the price of finding them. The gates above are what
makes retirement *possible*; they are not an argument that it is *due*. The
honest trigger is the one Rust and Go both hit: the day the seed's only
remaining job is to be a seed — when a release cycle passes in which stage0
found nothing, changed nothing, and shipped nothing except itself.

Until then, `IR(stage0, self/) == IR(stage1, self/)` is the most valuable line
in the test suite, and it is worth what it costs.

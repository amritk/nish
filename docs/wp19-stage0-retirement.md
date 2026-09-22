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
   language.** The cross product runs every corpus program under each of the
   flag variations `VARIATIONS` names — fourteen when this was written, sixteen
   now — and it cannot ask a question no program in the corpus poses.
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

**And this section settled only half of the split it was about, which §A8 then
paid for.** Two columns were decided here and only one of them was ever written
anywhere normative: bytes for a `DILocation`, because a debugger reads a DWARF
column back against the file's bytes and `clang` settles it; **code units for a
diagnostic**, because an editor is the consumer there. The paragraph above
states the second half in one clause and nothing else in the repository
repeated it — no rule in `docs/LANGUAGE.md`, no case, no golden. What carried it
instead was a caveat in the header of `self/diagnostics.ts`, which then
**retired it on the strength of the ASCII goldens** — the identical move
`self/debug.ts` had made two paragraphs up, about the identical subject, and
this document had already recorded as wrong.

That is **three instances of one pathology in this document's own history**:
`self/debug.ts` on the debug column, `self/std_modules.ts` on the module header
(§A7), and `self/diagnostics.ts` on the diagnostic column. Each wrote the true
divergence down, each dismissed it against the corpus to hand, and each was
right about that corpus and wrong about the language. The shape is stable enough
to state as a rule: **a caveat in a comment is a claim nobody re-derives, and a
caveat that retires itself against the test directory retires against a sample,
not against the language.** The remedy each time was the same and is cheap — a
case that asks the question (`dbg_utf8`, `std_bare_specifier`, and now
`reject_diag_utf8`) — which is why the next comment of this shape should arrive
with its case or not be believed.

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

#### A7. Red again, on a corpus a third larger — and then a fourth time, during this pull request

```
parity: 12225 runs over 815 programs; 37 undeclared difference(s), 2588 declared    2026-09-13, this branch, before the fix
parity: 12225 runs over 815 programs;  0 undeclared difference(s), 2588 declared    2026-09-13, this branch, after it
parity: 13020 runs over 868 programs; 18 undeclared difference(s), 2646 declared    2026-09-14, the same branch merged with main at 50410a5
```

Read those three lines in order, because the third one is the section.

**Line 1 to line 2: the fix, and the declared count is how you know it was a
fix.** 2588 both times. The 37 went away because the lowering changed, not
because a difference was written down as expected — a fix and a declaration
look identical in the "undeclared" column and are opposites everywhere else.
36 of the 37 were `; ModuleID`, the 37th a `!DIFile` under `-g`.

**Line 2 to line 3: the same thing happened again, to this document, while this
change was in review.** The 815-program measurement was a day old when the
branch was made mergeable, and in that day `main` grew by **53 programs** —
WP18's generic classes and WP21's package fixtures. Re-derived on the tree that
would actually land, the gate is **red: 18 undeclared differences**, and not one
of them is this change's. Narrowed with `--only`, over the same 135 runs on each
side:

| `node tests/self/parity.js --only std_` | undeclared |
| --- | ---: |
| `origin/main` at `50410a5` | **37** |
| this branch merged into it | **0** |

and the 18 that remain are on `main` with no part of this branch in the tree,
measured the same way:

| what | rows | where it came from |
| --- | ---: | --- |
| `tests/cases/ffi_pointer.ts` and `docs/cookbook/decl_ffi_pointer.ts` under `-g`: stage1 **exits 70** and writes no IR where stage0 compiles | 4 | WP27's `CPtr`, `50410a5`, landed the same morning |
| `tests/cases/reject_generic_expanding_field`: stage1 asks for a contextual `T \| null` annotation at 13:22 where stage0 says ``Unknown field `inner` on class `Nest$i32` `` at 13:12 — two different complaints about one line, not a wording | 14 | WP18's generic classes, `9000434` |

An internal compiler error is the worst row this table can hold — it is not a
wording or a span, it is stage1 refusing to compile a program stage0 compiles —
and it reached `main` green, because `npm test` does not run this mode and the
nightly that would have run it is the workflow *this* pull request adds.

**That is four times, and the corpus is the reason all four.** 764 programs at
§A6, 815 when this branch went red, 868 a day later. The lesson is no longer
"re-run the mode before quoting the number"; it is that **the number has a
shelf life of about a day on this repository**, and a row of this document that
states one without a date is stating a guess. R1's row in §5 is worded to make
that impossible to write.

Two more corrections to the first draft of this section, both of them the same
mistake it is about:

- **Two different numbers for one measurement.** The 2588 above and a "2,625"
  that reached `.claude/selfhost.md` in the same commit. Neither was
  re-derived. The re-derivation says 2646 on a corpus that has since grown, so
  both were wrong by the time anybody read them and neither was wrong in an
  interesting way.
- **A wall clock quoted as if it measured the change.** `3937.1 s` before the
  fix and `2051.6 s` after, side by side, reads as though naming a module
  differently halved the compile time. It cannot: both sides run the same
  12,225 runs. It was load on a shared four-core machine — the run in line 3
  took 4184.8 s on the same box with three other agents on it — so the seconds
  measure the neighbours. They are gone from the lines above.

The cause of the 37 is §A3's first class — **a path inside the IR** — recorded
as closed and reopened on the one specifier kind the fix never covered:

```
stage1  ; ModuleID = 'std/testing.ts'
stage0  ; ModuleID = '/home/user/nish/std/testing.ts'
```

`importedName` names an imported module by "the specifier resolved against the
name the importer was given", which is right for `./text` and is answering a
question nobody asked for `nish/text`: a `nish/` specifier does not resolve
against the importer at all, it resolves against the package the compiler
shipped in. Under a **relative** entry `path.relative` climbed out of the
importer's directory and back down to the same string, so the two compilers
agreed; under an **absolute** entry the join put the whole checkout path in the
header. stage0 was the wrong side, for the third time in this family and for
the reason §A3 gave the first time: the rule that survives is the one that needs
no working directory, because that is also the one that makes a build
reproducible. `stdModuleName` in `src/std-modules.ts` answers `std/<name>.ts`
and nothing else now, and `stdModulePath` is that same string under the package
root — one construction rather than the two in two files that let the name and
the identity drift apart in the first place.

**The comment that asserted the bug was already in the tree.**
`self/std_modules.ts` says, of its own normalisation, "the header would read
`./build/../std/text.ts` where *stage0 writes `std/text.ts`*". That sentence was
true of every call in this repository and false of the one the parity harness
makes, which is §A5's `self/debug.ts` caveat exactly — *a claim about the corpus
quietly read as a claim about the language* — in a second file, about a second
subject, written down and then trusted.

**What stops the next one is a check, not a paragraph.** `tests/run.js`
compiles `std_bare_specifier` **by absolute path** and pins the header, beside
the `link/diamond` check that does the same for a relative specifier — the
`dbg_arrow` move of §A5, applied to this family. It fails on the commit before
this one and costs one compile, so the question is asked on every `npm test`
rather than on the nights somebody reads the nightly. Both checks make the
fixture's *existence* part of the assertion rather than a guard around it:
written as `if (fs.existsSync(entry))` they would have vanished the day somebody
renamed the directory, with no failure and no SKIP — this section's subject
wearing the costume of a passing suite.

##### What the fix changes that no gate sees

All three of these move stage0 onto stage1's existing answer, so each is
parity-positive and none of them is what the parity harness measures — it always
passes `-o <dir>/`. They are written down here because "a naming change" sounds
like it has no consequences and it has three.

- **Where the output files land, when there is no `-o`.** The module's name is
  what `planOutputs` writes it under, so `nish main.ts` on a program importing
  `nish/testing` now writes `std/testing.ll` under the *user's* working
  directory. Before, it wrote into the compiler's own installation
  (`<prefix>/std/testing.ll`), which is `EACCES` under a root-owned global
  install and silently modifies the compiler's own tree otherwise. Both are
  arguably wrong and the new one is stage1's, which is what this change is for.
- **Two different modules can now carry one `; ModuleID`.** A program importing
  both `./std/text` and `nish/text`, compiled with a relative entry, names both
  `std/text.ts`; before, the `nish/` one was told apart by its absolute path.
  Under `-o <dir>/` both files are **not** still written, and the draft of this
  bullet that said they were is corrected here (measured 2026-09-21).
  `outputStems` disambiguates *from* the absolute path rather than from the
  name, which is not the same as being disambiguated *by* it: it drops every
  `.` and `..` segment of the entry-relative path before joining, so a module
  above the entry's directory collapses onto one below it with the same tail
  and stage0 writes one `.ll` for the two. Under `-g` a debugger sees one
  `DIFile` for two files, `clashMessage` would name both modules identically in
  a symbol-clash diagnostic, and with **no** `-o` at all the name *is* the
  output path, so the second module's IR overwrites the first's. The sentence
  that used to close this bullet — that stage1 keys its output stems on the
  name and therefore writes *one* file where stage0 writes two — was wrong in
  both of its halves: a stage1 module's name *was* its identity, so stage1
  could not hold two modules under one name at all, and under a relative entry
  the direction is the other one, stage0 writing one file where stage1 writes
  two. [§5a](#5a-what-r6-is-waiting-on) item 5 has the invocations, the
  measurements and what is actually broken.

  **The first half stopped being true on 2026-09-21**, which is the third
  bullet below: stage1 carries a module's name apart from its identity now, so
  it can print one `; ModuleID` for two modules exactly as stage0 can. `byPath`
  is still keyed on the identity, so they are still two modules and still two
  files; what they share is the name.
- **stage1 was still sensitive to how the *compiler* was invoked — closed on
  2026-09-21.** stage0's answer had not depended on anything outside the
  package since this branch; stage1's `packageRoot()` is
  `<dirname(argv[0])>/..`, and a package module was *named* by the path the
  compiler found it at, so `./build/nish` answered `std/text.ts` and
  `/abs/path/build/nish` answered `/abs/path/std/text.ts` for one program:

  ```
  ./build/nish  prog.ts -o out/     ; ModuleID = 'std/text.ts'                  before
  /abs/build/nish prog.ts -o out/   ; ModuleID = '/abs/.../std/text.ts'         before
  either spelling                   ; ModuleID = 'std/text.ts'                  after
  ```

  The harness happened to invoke the spelling that agreed, which was the
  *whole* reason this family read as closed. What closes it is the distinction
  the rest of this section is about, made in stage1 too: a module's **identity**
  is still the path it was opened at — a file has to be opened — and its
  **name** is its package-relative specifier, `std/text.ts`, which is what
  stage0 has written since this branch. `ModuleUnit.name` in
  `self/compilation.ts` carries it, `SourceFile` is constructed with it, so the
  `; ModuleID`, the `source_filename`, the `DIFile`, the diagnostics, the
  interop sidecars' `/* <module>: */` lines and the no-`-o` output path all read
  it. `tests/run.js` drives a staged install by an absolute `argv[0]`, by a
  relative one and by a bare name on `$PATH` and asserts the three agree —
  watched failing with the fix reverted, because the harness's own spelling is
  what hid this for four releases.

  **A bare-specifier package is already under the rule, and was measured rather
  than assumed** (`tests/link/package_bare`, both compilers, three spellings of
  `argv[0]`): its module names are `node_modules/pkg_bare/src/index.ts` and
  friends in every one of them, because `findPackageDir` walks up from the
  *importing module's own name* and never asks `packageRoot()`. Such a module's
  name tracks the entry's spelling exactly as a relative import's does, which is
  a fact about the program being compiled rather than about the compiler, and it
  is `nish/`'s resolution against the compiler's own install that made the
  standard library the exception. So the two kinds of package are named by one
  rule again, and only one of them needed moving.

  Two consequences it carries, both measured on 2026-09-21 and both moving
  stage1 onto stage0's answer:

  - **With no `-o`, stage1 wrote the module into the compiler's installation.**
    `nish p.ts` on a program importing `nish/text` wrote
    `<install>/std/text.ll` — `EACCES` under a root-owned install, and a
    silent edit of the compiler's own tree otherwise. It writes `std/text.ll`
    under the user's working directory now, which is the first bullet above,
    for both compilers rather than for one.
  - **stage1 can now hold two modules under one name**, exactly as stage0 can,
    which is the second bullet above. The sentence in §5a item 5 that a
    duplicate name is a duplicate identity in stage1 was true of the tree that
    measured it and is not true of this one: `byPath` is keyed on the identity,
    which is still the path, so the two modules still load as two — and they
    can now print one `; ModuleID`. What has *not* changed is `outputStems`,
    which still stems from the path on both sides, so neither the file counts
    in §5a item 5's table nor the install-dependence of a package module's
    stem moves with this. That is the fix carried separately there.

#### A8. The fifth way this gate lied: a surface `VARIATIONS` had never named

```
parity: 14416 runs over 901 programs;  180 undeclared difference(s), 2708 declared    2026-09-19, before #117
parity: 14432 runs over 902 programs;    0 undeclared difference(s), 2798 declared    2026-09-19, after it
parity: 14432 runs over 902 programs;    0 undeclared difference(s), 2798 declared    2026-09-19, re-run on merged `main` at 862c7cc
```

The third line is the second re-derived on the tree that actually landed, and
it is there because §A7 is a section about exactly the gap between those two
trees. It is also where the 90 new declarations went: 89 of them are the sixth
declaration this gate has, `--json stdout` — the parser refusal read off the
machine-readable shape instead of off stderr, sharing `parserRefusedFirst` with
the stderr declaration so the two cannot drift into meaning different things.
That is one surface declared, narrowly, and **89 × 2 = 178 is where the rows
below come from**: one stdout row and one exit row per refused program.

§A5 lists two ways a closed gate reopens in silence, §A6 adds a third — an
oracle comparing against a binary nobody rebuilt — and §A7 a fourth, the corpus
growing between the branch a number was measured on and the tree it merged to.
**This is a fifth, and it is the one the previous four could not have found:
the cross product is only as wide as `VARIATIONS`, and `--json` was not in
it.** The compiler's one
machine-readable contract — the surface `AGENTS.md` tabulates, `docs/wp10-ci.md`
bands and `tests/nish/cli.ts` checks — had never been compared between the two
compilers on any program. 180 undeclared differences were waiting there, on a
corpus that was otherwise green.

**178 of the 180 were one defect, and it is the kind this gate exists for.**
`Compilation.load` wrote the parser's refusals to stderr whatever the command
line said, so stage1 answered a syntax error with an **empty stdout** where
stage0 printed a diagnostic object. A program with a syntax error compiled
`--json` by stage1 produced nothing a machine could read — not a different
object, no object — and every consumer of that contract would have seen an
empty report rather than an error. The other two were spans narrowed to the thing
their message names — `__proto__` in stage1, `debugger` in **stage0** — which
is the ordinary direction of this family by now: the frozen compiler is the
wrong side about as often as the new one.

**No miscompile.** Every `.ll` is byte-identical under every variation, before
and after. The defect was entirely in what the two compilers *said*, which is
exactly the class §A2 opened this document with and exactly the class a golden
`.ll` cannot hold.

**The fourth class had zero rows, and it is the one worth reading.** A
diagnostic column counted **bytes** in stage1 where stage0 counts **UTF-16 code
units** — in the default mode, under no flag, on the surface a tool parses. It
reported zero rows because no program in 902 put a non-ASCII character in front
of a caret. That is §A5's first lesson for the third time in this document:
*an empty difference set is a fact about the corpus*. `tests/cases/reject_diag_utf8`
now makes the corpus ask the question, so the next run measures it rather than
missing it.

**What closed it is the variation, and the variation is the deliverable.**
`{ name: "--json", args: ["--json"], family: "--json" }` is one line of
`VARIATIONS`. It is the sixteenth — WP20's `--threads` was the fifteenth (§A5's
costing) — and it costs one run per corpus program, about 900, to ask a
question that had 180 rows waiting behind it. The lesson
generalises past this surface and is the one to carry into R6: **a flag the
cross product does not name is a flag nothing compares**, and the sixteen
variations are a list somebody wrote, not a property of the compilers. Read
that list before believing a green number covers a surface.

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
| `tests/differential/` default mode | the same program rewritten to JS and run under Node (WP13) | **survives only because it was frozen, and this row was wrong.** It needs no second *compiler*, but the JavaScript it compares against is typed by stage0's `Compilation`, which `rewrite.js` drives in process — so `src/` takes the reference generator with it. `tests/differential/goldens/rewrites.txt` holds the rewrite of all 176 programs and reproduces the live verdicts exactly (§6 item 6); what dies with the rewriter is the fuzz differential against Node and the arrow-parity guard |
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

Six oracles and **both** fuzzer modes die, and the row above them is the one
that had to be re-read: a *semantic* oracle needs no second compiler and still
needs stage0 to produce the JavaScript it compares against. `--stage1` is the
mode this table named; the default mode, which compares a generated program
with Node, goes for the same reason the row above it nearly did — the reference
is `rewrite.js`, and a program invented from a seed has no frozen one to fall
back on (§6 item 6). The replacement for the six is Go's `toolstash -cmp`:
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
| `rewrite.js`, the WP13 reference | 176 whole programs rewritten to JavaScript and run against Node: stdout, exit status and terminating signal, byte for byte | `tests/differential/goldens/rewrites.txt`, 358 modules stored by content | 235 KB |

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

| | When the gap was measured | 2026-09-19, stage0 | 2026-09-21, stage1 |
| --- | --- | --- | --- |
| registry codes | 351 | 410 | 410 |
| provoked by something that outlives stage0 | 175 | **344** | **264** |
| provoked by nothing | 176 | 0 | 0 |
| unreachable, each with a reason on file | — | 66 | 66 |
| stage0 only, each with its programs on file | — | — | 80 |

**The third column is the one this gate is actually about, and it did not exist
until 2026-09-21.** The criterion says "provoked by something that outlives
stage0", and the two columns to its left were both measured with stage0, which
does not. Asked of stage1 —
`node tests/diagnostic_coverage.js --compiler build/nish --require-coverage` —
the criterion answered with **80 findings**, each reading `is provoked by
nothing: add a case to tests/wordings/, or a reason to unreachable.txt`. That
advice was wrong eighty times over. Nothing had been overlooked: every one of
the 80 is a code whose programs stage1 answers in its *parser*, and all 126
of those programs — every program that provokes one of the 80 under stage0,
not merely the first in corpus order — was already recorded, with the sentence
stage1 answers instead, in `tests/self/parser_refusals.txt` (85 entries),
`tests/wordings/parser_refusals.txt` (39) or `stage1_divergence.txt` (2). The
registers are per **case** and the criterion is per **code**, and no file made
the step from one to the other — so the tool could only print `(no reason on
file)` for a reason that was on file, and the gate could only be asked of the
compiler it is going to delete.

`tests/wordings/stage0_only.txt` is that step and nothing else: one
`CODE  case[,case...]` line per code, naming programs rather than repeating
sentences, so it cannot drift from the registers without failing. It is checked
from both sides while both compilers exist — against stage0 the named set must
be **exactly** the set the run found, so a corpus that grows a case cannot
leave a line stale; against stage1 under `--strict-refusals` a code the run
provokes fails until its line is deleted. `npm test` now passes
`--require-coverage` on the stage1 run as well as the stage0 one, which is what
makes the gate's own sentence true of the compiler R6 leaves behind. The file
empties into `unreachable.txt` at R6, where these wordings become retired codes
because nothing prints them any more.

What moved it is `tests/wordings/`, 126 cases: one small program per code,
named for the code it pins (`nl2200_empty_import_list.ts`), with the whole
message in its `.err`. A reword fails it twice — the message no longer matches, and the
generator gives the new words a new number, so the code no longer matches
either — and the tool refuses to go green while any registry code is neither
provoked, nor named in `tests/wordings/unreachable.txt`, nor named in
`tests/wordings/stage0_only.txt`. That last rule is the part that keeps the gap
closed: a diagnostic added next year arrives with a case, with a sentence
saying why it cannot have one, or with the programs that provoke it under the
compiler that states the rule.

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
`node tests/diagnostic_coverage.js --compiler <stage1> --strict-refusals`
prints at the end of its run**, and both have moved since this section was
written — 58 of 124 then, 43 of 126 on **2026-09-19**, measured on this tree —
so re-derive them rather than quoting this paragraph:

```
wordings: 83/126 cases pin their code (41 refused by the parser, 2 answered differently), coverage 264/410 codes, 66 unreachable, uncoded=5 (compiler build/self/compile)
```


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
- One smaller thing, recorded here rather than in a list — **and it turned out
  to be the largest finding this gate has produced, which is why it is left
  standing rather than quietly corrected**: stage0 prints a syntax error as a
  `--json` object on stdout and stage1 prints it only on stderr, and `--json`
  was not one of `--parity`'s variations. The spans differ on `NL2200` as well
  (stage0 points at the `{}`, stage1 at the whole statement). Both are closed
  by §A8, at the cost of 180 undeclared differences nobody had counted: a
  sentence in a bullet list is not a check, and the interval between writing
  this one down and measuring it is the whole of what §A8 is about.

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
— the sixteen of `VARIATIONS`, each of them a flag some `.args` sidecar or
`tests/run.js` already passes, and each of them a line somebody added (§A8 is
what the sixteenth was worth) — and compares *everything the command line
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

**And running it is not the same as somebody hearing the answer.** A nightly
whose only record is a run summary has moved the silence rather than closed
it: §A5's gate was reopened for weeks with a number written down that nobody
re-derived, and a red Tuesday nobody opens Actions on is the same failure with
a schedule attached. So a full run that is not green now opens the issue
*WP19 G1: the parity gate is not green* — or comments on the open one, so a
run of red nights is one thread — and a green full run closes it. An
`only`-filtered `workflow_dispatch` is barred from touching it, because a
green subset read as a green corpus is §A5's mistake in the shape a workflow
input makes it easy to repeat. The two states that open it are an undeclared
difference and a run that never reached the mode: the second is not the lesser
one, because the record may not read green on a day nothing was measured.

**It opened on the first night, as expected, and it has since closed.** The
workflow's first issue was the backlog rather than a regression — eighteen
differences belonging to WP18 and WP27, one of them an internal compiler error,
red on `main` precisely because no nightly existed to say so (§A7). #93 was
opened for the red run of 2026-09-18 and closed by a green full run. **State, 2026-09-22**, from
`node tests/run.js --parity` on merged `main` at `3927242`:

```
parity: 14544 runs over 909 programs (2663.3 s); 0 undeclared difference(s), 2808 declared
```

exit 0. The seconds are a shared four-core box and measure the neighbours as
much as the compilers (§A7); the counts are the gate. The declared set is the
five of §A4 plus §A8's sixth — `89 × --json stdout`, the parser refusal read
off the machine-readable shape rather than off stderr, sharing
`parserRefusedFirst` with the stderr declaration so the two cannot come to mean
different things.

**And the gate's most recent lesson is about the check rather than the
compilers.** §A8: the cross product is only as wide as `VARIATIONS`, and
`--json` was not in it, so 180 undeclared differences sat on an otherwise-green
corpus with nothing to find them. A green number therefore answers a narrower
question than it looks: *the corpus, under the variations somebody listed*.
Both halves of that are a lower bound — which is why #94 still reproduces on a
tree this gate calls green, and why the variation list belongs in the reading of
any number this section reports.

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
5. The WP13 differential oracle's *reference* is recovered the same way, and
   for a reason this gate did not originally see: §2B had it surviving, and it
   does not, because `rewrite.js` types its JavaScript with stage0's own
   `Compilation`. **Done.** `tests/differential/goldens/rewrites.txt` is the
   rewrite of all 176 programs, frozen while stage0 exists; the frozen run
   reproduces the live one's 176 verdicts exactly, and what could not be frozen
   is priced in §6 item 6 rather than discovered later.

**The check.** The numbers, in this document, on the day: how many programs
each dying oracle covered, and what covers them afterwards. For the wordings
the check is a command rather than a paragraph —
`node tests/diagnostic_coverage.js --report` — and it is wired into `npm test`
over both compilers, so the gate cannot be met once and then drift: a registry
code that no program provokes fails the run until somebody writes the case or
writes the reason.

**State: items 4 and 5 are met, and here are the runs that say so.** Measured
on this tree on **2026-09-19**, `node tests/diagnostic_coverage.js --report`:

```
wordings: 126/126 cases pin their code, coverage 344/410 codes, 66 unreachable, uncoded=4 (compiler dist/index.js)
```

and the same tool over stage1, which is the half that outlives stage0
(`--compiler build/self/compile --strict-refusals`):

```
wordings: 83/126 cases pin their code (41 refused by the parser, 2 answered differently), coverage 264/410 codes, 66 unreachable, uncoded=5 (compiler build/self/compile)
```

Item 5's run is `node tests/differential/run.js`, twice on 2026-09-22 with
nothing between the two but where the JavaScript came from:

```
164/176 programs agree with Node (51.4 s, 4 jobs); 0 unexpected failure(s).   # live rewrite
164/176 programs agree with Node (50.1 s, 4 jobs); 0 unexpected failure(s).   # frozen rewrite
```

and the 176 rows above each summary are the same verdicts in the same order,
compared line by line rather than by their totals. With `src/` and `dist/`
moved aside the harness resolves both halves itself — the seed for the native
side, the store for the Node side — and answers `162/176`, the difference being
two programs stage1's checker refuses rather than anything about the freeze
(§6 item 6).

**Those numbers moved once already, and the way they moved is the gate working.**
They were 163/175 when this section was written; #138 landed a corpus program
with an entry point, the store had no record for it, and the verify failed —
`175/176 programs fresh, the store differs from the live rewrite` — rather than
comparing the 175 it had and reporting a green 175. One `npm run test:update`
later the store covers 176 and the run agrees with Node on 164 of them.

The four goldens are in `tests/self/goldens/` with their numbers in §2B. **344
of the 410 registry codes are provoked by a program that outlives stage0** and
the other 66 are unreachable with a reason on file; nothing is provoked by
nothing. What is left behind on purpose is the pair of carried lists, and both
are in the stage1 line above rather than in anybody's memory: **41 wordings**
that are stage0's because stage1's parser refuses the syntax first, and **2
programs** the two compilers do not answer the same way, one of which stage1
compiles. Both lists are meant to shrink and both have — the wordings from 45,
when the *member header* family closed (see R3 below), and the divergences from
13 to 3 to 2.

**The registry moves, so these numbers date.** 351 codes when the gap was
measured, 399 when this paragraph was first written, 408 at R3's re-measurement,
410 today; the covered count moved 175 → 338 → 344 alongside it, and 61
unreachable became 66. Every one of them is a number the tool prints. Run it.

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
failed there with five failures in four families, three of them still open,
all of them checks that encode
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

1. the **seed**, which is [G5](#g5--distribution-does-not-need-node). This one
   has **landed as a workflow**: `release.yml` builds one binary per supported
   target. It has not landed as a released *asset* for darwin, because
   `attachedSince` for that pair is `0.4.0` — see item 2, which is why; and
2. the **ld64 fixed point** — the `stage3 == stage2` family above. **This has
   been run on a mac, root-caused, and merged** — `acbca9f` (#114). The failure
   was the *harness's* and not the toolchain's. `bootstrap.sh`
   linked the two comparable stages **at two different output paths**, which
   guaranteed different `LC_UUID`s for two compilers that agreed on every other
   byte — so the comparison had been failing on a difference the harness itself
   introduced. Both stages link at one path now and `stage3 == stage2` holds on
   Darwin as a raw `cmp`, with **nothing relaxed and nothing masked**: the
   narrowing `verify-binaries.sh` had grown is not what makes it pass.

   **What is measured, stated exactly**: the UUID is stable across two links to
   one output path and differs on a link to another. That rules out a hash of
   the output's own content, which is the explanation that would have made the
   comparison unfixable. It does **not** establish that the path is the cause —
   the probe never returned to the first path, so path-identity and
   invocation-order are confounded, and the output path is the leading
   explanation rather than a finding. The remedy holds either way, because it
   was measured end to end rather than inferred: the full `--verify` passes.
   `-Wl,-no_uuid` is closed off with evidence rather than left as a candidate —
   it links, and then arm64 dyld refuses the image.

   Anywhere this document previously called the Mach-O difference *unmeasured*,
   or attributed it to ld64's debug map, is stale as of `acbca9f`. The script's
   own header now carries the mechanism and the confound, so the two cannot
   drift apart the way §A7's `self/std_modules.ts` comment did.

Neither is a line in `ci.yml`, and the second is not claimed here. The matrix
is the release's answer rather than a list in the workflow, so the macOS row
appears on the day a release *carries* a darwin seed — which is the day the
second of those two has to be true, and the reason the darwin `attachedSince`
is held past the next release rather than set to it.

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

**State: done, and this row's evidence is a file rather than a run** — read as
of **2026-09-19** on `7ff7ce1`. The sentence is at
[`wp12-release.md`](wp12-release.md#the-bootstrap-seed), under *The bootstrap
seed*: "`nish` 0.N is built by the last patch release of 0.(N−1)." There is no
command behind that and **inventing one would be worse than having none** —
this gate asks whether a decision was written down before it was needed, which
is a documentary fact, not a measurement. So the honest form of "the command"
here is what would falsify it: that heading disappearing from
`wp12-release.md`, or a release being cut against a seed the sentence does not
name. Neither has happened. The rest of §3's rows carry a command because they
assert something about the tree's *behaviour*; this one does not, and saying so
is more useful than a dated run of something unrelated.

### G5 — Distribution does not need Node

- The release workflow builds `nish` for `x86_64`/`aarch64` × `linux`/`darwin`
  from the seed release and attaches the four binaries to the GitHub release.
- Installing the package keeps working: it becomes a thin installer that
  fetches the binary for the host, or ships it. Whichever, the check in
  `tests/run.js`'s WP12 block — pack, install into a temporary prefix, link a
  hello-world from an unrelated directory — must still pass. **This bullet
  used to read `npm install -g nish` and that spelling was never true**: the
  registry name `nish` belongs to an unrelated package from 2014, so the
  installer this gate wants had no name to be installed under. **Decided
  2026-09-19: the package is `@amritk/nish` and the command stays `nish`**
  ([wp12-release.md](wp12-release.md#the-npm-name)). The gate never depended on
  which answer, only on there being one. **The installer landed on 2026-09-20**
  and it is the "fetches the binary" half of this bullet rather than the "ships
  it" half: `bin.nish` is a launcher, the binary arrives as one
  `@amritk/nish-<asset>` `optionalDependencies` entry per platform with `os`
  and `cpu` set, and npm installs the matching one. The WP12 check still
  passes, and it now covers both paths — with a platform package the round trip
  packs, installs and links a hello-world through a real staged compiler, and
  with none the launcher refuses by name and exits 3. **Amended 2026-09-22**:
  that second path used to be a fallback to `dist/`, and a fallback that is the
  compiler this package deletes is not one, so `files` stops shipping `dist/`
  and the refusal is what a platform with no binary gets (§6, cost 5).
  **Nothing is compiled on a user's machine on any path**, which was never
  written into this bullet and is the property the gate is actually about.
- `--version` has a source that is not `package.json`.
- `docs/INSTALL.md` and `wp12-release.md` §"Not in this work package" are
  rewritten in the same commit.

**Why it blocks.** Retiring stage0 without this does not remove Node from the
compiler; it removes the compiler.

**State, read on the tree as of 2026-09-20: the workflow builds all four and
packages each as an npm package beside its tarball, the package is an installer,
and nothing has been published.** The three things this gate asked for are
written and tested; what stands between it and closed is a person running
`npm publish`, which is [wp12-release.md](wp12-release.md#release-procedure)
step 4 and is not work. The previous reading, on 2026-09-19 (`7ff7ce1`), was
that the workflow built all four, one of them shipped, and the package was
unchanged with no registry name to install it under. The checks behind this row are
`node tests/run.js seed` — the WP19 block that drives `.github/seed-matrix.sh`
and `.github/seed-due.sh` against a stand-in for `gh` in each of their states —
and `node tests/run.js wp12`, the pack-and-install round trip. Both were run on
this tree on 2026-09-19 and are green — **38 and 57 checks, 0 failed** — and
both run inside `npm test`. What no command in this repository can answer is
the last bullet, because it is a decision and not a state: see §5a. The release workflow builds `nish-<version>-<asset>` for
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

What this **starts** to close beyond its own bullet is the darwin half of
[G3](#g3--the-seed-protocol-exists-and-ci-uses-it), and that takes **two**
things rather than one. The seed is this bullet, and it has landed. The other
is the ld64 fixed point, and it has not.

`--verify` asserted `stage3 == stage2` as raw bytes, which does not hold on
Mach-O: measured at identical size with every IR equality green (WP19 R2). The
comparison now lives in `scripts/verify-binaries.sh` and **narrows** on Darwin
rather than lifting — the size asserted, debug information stripped where a
tool can strip it, and anything left over failed as *unattributed* — because an
arm that accepted any difference would accept a stage3 that is a different
compiler, which is the one thing the comparison is for.

**Somebody has now run it on a mac, and the answer is better than the
narrowing** — merged as `acbca9f` (#114). The differing bytes were
`LC_UUID`, as the candidate said, but the reason they differed was the
harness: `bootstrap.sh` linked the two comparable stages at **two different
output paths**. Link both at one path and `stage3 == stage2` holds on Darwin as
a raw `cmp`, nothing relaxed and nothing masked. The earlier attribution to
ld64's debug map was wrong for the reason this section already gave — a
`--profile speed` link puts no DWARF in the `.o` files and strips with
`-Wl,-x` — and the narrowing in `verify-binaries.sh` turns out not to be what
carries the comparison.

Be exact about what that measures. The UUID is stable across two links to one
path and differs on a link to another, which rules out a hash of the output's
own content; it does not separate **path-identity** from **invocation-order**,
because the probe never returned to the first path. The output path is the
leading explanation, not a finding. The remedy is sound regardless: run 4
measured the full `--verify` passing end to end. `-Wl,-no_uuid` is ruled out
with evidence rather than left open — it links, and arm64 dyld then refuses the
image.

**All three unexercised seed rows were run on their own hardware and all three
passed**, so `attachedSince: 0.4.0` is a proved claim rather than an assumed
one, and the three rows can be attached rather than held (#92). What is left is
not work but a **release**: `attachedSince` stands where it is and G3's macOS
`bootstrap` row does not appear until a release actually carries those assets,
because a release already published cannot grow one. That is the distinction
this row has been about since it was written, and it is now the only thing
between this gate and its macOS row.

`ci.yml`'s `bootstrap` job grows its macOS row from `seed-targets.json` with no
edit to the workflow, on the first release that *carries* that platform's seed
— presence, not `attachedSince`, which is also why a platform's rows want
exercising once before its version arrives (that file's note, under BEFORE
ADDING A PLATFORM).

The qualification that matters for reading this row: what is done is the
*workflow*, and a release already published cannot grow an asset. v0.2.0, the
current release, attaches `x86_64-linux` alone; `aarch64-linux` carries
`attachedSince: 0.3.0` and the darwin pair `0.4.0`, for the reason above, and
until each arrives G3's rows and [INSTALL.md](INSTALL.md)'s table both say so
rather than promising a 404. That is the same distinction §A5 and §A7 are about — a claim
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
installer needed a registry name, and has one as of **2026-09-19**:
`@amritk/nish`, with the command still `nish`
([wp12-release.md](wp12-release.md#the-npm-name)). What is left is the
installer, which is work rather than a decision. `--version` already has a source that is
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

**State: the tag is cut by the release workflow rather than by somebody
remembering — merged as `21a9381` (#116).** A tag that
depends on a human recalling it at release time is G3's warning-above-a-green-
check in a second costume: the one release nobody remembers is the one that
loses the property, permanently and unrecoverably (§2D). So `.github/ddc-tag.sh`
decides whether the tag is due and what it is called, `release` needs the `ddc`
job, the tag is cut **after the proof and before `gh release create`** — the
only order in which a tag cannot outrun the thing it certifies — and every arm
of that script is driven against a git stand-in by **19 checks** in the WP19
block of `tests/run.js`, which is the same move G3's `seed-matrix.sh` made for
the same reason: both times this logic was got wrong, it was inline shell in a
workflow that nothing could run. That count is one
`node tests/run.js ddc-tag | grep -c "ddc tag:"` prints — **19, on 2026-09-19,
on the merged tree at `7ff7ce1`**. The filter is the wider thing and the grep is
the count: the bare command answers **31**, because `ddc-tag` also selects the
`verify-binaries:` checks and a handful of others. Name the command that
produces the number, not the one nearby — and it is derived here rather than
copied
because the number in #116's own description had already drifted to 18 by the
time it merged — the smallest possible instance of §A7's lesson, in the
document that records it.

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
| **R1** | Parity | **green as of 2026-09-22, and a row that does not carry a date is not a measurement.** In the mode's own words: `parity: 14544 runs over 909 programs (2663.3 s); 0 undeclared difference(s), 2808 declared`, exit 0, from `node tests/run.js --parity` on **merged `main` at `3927242`** — re-derived on the head R6 would land on rather than quoted from the 2026-09-19 run at `862c7cc`, whose `14432` / `902` / `2798` the new counts exceed by exactly the seven entry programs that arrived between them, sixteen variations each. #117's own figure was taken on `ae6b45b` with that branch on top and lands on the same counts; re-running it after the merge is what makes this row a statement about the tree anybody has rather than about somebody's branch, which is the distinction §A7 was written about. `862c7cc` also carries a green `npm test` ([CI run 553](https://github.com/amritk/nish/actions/runs/35454091607)), covering G1's flag-set half; the corpus half is not in `npm test` by design. **Read the next two sentences before quoting the first.** Five times now a number in this row has turned out to be false, or to mean less than it looked (§A5, §A6, §A7, §A8), and the reason has never twice been the same: the corpus grew (764 → 815 → 868 → 884 → 888 → 902 → 909 programs), a fix was compared against a cached binary, a caveat was retired against the test directory — and, most recently, **the cross product did not name the surface**. §A8 is that fifth way, and it is the one the first four could not have found: `--json`, the compiler's one machine-readable contract, was not in `VARIATIONS` and had never been compared on any program. It was worth **180 undeclared differences on an otherwise-green corpus**, 178 of them one defect — stage1 answering a syntax error with an empty stdout where stage0 printed the object — plus two narrowed spans, one on each side. No miscompile: every `.ll` was byte-identical under every variation, before and after. A fourth class reported **zero rows** and is the one to carry forward, because zero was a fact about the corpus rather than about the compilers: a diagnostic column counted bytes in stage1 where stage0 counts UTF-16 code units, in the default mode under no flag, invisible because no corpus program put a non-ASCII character in front of a caret (`tests/cases/reject_diag_utf8` now asks). What remains true from the earlier record: §4's builtins landed in both compilers, the seven rows of §2A closed, §A2's five closed (four fixed, the fifth re-read as §A3's recovery class), §A3's five classes closed or declared, and §A7's two — the `CPtr` internal compiler error under `-g` and the cascading second diagnostic — closed by #90 and #91. The nightly `Parity` workflow opened #93 for the red run of 2026-09-18 and closed it on a green full run; `ci.yml`'s `parity-select` / `parity-changed` pair runs the corpus half over the programs each pull request touches, so the next time this row goes red it is red on the pull request that did it. **The standing qualification, which no green number retires**: the difference set is a lower bound over the corpus and the variation list, and both are things somebody wrote — #94 still reproduces on this tree and G1 cannot see it, because no corpus program has the shape |
| **R2** | The seed protocol | **mostly done.** `NISH_BOOTSTRAP` is in `scripts/bootstrap.sh`, `ci.yml`'s `bootstrap` job builds `self/` with the last release, and the policy sentence is in `wp12-release.md`. The seeded run asserts what a seed can prove — stage1 builds and links, the fixed point, the identical binaries — and *reports* `IR(seed) == IR(stage1)` instead of asserting it, because with a released seed that is a codegen freeze between releases rather than diverse double-compiling (G3, "What the seeded run proves"). A seed the job cannot find no longer passes with a warning, and no longer fails either: the lookup is its own `seeds` job, `bootstrap` is a matrix over the seeds a release actually attaches, and only a seed that *should* exist and does not is red — which is §A5's lesson applied without deadlocking the release train that supplies the first seed. That lookup is a script `npm test` runs against a stand-in for `gh` in each of its states, and the four asset spellings are one file both workflows read rather than two comments calling each other a contract. The Linux seed has arrived: v0.2.0 is released with `nish-0.2.0-x86_64-linux.tar.gz` attached, the line v0.1.1 started, because v0.1.0 was tagged and never built (G3, G4). Outstanding is the **second operating system**, and on a *measurement* rather than an estimate for the first time: the `test` row on macOS failed five checks in four families, all of them encoding an ELF assumption, and one of those four — `stage3 == stage2` at identical size, attributed at the time to Mach-O's debug map — is the comparison `--verify` makes, so it stands between this gate and a macOS `bootstrap` row as well as between G5 and a darwin release binary. That row needs two things and not one. The darwin **seed** has landed: `release.yml` builds one per target (G5). **The fixed point has now been measured on a mac and holds outright**, merged as `acbca9f` (#114). The failure was the harness's rather than the toolchain's: `bootstrap.sh` linked the two comparable stages at two different output paths, guaranteeing different `LC_UUID`s for compilers that agreed on every other byte. Both link at one path now and `stage3 == stage2` holds on Darwin as a raw `cmp`, with nothing relaxed and nothing masked — the narrowing in `scripts/verify-binaries.sh` is not what carries it. Stated exactly, because the distinction is the finding: the UUID is stable across two links to one path and differs on a link to another, which rules out a hash of the output's own content but does **not** separate path-identity from invocation-order, since the probe never returned to the first path. The output path is the leading explanation rather than a finding; the remedy holds either way, because run 4 measured the full `--verify` end to end. `-Wl,-no_uuid` is closed off with evidence — it links, then arm64 dyld refuses the image. All three unexercised seed rows were run on their own hardware and all three passed, so `attachedSince: 0.4.0` is proved rather than assumed and #92 can attach all three. What is left is a release that carries the assets, not work: until one does, the macOS `bootstrap` row does not appear, and the other failures in the `test` row keep `macos-latest` out of the test matrix regardless. Anywhere this document calls the Mach-O difference unmeasured, or attributes it to ld64's debug map, is stale as of `acbca9f`. **Checked on this tree on 2026-09-19 (`7ff7ce1`): `node tests/run.js seed` 38 passed, `node tests/run.js bootstrap` 12 passed, 0 failed either, both inside `npm test`** — which the acceptance run measured on this same merged tree at `2073 passed, 0 failed, 2 skipped`, no `DEGRADED:` banner, the two skips the environmental ones (no WASI sysroot, `NISH_BOOTSTRAP` unset). The darwin half of this row is the exception and has no command on this tree by construction: it needs a mac, and its measurement is #114's, on its own hardware |
| **R3** | Oracle succession | **mostly done.** `tests/nish-cmp.js` agrees with `ir_oracle.js` over the corpus and has been watched failing; `fuzz.js --stage1` is repointed; the four dying oracles' coverage is recovered as `tests/self/goldens/` with the numbers in §2B. The wording half is closed too: the gap was 176 codes rather than the 196 this document used to say — the tool that measures it is `tests/diagnostic_coverage.js`, and the number is 0. **That sentence was true and proved by nothing between WP22 stage C and 2026-09-18**, which is the same defect as R1's in a smaller frame: the tool reads the registry out of `self/codes.ts` with a pattern that was keyed on four literal spaces, stage C rewrote those tables as arrows with concise bodies and they lost an indentation level, and the tool therefore parsed **0 of 408** codes — `--require-coverage` iterated an empty map, the per-case registry-fragment cross-check found no fragment for any case, and the run printed `coverage 0/0 codes` and exited 0. An empty registry reads exactly like a covered one. Re-measured on 2026-09-18 with the parser reading any indentation and an empty registry made a failure rather than a pass: **344 of 408 codes provoked, 64 unreachable with a reason on file**. **Re-derived on 2026-09-19 on the merged tree at `7ff7ce1`, `node tests/diagnostic_coverage.js --report` answers `wordings: 126/126 cases pin their code, coverage 344/410 codes, 66 unreachable, uncoded=4`** — the registry grew by two and both went to the unreachable list. **That is a weaker thing than the defects this document collects, and the difference is the whole discipline**: the 2026-09-18 figure carried its date and was never false, it was *overtaken* — an accurate record of one day sitting in a table a reader takes for the tree's current state. §A5's pathology is a claim that was wrong; this is a claim that stopped being current. The remedy is the same and cheaper: re-derive rather than re-read, which is why both numbers here name the command. Nothing was provoked by nothing on either date, and the gate is demonstrably able to fail again — dropping one line of `tests/wordings/unreachable.txt` reports ``NL2001 is provoked by nothing`` and exits 1 (§2B). The four survivors are repointed too: they build their stage1 binary with the seed through `tests/self/seed.js` and name no compiler of their own, and all four were watched green with `dist/` moved out of the tree. Both carried lists are shrinking rather than sitting. The wordings stage1's parser refuses before Phase 0 can state them are **41, from 45**: the member-header family — `x?: T`, `x!: T`, `m?()` and `static` — closed together, because stage1's parser records the marker or the modifier as a flag and the checker states the rule, which is the phase that knows whether the member is a field or a method and which class it is in. The family is every member a header can sit on, the constructor included: ``static constructor()`` is ``Constructor of class `C`: `static` members are not supported`` on both sides (`tests/cases/reject_cls_ctor_static`), and it is in the register because a modifier the *parser* stops refusing has to reach a member the *checker* asks about, or the program is simply accepted — which `static constructor()` was, and ran, as the instance constructor, between the two halves of this change. **What the move costs is the limit worth stating rather than discovering: a rule the checker owns is a rule the member has to parse to reach.** Eight shapes do not reach it — `m?()` with no return type, `x? = 5` with no annotation, `static x;`, `static` alone, `static x: i32 = 0` with no `;` before the `}`, `static m(): i32;`, `static m() { }` and `static { }` — and each is a stage1 syntax error about the *other* defect where stage0 names the member and its rule. Those sentences moved out of stage1's reach rather than into it, which is §A3's declared class seen from the inside, counted by `reject_oracle.js` and declared by `--parity` (`tests/cases/reject_cls_method_optional_untyped`, `reject_cls_field_optional_untyped`, `reject_cls_static_field_untyped`, `reject_cls_static_block`, and `self/parser.ts`'s `parseMemberModifiers` for the rest). Putting a copy of the rule back in the parser would restore an uncoded sentence in the phase that cannot name the member, which is the duplication the change removes; the shapes are named here and there instead. **That caveat is closed, and the closure is the shape to copy.** It used to read: the two lists are shrink-only under `--strict-refusals`, but the reject oracle's parser bucket is a count in a summary line with no ceiling beside it, so the next rule that leaves the parser's reach migrates a case into the bucket silently — read the bucket's number before and after. Reading a number is a discipline, and this document's whole subject is that a discipline nothing checks is a comment. So the bucket has a ceiling now: [`tests/self/parser_refusals.txt`](../tests/self/parser_refusals.txt) names each case **and the sentence stage1 answers with**, 89 entries as of 2026-09-19, and `reject_oracle.js` compares the register against the run **in both directions** — a case in the bucket that the file does not name fails, and a case the file names that no longer lands in the bucket fails too. A rule leaving the parser's reach is now an edit to that file rather than a tally nobody re-read, and a rule *returning* to it cannot pass silently either. The comparison is itself exercised: a `selfCheck` inside the oracle drives the register logic over fabricated inputs on every run and its `<n>/<n>` count prints in the summary line, so the ceiling is not a check that has never been watched failing (#115). The modifiers themselves now agree in full: `readonly` on a method or a constructor is ``unsupported modifier `readonly` `` from both compilers rather than accepted by stage1 (`reject_cls_method_readonly`, `reject_cls_ctor_readonly`, `reject_cls_method_readonly_optional`), and because stage0 reports the first modifier in *source* order the parser records which of `static` and `readonly` came first, so `static readonly m()` and `readonly static m()` get different sentences and each gets the same one from both (`reject_cls_method_static_readonly`, `reject_cls_method_readonly_static`). An *interface* field takes the same modifiers, for the reason the checker takes one function for both: `readonly x: i32` compiles on both where stage1's parser used to refuse it, and `static x: i32` is ``Field `x` of interface `I`: `static` members are not supported`` on both. What is still one-sided and older than this work is `class C { constructor: i32 = 0; }`, which stage1 compiles and the `typescript` package calls a syntax error — the direction `stage1_divergence.txt` calls serious, recorded in `parseMember` because no corpus program has the shape and nothing measures it. The remaining 41 go with stage0 at R6 unless the same trick reaches them. The programs the two compilers answer differently are **2, from 13** — one of which stage1 compiles — and what is left is not more of the same: one is WP18's (`<T, T>`) and belongs to that package rather than to this one, and the other is `;` as a statement, where agreeing would mean stage1 printing the `typescript` package's `EmptyStatement` — someone else's node names inside the self-hosted compiler, which is the trade `.claude/selfhost.md` turns down for `--emit-ast` and turns down here for the same reason |
| **R4** | Distribution | **the workflow is done, the installer is done, and nothing has been published.** One native compiler per supported target is built and smoke-tested by `release.yml` — each on a runner of its own architecture, so nothing is cross-compiled and "built" and "smoke-tested" mean the same thing on every row — and `INSTALL.md` and `wp12-release.md` are rewritten around them; `--version` already has a source that is not `package.json`. Which targets a given release carries is `attachedSince` in `.github/seed-targets.json`, compared against that release's version by `.github/seed-due.sh`: `x86_64-linux` from 0.1.1 and the other three from 0.4.0 — v0.2.0 was published before this landed and a release already published cannot grow an asset, and the three new rows had never run. **All three have now been run, on their own hardware, and all three passed**, merged as `acbca9f` (#114). That closes the reason each was waiting: `attachedSince: 0.4.0` was an assumption about rows nobody had exercised and is now a proved claim, and #92 can attach all three. The darwin pair's second blocker is closed with them, the fixed point holding as a raw `cmp` once `bootstrap.sh` stops linking the two comparable stages at different paths (R2 above). What is left is a release that carries the assets, since a release already published cannot grow one. So G3's macOS row gets its seed on the first release at or after 0.4.0, not the next one. The package becoming an installer was the last piece of work here and **landed on 2026-09-20**: `bin.nish` is a launcher, the native compiler arrives as one `@amritk/nish-<asset>` `optionalDependencies` entry per platform, and `release.yml` packages each from the directory it already stages for that platform's tarball (G5). The registry name it waited on was settled on 2026-09-19 ([wp12-release.md](wp12-release.md#the-npm-name)). So what is outstanding in this row is **a person publishing**, twice over and for the same reason each time — a release that carries the three new seed assets, and a `npm publish` of the N+1 packages — neither of which is work. **Checked on this tree on 2026-09-20: `node tests/run.js seed` (38 passed) and `node tests/run.js wp12` (64 passed), 0 failed either — the `seed-targets.json` rows against the compiler's own target table and against `release.yml`'s text, and the pack-and-install round trip.** What that cannot check is which assets a *published* release carries, which is the decision in §5a rather than a state of the tree |
| **R5** | Provenance | **done**, merged as `21a9381` (#116). §G6 has the four-command re-verification, unchanged. What was outstanding is that the tag was cut "at release time", meaning by whoever remembered: a provenance record whose only trigger is memory, for a property that cannot be re-established once lost (§2D). `release.yml` cuts it now — `.github/ddc-tag.sh` decides the tag, the `release` job `needs: ddc`, and it is cut after the jobs that prove the equalities and before `gh release create`, so the tag can never certify a commit the proof did not pass. 19 checks in the WP19 block of `tests/run.js` drive every arm of the script against a git stand-in rather than trusting shell nothing runs — **`node tests/run.js ddc-tag | grep -c "ddc tag:"`, 19 on 2026-09-19 on the merged tree at `7ff7ce1`**; the bare filter prints 31, because it selects the `verify-binaries:` checks too. A count derived rather than copied, #116's own description having said 18 by the time it merged. What is left is not work: the first release after this cuts the first `ddc-<version>` tag, and until one is cut the procedure in §G6 has no tag to check out |
| **R6** | The deletion | `src/`, the `typescript` runtime dependency, the six dead oracles, and every rule that names stage0 |

### 5a. What R6 is waiting on

R6 is one commit that deletes `src/`, the `typescript` runtime dependency, six
oracles and every rule that names stage0. The question this section answers is
the one the table above does not: **is that commit a decision somebody makes,
or a project somebody schedules?** Measured on this tree on **2026-09-19**, it
is neither yet — and what stands between is three different kinds of thing,
which is why they are separated here rather than listed as one backlog. A row
in the wrong bucket is how "we are nearly there" survives contact with a year.

#### Closed — measured, with the date and the command

| | What | The measurement |
| --- | --- | --- |
| **G1** | parity over the corpus, every flag variation | `parity: 14544 runs over 909 programs (2663.3 s); 0 undeclared difference(s), 2808 declared` — `node tests/run.js --parity`, exit 0, **2026-09-22**, on merged `main` at `3927242`, the head R6's deletion would land on. It replaces `14432 runs over 902 programs … 2798 declared` at `862c7cc`, and the deltas **decompose rather than needing to be trusted**: seven entry programs arrived between the two runs — `io_realpath`, `reject_realpath_arity`, `reject_realpath_type`, `builtin_realpath`, `reject_cls_field_init_type_twice`, `reject_std_escaping_module` and `module_stem_clash/main.ts`, the clash case's two imported `text.ts` being modules rather than programs — and seven programs across the sixteen variations is exactly the 112 new runs. The ten new declared rows are those programs meeting declaration classes that already existed: no `DECLARED` entry names any of them, which is the difference between a corpus that grew and a gate that was widened |
| **G2** | every registry code provoked by something that outlives stage0, or unreachable with a reason | `wordings: 83/126 cases pin their code (41 refused by the parser, 2 answered differently), coverage 264/410 codes, 66 unreachable, 80 stage0-only, uncoded=5` — `node tests/diagnostic_coverage.js --compiler build/nish --require-coverage --strict-refusals`, exit 0, 2026-09-21. **Measured with stage1 rather than with stage0, which is what the criterion says and what this row did not do until now**: the stage0 figure (`coverage 344/410 codes, 66 unreachable, uncoded=4`, same command with `--compiler dist/index.js`, also exit 0) measures the compiler R6 deletes. Asked of stage1 the criterion had 80 findings, none of them an oversight — each had a reason on file, per case, in a register nothing joined to the codes; §2B has the join and what it checks |
| **G2** | the four dying oracles' coverage recovered as goldens, built by the seed rather than by stage0 | `tests/self/goldens/`, numbers in §2B; watched green with `dist/` out of the tree |
| **G3/G6** | the three IR equalities and the fixed point | green inside `npm test` on merged `main` at `862c7cc`, 2026-09-19 — [CI run 553](https://github.com/amritk/nish/actions/runs/35454091607), conclusion `success`. `node tests/self/bootstrap.js` is the check; the suite runs it |
| **G2.1** | the successor itself, against a real seed | `nish-cmp: 437/437 programs agree (3582 files, 3253862 IR lines) … 4 equal after each compiler's own root, 0 undeclared difference(s)` — `NISH_BOOTSTRAP=<v0.5.0>/bin/nish node tests/nish-cmp.js`, exit 0, 2026-09-21. The first run of this gate against anything; §5a item 1 has what it took |
| **G4** | the seed policy sentence | written, in `wp12-release.md`; nothing further is owed |
| **G6** | the re-verification procedure, and the tag it checks out | procedure written in §G6 above, four commands, unchanged; the `ddc-<version>` tag is cut by `release.yml` rather than by somebody remembering, merged as `21a9381` (#116), with 19 checks driving every arm of `.github/ddc-tag.sh` against a git stand-in |

Those are the rows where the honest answer is *done*, and each carries the
command that says so rather than a recollection that it once did.

**The G1 row is a run on merged `main`, which is worth stating because it is
the thing this gate has most often not been.** #117's own figure was taken on
`ae6b45b` with that branch on top; the row above is the corpus half re-run
afterwards on `862c7cc`, the merged result, and it lands on the same counts —
14432 runs, 902 programs, 0 undeclared, 2798 declared — which is what a merge
that changed nothing about the comparison should look like, and is not
something a reader should have to assume. `862c7cc` also carries
[CI run 553](https://github.com/amritk/nish/actions/runs/35454091607), a green
full `npm test`, which covers G1's flag-set half, the bootstrap equalities and
the diagnostic-coverage tool over both compilers; the corpus half is not in
`npm test` and never will be (§"Should `--parity` run in CI?"), so the number
above and the nightly are the two things that produce it.

#### Work — open, doable, and nobody's decision required

None of these needs anybody's permission. They need somebody's afternoon.

1. ~~**`nish-cmp` green in CI as a required check**~~ (G2 item 1).
   **Done, 2026-09-20.** `ci.yml` has a `nish-cmp` job: it shares the `seeds`
   job with `bootstrap`, takes a row per Linux seed the last release carries,
   downloads that seed and runs `tests/nish-cmp.js` against it. Being a job in
   `ci.yml` is what makes it required — `release.yml` reaches this workflow
   through `workflow_call`, so a red row is a release that cannot be cut. The
   CHANGELOG rule needed no work: `DECLARED` in the tool already refuses a
   difference the release note does not name, in both directions.

   **It found a defect on its first real run, and the defect is in what was
   published rather than in the tree.** Against the v0.4.0 seed the corpus is
   `433/435 programs agree ... 2 undeclared difference(s)`, and the two are
   `tests/link/std_bare_specifier` and `tests/link/std_package_scope` — the
   only corpus programs that reach the standard library by its **package
   specifier** rather than by a relative path. The released compiler refuses
   them:

   ```
   error: Module `nish/text` is not part of the standard library (it has: json, testing, text)
   ```

   That sentence names the module it is refusing, because the list in it is
   the static table of module names and the **file** is what is absent:
   `release.yml`'s `binaries` job staged `bin`, `runtime` and `scripts` and
   never `std/`, so every release from 0.1.1 to 0.4.0 ships a compiler that
   cannot import its own standard library. Copying `std/` into the unpacked
   v0.4.0 tarball makes that same binary compile, link and run the program, so
   the omission is the whole cause. Fixed for the next release in both
   channels — the tarball stages it and `scripts/platform-package.mjs` lists
   it, the npm platform package being `npm pack` over the same directory — and
   nothing had been published to npm yet, so the fix lands before the first
   publish rather than after it.

   **Three things had to be true at once for four releases to carry it**, and
   each is worth naming because each is a guard that existed and did not
   cover this:

   - the staging copied `runtime` and not `std`;
   - the "the tarball carries a whole compiler" gate listed seven paths and
     none under `std/` — a presence check written for exactly this class,
     passing because the class was spelled as a list;
   - both smoke programs, `hello.ts` and `examples/multi`, import nothing, so
     a compiler with no standard library links them and reports success.

   And the fourth, which is the instructive one: the pack-and-install round
   trip in `tests/run.js` packs the **main** package, whose `files` has
   carried `std` all along, and a main package with no platform package beside
   it falls back to `dist/`. **The path the harness takes works and the path a
   user gets does not** — §A7's sentence about `argv[0]`, "the harness happens
   to invoke the spelling that agrees", holding for the product a second time
   and in a second place. `tests/run.js` now asserts all four: the staging
   line, a `std/` path in the presence gate, a smoke program that imports
   `nish/text` and *runs* it, and `std` in the platform package's `files`.
   Each was watched failing with its half of the fix reverted.

   **What it costs the gate is one release of waiting, recorded rather than
   allowlisted.** A seed that cannot compile the corpus cannot be compared
   against it, and no edit to the tree changes what v0.4.0 published — so
   `cmpSince` in `.github/seed-targets.json` says which releases `nish-cmp`
   may use, the way `attachedSince` says which carry a seed and for the
   identical reason. It is `0.5.0`, and until a release reaches it the job has
   no row. Declaring the two programs in `DECLARED` was the other way and is
   worse twice over: the difference is the seed's defect rather than a decided
   change of output, and the mechanism cannot be satisfied between releases
   anyway — it requires the words in `CHANGELOG.md`, which is generated at
   release time with `[Unreleased]` deliberately empty. An absent row says no
   comparison happened; a green row with those two allowlisted inside it would
   say one happened and passed, which is §A5 exactly.

   **The wait is over, and the gate's first green run is 2026-09-21:**
   `nish-cmp: 437/437 programs agree (3582 files, 3253862 IR lines) — reference
   <v0.5.0 seed>/bin/nish, candidate build/self/compile, 21 refused by both,
   3 dumps (no artefact), 4 equal after each compiler's own root, 0 undeclared
   difference(s)`, exit 0, with `NISH_BOOTSTRAP` pointing at the published
   `nish-0.5.0-x86_64-linux` tarball. This is the first time the successor has
   compared anything, which is the evidence R6 was told to wait for.

   **It took a fix, and the fix is to the comparison rather than to either
   compiler — which is the sentence to read carefully, because §A5 is about
   exactly this move.** Run as it stood, against a seed that *can* compile the
   corpus, the gate reported **4 undeclared differences over 2 programs**, all
   one cause: `tests/link/std_bare_specifier` and `tests/link/std_package_scope`
   reach the standard library as `nish/<name>`, which is resolved against the
   compiler's **own** package root and then named by the path it was found at, so
   the seed writes `; ModuleID = '<where the seed is unpacked>/std/text.ts'` (and
   the same in `source_filename` and in the `.h`'s `/* <path>: class Suite */`)
   where HEAD writes `std/text.ts`. It is §A7's third bullet — `packageRoot()`'s
   sensitivity to how the compiler was invoked — in the one harness that cannot
   arrange for the spellings to agree.

   Three things make this a statement about what the comparison *can mean*
   rather than an allowlist. It is not keyed on a program or a file: each side's
   own root is removed from every file, symmetrically, leaving the module's path
   relative to its own package, which is the identity being compared. It cannot
   be satisfied by a difference anywhere else on those lines — a path not under
   the compiler's own root is compared as it stands, and `selfCheckRoots` drives
   the normalisation over fabricated inputs on every run, including a sibling
   directory whose name merely begins with the root's. And the run **says** it:
   a `note:` line names both roots and the number of files, and the summary
   carries `4 equal after each compiler's own root`, so no reader has to know
   the flag to find what was set aside. Two compilers are never installed in one
   directory, so without this the gate could not be green for *any* tree,
   including an empty diff — which is the difference between this and the
   `DECLARED` entry the paragraph above turns down.

   What is **not** fixed by it is the underlying defect: a standard-library
   module's IR still carries wherever that compiler happens to be installed, so
   two users with `nish` under different prefixes get different `; ModuleID` and
   different `DIFile` paths for the same `std/` module. That is §A7's bullet and
   it is still open; the gate now measures everything except it.

   **The cycle this item asked for, tallied 2026-09-22.** The paragraph above
   says a cycle is more than one run and that the deletion should rest on the
   runs nobody arranged. Those runs now exist: **twelve `nish-cmp` rows on
   `main` since 2026-09-21**, two architectures across six `ci.yml` runs —
   `2695807` (#129), `da3eaec` (#131), `7d7fa9d` (#134), `f0cbd50` (#133),
   `2274097` (#135) and `3927242` (#136). **No red row, and every row that
   printed a summary reports `4 equal after each compiler's own root` and `0
   undeclared difference(s)`**: 437/437 programs over the first three heads and
   438/438 from #135 onward, the single rise being
   `tests/link/module_stem_clash`, because a `reject_` case is not a program
   this gate enumerates — `tests/self/corpus.js` leaves a rejection out, as
   "it belongs to `reject_oracle.js`". #136 moved the IR line count
   (3253922 → 3255945) and no program count, which is what a renaming that
   changes emitted text without adding a program should do.

   **The count not moving off 4 is the part to read.** `withoutOwnRoot` was
   allowed into the gate on the ground that it is keyed on no program and no
   file, so a fifth normalised file would be the gate forgiving more than was
   argued for it rather than the corpus growing — and a tally is how that gets
   noticed instead of assumed. #136 is the case in point: it changed how a
   package module is named, predicted the count would stay at 4 while the seed
   predates the fix, and CI agreed to the byte (`438/438 … 3589 files,
   3255945 IR lines, 4, 0`) on both architectures. Against five recorded
   instances of a prediction about this gate being wrong, that one was run.

   Two of the twelve rows are `cancelled` rather than green, and the cause is
   this workflow rather than the gate: `ci.yml`'s `concurrency` group carries
   `cancel-in-progress: true`, and run 614 (`f0cbd50`, #133) was created at
   22:37:52Z with run 616 (`2274097`, #135) fifty-one seconds behind it on the
   same ref, so the first was killed mid-comparison. Nothing is unproven by it
   — that head's own pull-request run is green with both rows, and it is a
   direct ancestor of run 616's head, which is green — but it is worth writing
   down that **a green-row tally on `main` has a hole wherever two merges land
   inside a minute**, so "every row since <date> was green" has to be read as a
   claim about the rows that ran.
2. ~~**The package becoming a thin installer**~~ (G5's last bullet, R4).
   **Done, 2026-09-20.** `bin.nish` is a launcher that hands over to the
   prebuilt native compiler for the host, which arrives as one
   `@amritk/nish-<asset>` package per platform declared as an
   `optionalDependencies` entry with `os` and `cpu`; `release.yml` packages
   each from the directory it already stages for that platform's release
   tarball, so the bytes a user downloads are the bytes it built and
   smoke-tested. The WP12 round trip stayed green and grew seven checks,
   covering the handover and the fallback.

   One of the two decisions behind it was amended by the work.
   [wp12-release.md](wp12-release.md#which-compiler-the-package-ships) had
   recorded the fallback for a platform with no binary as (a) — ship `self/`
   and bootstrap — and that turned out to cost a clang and two compilations of
   `self/` on the user's machine, plus 944,676 bytes in every tarball on every
   platform, to serve musl and FreeBSD. The fallback is `dist/` instead, the
   Node compiler already in the package. **Nothing is compiled on a user's
   machine on any path**, which is what this item was for and what its own
   wording never said.
3. **The macOS `test` row** (G3). **Three checks ported, six still red, the row
   still out — measured 2026-09-21** (#133). Each of the three encoded an
   ELF/Linux assumption in the *check* rather than a compiler bug, and each now
   asserts the same sentence on both object formats. Two read `.debug_line` out
   of a linked binary, which on Mach-O is empty by design: `clang -g` leaves the
   DWARF in the object files and the executable keeps only a debug map naming
   them, and the Darwin driver runs `dsymutil` at the end of a compile-and-link
   to build the `.dSYM` bundle that holds the table. `lineTableOf` in
   `tests/run.js` answers with the file the platform used, so both checks assert
   what they always asserted: the table names `dbg_main.ts` and has at least one
   row. **Reaching for `dsymutil` afterwards is deliberately not a fallback** —
   by then clang has deleted the objects the map names, so the tool warns once
   per object, writes a bundle whose `.debug_line` is empty, and exits 0, which
   would turn "there is no line table here" into "the line table has no rows".
   The third asserted that a `--threads` module refuses to link against a runtime
   built without `-DNISH_THREADS`; that is ELF's rule about a TLS reference to a
   non-TLS definition and ld64 does not have it. Measured: clang exits 0, `nm -m`
   shows `_nish_arena` as a plain `(__DATA,__common)` symbol where a thread-local
   descriptor should be, the first allocation calls the arena's own `buf` as if
   it were the descriptor's thunk, and the process takes SIGSEGV — while the
   matched build of the same two inputs prints `alloc_smoke delta = 16` and exits
   0, which is what makes the crash the mismatch's rather than the fixture's. So
   the property both platforms are held to is not the link error but that the
   mismatch is **never quietly a working-looking program with two arenas**, and
   the check's name says which mechanism caught it.

   **What keeps the row out is now six named checks with the run that measured
   them, rather than a count somebody remembered**: `2125 passed, 6 failed, 4
   skipped` with the row in the matrix
   ([run 606](https://github.com/amritk/nish/actions/runs/35652075129)). Three of
   the six repeat a cause just ported, in checks the 2026-09-13 run never reached
   — the prebuilt object cache and the stage1 `-g` check are both newer than that
   run, and each arrived carrying a mistake its own family had already made. The
   other three share a cause that is now **settled**: `LC_UUID`, which ld64
   varies with the *output path*, so `tests/self/bootstrap.js` and the two
   `runtime objects:` byte comparisons each link two copies of one input to two
   different paths and therefore fail at identical size. `scripts/bootstrap.sh`
   already links its comparable stages at one path; those three do not.
   `ci.yml`'s matrix comment and [wp10-ci.md](wp10-ci.md#ci-matrix) name all six
   with that run, and both drop the claim that nothing in this file runs on
   macOS: the darwin pair's `attachedSince` is 0.4.0, so both `bootstrap` darwin
   rows have been green for two releases — and they are where the `LC_UUID`
   finding came from, so the file had been disowning its own evidence.
4. **stage1's `packageRoot()` sensitivity to `argv[0]`** (§A7's third bullet).
   `./build/nish` and `/abs/path/build/nish` answer differently for one
   program, and the harness happens to invoke the spelling that agrees — which
   is the *whole* reason that family reads as closed. **No longer unmeasured:
   it surfaced in front of a user on 2026-09-20**, while the installer was
   being built. `packageRoot()` does not resolve a symlink, and npm links every
   command as one (`node_modules/.bin/nish -> ../@amritk/nish/bin/nish`), so a
   native compiler placed beside the main package and reached through `.bin`
   looks for `scripts/build.sh` in `node_modules/` and fails every `--link`,
   while `--version` and `-o` keep working. The installer execs the binary
   inside its own package instead, which sidesteps it with a real path and does
   not fix it ([wp12-release.md](wp12-release.md#what-the-launcher-costs) has
   the failure and the reasoning).

   **The worse half of it, found the same day: a bare `nish` on `$PATH` cannot
   link at all.** A command found on `$PATH` arrives with `argv[0]` as the bare
   word — `nish`, no directory — so `packageRoot()` answers `./..` and
   `--link` resolves `scripts/build.sh` against whatever the working directory
   happens to be:

   ```
   --link: cannot find scripts/build.sh (looked in ./.. and .)
   ```

   So unpacking a release tarball onto `$PATH`, which is what an installed
   native compiler *is*, does not work — and `--version` and `-o` keep working
   throughout, which is why nothing noticed. Nothing noticed because nothing
   invokes it that way: `release.yml`'s smoke step runs `"$unpack/.../bin/nish"`
   and [INSTALL.md](INSTALL.md) showed `nish-<version>-<asset>/bin/nish`, both
   path-shaped, both fine. That is §A7's sentence about this family — "the
   harness happens to invoke the spelling that agrees" — holding for the
   product as well as for the harness.

   Both installers work around it the same way, with a one-line `exec` of an
   absolute path (`scripts/postinstall.mjs`, `install.sh`'s
   `nish_write_wrapper`), and `tests/run.js` drives a bare `nish` on `PATH` and
   asserts the `argv[0]` that arrives.

   **The `$PATH` half is fixed, 2026-09-20.** `packageRoot()` splits on whether
   `argv[0]` is a path at all: one that carries a directory keeps the old
   `<dirname>/..`, and a bare word is looked up on `$PATH` — which is where the
   shell found it, so the first entry holding a file of that name is the one
   that ran, and its parent is the root. Nothing new was needed from the
   language: `getenv` and `splitByte` were already in the frozen surface, and
   the rolling freeze was checked against the v0.4.0 seed before and after
   (`IR(stage1) == IR(stage2)`, `stage3 == stage2` byte-identical).

   The diagnostic is derived from the same candidate list rather than
   re-spelling it, so it names where the compiler actually looked:

   ```
   --link: cannot find scripts/build.sh (looked in /somewhere/lonely/.. and .)
   ```

   Three checks pin it, and they are the first in the suite to drive a *real*
   compiler by a bare name — everything else invokes one by a path, which is
   precisely why nothing noticed for four releases. An install is staged the
   way `release.yml` builds one, driven from a third directory, and the program
   imports `nish/text`, so a wrongly-resolved root fails even if
   `scripts/build.sh` were found some other way. All three were watched
   failing with the fix reverted.

   **The symlink half is fixed, 2026-09-21** — the builtin on 2026-09-20 and
   the call site one release later, which is what the rolling freeze costs
   rather than a delay anybody chose. The defect is broader than npm, which is worth
   stating because the npm case reads like a packaging quirk and this is not
   one: `packageRoot()` resolves no symbolic link, so *any* install that puts a
   link on `$PATH` misses. Measured on this tree, an admin's
   `ln -s /opt/nish/bin/nish /usr/local/bin/nish` fails `--link` in **both**
   spellings, by the link's absolute path as well as by the bare name — the
   `$PATH` lookup above does not help, because the link *is* a path and the
   parent of its directory is not the package. npm's
   `node_modules/.bin/nish -> ../@amritk/nish/bin/nish` is the same shape.

   `realpathSync(path): string | null` is now a builtin in both compilers, with
   `nish_realpath` in `runtime_os.c`, the Node shim, a golden case, two
   negative cases and a `tests/run.js` check that resolves a real symlink —
   including one through a directory link — in a directory it makes. It is
   `getenv`'s shape exactly: one call, an `i8*` that may be null, read by the
   ordinary `T | null` narrowing.

   **What the builtin cost.** The `runtime_os.c` ceiling moved
   from 1,280 to 1,536, which is the move
   [wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget) said the next
   OS-facing builtin would make; `nish_realpath` is 157 bytes of it.

   **What the call site is, and what it deliberately does not change.**
   `packageRootCandidates()` in `self/compile.ts` adds the real path of whatever
   `argv[0]` named — after the unresolved spelling, and only when the two differ.
   Order is the whole of the care in it: a compiler that is *not* reached through
   a link finds `scripts/build.sh` on the first candidate and therefore answers
   exactly the root it answered before, spelled the way it was invoked, so no
   ordinary install and no golden moves and the "looked in …" diagnostic still
   names one directory. A link adds the second candidate and is the only thing
   that does. `argv[0]`'s *spelling* sensitivity — `./build/nish` answering
   `std/testing.ts` where `/abs/path/build/nish` answers the absolute path for
   the same program — was untouched by that on purpose: it is §A7's third
   bullet rather than this item, and it closed there on 2026-09-21. Not by
   resolving the spelling, which would indeed have moved every path both
   compilers print, but by taking the spelling out of the answer: the path is
   still whatever `argv[0]` implies and the *name* is the package-relative
   specifier, so the three spellings this item is about now write one
   `; ModuleID`, one `DIFile` and one output path.

   **Measured 2026-09-21, and the seed is the point.** `self/` may only use what
   the last release compiles, so the check is the v0.5.0 seed compiling this call
   site: `NISH_BOOTSTRAP=<v0.5.0>/bin/nish scripts/bootstrap.sh --verify` gives
   `IR(stage1) == IR(stage2): 61 modules identical` and `stage3 == stage2:
   byte-identical binaries`. Before and after, through an absolute link into a
   staged install: v0.5.0 answers ``Module `nish/text` is not part of the
   standard library (it has: json, testing, text)`` for a program that imports it
   and `--link: cannot find scripts/build.sh (looked in <link dir>/.. and .)`
   (exit 3) for one that does not; the same binary through its real path
   compiles both. That first sentence is worth keeping visible — the symlink
   defect is not only a `--link` defect, and it prints the same misleading
   "it has: json, testing, text" the missing-`std/` release did (work item 1),
   for the same reason: the list is a literal and the *file* is what the root
   never reached.

   **Both installers keep their absolute-path `exec`, now for their own
   reasons rather than for this.** `install.sh` installs a *released* compiler,
   and every release up to 0.5.0 predates the fix, so its wrapper is about what
   it downloads rather than about this tree; `scripts/postinstall.mjs` execs to
   take node out from in front of the compiler, which is 3.2 ms against 94 ms
   ([wp12-release.md](wp12-release.md#what-the-launcher-costs)). Neither is a
   workaround for a defect any more, and both were kept rather than quietly
   removed because a fix landing is not the same thing as every install on a
   user's disk carrying it.
5. **`outputStems` dropping a module under `-o <dir>/`** — filed as *stage1
   writing one file where stage0 writes two*, when two modules share a
   `; ModuleID` (§A7), and renamed here because that is not what it is.
   **Measured 2026-09-21, and the row was wrong in both of its halves. The
   mechanism it names cannot happen. The outcome it names does happen, on an
   ordinary invocation — and so does the opposite outcome, and the commonest
   case is both compilers doing it together. So what was filed as stage1's own
   defect is a shared one, and what it costs a user is a build that fails on a
   symbol their program defines exactly once.**

   **Why the mechanism could not happen when this was measured, which is the
   part worth keeping — and what changed under it since.** A stage1 module's
   name *was* the path string it was opened at: `ModuleUnit.path` in
   `self/compilation.ts` was declared as "the resolved path, which is the
   module's identity and the name in its IR header", and `Compilation.byPath`
   is keyed on that same string, so the second arrival of a name returned
   early out of `load`. Two modules therefore never shared a name in stage1 —
   a duplicate name was a duplicate *identity*, deduplicated at load rather
   than mis-written at emit — and `outputStems` could not be handed one twice
   under any invocation. The premise was stage0's: it keeps the two apart in
   two fields, `path` (absolute, the identity) and `fileName` (the name), so
   only stage0 could hold two modules that are different files under one
   `; ModuleID`. That is also what every earlier construction ran into. The
   "collapsed into a single module" of the previous attempt was not the
   construction failing, it was this property — and it was written down one
   file away the whole time, in `resolvePath`'s comment in `self/paths.ts`:
   stage1 "keys module identity on the normalised path as written".

   **On 2026-09-21 stage1 grew the second field**, because naming a package
   module by the path it was found at is §A7's third bullet and that had to
   close: `ModuleUnit.name` is the name and `ModuleUnit.path` is still the
   identity. So the premise above is now both compilers', and stage1 can print
   one `; ModuleID` for two modules the way stage0 does. Nothing in the table
   below moves with it: `byPath` is still keyed on the identity, so the modules
   are still counted the same way, and `outputStems` still reads the *path* on
   both sides — deliberately, and said so beside the code — so every file count
   in the four rows was re-measured unchanged on that tree. What did move is
   inside the files: under a relative entry (row 2) the `nish/` module's header
   is `std/text.ts` where it used to be the install's absolute path, so the two
   compilers now agree about every module's *name* in every row while still
   disagreeing about how many files they write in two of them.

   **What is actually broken: the disambiguation is lossy, and on both
   sides.** `outputStems` tells two modules of one basename apart by the
   module's path relative to the entry's directory with the separators turned
   into `_`, and both copies drop every `.` and `..` segment before joining.
   A module *above* the entry's directory therefore collapses onto a module
   with the same tail below it. The shortest reproduction needs no standard
   library, no install, no `nish/` specifier and no absolute path — two
   relative imports:

   ```
   $ cat src/main.ts
   import { inner } from "./lib/util";     // src/lib/util.ts
   import { outer } from "../lib/util";    // lib/util.ts
   export const main = (): number => inner() + outer();

   $ cd src && nish main.ts -o out/
   wrote out/main.ll
   wrote out/lib_util.ll
   wrote out/lib_util.ll
   ```

   Two files in, one file out. `src/lib/util.ts` relativises to `lib/util.ts`
   and `lib/util.ts` to `../lib/util.ts`; the `..` is filtered; both answer
   `lib_util`. The survivor is whichever was emitted last, so `out/main.ll`
   calls an `@inner` that no `.ll` in the directory defines. The two modules
   carry *distinct* `; ModuleID`s throughout — `lib/util.ts` and
   `../lib/util.ts` — which is why §A7 went looking for a shared name and did
   not need one.

   **The shape §A7 described does it too, and puts the shared name on top.** A
   program inside the compiler's own package — a checkout, or a release
   tarball with the program unpacked beside it — importing both `nish/text`
   and its own `./std/text`. `nish/text` is `<install>/std/text.ts`, one
   directory above the entry, so its entry-relative path is `../std/text.ts`
   and its stem is `std_text`; the local `./std/text` is `std/text.ts` and its
   stem is `std_text` as well. Compiled by absolute entry, **both compilers
   drop a module, and they drop the same one**:

   ```
   $ nish <install>/prog/main.ts -o out/          # stage0 and stage1 alike
   wrote out/main.ll
   wrote out/std_text.ll
   wrote out/std_text.ll
   ```

   The survivor is the local module, so the `@nish.trim` that `main.ll`
   declares and calls is the one that went. `--link` is where a user meets it,
   because the module list handed to `scripts/build.sh` names `std_text.ll`
   twice — exit 3 on both compilers, on a symbol the program defines once:

   ```
   ld.lld: error: duplicate symbol: localTag
   ```

   **Both directions are reachable, which is the finding that replaces the
   row.** Four invocations, one program each, `-o <dir>/` throughout, stage0
   and stage1 from one staged install so that `nish/<name>` is the same file
   for both:

   | invocation | stage0 | stage1 |
   | --- | --- | --- |
   | `nish/text` + `./std/text`, **absolute** entry | 2 files, one module dropped | 2 files, one module dropped — byte for byte the same, header included |
   | the same program, **relative** entry | 2 files, one module dropped | **3 files, nothing dropped** |
   | an absolute root and a relative root spelling the same segments | 3 files | **2 files, one module dropped** |
   | roots `std/text.ts` and `../std/text.ts` | 2 files, one dropped | 2 files, one dropped |

   Row 2 is §A7's claim with the compilers the other way round: under a
   relative entry stage0 names the `nish/` module package-relatively and stems
   it from an absolute path that climbs, while stage1's is absolute in both
   roles and keeps its own stem. Row 3 is §A7's claim as stated, reached by a
   different mechanism — stage1's `outputStems` calls `relativePath` outside
   its documented contract, "two paths rooted at the same base: both relative,
   or both absolute, and neither climbing above that base", and
   `pathSegments` drops the leading empty segment of an absolute path, so an
   absolute module path is relativised as though it had been spelled without
   its root. Rows 1 and 4 are the ordinary case and are symmetric, which is
   exactly why no parity gate has ever seen any of this: G1 compares the two
   compilers, and on the shape a user is likeliest to write they agree about
   dropping a module.

   **One more, found on the way and stage1's alone.** Two *spellings* of one
   file as two roots — `nish main.ts std/text.ts ./std/text.ts` — are one
   module to stage0, which canonicalises with `path.resolve`, and two modules
   to stage1, which keys identity on the path as written. stage1 then refuses
   the program stage0 compiles: ``error: Exported function `innerTag` is also
   defined in std/text.ts; exported names must be unique across the program``.
   It is the same property as the one above, running the other way: identity
   as written can never merge two files into one name, and can split one file
   into two.

   **What a fix is, and why it is not this change.** The disambiguation has to
   keep the climb instead of filtering it, because a `..` segment carries the
   only information that tells the two modules apart. Three things make that
   somebody's afternoon rather than a line. The two `outputStems` are one
   lowering in two files (`src/compilation.ts`, `self/compilation.ts`), so it
   is a two-sided change or it is a new parity difference where there is a
   shared bug today. It moves a stem that is live: every corpus program that
   reaches the standard library by `nish/<x>` reaches it through a climb, so
   `std_text` is itself a product of the filter. And it lands on top of
   whatever is decided about how a package module is *named*, because the
   `nish/` side's stem is derived from that name — rows 2 and 3 move with that
   decision, though the defect itself does not: the two-relative-imports
   reproduction above reaches no package at all, and both compilers collapse
   it into the same byte-identical `lib_util.ll`. `tests/run.js` already has
   both halves of the check a fix wants: `llFilesIn` for the set of files
   written, and `package_above`'s pattern for driving a compiler from a chosen
   working directory with a relative entry — which is what rows 2 and 3 need
   and what no `tests/link/` fixture can express, since the harness compiles
   every such program by absolute path from the repository root.

   **The branch had no coverage at all, which is the other half of why this
   survived.** No `tests/link/` program has two modules of one basename — the
   `nish/` cases reach `testing.ts` and `text.ts`, already unique, so
   `outputStems` answers them from the basename and never takes the fallback.
   `tests/link/module_stem_clash` takes it: two `text.ts` in one program,
   answering `a_text` and `b_text`, with a line of `expected.ir` from each
   module, so a regression that collided them drops one from the emitted set
   rather than merely misnaming it.

   **It reaches no package, and that is a constraint rather than a taste.** A
   package module's stem is reached by climbing out to wherever the compiler is
   installed, so a program that put one into this branch writes a different
   file name under every install — measured, the same program answers
   `std_text.ll` from a checkout and `<unpack path>_std_text.ll` from a staged
   install. `tests/nish-cmp.js` pairs the two compilers' outputs **by file
   name**, and the G2 gate it drives compares a *released* compiler with HEAD,
   which are in different directories by construction; such a program would
   therefore be two undeclared differences on every run of it — "the reference
   wrote it and the candidate did not", and its mirror. `withoutOwnRoot`
   cannot help, because it normalises what is *inside* a file and this is the
   file's name. So the shape §A7 described is not merely undetected by the
   gates: it cannot be put in front of them at all until the stem stops
   depending on the climb, which is one more reason the fix is worth making.

   **Still true after the naming change of 2026-09-21, and re-measured there.**
   A package module's *name* is install-independent now (`std/text.ts` under
   every install and every spelling of `argv[0]`), and its **stem** is not: both
   compilers still stem from the path, so a staged install still answers
   `<unpack path>_std_text.ll` where a checkout answers `std_text.ll`. That was
   left alone on purpose — moving what `outputStems` reads *and* what it drops
   in one change would move two things at once over live output stems — and it
   is what the fix now has to do: with the name package-relative, a package
   module's stem can be taken from the name instead of from a climb, which is
   both halves of this item in one edit. `tests/link/module_stem_clash` stays
   package-free until it is made.
6. **#94** — stage0's `Checker.error` throw removing the members after a failed
   one, so a later field is reported as unknown when it is not. **Reproduced
   again on 2026-09-20** on this tree: stage0 prints ``Unknown field `grown` ``
   for a field the class plainly has, stage1 prints the one correct diagnostic.
   The corpus does not have the shape, so G1 cannot see it.

   **This row is not a blocker for R6, and it is the only one of the three that
   R6 *resolves* rather than survives.** The defect is in
   `src/checker/classes.ts`, and R6 deletes `src/`; the compiler that is left
   is the one already giving the right answer. Fixing it before the deletion
   would be work thrown away with the file.

   What does survive is the mechanism #94 records on the stage1 side, and it is
   worth separating because the issue puts both in one place:
   `self/context.ts`'s `error()` is a no-op once `errored` is set, and
   `collectStructMembers` never resets it between fields, so an earlier
   member's error can silence a later member's refusal. Measured on
   2026-09-20: a class with two mistyped fields reports **one** diagnostic on
   both compilers, and both still reject the program — so what survives R6 is a
   completeness question about diagnostics, not a soundness one. Worth a case;
   not worth holding the deletion for.

Items 4, 5 and 6 share a property worth naming: **each is a defect the gate is
green in spite of, because no corpus program poses the question.** That is
§A5's first lesson and §A8's, and it is the honest qualification on every green
number in the table above — the difference set is a lower bound.

#### Which release R6 can land in, and why it is not 0.5.0

Asked on 2026-09-20, with 0.5.0 named as the target. The gates allow it; the
**order** does not, and the obstacle is the successor this package spent its
effort building.

`nish-cmp` compares the last RELEASED compiler with HEAD, so which releases it
can use is `cmpSince`, and `cmpSince` is 0.5.0 because every seed before it
ships no `std/` (work item 1). `.github/seed-matrix.sh` reads the **last
release**, which gives:

| While the tree is | the last release is | `nish-cmp` rows |
| --- | --- | --- |
| 0.5.0 in development | v0.4.0 | **0** |
| 0.6.0 in development | v0.5.0 | 2 |

Measured by driving the script against a stand-in for `gh` at both tags.

So R6 landing *in* 0.5.0 deletes `ir_oracle.js` and `interop_oracle.js` — the
two largest of the six — during the one window in which their successor
provably cannot run. The IR of every module of every corpus program would go
from "proved by two implementations agreeing" to "proved by nothing", not as a
considered trade but as an accident of ordering, and the first run of the thing
meant to replace them would happen after the code they checked was gone. **A
gate that has never been green is not a successor; it is a plan.**

The fix is not work, it is a release boundary. Ship 0.5.0 with everything R6
needs — that is where this tree already is — and land the deletion once 0.5.0
is out, so it rides 0.6.0. `nish-cmp` then has a full cycle of green runs
against the 0.5.0 seed *before* anything is deleted, which is the evidence the
deletion is supposed to rest on. The cost is one release; §6 says what the
deletion costs when it is right, and none of that changes.

**0.5.0 is out, and the first of those runs is green: 437/437 programs,
2026-09-21** (item 1 above has the line and what it took — a normalisation of
each compiler's own package root, without which no cross-install comparison can
be green). So the sentence above has stopped being a prediction: the successor
has run, once, against a real seed. A cycle is more than one run, and what the
cycle is for is the runs nobody arranged — every merge to `main` from here on
has a `nish-cmp` row, and the deletion should rest on those rather than on this
one.

The alternative — lowering `cmpSince` to 0.4.0 and declaring the two
`nish/`-specifier programs — is the allowlist that item 1 turned down, and it
fails on its own terms as well: `DECLARED` wants the words in `CHANGELOG.md`,
which is generated at release time with `[Unreleased]` empty, so the
declaration cannot be green on any pull request. There is no spelling of it
that makes 0.5.0 work.

#### A human's decision — two, and neither is a checkbox

**The registry name was the third, and was answered on 2026-09-19:**
`@amritk/nish`, with the command still `nish`
([wp12-release.md](wp12-release.md#the-npm-name)). It is recorded here rather
than deleted because of what it demonstrates about this bucket — it sat here
needing nobody's work and everybody's permission, and closing it took one
person one sentence. What it leaves behind is ordinary work: the package
becoming a thin installer, which was in the list above and landed on
2026-09-20.

**~~A release that carries the darwin and `aarch64-linux` seeds~~ (G3, G5) —
closed on 2026-09-20.** v0.4.0 is published and carries all four:
`nish-0.4.0-x86_64-linux.tar.gz`, `nish-0.4.0-aarch64-linux.tar.gz`,
`nish-0.4.0-aarch64-darwin.tar.gz` and `nish-0.4.0-x86_64-darwin.tar.gz`, plus
the five npm tarballs. So this bucket holds **one** decision now, not two, and
G3's macOS `bootstrap` row appears from `seed-targets.json` on its own as the
note there promised — no edit to `ci.yml`. **What the release did not settle is
the thing the seeds are for**: the compiler those four assets contain ships no
`std/` (work item 1 above), so the rolling freeze they check is a freeze on a
compiler that cannot import its own standard library. That is not a reason to
re-cut v0.4.0 — `bootstrap` builds `self/`, which imports nothing from `std/`,
so the freeze it checks is real — but it is the reason `cmpSince` is 0.5.0, and
it is worth recording here that a gate can be green on a seed that is broken in
a way the gate does not ask about. The paragraph below is the record of what
this decision was, and stands.

The
measurement and the fix are done and merged — `acbca9f` (#114): all three
previously unexercised rows run on their own hardware and green, and the Mach-O
`stage3 == stage2` comparison holding as a raw `cmp` (see R2 and §G5). What is
left is a **release**, because a release already published cannot grow an
asset — and in this repository a release is a person's: `chore(release):
<version>` on `release/next` is the one pull request an agent must never merge,
because merging it tags and publishes ([AGENTS.md](../AGENTS.md)). #92 is open
waiting on exactly that. **This is the cheapest of the three, because there is
nothing to weigh** — nobody is trading anything off, somebody has to press the
button — but it is the same *kind* of thing as the other two, and this section
sorts by kind. Once a release carries those assets, G3's macOS `bootstrap` row
appears on its own from `seed-targets.json`, with no edit to `ci.yml`.

**Whether the second implementation still earns its keep.** §7's trigger is the
day the seed's only remaining job is to be a seed — *a release cycle in which
stage0 found nothing, changed nothing, and shipped nothing except itself*. That
is a judgement about value, not a gate with a command behind it, and this
document is the wrong place to pretend otherwise.

**And this week's evidence points away from the trigger, which is worth saying
plainly in a section about being ready to delete.** In the run that produced the
measurements above, the second implementation earned its keep three times over:

- stage0 caught a **contract stage1 was not answering at all** — 178 of the 180
  rows, across 89 programs, where stage1 gave `--json` an empty stdout for a
  syntax error and stage0 printed the object (§A8). Not a wording: the
  machine-readable surface was simply absent.
- stage0 caught a **span stage1 got wrong**, and stage1 caught a **span stage0
  got wrong**, in the same run and on the same surface.
- stage0 is the compiler that is currently **right** about #94's shape being
  worth reporting and **wrong** about how, and stage1's single diagnostic is
  the correct output for that program — which is only knowable because there
  are two.

A release cycle in which stage0 found nothing is not this one. §6 prices what
retirement costs and §7 says when not to do it; both stand, and the numbers
above are an argument for the second implementation rather than against it. **A
document that argued for retirement while its own measurements pointed the
other way would be the exact failure this package has recorded five times** —
a claim kept alive past the evidence because nobody re-derived it. So: the
gates are closing, R6 is becoming a decision rather than a project, and the
decision's honest answer today is *not yet*.

#### Recorded for whoever owns the file

Three corrections this stage measured and may not make, because each is outside
the three documents it owns. They are written here so they are not rediscovered:

- **`self/parser.ts:787` still asserts the caveat R3 closed** — "That bucket
  counts; it does not gate… Whoever moves the next rule should read the
  bucket's number before and after." `tests/self/parser_refusals.txt` is that
  ceiling as of #115, compared in both directions. The comment is stale and
  should say so when somebody next touches that file. (It is also the fourth
  instance of §A5's pathology in waiting: a true caveat that outlives its own
  fix reads as a live one.)
- **`docs/wp14-selfhost.md` §7 claims** "Every other `--json` object, the codes
  included, is byte-identical between the two and `tests/run.js` proves it".
  **That was not true of a syntax error**, on 178 programs, until #117 (§A8),
  and `tests/run.js` was not what proved it either way — nothing compared the
  surface. The sentence needs re-stating against §A8's before-and-after.
- **No sibling oracle self-tests its comparison logic.** `reject_oracle.js`'s
  `selfCheck` and `scripts/verify-binaries.sh`, which `tests/run.js` drives
  against a stand-in, are the two counterexamples in the tree; every other
  oracle's compare-and-report path is exercised only by the corpus agreeing
  with it. Relatedly, `tests/self/stage1_only.js:41-43`'s malformed-line throw
  is exercised by nothing. That is a stage of its own, not a line in this one.

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
5. **musl, FreeBSD and every 32-bit platform lose their `npm install`.** This
   is the one cost on the list that is paid by somebody other than this
   repository, so it is worth being exact about who and what. `package.json`'s
   `files` shipped `dist/`, and `bin/nish` ran it on any platform this project
   attaches no prebuilt binary for — the four are `x86_64-linux`,
   `aarch64-linux`, `x86_64-darwin`, `aarch64-darwin`
   ([`.github/seed-targets.json`](../.github/seed-targets.json)). `dist/` was
   affordable as a fallback precisely because it was in the package for its own
   reasons, as the seed and as the oracle; delete `src/` and it has none, and
   keeping it would mean publishing and maintaining a second implementation of
   the compiler for the smallest constituency in §1's table. So `files` stops
   shipping it and the launcher refuses: it names the four platforms that do
   have a binary, says there is nothing inside the package to fall back to, and
   exits 3 (`docs/wp12-release.md`, "Which compiler the package ships", amended
   2026-09-22).

   **What those users had and no longer have** is a working compiler from one
   `npm install`, needing no C toolchain, about eight times slower than the
   native one and the same compiler by every test here. **What is left** is in
   [INSTALL.md](INSTALL.md) and none of it is a supported install: bootstrap in
   a glibc host or container with `NISH_BOOTSTRAP=<released nish>` and link with
   the machine's own `clang`; compile the compiler to a single WASI module
   (`--profile wasi`) and run it under Node; or use a target this project does
   build. The seed does not have to be *for* the machine, but it has to run *on*
   it, which is the whole of the difficulty on musl.

   Two properties survive and are the reason this is a cost rather than a
   regression: **nothing is compiled on a user's machine on any path**, and a
   supported platform still installs by download and unpack. What a user on an
   unsupported platform gets is a sentence naming the situation and a remedy,
   which is the honest form of a package that cannot serve them — and the
   alternative that was never on the table is a command that exits 0 having
   compiled nothing. **The refusal is machine-readable**, which is not a detail:
   `AGENTS.md` promises that a failure with no source position is still one JSON
   line and that under `--json` nobody has to read stderr to find out why a run
   failed, so the refusal answers `--json` with one `{"severity","code","message"}`
   object on stdout carrying `NL0002` — the toolchain code the compiler already
   mints for "a program that had to run would not" — and exits 3. The first
   version of this change made it prose on every path, which broke that contract
   on a path that is reachable on a fully supported platform (`--no-optional`, or
   a lockfile without the optional entries), and nothing in the suite saw it
   because `tests/nish/cli.ts` drives the compiler rather than the command.

   **What the suite asserts, and which of it could have failed before.** Seven
   checks in `tests/run.js`'s WP12 block were watched failing against the
   fallback they replace: the refusal and its exit 3, the package it names, the
   remedy it names, the unstartable-binary refusal, the `--json` object and its
   contents, and that a refusal writes nothing *when asked for an `-o` and a
   `--link`* — that last one being an assertion only in that form, because
   against an empty directory it passed before the change as well. The rest is
   **new coverage that could not have failed against the old behaviour, and
   saying so is the point of this paragraph**: three assert a message that did
   not exist until this commit, one pins the printed platform list against
   `.github/seed-targets.json`, and four exercise the packaging path — of which
   `the platform package ships a whole compiler` was watched failing against a
   `files` list with an entry deleted from it, which is the 0.1.1–0.4.0 defect
   exactly. One of them, `installed nish compiles and links a program importing
   nish/text`, passes on the old fallback too; its value is that it now runs
   through the platform package rather than through `dist/`, which is the half
   of this block that was never tested before (§5a item 1).

6. **The WP13 differential oracle can no longer make its own reference, and
   two of its checks stop existing.** §2B listed this one as surviving R6 and
   the row was wrong; it is corrected there rather than quietly, because a row
   that says "survives" is what let R6 be planned as one commit. The oracle
   needs no second *compiler* — it compares a native binary with the same
   program under Node — but the JavaScript it compares against is produced by
   `tests/differential/rewrite.js`, which drives stage0's `Compilation` in
   process, because `i32`, `u8`, `f32` and `i64` are all just `number` to
   `tsc`'s own checker and the rewrite has to know which is which. Delete
   `src/` and the reference *generator* goes with it. This is the only oracle
   in the repository about **runtime semantics** rather than emitted text: no
   `.ll` golden, no `nish-cmp` row and no parity variation can see a program
   that prints the wrong number.

   **What is saved.** G2.4's move, taken on 2026-09-22 while stage0 still
   exists: the rewrite of all 176 programs is checked in as
   `tests/differential/goldens/rewrites.txt` — 358 modules, 354 distinct
   bodies, 235 KiB — and `tests/differential/run.js` compares against the store
   instead of against the rewriter (`--frozen`, and automatically when there is
   no `dist/`). Neither half of the harness names stage0 any more: the native
   side takes `--compiler` or the seed protocol's answer, as the four surviving
   oracles do since G2.3.

   **What it is worth, measured rather than claimed.** The frozen run
   reproduces the live one program by program and not merely in total —
   `164/176 programs agree with Node ...; 0 unexpected failure(s)` from both,
   the same 176 verdicts in the same order, the twelve `known-failures.txt`
   decisions among them. `npm test` then requires the store to be byte
   identical to what the live rewriter produces today, so what is frozen stays
   what the oracle actually compares, and every record carries the SHA-256 of
   each source module the program loads: a program whose source has moved
   fails as `STALE` ahead of `known-failures.txt`, because a frozen reference
   that silently compares against changed source is worse than no oracle at
   all — it reads as coverage.

   **What cannot be frozen, and therefore dies:**

   - **The fuzz differential against Node** — `fuzz.js` in its default mode,
     which `npm test` runs ten programs of and which `--count 200` is the
     larger form of. Its programs are generated from a seed and are not checked
     in, so there is nothing to freeze: a reference for a program that does not
     exist yet has to be *computed*, which is the one thing a store cannot do.
     The generator itself survives, and after R6 what it can still ask is
     whether a generated program compiles and runs, not whether it computes
     what Node computes. (`fuzz.js --stage1`, the IR comparison, was already
     priced as dying in §2B.)
   - **The arrow-parity guard**, `arrow-parity.js`. Its subject *is* the
     rewriter — that `function f() {}` and `const f = () => {}` rewrite to the
     same JavaScript, the WP22 defect that had nine corpus programs compared
     with JavaScript's own `console.log` left in them — so freezing its output
     would leave a check that two checked-in files match each other. What
     carries the risk instead of the check is the store: its text was generated
     while that guard was green, and it cannot drift without the staleness
     guard or the per-body hash failing on read.
   - **The store's fidelity check**, which is the other half of `goldens.js`:
     the whole file rebuilt from the live rewriter and compared byte for byte.
     Freshness survives it — every program has a record, its sources still
     hash, no record is orphaned, the header's counts are the store's own — but
     freshness cannot see a record that names the wrong module while holding
     that module's hash, and nothing short of the rewriter can. So after R6 the
     store is trusted the way `tests/cases/*.ll` is trusted, and is weaker for
     exactly the reason cost 2 gives.
   - **A corpus program added after R6 gets no differential coverage.** Until
     then a new program is one `npm run test:update` away from a frozen
     rewrite; afterwards `goldens.js` fails it by name, and the only honest
     answers are to write the program's coverage off or to port the rewriter.
     That is an ongoing cost, not a one-off: the corpus has grown from 50
     programs to 71 over this project's life, and every future addition pays
     it.

   **The way out, for whoever wants it back.** stage1 prints the same type
   information the rewrite needs — `--emit-checked` is the dump the checked
   goldens are made of — so the rewriter can be ported onto it and the store
   goes back to being generated rather than frozen. It is a project of its own
   and is deliberately not R6's: the store is what makes R6 possible without
   losing the oracle, and the port is what would make the oracle live again.

   **One finding this work turned up, which is a cost of its own.** With the
   native half moved to stage1, two of the 71 corpus programs stop compiling:
   `corpus/str_template` and `corpus/conversions_roundtrip`, both on `-1 / z`
   with `z: f64`, where stage0 types the negated literal from its context and
   stage1 answers ``Operator `/` requires two operands of the same numeric
   type, got i32 and f64``. Neither `--parity` nor the IR oracle could have
   found it, and the reason is worth more than the defect: `CORPUS_DIRS` in
   `tests/self/corpus.js` does not include `tests/differential/corpus`, so
   **those 71 programs are compiled by stage1 nowhere in the suite** — G1's
   standing qualification, that the difference set is a lower bound over a
   corpus somebody wrote, with a sixth instance. The frozen run with `src/` and
   `dist/` moved aside therefore reads `162/176` and names the two, which is
   the number R6 inherits unless the gap is closed first.

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

**Measured against that trigger on 2026-09-19, the answer is not yet, and the
measurement is in this document rather than in an opinion.** The week these
gates were last re-run, stage0 found a machine-readable contract stage1 was not
answering across 89 programs — 178 of the 180 rows — and a span stage1 got
wrong, while stage1 found a span stage0 got wrong (§A8) and holds the correct output for #94's shape. A
release cycle in which stage0 found nothing, changed nothing and shipped
nothing except itself is not the cycle this was. §5a keeps that comparison next
to the gate states, so the two are read together.

Until then, `IR(stage0, self/) == IR(stage1, self/)` is the most valuable line
in the test suite, and it is worth what it costs.

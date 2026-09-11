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
| 12,209 | **a path inside the IR** | `; ModuleID = '...'` and `-g`'s `!DIFile(filename: ...)`. Handed the same absolute path, stage0 rewrote it cwd-relative (`displayName`) and stage1 printed what it was given. The oracles never saw it because they pass relative paths to both compilers | **stage0 changed.** An imported module is named by the specifier resolved against the name the *importer* was given (`importedName`), which is stage1's rule and needs no working directory. Named relatively no golden moves; named absolutely the two now write the same bytes. It also takes the cwd out of the emitted IR, which is what makes a build reproducible. `runtime.c` has eight bytes left of its 4 KB budget, so a `cwd` builtin was never available to buy the other direction |
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


### B. The oracles

Twelve comparisons keep the two implementations honest. Retiring stage0 does
not blind all of them, and knowing exactly which is the difference between a
decision and a leap:

| Oracle | Compares against | After stage0 |
| --- | --- | --- |
| `lexer_oracle.js` | the `typescript` package's scanner | **survives** — it never read `src/`. Costs one devDependency |
| `parser_oracle.js` | the `typescript` package's parser | **survives**, same reason |
| `support_oracle.js` | `node:path`, `Buffer`, `Map`, `JSON.stringify` | **survives** |
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
   the **seed** rather than with stage0, and stay green.
4. The coverage lost by `checked_oracle.js`, `types_oracle.js`,
   `diagnostics_oracle.js` and `symbols_oracle.js` is measured and recovered as
   checked-in goldens *before* they are deleted — in particular every
   diagnostic wording, which is presently proved by comparison and would
   otherwise be proved by nothing.

**The check.** The numbers, in this document, on the day: how many programs
each dying oracle covered, and what covers them afterwards.

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

**State: the script half is done, the CI half is one operating system short.**
`scripts/bootstrap.sh` reads `NISH_BOOTSTRAP`, and the `bootstrap` job in
`ci.yml` downloads the last release's binary and builds `self/` with it. It
runs on Linux alone, because `macos-latest` is commented out of the test matrix
(`ci.yml` says why: `scripts/build.sh` needed a bash 3.2 fix, which has landed,
and `scripts/smoke.sh` still uses `mapfile`, a bash 4 builtin, which has not).
Until a release exists the job has no seed and says so in an annotation rather
than passing quietly — a freeze nobody checked must not read as a freeze that
held.

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
- `npm install -g nish` keeps working: the package becomes a thin installer
  that fetches the binary for the host, or ships it. Whichever, the check in
  `tests/run.js`'s WP12 block — pack, install into a temporary prefix, link a
  hello-world from an unrelated directory — must still pass.
- `--version` has a source that is not `package.json`.
- `docs/INSTALL.md` and `wp12-release.md` §"Not in this work package" are
  rewritten in the same commit.

**Why it blocks.** Retiring stage0 without this does not remove Node from the
compiler; it removes the compiler.

**State: one binary of the four, and the npm package is unchanged.** The
release workflow builds `nish-<version>-x86_64-linux` — stage2, `--verify`d,
and smoke-tested before it ships, because it is also the seed every later
release bootstraps from. The other three are not built: `aarch64-linux` needs
an arm64 runner, and both darwin binaries need `macos-latest`, which is out of
the matrix. The npm package is still the Node tarball rather than a thin
installer, so `nish` today is Node-free only if you take the binary rather than
`npm install`. `--version` already has a source that is not `package.json` —
`VERSION` in `self/branding.ts`, which `tests/run.js` pins against
`package.json` — so that bullet is met by the binary the moment it is the
product. This gate closes when the remaining three binaries and the installer
land; nothing here is a decision against them.

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
| **R1** | Parity | **done.** §4's builtins landed in both compilers, the seven rows of §2A closed, §A2's five closed (four fixed, the fifth re-read as §A3's recovery class), and §A3's five classes are closed or declared: `--parity` is green over the whole corpus with an empty difference set (§A4) |
| **R2** | The seed protocol | **mostly done.** `NISH_BOOTSTRAP` is in `scripts/bootstrap.sh`, `ci.yml`'s `bootstrap` job builds `self/` with the last release, and the policy sentence is in `wp12-release.md`. Outstanding: the job runs on Linux only, and it has no seed to use until 0.1.0 ships (G3, G4) |
| **R3** | Oracle succession | **begun.** `tests/nish-cmp.js` exists, agrees with `ir_oracle.js` over the corpus and has been watched failing; `fuzz.js --stage1` is repointed. Outstanding: the four survivors repointed to the seed, and the lost coverage recovered as goldens with the numbers written into §2B — which is the half that matters (G2) |
| **R4** | Distribution | **begun.** One binary per release, `nish-<version>-x86_64-linux`, built and smoke-tested by `release.yml`; `--version` already has a source that is not `package.json`. Outstanding: the other three binaries, the npm package becoming an installer, and the INSTALL.md/wp12 rewrite (G5) |
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

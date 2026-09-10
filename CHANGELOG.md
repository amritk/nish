# Changelog

All notable changes to `amritc` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). The release procedure (bump,
changelog, tag, workflow) is in [docs/wp12-release.md](docs/wp12-release.md).

## [Unreleased]

### Added

- **WP19 R1 is closed: `node tests/run.js --parity` is green over the whole
  corpus.** 8,358 runs over 597 programs — every program the suite has, through
  both compilers, under each of the fourteen flag variations — with **0
  undeclared differences** and 1,523 declared by five written reasons
  (`docs/wp19-stage0-retirement.md` §A4). Every diagnostic, every span, every
  byte of IR, every sidecar and every exit code is identical; what is left is
  the parser refusing syntax the language forbids before Phase 0 can name the
  rule, each compiler's own `--emit-ast` tree, the one `module <path>` header
  line, an inheritance cycle stage0 reports twice, and the exit status the
  first of those reaches under a dump flag.

  It took the undeclared count from 13,800 to 0 across the entries below, and
  one step went backwards — 28 to 53, on a rule about stage0 inferred from two
  experiments and wrong in two ways. The mode caught that as well.

### Fixed — correctness

- **A fixed-length stack array was sized from an IR operand rather than from
  the length that was written, and in f64 mode that operand is a register.**
  `new Float32Array(2)` in a function that keeps its array on the stack (WP6)
  types the slot `[2 x float]`, and the emitter got the `2` by parsing the
  operand it had just emitted for the length. Under `--number-mode f64` the
  literal has been through a conversion by then, so the operand is `%5`:
  stage0 parsed it to `NaN` and wrote `alloca [NaN x float]` — IR `llvm-as`
  refuses, from a compile that exited 0 — and stage1 parsed it to 0 and wrote
  `alloca [0 x float]`, which assembles and then stores two floats past a
  zero-element stack slot. stage1's was the more dangerous of the two, because
  it builds and runs.

  Both compilers now read the length the way `escape.ts` read it when it
  decided the site was stackable at all: from the literal (`literalLength`,
  now shared with the emitter rather than reimplemented by parsing text). The
  two cannot disagree any more, and a stack site whose length is not a literal
  is an internal error instead of a silent zero. `tests/cases/arr_stack_f64`
  pins the IR and runs it. Found by `tests/run.js --parity` (WP19 §A2), which
  is the only thing that had ever compiled these programs in f64 mode.

- **`String(x)` on a double printed seventeen digits where sixteen suffice, for
  about one value in twenty thousand.** The language's rule is that number
  formatting matches JavaScript's `String(x)`, which prints the *fewest* digits
  that read back as the same double. The old search asked `snprintf` for k
  digits and `strtod` whether they round-trip, increasing k until they did —
  but `snprintf` can only hand back the *correctly-rounded* k-digit string, and
  for some values that one does not round-trip while a neighbouring k-digit
  string does. The search then gave up on k and moved on.

  `7.120236347223045e-307` is such a value: Node prints those sixteen digits,
  `amritc` printed `7.1202363472230444e-307`. So did `runtime/shim.mjs`
  disagree with the native runtime, since the shim delegates to JavaScript's
  own `String`. Ryu (below) finds the shortest string rather than the rounded
  one, and `tests/cases/f64_shortest_digits` pins four such values against
  Node's output alongside `0.1`, `1e21` and `5e-324`.

### Changed

- **The self-hosted compiler refuses five programs it used to compile, and
  words a sixth refusal as stage0 does (WP19 G1).** Each is stage1 having been
  more permissive than the compiler it is frozen against, and each was invisible
  to the oracles, which compile a program with the flags that program already
  carries:

  - **A contextual type no longer reaches a `Result` payload.**
    `docs/LANGUAGE.md`'s contextual-literal table is an enumerated list of
    positions and `Ok(...)` is not one of them, so `Ok(3)` for a
    `Result<i32, string>` in f64 mode is an `f64` meeting an `i32`, as stage0
    has always had it (`reject_res_ok_f64`). This is the `unwrapOr` fix of the
    previous release at the site it did not reach.
  - **Nor an object literal's property value, for a numeric literal or `[]`.**
    stage0 answers this position from three separate walks: the one that types
    an object literal and a `null` names it, and the numeric and array ones do
    not. stage1 threads a single contextual type down and was handing it to all
    four, so `{ b: 255 }` for a `u8` field and `{ xs: [] }` both compiled where
    stage0 refuses them — in the *default* mode, with no flag involved
    (`reject_struct_field_u8`, `reject_struct_field_empty_array`,
    `reject_struct_field_f64`). A nested object literal and a `null` still take
    the field's type, as they do in stage0.
  - **`+=` is arithmetic, not concatenation.** A compound arithmetic assignment
    has one rule of its own — the target must be numeric and the value must be
    exactly its type — and stage1 was routing it through the binary operator's
    rule instead, which takes two strings. `s += "b"` compiled there and is
    refused by stage0 (`reject_cf_compound_string`, `reject_cf_compound_widths`).
  - **The refusal names the token that was written.** `x /= k` is
    `` Operator `/=` requires ... ``, not `` `/` ``, for a local, a field and an
    element alike, which is what stage0 says and what the bitwise family already
    said on both sides.
  - **The context around a binary operator no longer reaches its operands.**
    `docs/LANGUAGE.md` says only the literal's *immediate* context counts, and
    for an operand that context is the other operand — never the annotation
    outside. stage1 was passing the outer type in, so `const b: u8 = 1 + 2`
    compiled there and is refused by stage0, which reads the sibling instead
    (`reject_bin_operand_context`). The sibling still propagates, which is what
    makes `kind === 3` work when `kind` is an `i64`.

  `Field \`code\` of \`IoError\` is i32, got f64` is now
  `` ... expects a value of type i32, got f64 ``. The message was assembled
  entirely out of interpolations and so had no literal run for
  `scripts/gen-diagnostic-codes.mjs` to key a code on; it is `AS2269` now,
  which is what `tests/run.js`'s coverage check asks for rather than a longer
  uncoded backlog.

- **The self-hosted compiler recovers from an error where stage0 does, and
  reports the same diagnostics after the first one (WP19 §A3).** Both compilers
  recover per statement — `checkStatements` wraps each one in a `try` in stage0
  — but stage0's `throw` abandons the rest of the statement it came from and
  stage1 carried on through it, so one bad type became a paragraph of
  consequences where stage0 reported the cause. Over a program written for i32
  mode and compiled with `--number-mode f64` that was the difference between 20
  diagnostics and 20 different ones.

  `errored` in `self/context.ts` is stage0's `throw` in a language that has
  none: set by `error`, cleared at the start of each statement, and consulted
  by `checkStatement` and `checkExpression` so nothing further in a refused
  statement is checked or reported. A list *inside* a refused statement is not
  entered at all (a `switch` abandoned at its discriminant does not go on to
  refuse its `case` labels), and a list that runs to the end clears the flag,
  so the `else` of an `if` whose `then` failed is still checked. A rejected
  initializer leaves its variable undeclared unless the annotation says what it
  is, which is what makes `const at = m.get(k, -1)` in f64 mode report
  `Unknown identifier \`at\`` at each later use on both sides.

  Four contextual-type differences fell out of measuring this, all the same
  shape as the ones above — stage1 handing its one `want` to a position
  stage0's walk does not name:

  - **A method's argument.** `docs/LANGUAGE.md` grants a bare literal the
    parameter's type for a *function* and a *constructor*; a method is neither,
    so `b.get(-1)` on an `i32` parameter is an f64 in f64 mode
    (`reject_method_arg_literal`). `super`'s arguments go the same way.
  - **`push` and `indexOf` through a field.** The element type reaches a
    literal only when the receiver is a plain identifier: stage0 gets there
    through `calleeName`, which names `xs.push` and gives up on `b.xs.push`
    (`reject_push_field_literal`).
  - **The other operand of a binary operator, when it is not a shape stage0
    can peek at.** "Known type" is an enumerated list — a variable, a field or
    element of one, a call to a user function or a conversion — and a
    sub-expression is not on it, so `0xc0 | (cp >> 6)` in f64 mode is an f64
    meeting an i32 (`self/lexer.ts` compiles under it; the rule is
    `peekable` in `self/expressions.ts`).
  - **The caret on a nullable member access** sits under the property name, as
    stage0 puts it, not under the receiver.

  And one message: an unknown dotted call is `` Unknown builtin `foo.bar`
  (supported: …) `` in both compilers now, naming the callee and listing what
  there is, rather than four shorter sentences and an `Unknown identifier` for
  the receiver.

- **`--emit-checked` prints the attribute pass's facts in the self-hosted
  compiler too (WP19 G1).** stage0 runs the whole-program fixpoint before it
  dumps and prints `facts:`, `escaping:`, `calls:`, `pointer ...` and
  `stackSites=` for every function; stage1 dumped straight after `check()` and
  printed none of them. That was 193 of the 206 differences `--parity` found,
  one per program, and no oracle could see it because `checked_oracle.js`
  filtered exactly those lines away — by design, since it was comparing the
  checker.

  `self/dump.ts` now formats them the way `src/dump.ts`'s `factsText` does and
  `self/compilation.ts` has stage0's memoised `analyze()` behind it, so a
  compile that also emits does not run the fixpoint twice. The oracle's filter
  is deleted: all 314 programs of the corpus agree over 297,361 dump lines,
  every line compared.

  The new lines caught a regression on their first run, which is the argument
  for comparing them: the compound-assignment change above had stopped
  recording the target's type, and `collectDivisionFacts` reads exactly that to
  decide whether `x /= k` can reach `amrit_panic_div`, so stage1 reported
  `effect=none willReturn=true` for a function stage0 called
  `effect=write willReturn=false callsNoReturn=true`. Wrong facts are wrong
  *attributes*, the class of bug a golden `.ll` is worst at catching, and it
  was caught inside the change that caused it rather than in a release.

- **`--out-dir` is gone from the self-hosted compiler; `-o <dir>/` is the one
  spelling (WP19 G1).** It was stage1's own flag, added when
  `scripts/bootstrap.sh` drove the stages and kept afterwards because the
  oracles passed it. stage0 has never had it, so it was a difference in the
  flag sets running in the direction nobody checks — a flag a user could come
  to depend on that the one remaining compiler would then have to keep forever.

  `-o <dir>/` did the same thing already, with the same directory-making and
  the same per-module stems, so the removal costs nothing: `tests/self/`'s IR,
  interop and bootstrap oracles pass `-o <dir>/` to both compilers now instead
  of one spelling each. Both usage texts also name the same six spellings now —
  `-o`/`--output`, `-v`/`--version` and `-h`/`--help` were always accepted by
  both and each side documented a different subset, and since the flag-set
  check reads `--help`, what a compiler documents is what it is held to.

- **A `<name>.env` line that is a bare `NAME` unsets the variable.** The
  sidecar layers `NAME=value` over the inherited environment, so `getenv`'s
  third answer — unset — was only as reliable as the developer's own
  environment: `io_getenv` assumed `AMRITC_TEST_NOT_SET` was absent rather than
  making it so. A line with no `=` now removes it, in both readers
  (`tests/run.js` and `tests/differential/lib.js`), and the case says so.

- **`s.indexOf(sub)` is about 17x faster: 53.7 ms to 2.9 ms over 52 MB of
  haystack (WP15).** The search was emitted inline, one `amrit_str_at` probe
  per offset, so that `runtime.c` stayed inside its size budget — which made
  the idiomatic string search a byte-at-a-time scan. It is now
  `amrit_str_index_of` in the runtime, where `memchr` finds a candidate first
  byte and `memcmp` confirms it, both the libc's vectorised routines. Every
  call site *shrinks*, since thirty lines of loop become one call, and
  `runtime.c`'s `.text` goes from 3,852 to 4,002 bytes, still inside the 4 KB
  budget.

  `memmem` would be 2.5 ms and is deliberately not used: it needs
  `_GNU_SOURCE`, which makes glibc's `<string.h>` pull in `<strings.h>` — and
  this project generates a header of that name from `examples/strings.ts`, so
  any `-I` at it shadows the POSIX header and drags `amritc.h` into
  `runtime.c`. The interop tests caught exactly that. A C host would hit the
  same, and a fifth of the time is not worth making the runtime sensitive to
  its includer's include path.

  The semantics are unchanged: an empty needle answers 0, a needle longer than
  the haystack -1, and the offset is in bytes (`tests/cases/str_search`, and
  eleven cases in `tests/runtime_test.c`).

- **A non-exported function passes a small `Result` as two values instead of
  one packed word: `bench/result` goes from 650 ms to 464 ms (WP15).**
  `Result<T, E>` with two small scalar payloads has travelled in a single
  `i64` since WP17, because that is what a C or wasm host has to see. Inside a
  module no host is looking, and the word costs something real there: with both
  halves in one register the `select` that picks the live arm happens on the
  word, and instcombine can no longer fold the arithmetic around it. A function
  that gets `internal` linkage now uses `{ i1, i32 }` instead — rustc's
  `ScalarPair` — which puts us at C's 444 ms rather than 1.46x behind it.

  **The condition is the linkage condition**: `--strict-exports` on and the
  function not exported, the same test that writes `internal`. The private
  shape is safe only because no host can name the symbol, so
  `--no-strict-exports` turns it off along with the linkage it mirrors, and an
  imported function — exported by definition — is always packed, which is how
  two modules agree without consulting each other. `--emit-header`,
  `--emit-dts` and `--emit-napi` describe exported functions only and are
  unchanged; `tests/cases/res_export` still emits `i64` for all four shapes.

  The packing code did not move: the word is still built exactly as before and
  split at the boundary. LLVM folds the round trip away, and a hand-written
  two-scalar lowering measures 467 ms against this 464 — the same, within
  noise — so one packing path was worth keeping. `docs/wp17-result-abi.md` §4
  has the four-way table.

- **Formatting a double is 35x faster: 2557 ns to 72 ns (WP15).**
  `amrit_str_from_f64` used up to seventeen `snprintf`/`strtod` round trips to
  find the shortest digits; it now computes them directly with Ryu (Adams,
  PLDI 2018). The ECMAScript layout around the digits — where the point goes,
  when to use e-form — is unchanged, so only the digit generation moved.

  **This costs binary size, and the size lands only on programs that use it.**
  The two power-of-five tables are 9,888 bytes of read-only data, generated
  with exact integer arithmetic rather than transcribed. `runtime.c`'s `.text`
  goes from 2,775 to 3,852 bytes, still inside the 4 KB budget of
  `docs/MASTER_PLAN.md` §2; its `.rodata` goes from 32 bytes to 9,920. Section
  GC keeps the tables out of any binary that never formats a double, so
  `bench/fib` is unchanged at 5,600 bytes while `bench/nbody` goes from 10,856
  to 21,168.

  Validated against the ECMAScript rule itself rather than against the code it
  replaces — the digits round-trip, no shorter string round-trips, and no
  same-length string is closer — over 20.9 million values: every finite
  exponent with boundary and random mantissas, the powers of ten, and uniform
  random bit patterns. Zero violations. The same harness finds 46 violations
  per 1.4 million in the old implementation, which is the bug above.

- **`scripts/size-report.sh` measures the section the budget is about.** §2
  defines the runtime budget as `runtime.c`'s `.text` at `-Oz`, but the script
  reported the `text` *column* of `size`, which also counts `.rodata` and the
  `.eh_frame` entries the size profile strips. That row therefore read 4,696
  against a 4,096 budget while the section it names was at 2,775. It now
  reports `.text` against the budget and `.rodata` on its own row.

- **An array's header and its elements are separate alias domains, which is
  worth 1.6x on a loop that writes elements (WP15).** Every load and store of a
  `%struct.amrit_array` field now carries `!alias.scope`/`!noalias` naming a
  "header" scope, and every load and store of element data the matching
  "elements" scope. Nothing about the language changes — no flag, no syntax, no
  observable behaviour — but LLVM stops having to assume that `a[i] = v` might
  land on some array's `len` or `data`.

  What that assumption cost: the header was reloaded on *every iteration* of
  every loop that writes an element, because LICM could not hoist a load the
  store might clobber, and the loop vectoriser gave up behind it. On
  `dst[i] = src[i] * 2.0` over 8192 doubles, `--profile speed`, the reload alone
  measured **1205 ms against 763 ms**.

  The proof is about bytes rather than allocations: a header's three fields and
  the `cap * sizeof(T)` of element storage never overlap, in any of the four
  shapes the compiler produces them (an arena bump each, two entry-block
  allocas under WP6, or — for `process.argv` alone — one `malloc` block whose
  elements start after the header). `src/codegen/emit/arrays.ts` carries the
  full argument beside the code. Strings are left alone: a string is one block
  whose length and bytes are contiguous, so it has no such split to describe.

  `tests/cases/arr_alias_domains` pins the consequence a golden cannot express
  — after `opt -O2` no header load is left inside the loop — and 39 array
  goldens grew the metadata. `--plain` emits none of it.

### Changed — BREAKING

- **Signed integer overflow is now undefined behaviour. The documented
  guarantee that "integers wrap" is withdrawn (WP15 §3).** `--nsw` is on by
  default: every user-level signed `i32`/`i64` `add`, `sub` and `mul` — binary
  operators, unary minus, `op=` on locals, fields and elements, `++`/`--` —
  carries `nsw`, so a program that overflows one of them has undefined
  behaviour, exactly as in C. LLVM may now widen `i32` induction variables to
  64 bits and strength-reduce the loops around them.

  **A program that relies on wrapping keeps compiling and stops being
  correct.** There are two remedies and no others. Compile it with the new
  **`--wrapping`**, which turns the flag off everywhere and restores
  two's-complement wrapping, so `2147483647 + 1` is `-2147483648` again; or
  write the deliberately-overflowing arithmetic in an unsigned type, because
  `u8`, `u16`, `u32` and `u64` are *defined* to wrap and are the reason those
  types exist.

  Three things this does **not** change: unsigned arithmetic never carries a
  no-wrap flag in either mode (`--nsw` used to put `nuw` on it; it no longer
  does, since `nuw` would withdraw the unsigned wrapping guarantee too),
  division, remainder and shifts are never flagged because they have no such
  form, and `Math.abs(-2147483648)` still wraps to itself because `llvm.abs`
  is emitted with its poison flag off.

  Constant folding follows the emitter rather than diverging from it: by
  default a module constant whose arithmetic leaves its width is
  `` attempt to compute with overflow in a constant `` instead of a silently
  wrapped value — the same treatment `1 / 0` and `MIN / -1` already got in a
  constant — and under `--wrapping` it wraps as before.
  `tests/cases/opt_nsw` pins which operations carry the flag,
  `opt_wrapping` the same program without it, `reject_const_overflow_arith`
  the refused fold and `const_wrap` the folded one under `--wrapping`.

- **Only `export`ed functions are C-ABI symbols: `--strict-exports` is now the
  default (WP15 §3).** Every other top-level function gets `internal` linkage,
  so LLVM may inline it, specialise it for its call sites, or drop it
  altogether — a win on speed *and* on size. The visible consequence is that a
  non-exported function is no longer callable from C and no longer appears in
  `--emit-header`, `--emit-dts` or `--emit-napi`.

  **`--no-strict-exports`** restores the old behaviour
  (`tests/cases/export_no_strict`). A C driver that calls a function the module
  does not export needs either that flag or an `export` on the function; the
  test corpus took the second route, so `tests/driver.c`'s `test()` is now
  `export function test()` in every case that links it, as are
  `tests/cases/add.ts`, `tests/layout/structs.ts`, `examples/add.ts` and
  `examples/strings.ts`.

- `--nsw` and `--strict-exports` are still accepted and now spell out what the
  compiler does anyway, so a build script written before the flip still runs.

- **`--help` answers on stdout and exits 0.** It used to print the usage text
  on stderr and exit 2, which made a request that was answered
  indistinguishable from one that was refused: `amritc --help` counted as a
  failed command, and the text could not be read from stdout at all. It now
  behaves the way clang, tsc and git do. A usage *error* — an unknown flag, a
  missing argument, no inputs — is unchanged: the same text on stderr with exit
  2. The self-hosted compiler mirrored the old behaviour on purpose and moves
  with it, so both answer the same way.

  A script that relied on `--help` failing, or that captured it from stderr,
  needs the obvious edit. `docs/wp12-release.md` has the exit-code table.

### Fixed — soundness

- **The arena's C struct was 16 bytes on wasm32 where the IR says 32, so the
  `wasi` profile handed out wild pointers.** `struct amrit_arena` spelled `off`
  and `cap` as `size_t`, which is the IR's `i64` only on a 64-bit target. Under
  wasm32 they sat at bytes 4 and 8, while the bump allocator every compiled
  function inlines (`%struct.amrit_arena = type { i8*, i64, i64, i8* }`,
  `src/codegen/runtime.ts`) bumped byte 8 and compared byte 16 — past the end
  of a global that was only 16 bytes long. A string-only program survived,
  because `runtime.c` allocates its strings through its own consistent view of
  the struct; anything that built an object or an array in compiled code got a
  pointer from nowhere, and a `new` in a loop trapped. The freestanding `wasm`
  profile was never affected: `runtime/runtime_wasm.c` had the rule right and
  said why. `runtime.c` and `amritc.h` now use `uint64_t` for the same reason,
  all three static-assert the offsets wherever they are compiled, and
  `tests/run.js` compiles the header's layout assertions for the host *and* for
  wasm32 — `-fsyntax-only`, so the guard runs without a WASI sysroot, which is
  what the old host-only check was missing.

- **A duplicate function name is refused whether or not `--strict-exports` is
  in play.** The check used to be skipped under that flag, on the reasoning
  that an `internal` symbol never reaches the linker. It does reach
  `analyzeFunctions`, which keys the whole-program attribute fixpoint by
  `FunctionSig.name`: two functions sharing a name shared one set of facts and
  each was emitted with the other's attributes — a miscompile, not a link
  error. Making the flag the default made it easy to hit; the bootstrap did,
  as an out-of-bounds inside stage1 the moment two modules of `self/` both
  declared a `narrow` (`tests/link/duplicate_internal`).

### Fixed

- **The self-hosted compiler printed no performance warnings at all, and had no
  `--no-warn-performance` (WP19 G1).** stage1 has had the whole of WP15 §8
  since the class landed — the analysis in `self/checker.ts`, the second list
  in the sink, the report in `self/diagnostics.ts` — and its driver never
  printed a word of it, so `build/amritc` compiled a quadratic string loop in
  silence where `amritc` named four warnings.

  It reports them now on stage0's terms and stage0's streams: the human report
  on stderr capped at 20, one flat object per warning on stdout under `--json`,
  in the order the checker found them, exit code untouched.
  `--no-warn-performance` silences both, which is the flag stage0 has had since
  the class shipped and stage1 did not accept at all.

  **No oracle could have caught it, and neither could the corpus half of
  `--parity`**: a performance warning goes to stderr on a compile that
  *succeeds*, and nothing compared that stream on a success. What found it was
  a second half of the parity check that asks each compiler what flags it has,
  by reading its own `--help`, and diffs the two sets — added to
  `tests/self/parity.js` beside the corpus comparison. The same half found
  `--out-dir`.

- **Six programs of the corpus had silently stopped being compared, and
  `self/dump_checked.ts` was dropping a flag it did not know.** A skip in a
  stage1 oracle prints only under `--verbose`, so a corpus file whose `.args`
  names a flag the oracle's `SHARED_FLAGS` set does not list leaves the
  comparison without failing anything. `--wrapping` and `--no-strict-exports`
  had been stage1's since WP14 §7a and were never added to that set, so the
  `--wrapping` cases the WP15 overflow flip brought with it — `const_wrap`,
  `opt_wrapping`, `i64_basic` and `export_no_strict` among them — went straight
  into the skip count. The IR oracle was at seven skips and is back to the one
  documented file (`tests/parser/precedence.ts`).

  `checked_oracle.js` passed only `--number-mode` on the grounds that it is the
  only flag the checker reads, which stopped being true when constant folding
  learned about `--wrapping`: `tests/cases/const_wrap.ts` was refused by stage0
  without it and counted as a skip. It passes both now (`checkerArgs` in
  `tests/self/corpus.js`).

  That last one uncovered a real bug rather than a stale list.
  `self/dump_checked.ts` took any argument it did not recognise as the file
  name, so `--wrapping` became the path, the real path overwrote it, and the
  dump was produced with the flag dropped — stage1 then rejected a fold stage0
  accepted. It takes `--wrapping` now, and refuses an unknown flag instead of
  turning it into a file name.

- **`` `X` expects an argument of type Y, got Z ``: eight uncoded diagnostics
  become one.** The suite pins how many distinct rejection messages carry no
  stable `code`, as a ratchet that may shrink and not grow. The registry is
  derived from the longest literal run between a message's interpolations, and
  `` `${name}` expects ${want}, got ${got} `` has none long enough to name a
  rule — that one template was eight of the nine uncoded messages, and adding a
  builtin adds a ninth, because a new builtin's argument-type message is a new
  distinct message.

  So the message got words of its own, which is what the check's own comment
  says to do instead of editing the table: it reads `expects an argument of
  type string, got i32` now, and that covers `readFileSync`, `mkdirSync`,
  `isDirectorySync`, `spawnSync`, `getenv`, `indexOf`, `f64ToBits`,
  `bitsToF64` and `Arena.release` at once. Coverage goes from 230/239 (96.2 %)
  to **238/239 (99.6 %)** and the pin is now 1. The registry gained one rule,
  `AS2268`, and no existing number moved. The one still uncoded is
  `` Unknown base class `X` (`extends` must name a class declared in this
  module) ``, whose leading run is shorter than the parenthetical that states
  the rule.

- **stage1 accepted a program stage0 rejects: `unwrapOr`'s fallback was
  checked with a contextual type (WP19 G1).** `self/result.ts` threaded the
  success type down as a hint, so in f64 mode `r.unwrapOr(-1)` on a
  `Result<i32, string>` typed the literal as `i32` and compiled, where stage0
  types it `f64` with no context at all and refuses the mismatch.
  `docs/LANGUAGE.md` is normative here and its contextual-literal table is an
  enumerated list that `unwrapOr`'s argument is not in, so stage1 was the side
  in the wrong. Write `toI32(-1)` when the fallback has to be an i32.

  Nothing had ever compiled `tests/cases/res_unwrap.ts` in f64 mode through
  both compilers: every oracle uses the flags a program already carries, and
  that one carries none. `tests/run.js --parity` compiles the corpus across
  the flag variations the suite uses, which is exactly the hole, and this was
  its first find. `reject_res_unwrap_or_f64` pins it.

### Added

- **`web/`: the compiler compiled to wasm, driven from a Web Worker.** `self/`
  is an AmritScript program, so `--profile wasi` links it into one 480 KB
  module (about 140 KB gzipped) that lexes, checks and emits LLVM IR with no
  server involved. `web/wasi.mjs` is a WASI preview1 host over an in-memory
  filesystem, with no imports at all, so the same file runs in a page and under
  Node; `web/worker.mjs` answers one compile per message in a fresh instance;
  `web/compile.mjs` drives it from `node:worker_threads` and `web/index.html`
  is a playground. `tests/run.js` builds the module and checks that the IR it
  emits for `examples/add.ts` is stage0's, byte for byte (skipped without a
  WASI sysroot, like the rest of the `wasi` block).

  It stops at the IR, and that is the design rather than a gap: `amritc` emits
  textual LLVM IR and hands the rest to `clang` and `wasm-ld`, neither of which
  exists in a page. `--link` and `--profile` need `spawnSync`, which WASI
  answers with `-1` — reported as a toolchain failure, exit 3 — and
  `--target host` is refused because `process.platform` is `unknown` there.
  `web/README.md` has the whole list.

- **A plan for true multithreading (WP20, `docs/wp20-threads.md`).** The
  answer to "how does AmritScript do threads, like Go or Rust" turns out to be
  forced rather than chosen: **1:1 OS threads with data races rejected at
  compile time, not goroutines.** Green threads want a relocatable stack and a
  relocatable stack wants a precise GC, which is the one thing the project
  spent first (WP6 puts objects in entry-block `alloca`s and reuses the slot
  across loop iterations on the argument that nothing outside the frame can
  name them); and Go's posture — a race is a bug a runtime detector finds — is
  not available to a compiler whose `readnone`/`readonly`/pointer-parameter
  attributes are proved by a fixpoint that assumes a single mutator, because a
  false attribute there is a silent miscompilation rather than a race report.
  The note prices both the assets and the blocker. The assets are larger than
  expected and are all accidents of other decisions: there is **no mutable
  global state in the language at all** (top-level `let`, static fields and
  top-level statements are each rejected, and a module `const` emits no
  symbol), there are **no closures**, so a thread entry can only be a named
  top-level function and the capture question never arises, and
  `src/codegen/escape.ts` plus the whole-program fixpoint already compute the
  shape of judgment a `Send` rule needs — which is why the design reaches for
  a shareable-type rule rather than a trait system. The blocker is that the
  arena is one process-wide global *and its bump is inlined into the emitted
  IR* (`inlineAllocator`, a non-atomic load/add/store on `@amrit_arena` at
  every allocation site), so two threads allocating race in the IR and not
  merely in `runtime.c`. Five stages follow, of which the first — a
  thread-local arena and RNG behind `--threads`, with no language surface —
  is a prerequisite for every version of the design and is gated on
  BENCHMARKS.md rather than on argument. Channels wait for monomorphisation
  (WP15 item 8); detached threads, wasm threads, atomics and a race detector
  are named as out of scope and why. It is a plan, not an implementation:
  nothing in the compiler changed.

- **`--emit-ast` is no longer stage0's: the self-hosted compiler answers it too
  (WP19 R1).** It was the last flag refused by name, and the refusal was right
  about the reason and wrong about the conclusion. stage0's dump prints the
  `typescript` package's node names and 1-based `line:col` spans; mirroring
  those inside the self-hosted compiler would have been imitation, not parity.
  So both compilers answer the flag and **each dumps its own tree**: stage1
  prints the flattened vocabulary `self/nodes.ts` defines, with byte offsets,
  one `SOURCE_FILE <path>` header per module in the same order stage0 prints
  its `SourceFile <path>` headers.

  There is therefore no oracle between the two dumps — there is a golden per
  compiler, over the same input file: `tests/cases/dump_ast.stdout` for stage0
  and the new `tests/self/dump_ast.golden` for stage1.

  The printer moved to **`self/ast_text.ts`**, shared by `self/compile.ts` and
  `self/dump_ast.ts`, which is the arrangement `self/dump.ts` already had for
  `--emit-checked`: the flag and the parser oracle print through one function
  and cannot drift into two spellings of one tree. `dump_ast.ts`'s own output
  is unchanged to the byte, because `tests/parser_oracle.js` compares against
  it.

- **`getenv(name: string): string | null`, the language's one environment read
  (WP19 R1).** The first of the six retirement gates asks that no flag and no
  program be stage0's alone, and reading the environment was the last thing
  only stage0 could do: its `--link` preflight checks the compiler named by
  `CC` before it spawns `scripts/build.sh`, and stage1 had no way to ask what
  `CC` was. Both compilers now answer it, with the same IR — one
  `call i8* @amrit_getenv(i8* name)`, `noalias` because every call answers a
  fresh arena copy, and `readnone` on neither, because it allocates and the
  environment is not memory LLVM tracks.

  **`null` and `""` are different answers.** An unset variable is `null`; one
  set to nothing (`CC=`) is a zero-length string. A driver acts on that
  difference — unset means "use the default" — which is why the result is
  `string | null` and narrows with `!== null` like every other nullable, and
  why the builtin takes no second "default" argument: `cc === null ? "clang" :
  cc` already says it.

  It is a **call and not `process.env.CC`**: member access on a key chosen at
  runtime is what Phase 0 forbids, so the two `process.*` surfaces the language
  has stay what they were, fixed names with no key. There is no `setenv`
  either; a program reads its own environment and passes one on through
  `spawnSync`, and that is all. `runtime/shim.mjs` answers
  `process.env[name] ?? null` for the differential runs, since Node has an
  `undefined` where the language has only `null`.

  New: `tests/cases/<name>.env`, one `NAME=value` per line, read by both
  `tests/run.js` and `tests/differential/lib.js`. A case that calls `getenv`
  cannot pin its own answer, and a golden that read the developer's
  environment would not be a golden. `io_getenv` pins all three answers;
  `reject_getenv_arity` pins the refusal of a second "default" argument and
  `reject_getenv_unchecked` the one that matters — the result is `string |
  null` and has to be narrowed before it is used.

- **`runtime/amritscript.mjs`: run a program under Node with nothing rewritten
  (`docs/RUN_UNDER_NODE.md`).** WP13's rewriter is exact because it loads a
  program through the compiler's own checker and rewrites every expression from
  the recorded types; it is a testing oracle, not something to hand anyone. This
  is the smaller claim beside it: `node --experimental-strip-types --import
  ./runtime/amritscript.mjs prog.ts` runs the source as the TypeScript it is,
  with the prelude supplying only what Node lacks — `console.log`'s formatting,
  the file and stream globals, the conversions, `Ok`/`Err`, `parseInt` /
  `parseFloat`, `process.argv`'s indexing, and an `Arena` that answers zero.
  Everything delegates to `runtime/shim.mjs`, so the two cannot drift.

  It is honest in **f64 mode**, where JavaScript's `+ - * / %` on doubles *are*
  `fadd/fsub/fmul/fdiv/frem`, and it will never be honest in i32 mode, where
  `number` wraps at 32 bits and every operator differs. The doc states the whole
  overlap: byte-length `.length`, unchecked `a[i]`, virtual dispatch,
  `orReturn()` (which needs the caller's control flow and so needs the
  rewriter), `Number(s)`, and the three float decisions. Each one lives in an
  operator or the object model, where a prelude cannot reach.

  `tests/differential/unmodified.js` pins it: every f64-mode program with an
  entry point, native against unmodified Node, four listed divergences and any
  other difference failing the run — 6 of 10 agree today, and the four that do
  not are the programs written to probe exactly those decisions. An ordinary
  program does not look like them: `examples/nbody.ts` prints byte-identical
  output either way. Wired into the WP13 block of `tests/run.js` and available
  as `npm run test:node`.

- **`readonly` on an interface field has a test** (`reject_cls_readonly_interface`).
  It has worked since interfaces and classes started sharing `collectField`, and
  `LANGUAGE.md` documented it as *(CLI only)* — an implemented rule with nothing
  pinning it, which is how the `panic` hole in the ambient declarations survived
  too.

- **`readonly T[]` and `ReadonlyArray<T>`: an array a callee may read and not
  write.** The same header, the same pointer, the same LLVM type — the cookbook
  entry is the same function under both spellings and the two bodies are
  identical instruction for instruction, because the annotation is a promise
  the checker keeps rather than a value the emitter lowers. A `T[]` widens into
  one at any sink and never back (`reject_arr_readonly_widen`), stores, `push`
  and `pop` through one are refused under their own names
  (`reject_arr_readonly_store`, `_push`, `_pop`), and it is shallow, as
  TypeScript's is. It is a type and not a parameter modifier, so it is legal
  wherever an array type is — a field, a return type, a `const`'s annotation —
  and the rule travels with it (`arr_readonly_field`).

  The reason to write one is the C ABI. `--emit-header` already spelled an
  array parameter `const amrit_array *` when the whole-program fixpoint proved
  nothing stored through it, which makes `const` a consequence that can
  disappear when a callee three levels down starts writing; on a `readonly T[]`
  it is the signature keeping a promise, and the comment above the prototype
  shows the annotation that earned it. The fixpoint is not consulted for one:
  `writesThrough` is a conservative *may-write* that every escape sets, so a
  `readonly` parameter which is only returned or stored in a field would
  otherwise lose the `const` it was promised (`arr_readonly_escape`).

  The spelling was not a choice. TypeScript allows `readonly` on array and
  tuple types and nothing else (TS1354), so `readonly Point` — the struct
  parameter that would have been the other half of this — is not TypeScript and
  was left out rather than invented; `readonly i32` names that rule
  (`reject_arr_readonly_scalar`) instead of reading as a gap. Both compilers
  landed together and `IR(stage0) == IR(stage1) == IR(stage2)` still holds over
  the whole corpus.

- **Stable diagnostic codes in `--json` (`code`).** The field was reserved and
  empty; it now carries a stable identifier for the rule that was broken —
  `AS1013` for `` `any` is forbidden ``, `AS2231` for a mismatched operator —
  and it, not the prose, is what a tool should key on: `message` is allowed to
  improve between releases and the code is not. The band says which phase
  refused the program: `AS1xxx` Phase 0, `AS2xxx` the checker, `AS3xxx` the
  driver, `AS4xxx` the interop sidecars, `AS9xxx` a WP15 §8 performance
  warning, and `AS0001`–`AS0003` a syntax error, an unusable C toolchain and an
  internal compiler error. `AS0000` means the message has no rule yet.

  The registry is one table in two files, `src/codes.ts` and its stage1 twin
  `self/codes.ts`, generated from the compiler's own diagnostic sites by
  `scripts/gen-diagnostic-codes.mjs`; a diagnostic added without a code fails
  `npm test` rather than shipping uncoded. The generator only ever appends
  numbers, so a code means the same rule next release, and a retired rule keeps
  its number reserved. 221 of the 229 distinct messages the suite exercises
  carry one; the remaining eight are built entirely out of interpolations and
  are pinned as a backlog that may shrink but not grow.

  Codes are in `--json` only. The human summary line is byte-for-byte what it
  was, because the `.err` goldens and `tests/self/reject_oracle.js` match on it.

- **Every `--json` failure is a JSON object, including the ones with no source
  position.** An unusable C toolchain (exit 3) and an internal compiler error
  (exit 70) used to print prose on stderr and nothing on stdout, so a tool that
  asked for JSON was left with an empty stream and an exit code to guess about.
  Both now print `{"severity","code","message"}` on stdout as well; the human
  report still goes to stderr for the internal error, because a crash is worth
  seeing twice.

- **`npm test` reports how many checks were skipped, and says when that
  matters.** The summary is `N passed, M failed, K skipped`, and a run that
  skipped anything because LLVM 18 was missing ends with a `DEGRADED:` banner
  naming the tools it could not find. Without the toolchain the assembly,
  native round-trip, linking, interop, self-hosting and differential checks
  skip rather than fail, so `N passed, 0 failed` looked identical whether it
  had proved everything or almost nothing. It no longer does.

- **A `SessionStart` hook and settings for AI coding agents
  (`.claude/settings.json`, `.claude/hooks/session-start.sh`).** A fresh
  container gets the same six LLVM 18 binaries CI installs, so an agent's
  `npm test` means what it means on a developer machine, and the repository's
  standard commands are pre-allowed. `AGENTS.md` gains the table of
  machine-readable surfaces — `--help`, `--json` and its schema, the exit
  codes, the skip count — with the contracts each one has a test for.

- **The `performance` diagnostic class, with its first two warnings (WP15
  §8).** The compiler now says something when it had to take a slow path and
  a faster one was available. A warning is the same anchored, excerpted
  diagnostic an error is, with `performance` where the word `error` would be
  (`file:line:col: performance: <text>`), so nothing that greps `: error: `
  picks one up; in `--json` it carries `"severity":"performance"`, the field a
  tool filters on. Warnings are **on by default**, print on stderr, and
  **never change the exit code** — a program that trips one still compiles and
  still exits 0. A compilation that failed prints its errors and none of its
  warnings, so no error report is diluted with advice about code that is about
  to change; more than one warning is capped at 20 like the error report, with
  `...and N more performance warnings` and an `N performance warnings` line.
  `--no-warn-performance` silences the class and changes nothing else: the IR
  is byte-identical either way, because the flag never reaches
  `CompilerOptions` and only the driver reads it. Both compilers print the
  same bytes.

  The two warnings, each of which names the rewrite in the user's own terms,
  because a warning nobody can act on trains people to ignore the whole class:

  - **quadratic string building** — `s = <something built from s>`, through
    `+` operands or a template hole, where `s` is a string local declared
    outside the loop the assignment sits in. Every pass copies the whole
    accumulator, which §1 measures at 180 MB of peak RSS for 88 KB of output;
    the hint is a `string[]` and one `join`.
  - **allocation in a loop** — a `new Array<T>(n)` with a non-constant `n`
    declared inside a loop whose value never leaves the iteration. A
    dynamically sized array can never be an entry-block alloca, so the arena
    grows once per pass and is only released when the function returns; the
    hint is to hoist it above the loop or bracket the loop body with
    `Arena.mark()` / `Arena.release(m)`.

  The analysis is a per-function pass in the checker after the body is checked
  (`src/checker/performance.ts`, and the WP15 section of `self/checker.ts`):
  both facts are syntax plus the types and bindings pass 2 already wrote, and
  the emitter may not report user-facing diagnostics at all. The guards are the
  point of the design — everything WP6's escape analysis already handles stays
  silent, so a `new C(...)`, an object or array literal and a
  `new Array<T>(<literal>)` in a loop are never reported (each is one
  entry-block alloca whose slot is reused every pass), nor is an allocation
  that is pushed, stored, returned or passed on, nor a concatenation in a loop
  that does not accumulate into its own target. `tests/cases/perf_*` covers
  both halves and the `WP15 §8` block of `tests/run.js` pins the exact text,
  the flag, the `--json` shape and the cap.

  Run over the corpus, the warnings found one real bug: `self/lexer.ts` builds
  the text of a string and of a template literal one character at a time with
  `text = text + ...` inside a `while` loop, the shape `.claude/selfhost.md`
  forbids in `self/`. It is reported rather than fixed here; the fix is a
  `StringBuilder`, as the rest of `self/` already uses.

- **A caller reclaims the arena around a string-returning call (WP9, closing
  the remaining item of the WP6 note in `docs/wp9-optimisation.md`).** A
  function that returns a string can never have an automatic arena scope: the
  string it hands back has to outlive it, so every intermediate it built lives
  as long as the program. That is what made `bench/strbuild` touch 48 MB of
  fresh pages to produce an 806 KB string. The caller is in a better position,
  and for a reason that has nothing to do with how the value is used — a call
  hands back exactly one value, so everything else the callee bumped is
  unreachable the moment it returns. Calls now compile to

  ```llvm
  %mark = call i64 @amrit_arena_mark()
  %t    = call i8* @join(i32 %lo, i32 %hi)
  %kept = call i8* @amrit_arena_keep(i64 %mark, i8* %t)
  ```

  with `%kept` used everywhere `%t` would have been. **Peak resident set for
  `bench/strbuild` falls from 48,676 KB to 16,420 KB** and its peak live arena
  from 51.5 MB to 15.2 MB, for the same output and the same bytes bumped.

  The bracket is emitted only when the callee returns a plain `string`, bumps
  the arena at all, never touches `Arena.reset` / `Arena.release`, and — the
  fact that needed building — never lets an allocation out of its frame other
  than through its return value. `src/codegen/escape.ts` grew that fact,
  `allocEscapes`, by refining what `allocLeaks` already knew: `leaks` merges a
  value stored where the *caller* can reach it with one merely assigned to a
  local of the frame (`s = s + piece(i)`, the shape of every string builder),
  and only the first is a reason not to reclaim. Every `Outcome` now carries an
  `escapes` bit computed in the same walk from the same `classifyUse`, and it
  propagates over the call graph in the same fixpoint; `allocEscapes` implies
  `allocLeaks` and never the reverse, and `flow` is untouched, so the stack
  rule and the automatic scopes decide exactly what they decided before.

  The runtime gains `amrit_arena_keep(mark, p)`: it releases back to `mark`
  while preserving the newest block, either by moving it down onto the mark and
  freeing every newer chunk, or — when the mark sat at the end of a chunk the
  callee filled exactly — by leaving it where it is and unlinking the chunks
  between. Only a `string` may be kept, because only a string is one flat block
  with no interior pointers; an array header names a separate data block and a
  `Result` names its payload, so neither is ever moved. Anything the guards
  cannot prove — a block that is not the arena's newest, a stale mark, a mark
  newer than the block — answers the pointer unchanged, which reclaims less and
  is always safe. `.text` in `runtime/runtime.c` goes from 2,561 to **2,775**
  bytes at `-Oz` against the 4,096 budget.

  `tests/cases/mem_reclaim_call.ts` is strbuild in miniature,
  `mem_reclaim_argument.ts` shows the temporary being passed on and held across
  a later call, `mem_reclaim_no_stack_alloc.ts` shows `--no-stack-alloc` moving
  allocations without moving a bracket, and `mem_reclaim_guards.ts` is the
  negative half: four calls of which exactly one is bracketed, the other three
  refused for storing into the caller's object, for `Arena.reset`, and for
  returning a `Result<string, number>`. `tests/runtime_test.c` covers both
  outcomes of `amrit_arena_keep` and its three refusals. Both compilers emit
  the bracket identically and the bootstrap still reaches its fixed point;
  `self/` is itself a heavy string builder, so its own IR carries it too.

- **A plan for retiring stage0 rather than freezing it (WP19,
  `docs/wp19-stage0-retirement.md`).** WP14 §6 decided that stage0 stays
  buildable as the bootstrap seed and the differential oracle but is not kept
  up to date; this is the document for the day that freeze becomes a deletion,
  and it is a checklist rather than a schedule. It takes the arrangement rustc
  and Go both reached — the seed is the previous release of the compiler
  itself, not a second implementation — and prices it: the four things stage0
  still owns beyond compiling (the twelve oracles, six of which die with it;
  the npm package and the `--version` source; the four flags and exit codes of
  §7a; and `IR(stage0, self/) == IR(stage1, self/)`, the diverse-double-compiling
  property no project in its comparison table asserts), the six gates that must
  close before any of it is deleted, and the four builtins those gates need —
  `process.platform`/`process.arch` and `isDirectorySync`, which WP18 lands
  alongside the generics work and which close two of §7a's four rows, plus
  `getenv` and `panicInternal`, which are this package's — each of them in
  stage0 first, because the seed has to be able to compile the compiler that
  replaces it. It also records what
  retirement costs and the honest trigger for doing it: a release cycle in
  which stage0 found nothing, changed nothing and shipped nothing but itself.

- **The self-hosted compiler links its own output; `scripts/amritc.sh` is
  gone (WP14, reversing §3a D4).** `amritc self/compile.ts --link amritc`
  now produces a compiler byte-identical to the one that ran it, with no shell
  script between them. D4 had dropped `--link`, `--profile` and directory
  creation from stage1 on the grounds that they would mean `spawnSync` and
  `mkdirSync` builtins and runtime growth; it was right about the order of the
  work and wrong about the end state, because a compiler that cannot produce an
  executable on its own is self-hosting in the IR and not in the artifact.

  Two builtins, each landed in `src/` first with its golden, its native round
  trip, two negatives, its `docs/LANGUAGE.md` rule and its cookbook entry:
  `mkdirSync(path: string): boolean` makes one directory and answers whether a
  directory is there afterwards (the retry is a `stat`, not `errno == EEXIST`,
  so a plain file at the path answers false), and `spawnSync(argv: string[]):
  number` runs `argv[0]` through `PATH`, waits, and answers the exit status —
  `128 + n` for a signal, `-1` for an empty vector or a program that would not
  start. Both answer a value rather than exiting, for the reason
  `readFileSyncOrNull` answers `null`: there are no exceptions, so the caller
  owns the diagnostic. `spawnSync` is the first builtin whose pointer argument
  the runtime keeps — `amrit_spawn` copies each element's bytes pointer into an
  arena vector that outlives the call — so `classifyUse` reports an escape for
  it and the declaration carries no `nocapture`, and the first that is not
  `willreturn`, because the child may never exit and `waitpid` waits.

  With them, `self/compile.ts` answers `-o <file.ll>`, `-o <dir>/`, `--link
  <exe>` (`<exe>.ll` for one module, `<exe>.modules/` for a program with
  imports) and `--profile speed|size|debug|wasi`, validated before anything is
  compiled; it makes every directory in the way of the IR, a sidecar or the
  binary; it writes `<module>.ll` beside each source when nothing is named,
  which is stage0's default and replaces stage1's older "one module to stdout";
  and it refuses `--link` on a program with no `export function main` before
  the emit rather than leaving it to the linker. It finds `scripts/build.sh`
  and `runtime/runtime.c` from the path it was invoked by, falling back to the
  working directory, and names both when neither has them. `--emit-ast` is
  refused by name by the compiler itself now. Nothing about the host platform
  came in with any of this: the `uname -s`, the profile flag sets and the wasi
  sysroot search are in `scripts/build.sh`, where they always were, for both
  compilers alike.

  The bill is **257 bytes of `.text`** (2,287 to 2,544 at `-Oz`), and a program
  that calls neither pays none of it: `examples/hello.ts` at the `size` profile
  is 4,696 bytes with these two functions in the runtime and 4,696 bytes
  without, because `-ffunction-sections -Wl,--gc-sections` drops both. The
  runtime budget in `docs/MASTER_PLAN.md` §2 is restated to measure `.text`
  rather than the `text` column of `size`, which counts the `.eh_frame` entries
  the `size` profile strips, and rather than source bytes, which have been over
  since WP4 because comments are not code.

  `scripts/bootstrap.sh` runs on it: every stage is one `--link` by the stage
  before it, where stages 2 and 3 used to be compiled with `--out-dir` and then
  linked by the script itself, and the three equalities read the
  `<exe>.modules/` directory `--link` already writes. The chain that proves the
  fixed point is now the same command a user runs.

  Both builtins are in the WP13 differential comparison like every other one:
  `runtime/shim.mjs` implements them for the Node side — `mkdirSync` decides
  with `statSync` rather than with the exception Node throws, so it answers
  where the runtime answers — and `tests/differential/rewrite.js` knows their
  names. Without that the two new goldens ran natively and failed under Node,
  which is the shape of every builtin that was ever added and forgotten there.

- **Three of the four things stage1 still left to stage0 are closed (WP14
  §7a).** Each of the new constructs entered the language and `src/` first,
  with a golden `.ll`, a native round trip, negatives, a `docs/LANGUAGE.md`
  rule and a cookbook entry, and only then `self/`:

  - `process.platform` and `process.arch` (`io_host`;
    `reject_platform_assign`, `reject_arch_call`) answer what machine the
    *program* runs on, spelled as Node spells it: `"linux"` / `"darwin"` and
    `"x64"` / `"arm64"`, and `"unknown"` for anything this compiler has no
    triple for. Each is one call that answers the address of a string in the
    runtime's own constant data — settled when `runtime.c` was compiled, so a
    cross build reports the target — which means nothing is allocated and
    nothing is loaded, the declarations carry `readnone willreturn`, and two
    reads in one function fold into one. Not `noalias`: every call answers the
    same pointer. With them `self/target.ts` composes the host triple exactly
    as `src/codegen/target.ts` does, so **`--target host` is stage1's** and the
    two compilers emit the same module for it.
  - `isDirectorySync(path: string): boolean` (`io_is_directory`;
    `reject_is_directory_arity`, `reject_is_directory_type`) is one `stat`
    answering the one question `-o <dir>` asks of a path, and a value rather
    than an exit for the reason `mkdirSync` and `readFileSyncOrNull` answer
    values. `amrit_mkdir` is rewritten to call it, so the `stat` exists once.
    With it **`-o <dir>` without the trailing slash** names an existing
    directory in stage1, as it always has in stage0.
  - **An internal compiler error in stage1 exits 70** (`EX_SOFTWARE`) with
    stage0's report, where a broken invariant used to reach `panic(msg)` and
    exit 1. This needed *no* language change, which is why it was chosen over
    the second `panic` §7a also costed: `process.exit(n)` already means "this
    code, now", so the status one program wants for its own bugs is not the
    language's business, and the report's wording is the compiler's policy
    rather than a builtin's. `self/ice.ts` holds it and answers the status, so
    every one of the 28 sites is the single statement
    `process.exit(internalError("..."))` — a pair could be half-written and
    this cannot. stage1 names `AMRITC_DEBUG` and says there is nothing behind
    it here rather than promising a stack trace: with no exceptions the report
    is made at the site, so there is no stack to unwind and no `process.argv`
    to read either. Seven sites in `self/emit_ops.ts` and
    `self/interop_napi.ts` still exit 1.

  `.text` in `runtime/runtime.c` goes from 2,544 to **2,561** bytes at `-Oz`
  against the 4,096 budget: eight bytes each for `amrit_platform` and
  `amrit_arch`, exactly as §7a costed them, and one byte net for
  `amrit_is_dir`. `runtime/shim.mjs` and `tests/differential/rewrite.js` know
  all three, so the new goldens are in the WP13 comparison like every other
  builtin, and `runtime/amritc.d.ts` declares them — along with `mkdirSync` and
  `spawnSync`, which it had never been told about, so an editor typed them as
  unknown names. `--emit-ast` is the one thing that stays stage0's, by design.

### Changed

- **`--out-dir` is gone from the self-hosted compiler; `-o <dir>/` is the one
  spelling (WP19 G1).** It was stage1's own flag, added when
  `scripts/bootstrap.sh` drove the stages and kept afterwards because the
  oracles passed it. stage0 has never had it, so it was a difference in the
  flag sets in the direction nobody checks — a flag a user could come to
  depend on that the one remaining compiler would then have to keep forever.

  `-o <dir>/` did the same thing already, with the same directory-making and
  the same per-module stems, so the removal costs nothing: `tests/self/`'s IR,
  interop and bootstrap oracles pass `-o <dir>/` to both compilers now instead
  of one spelling each, which is what the parity check of G1 wants of them
  anyway.

- **The package is ES modules, and the Node floor is 22.18.** `"type":
  "commonjs"` had been there since the first commit — the `tsc` default of 2019,
  never a decision anyone made — and it had started to cost something real. An
  in-tree `.ts` was read as CommonJS, so `export function main` was a syntax
  error before type stripping ran, and
  `node --experimental-strip-types examples/nbody.ts` failed in the directory
  the examples live in. A compiler whose own repository could not run its own
  example programs in place, for a language that has `import`/`export` and no
  CommonJS at all.

  `tsconfig.json` emits `module: Node16`, so every relative import in `src/`
  carries its `.js` extension — 294 of them across 55 files, which `tsc`
  enumerates exactly (TS2835) rather than leaving to a grep. `__dirname` in
  `version.ts` is `import.meta.dirname`. The 18 files of `tests/` and
  `scripts/` are ESM too: `require` became `import`, the oracles' synchronous
  reads out of `dist/` became top-level `await import(...)` of a file URL, and
  `require.main === module` became a comparison against `import.meta.url`. The
  one `require` left is a deliberate `createRequire` in `tests/run.js`, because
  `require.resolve("typescript/bin/tsc")` has no ESM spelling.

  The floor moves from 18 to 22.18 — the version where Node strips types with
  no flag, which is what makes `docs/RUN_UNDER_NODE.md` something to point
  people at rather than a footnote about `.mts`. CI already ran 22.
  `tests/differential/unmodified.js` no longer copies each program into a
  scratch directory to escape the package's own module system; it runs them
  where they are.

  Nothing in the repository consumed `amritc` as a library, but `require("amritc")`
  is now an ESM entry point rather than a CommonJS one; the product is the CLI
  and the `bin` is unchanged. `runtime/shim.mjs`, `runtime/amritscript.mjs` and
  `bench/` keep their `.mjs` extensions, which now say "loaded by something
  else" rather than "the exception to the package".

- **`test (macos-latest)` is commented out of the CI matrix.** It is not a
  compiler failure and not an architecture one: `scripts/build.sh` runs under
  `set -euo pipefail`, and macOS ships bash 3.2 as `/bin/bash`, where expanding
  an empty array as `"${arr[@]}"` with `set -u` on raises *unbound variable*.
  bash 4.4 made that legal, so every Linux runner passes and every macOS one
  dies at `scripts/build.sh: line 96: pgo[@]: unbound variable` — `pgo`, `elf`,
  `strip_flag` and `libs` are all legitimately empty on the ordinary macOS
  path, so every `--link` at the `speed`, `size` and `napi` profiles fails
  before clang is reached. The matrix entry is commented rather than deleted
  and carries the fix beside it (`${arr[@]+"${arr[@]}"}` at the nine sites);
  `docs/wp10-ci.md` says what the gap costs, which is the ld64 / Mach-O half of
  `build.sh` that no Linux runner exercises at any architecture.

### Fixed

- **Six programs of the corpus had silently stopped being compared, and
  `self/dump_checked.ts` was dropping a flag it did not know (WP19 G1).** A
  skip in a stage1 oracle prints only under `--verbose`, so a corpus file whose
  `.args` names a flag the oracle's `SHARED_FLAGS` set does not list leaves the
  comparison without failing anything. `--wrapping` and `--no-strict-exports`
  had been stage1's since WP14 §7a and were never added to that set, so the
  `--wrapping` cases the WP15 overflow flip brought with it — `const_wrap`,
  `opt_wrapping`, `i64_basic` and `export_no_strict` among them — went straight
  into the skip count. The IR oracle was at seven skips and is back to the one
  documented file (`tests/parser/precedence.ts`); it compares 318 programs
  where it compared 312.

  `checked_oracle.js` passed only `--number-mode` on the grounds that it is the
  only flag the checker reads, which stopped being true when constant folding
  learned about `--wrapping`: `tests/cases/const_wrap.ts` was refused by stage0
  without it and counted as a skip. It passes both flags now (`checkerArgs` in
  `tests/self/corpus.js`) and compares 308 whole programs.

  That last one uncovered a real bug rather than a stale list.
  `self/dump_checked.ts` took any argument it did not recognise as the file
  name, so `--wrapping` became the path, the real path overwrote it, and the
  dump was produced with the flag dropped — stage1 then rejected a fold stage0
  accepted. It takes `--wrapping` now, and refuses an unknown flag instead of
  turning it into a file name.

- **`self/lexer.ts` no longer builds a literal one byte at a time (WP14
  §2.3).** The `performance` class above found it in the compiler's own
  source, and it was a true positive: `scanString` and `scanTemplate` both did
  `text = text + <one byte>` inside their scan loop, so every byte of every
  string and template literal copied the whole accumulator into a fresh arena
  string — quadratic in time and in arena bytes, in the loop that reads every
  file the compiler compiles. Both scans now keep a `chunk` cursor and move
  whole runs: an escape flushes the run before it and the terminator flushes
  the rest, so a literal with no escape in it — nearly every one — costs
  exactly one `substring` of its whole span and never touches a builder at
  all. The escape path shares one `StringBuilder`, held by the lexer and reset
  per literal rather than allocated per literal, through the two helpers
  (`takeEscape`, `literalText`) the two scans now have in common.

  Nothing the lexer *produces* changed: the token streams of 678 files agree
  byte for byte with the old lexer's, the malformed ones included, and
  `tests/lexer_oracle.js` still agrees with the `typescript` scanner over
  588 files and 176,304 tokens. stage1 compiling the whole of `self/` goes
  from **131.8 MB of peak RSS to 128.9 MB** (about 226 ms to 214 ms, on a
  shared machine, so the memory is the number to trust). On a source whose
  literals are long rather than short the quadratic shows its real shape:
  400 KB of literal text cost **408 MB and 392 ms** to lex and now cost
  **2.4 MB and 10 ms**.

- **`--emit-napi` bridges `u8`, `u16`, `u32`, `u64` and `f32` instead of
  dropping the function that mentions one (WP8).** The shim kept its own
  reader and boxer tables, and they had rows for `i32`, `f64`, `bool` and
  `i64` only, so a signature carrying any other width fell out of `plan()` and
  the addon simply did not export it — a `Result<f32, u8>` included, since its
  arms go through the same tables. Each width now has both halves. On the way
  in, `napi_get_value_uint32` reads the unsigned ones and `u8` / `u16` take the
  width's own modulus from it, which is the conversion JavaScript itself
  performs storing a number into a typed array: 300 reaches a `u8` as 44, `-1`
  reaches a `u32` as 4294967295, and nothing throws, matching the `i32` reader
  that has always applied ToInt32. `f32` is read as a double and converted by a
  generated `amrit_napi_f32`, because C leaves a double-to-float conversion
  undefined out of range: anything at or past `0x1.ffffffp127` becomes an
  infinity of that sign, where round-to-nearest-even sends it. On the way out
  `napi_create_uint32` keeps a `u32` above 2^31 positive, an `f32`
  widens to a double exactly, and `u64` crosses as a bigint like `i64`. A
  packed `Result` narrows each arm through its own temporary.

  And the reason the hole survived: a function the shim cannot carry was
  omitted under one fixed sentence that named neither the function's types nor
  the position that stopped it. It is now named with both — `not bridged:
  parameter 1 (p) is Point`, `not bridged: it returns Result<number, IoError>`
  — under a heading listing what does cross, so the next gap reads as a gap.
  `tests/self/interop_widths.ts` is built into a real addon and called by
  `tests/run.js` at every boundary; `self/interop_napi.ts` carries the same
  change and `tests/self/interop_oracle.js` compares the two shims byte for
  byte. Bare unsigned widths still do not cross the *wasm* loader, which is
  now written down in `docs/wp8-interop.md` rather than left to be discovered.

- **`&= |= ^= <<= >>= >>>=` reach a field and an element.** `this.flags |= MASK`
  and `xs[i] &= 0xff` used to be refused (`` Unsupported assignment operator
  `|=` `` for a field, `Only simple variables can be assigned` for an element)
  while the arithmetic compound operators had taken both targets since WP2 and
  WP4. There was nothing behind the refusal but a missing row: the lowering is
  the one `+=` already had — address the target once, load, apply one
  instruction, store — so the three targets now share one operand rule
  (`checkBitwiseAssignOperands`) and one apply step (`emitBitwiseCombine`), in
  both compilers. That sharing is what makes the guarantees hold everywhere at
  once: the shift count is masked to the operand width on a field and an element
  exactly as on a local (`f.bits <<= 33` is a shift by one), `>>` still reads the
  target's signedness (`ashr` on `i32`, `lshr` on a `u32`, where `>>>` is always
  `lshr`), and the target expression is evaluated exactly once — one call and one
  bounds check for `a[next()] |= 1`, because the check and the `getelementptr`
  happen once and the load and the store share the address.

  `readonly` is unaffected: a compound assignment is a write, so `this.mask |=
  bit` is refused for an inherited `readonly` field like any other write
  (`reject_cls_field_bitwise_readonly`), and the operand rule is still `&`'s, so
  an `f64` element is refused naming the compound token
  (`reject_arr_element_bitwise_f64`). Those two cases are the repointed
  `reject_cls_field_bitwise_assign` and `reject_arr_element_bitwise_assign`,
  which described behaviour that is now legal. New: `cls_field_bitwise_assign`,
  `arr_element_bitwise_assign` (whose `.out` proves the single evaluation),
  `tests/differential/corpus/bit_compound_target`, and the
  `expr_compound_target` cookbook entry.

### Fixed

- **An element assignment reported its type errors through a synthesised node.**
  `installArrayAssignmentCheckers` handed `checkElementAssignment` a spread copy
  of the binary expression so that the parentheses around `(a[i]) += v` were
  already peeled; a spread copy is a plain object with no `getStart`, so the
  moment that handler reported on the expression itself — a compound assignment
  whose operands disagree — the compiler died with exit 70 instead of printing
  the error. The unwrapped target is passed alongside the real node now, and
  `reject_arr_element_bitwise_f64` is the case that would have caught it.

- **`--emit-dts` no longer declares a wasm export its loader omits (WP8/WP15).**
  The declarations and the loader each had their own idea of what crosses the
  wasm boundary, and they drifted: `wasmType` spelled `u8`/`u16`/`u32` as
  `number` and `u64` as `bigint`, so the `.d.ts` declared such a function,
  while the loader's crossing test had never learnt the unsigned widths and
  wrote no entry for it. `load()` handed back an object missing a function its
  own typings promised — a `TypeError` at the call with no diagnostic
  anywhere, reproducible today with `port(p: u16)`. There is one predicate
  now, `wasmSkipReason`, and both files ask it; a function that cannot cross
  is a comment naming the position and the type that stopped it —
  `` argument 2 (a) is `string` `` — rather than the blanket sentence it was.

  The unsigned widths cross for real, which needs the loader to put each value
  back in its range: the wasm ABI has only `i32`/`i64`/`f32`/`f64`, so `u8`,
  `u16` and `u32` share a value type with `i32` and `u64` shares one with
  `i64`. A `u32` result above 2^31 was reaching JavaScript *negative*
  (`idU32(4294967295)` as `-1`) and a `u64` above 2^63 as a negative bigint;
  both are read unsigned now (`>>> 0`, `BigInt.asUintN(64, x)`). A `u8` or
  `u16` result is masked because the callee does not narrow it — `add i8` is
  congruent modulo 256, so the wasm backend adds in a 32-bit register and
  `addU8(200, 100)` answered 300 — and a narrow *argument* is masked because
  the emitter writes the parameter as a bare `i8` with no `zeroext`, which
  leaves zero-extending it the caller's job under the wasm C ABI. The
  spellings are `runtime/shim.mjs`'s, so the wasm build and the differential
  rewrite agree on what a `u32` above 2^31 is. `f32` needs nothing in either
  direction and now says so. Both compilers changed together
  (`src/interop/{wasm,dts}.ts`, `self/interop_{wasm,dts}.ts`);
  `tests/self/interop_unsigned.ts` is the new corpus fixture, built to wasm
  and called at every boundary by the WP8 section of `tests/run.js`, which
  also checks that every function a `.d.ts` declares has an entry in its
  `.mjs`.

- **The ambient declarations now say that `panic` and `process.exit` do not
  return.**
  `runtime/amritc.d.ts` claims one direction — a program `amritc` accepts is
  never one `tsc` refuses — and it was wrong about that in 68 places in `self/`
  alone. Both terminators were typed `void`, so `tsc` saw a function ending in
  `panic(...)` as one that falls off its end, and saw nothing at all in
  `if (x === null) { panic(...); }`, which is the guard `self/` writes wherever
  another language would assert: 16 missing-return errors and some 40 spurious
  `possibly null` ones, from one word. They are `never` now, which is how
  TypeScript spells a terminator. With those two words, `tsc --strict` accepts all 54 modules of the
  self-hosted compiler bar one call, and 151 of the 153 accepted cases.

- **The claim is now tested on the whole language rather than on `Result`.**
  The WP16 block type-checked the `res_*` cases against the declarations, which
  is why the holes above survived: nothing in that surface panics. It checks
  every accepted case and every `self/` module now, with the divergences named
  rather than tolerated — the typed-array aliases and the implicit `super()` on
  the case side, and `a.pop()` being `T` here and `T | undefined` in
  `lib.es5.d.ts` on the `self/` side. All three are recorded in the file's own
  foot-note section; a fourth diagnostic is a hole in the declarations and
  fails the run.

- **A builtin's argument is checked down to its element type.**
  `checkArgumentType` compared type *kinds*, which was enough while every
  builtin wanted a scalar or a string; `spawnSync` wants a `string[]`, and an
  `i32[]` has the same kind. It compares with `sameType` now
  (`reject_spawn_element_type`). stage1 was never wrong here: a type is an
  interned `i32` in `self/types.ts`, so its comparison was already the whole
  type.

- **stage1's command line answers the way stage0's does, in seven places where
  it silently did not (WP14).** None of them was a decision D4 or §7 records,
  which is what separates them from `--emit-ast`: they were drift, and each one
  had a shape a build script could be wrong about without being told. An
  unknown `--number-mode` is refused instead of quietly meaning `i32` — the
  worst of the three outcomes, because the program compiles, in the other
  arithmetic. Every positional is a root, as it is for stage0, instead of the
  last one winning and the rest being compiled into nothing. `wrote <file>`
  goes to stderr, where stage0 puts it, so a build script that pipes the IR or
  reads `--json` finds no chatter mixed in. A root that cannot be opened is
  reported by the driver — `error: cannot open <path>` on stderr, exit 1, and
  one flat object under `--json` — rather than by the loader, which could
  answer neither shape; the errno stays stage0's, since Node names it and
  `readFileSyncOrNull` answers null without saying why. Three more were fixed
  in `scripts/amritc.sh` and then inherited by the compiler when it took that
  script's job over (above): `--link` on a program with no `export function
  main` is refused with stage0's message and its exit 1, instead of reaching
  clang and coming back with `undefined reference to main` and exit 3; an
  unknown `--profile` is refused before the compile rather than after it, as
  stage0 validates `PROFILES` before it reads a file; and `-o <dir>/` writes
  into the directory it was given instead of clearing it first, which for
  `-o build/` took the rest of `build/` with it. Checks in the WP14 section of
  `tests/run.js` compare each answer against stage0's.

- **The WP14 section says when it skipped itself.** Without clang the
  self-hosting oracles and the bootstrap did not run and printed nothing, so a
  run reported the 55 compile-gate passes above them and looked like a proof of
  the fixed point. It now prints the `SKIP` line WP12 and WP13 print.

### Added

- **The self-hosted compiler writes the interop sidecars (WP8 in `self/`).**
  `--emit-header`, `--emit-dts` — which also writes the companion `.mjs`
  loader beside its declarations — and `--emit-napi` now work in stage1,
  spelled exactly as stage0 spells them and writing the same files to the same
  paths. `src/interop/`'s five modules are ported to `self/interop_abi.ts`,
  `interop_header.ts`, `interop_dts.ts`, `interop_wasm.ts` and
  `interop_napi.ts`, one for one so the two stay diffable, with the flags in
  `self/options.ts` and the writes in `self/compile.ts`. Three shapes changed
  and no generated byte did: a type is an `i32` into the `TypeTable` rather
  than a tagged object, the empty string stands in for `undefined`, and the
  N-API shim's readers and boxers — records of closures in `src/`, which the
  language has no way to hold — are records with a kind tag over a `switch`
  that writes the same lines. The whole-program attribute fixpoint the
  generators share is run once per compile here instead of once per generator.
  D4 is unchanged: stage1 still creates no directory and spawns no linker, so
  a sidecar's directory must already exist, and `scripts/amritc.sh` makes it
  and passes the three flags through rather than refusing them by name (`-g`
  and the dumps are still refused). New oracle:
  `tests/self/interop_oracle.js` compiles the WP8 interop corpus with both
  compilers and compares all four generated files byte for byte, wired into
  the WP14 section of `tests/run.js`; `--all` runs the same comparison over
  every whole program in the tree (281 programs, 1,124 sidecars, 15 MB of
  generated C, TypeScript and JavaScript, no difference). The bootstrap fixed
  point still holds over the ~2,400 new lines of `self/`, at 114 MB of peak
  RSS and 127 ms to compile the whole compiler (96 MB and 107 ms before).

### Changed

- **stage1's command line answers `--emit-checked`, `--json`, `--help` and
  `--version` (WP14).** The four flags that are not about linking are stage1's
  now, spelled and behaving as stage0 spells them: `--json` writes one flat
  diagnostic object per line to stdout, uncapped, in the same order and with
  the same spans; `--emit-checked` writes the checked program's tables, for a
  whole program with its imports; `--help` goes to stderr with exit 2; and
  `--version` prints `amritc <version>` from `self/branding.ts`, which
  `tests/run.js` fails if it drifts from `package.json`. The dump itself moved
  to `self/dump.ts` so the driver and the `dump_checked` entry the oracle
  spawns cannot grow two spellings of one format. `scripts/amritc.sh` passes
  all four through — `--emit-checked` and `--version` skip the output planning
  and the link, since they print text rather than writing IR — and it no longer
  swallows the compiler's stdout on a failed compile, which is where `--json`
  puts the diagnostics.

  **`--emit-ast` stays stage0's**, and by design rather than for now: stage0's
  AST dump prints the `typescript` package's node names and line:column spans,
  and stage1's tree is the flattened single-`Node` one `self/nodes.ts` defines,
  with its own vocabulary and byte offsets — the parser oracle translates
  TypeScript *into* that vocabulary, not the other way about. Matching the dump
  would mean carrying someone else's SyntaxKind naming inside the self-hosted
  compiler, which is imitation rather than parity, so the wrapper keeps
  refusing it by name and `self/dump_ast.ts` keeps the shape its oracle reads.

- **A `DIFile`'s directory is `.`, not the working directory.** `-g` metadata
  now depends only on the command line, so a debug build is reproducible across
  machines — which is what clang's `-fdebug-compilation-dir=.` is for — and the
  self-hosted compiler, which has no `process.cwd()` to ask for and no runtime
  budget to grow one (WP14 D4), emits the same bytes for a relatively-spelled
  entry, exactly as it already did for the module header.

- **The stage1 oracles compare whole programs, and the stale skips are gone
  (WP14).** Two of them still skipped every file that imports with the reason
  "needs the S5 driver", which had stopped being true when the driver landed.
  `self/dump_checked.ts` now drives `self/compilation.ts` rather than one
  `Checker`, so `--emit-checked` is compared over a whole program — every
  module in load order, what pass 1b bound each import to, and each module's
  own constants, structs and functions — and `tests/self/reject_oracle.js`
  covers the importing `reject_*` cases and the `tests/link/` negatives, whose
  rejections need more than one module to provoke. Every oracle now gives a
  program the flags it is compiled with everywhere else, read from its `.args`
  sidecar or its `// smoke: args` line by the new `tests/self/corpus.js`, so
  six programs that were being refused by stage0 for want of
  `--number-mode f64` are compared instead of counted as gaps in the port
  (`bench/*.args` are new, and `bench/run.mjs` reads them instead of carrying
  its own copy of the mode). `checked_oracle.js` goes from 225 files and 48
  skips to **272 whole programs and 1 skip**; `reject_oracle.js` from 181 cases
  and 44 skips to **194 cases**, 42 parser refusals and 1 skip;
  `ir_oracle.js` from 275 programs and 22 skips to **280 programs and 6
  skips**, with the 11 `tests/link` negatives named as negatives rather than
  skipped. What is left is named: a parser fixture no checker accepts, a
  `--link` failure stage1 has no way to write, and the `-g` and dump flags.

- **Renamed to AmritScript, and the name moved into two files.** The language
  is **AmritScript** and the compiler is **`amritc`** (npm package, `bin`
  entry, `runtime/amritc.h`, `runtime/amritc.d.ts`, `scripts/amritc.sh`,
  `AMRITC_DEBUG` / `AMRITC_SIMULATE_ICE`, and the `AMRITC_<STEM>_H` guard on a
  generated header); the previous name collided with an unrelated project. Every
  string the compiler prints now builds its name from `src/branding.ts`
  (stage0) or `self/branding.ts` (stage1) instead of spelling it, so the next
  rename is an edit to two files: the Phase 0 messages, `--help`, the banner,
  include guard and `#include` of a generated header, the DWARF producer
  string, and the internal-error report all read `LANGUAGE` / `CLI` from there.
  Phase 0's entry point is `validateSyntax`, named after its job rather than
  the language.

  The `amrit_` prefix on the runtime's C symbols was rewritten as the last step
  of the rename, so the tree carries no trace of the old name: `sts_str_concat`
  → `amrit_str_concat` and its 72 siblings, `STS_SYMBOL` / `STS_COLD` /
  `STS_RESULT_ASSERT` → `AMRIT_*`, the `%struct.sts_arena` / `sts_array` /
  `sts_str` / `sts_result_*` layouts, the Node shim's `__sts` namespace →
  `__amrit`, and the benchmark variant ids. **This is a C ABI break**: a host
  that links `runtime/runtime.c` or includes `runtime/amritc.h` must use the new
  names. Nothing has been released, so nothing linked the old ones. That prefix
  is ABI rather than branding and is **frozen** from here — it was affordable to
  change exactly once, before a first release, while every golden `.ll` that
  carries it could be regenerated; `docs/ARCHITECTURE.md` ("Where the name
  lives") says why it does not move again.

### Added

- **The self-hosted compiler emits DWARF (`-g`).** `self/debug.ts` is the port
  of `src/codegen/debug.ts`: one `DICompileUnit`, a `DISubprogram` per
  function, a `DILocation` on every instruction, `llvm.dbg.value` for
  parameters and `llvm.dbg.declare` for `let`/`const` and `for (const x of a)`
  slots, and the same type mapping down to the packed `Result` word a call
  boundary carries (WP17). `self/ir.ts` grew the metadata list it builds into,
  `-g` is a flag of `self/compile.ts`, and `scripts/amritc.sh` takes it and
  hands it to `scripts/build.sh` as well, so the DWARF survives the link
  instead of being stripped with the profile. `tests/cases/dbg_locals` and
  `tests/cases/dbg_result` are no longer skipped by `tests/self/ir_oracle.js`:
  the two compilers' output is compared byte for byte, metadata numbering
  included, and the runner check that used to prove `-g` was refused by name
  now links `examples/hello.ts` through the wrapper and finds `.debug_info` in
  the binary. `--emit-header` keeps that refusal for the flags that are still
  stage0's.

- **`Result` across the ABI (WP17).** A `Result<T, E>` whose two payloads are
  each a scalar of at most four bytes — `void`, `boolean`, `u8`, `u16`,
  `number`, `u32`, `f32` — now **travels in a register**, returned *and*
  passed, packed into one `i64`: the discriminant in bits 0-31 and the live
  arm's payload in bits 32-63. `return Ok(v)` is a shift and an `or` with no
  allocation at all, the receiving side unpacks the word into an object of its
  own, and SROA folds both halves away once the call is inlined. Where that
  object lives is the ordinary WP6 decision: a callee's unpacked parameter is
  an entry-block `alloca` unless a use of it stores the pointer somewhere that
  outlives the frame, in which case it is an arena bump
  (`EscapeResult.stackParams`). Measured on x86-64 with both compilers
  built and the same program compiled by each (`--profile speed`, 2 × 10^8
  iterations): **3.5× faster** (0.50 s → 0.143 s), same checksum, and `use` is
  14 instructions with no frame and no call against 47 with three. Over a call
  boundary the optimiser cannot inline away the win is 2.09×, where `sret` —
  the only other uniform option — reaches 1.43×. Eight bytes is
  not a tuning knob: `i64` is the only return width whose C-ABI lowering is the
  same LLVM type on all six supported triples, which is why the packed word can
  live in target-neutral IR at all. The decision, the per-target tables and the
  assembly for x86-64 and aarch64 are in
  [docs/wp17-result-abi.md](docs/wp17-result-abi.md); everything else about a
  `Result` — the in-memory layout, narrowing, the payload accessors, `Result`
  parameters — is unchanged. `tests/cases/res_by_value`,
  `res_by_value_propagate`, `reject_result_by_value_unchecked`.
- **A `Result` crosses the host boundary (WP17).** `--emit-header` no longer
  skips a function whose signature mentions one: it declares
  `struct amrit_result_<T>_<E>` for the arena object and a
  `amrit_result_<T>_<E>_word` typedef for the packed form, with a `sizeof`
  assertion, and clang lowers a function returning *or taking* that typedef to
  exactly the `i64` the module defines — so a C host includes the header and
  calls across with no glue, in both directions. `--emit-napi` bridges a
  by-value `Result` over numbers and booleans as `{ ok: true, value }` /
  `{ ok: false, error }`, in both positions, and `--emit-dts` declares the same
  union for the wasm build with the generated loader packing an argument and
  unpacking a result.
- **DWARF for a `Result` (WP17).** `-g` builds a `DW_TAG_structure_type` from
  `resultLayout`, so a debugger shows `ok`, `value` and `error` at their byte
  offsets instead of an opaque pointer; a return slot the ABI packs is
  described as the packed `{ int32_t ok; union { T; E; }; }` the C header
  declares, rather than as a pointer that is not in the register.
- **`bench/result`.** A seventh benchmark: a fallible function returning a
  `Result<number, number>` and one taking it, 2e8 calls, against a C twin
  using the two-word struct `--emit-header` declares and a Rust twin using
  Rust's own `Result<i32, i32>`. It is the regression guard for the packing —
  and it immediately earned its keep by naming a gap the packing does *not*
  close: AmritScript is 1.47x behind C and 2.6x behind Rust there, because
  instcombine simplifies the ok/err `select` only when the two arms are
  separate SSA values rather than halves of one word. C written the way
  `amritc` emits times identically to `amritc`, so it is not a
  code-generation defect; respelling the pack as clang's two-word coercion was
  measured and produced byte-identical assembly, so it was not taken. The
  diagnosis and the proposed fix (a private two-scalar ABI for internal
  functions) are in [docs/wp9-optimisation.md](docs/wp9-optimisation.md) and
  [docs/wp17-result-abi.md](docs/wp17-result-abi.md) §4.

- **Shipping the self-hosted compiler.** `scripts/bootstrap.sh` builds it from
  a checkout — stage0 builds stage1, stage1 builds stage2, and `--verify` also
  builds stage3 and compares every stage's IR for `self/` and the two binaries
  byte for byte — and `scripts/amritc.sh` is its command line, adding the
  directory creation and the `--link` step that `docs/wp14-selfhost.md` D4
  deliberately kept out of the compiler (D4's bet, settled: 120 lines of bash
  and no runtime growth). `npm run bootstrap` writes `build/amritc`. The
  suite now builds a compiler with the script and uses it through the wrapper
  to compile, link and run a one-module and a two-module program, so what is
  checked is the artifact and not only the fixed point. `npm install -g
  amritc` still ships stage0: it is the bootstrap seed, the oracle every
  `self/` phase is compared against, and the only one of the two that emits
  DWARF and the interop sidecars.
- **Self-hosting S5: the compiler compiles itself.** `self/compilation.ts` is
  the whole-program driver — transitive module loading through `import`,
  cross-module binding, the reachable-struct closure, symbol-clash rejection
  and a program-wide attribute fixpoint — and `self/compile.ts --out-dir <dir>`
  writes one `.ll` per module. `tests/self/bootstrap.js` builds stage1 with
  stage0, stage2 with stage1 and stage3 with stage2, and all three equalities
  hold over the 41 modules and 4 MB of IR that make up `self/`:
  `IR(stage0) == IR(stage1) == IR(stage2)`, byte for byte, and stage3 is
  byte-identical to stage2. Compiling the whole compiler costs stage1 91 ms and
  86 MB of peak RSS, against stage0's 786 ms and 178 MB.
- **Parenthesised types.** `(T | null)[]` needs its parentheses — `T | null[]`
  groups the other way — and stage0 always accepted them; the `self/` parser now
  does too (`tests/cases/cls_parenthesized_type`, `reject_paren_union_type`).
- **Self-hosting S4: the AmritScript emitter.** `self/` now carries the whole back
  end — the IR builder, the runtime ABI table, the target layouts, the escape
  analysis, the whole-program attribute fixpoint, the six construct families,
  the module assembly and a one-module driver — in 6,761 lines of AmritScript
  against the 5,686 of `src/codegen/` they replace. `tests/self/ir_oracle.js`
  compares the two compilers' entire output byte for byte over every
  import-free program in the corpus: 206 of 206 files agree over 19,452 lines
  of IR. Three stage0 bugs and three stage1 divergences came out of writing it,
  each with a case of its own. stage1 emits no debug info: `-g` stays stage0's,
  as `--link` does.
- **Phase 1: basic math.** `function`, `number` (`i32` by default, `f64` with
  `--number-mode f64`), `boolean`, arithmetic, comparisons, locals, calls, and
  exact LLVM IR output (`add(a, b)` compiles to the documented target IR).
  `--plain` drops all performance annotations.
- **Performance pass.** Zero-GC arena runtime (`runtime/runtime.c`),
  Rust-parity LLVM function/parameter attributes (`noundef`, `nounwind`,
  `willreturn`, `readnone`, ...), alignment hints, and the `scripts/build.sh`
  pipeline with `debug` / `speed` / `size` profiles (LTO, section GC, strip).
  `scripts/size-report.sh` prints before/after binary sizes.
- **Phase 0 validator** (`src/validator.ts`). A single syntax-only pass that
  rejects every construct AmritScript can never compile (`any`, `eval`, `with`,
  dynamic property access, ...) in about 2 ms per 1,000 lines, before the
  checker runs. Biome lint/format configuration, with a rule set that mirrors
  the validator (`noVar`, `noParameterAssign`, `useExplicitLengthCheck`, ...)
  and covers the example, cookbook and benchmark programs, plus the house-style
  rules (`type` over `interface`, arrow functions over `function` declarations)
  reported as warnings while the compiler's own source is migrated.
- **Control flow.** `if` / `else`, `while`, `do ... while`, `for`, `break` /
  `continue`, the ternary, short-circuit `&&` / `||`, compound assignment and
  `++` / `--`, with termination analysis feeding the `willreturn` attribute.
- **Strings.** Arena-allocated immutable `string` (header + UTF-8 bytes),
  literals, `+` concatenation, `===` / `!==`, `.length`, template literals,
  and `console.log`.
- **Modules, entry point, linkage.** `export function` / named relative
  `import`, whole-program compilation with program-wide attribute facts,
  import cycles, `export function main(): number | void` as the process entry
  (its return value is the exit code), `--link <exe>`, `-o <dir>/` for one
  `.ll` per module, and `--strict-exports` for `internal` linkage.
- **Runtime and intrinsics.** `Math.*` as LLVM intrinsics, the `i64` type with
  explicit numeric conversions, `process.exit`, synchronous file I/O, and
  JavaScript-accurate number formatting in the runtime.
- **Command line, string parsing, WASI.** `process.argv: string[]` (built
  once by the `@main` wrapper with `amrit_argv_init`; `argv[0]` is the program
  path; read-only; a compile error in a program without `main`),
  `parseInt(s): i32`, `parseFloat(s): f64` and `Number(x): f64` (JavaScript
  semantics for the decimal forms via one runtime call `amrit_parse_number`;
  `parseInt` has no NaN and saturates like `toI32`), and a `wasi` build
  profile (`--link app.wasm --profile wasi`) that links the runtime against
  wasi-libc so whole programs run under any WASI host, including Node's
  (`examples/wasi-host.mjs`). Runtime `.text` at `-Oz` is 4,093 bytes.
- **Interop.** `--emit-header` (C header), `--emit-dts` (TypeScript
  declarations for the wasm exports), `--emit-napi` (N-API shim) plus the
  `napi` and `wasm` build profiles; an FFI benchmark.
- **Typed arrays across the boundary.** `Int32Array`, `Float64Array` and
  `BigInt64Array` are accepted as type annotations and as `new Int32Array(n)`;
  they are the same type as `i32[]` / `f64[]` / `i64[]` (one layout). Exported
  functions taking or returning them cross to Node: the N-API shim borrows a
  JS typed array zero-copy (`napi_get_typedarray_info` under a stack
  `amrit_array` header) and returns a fresh typed array, and also bridges
  `string` and `i64` (bigint) arguments and results, releasing the arena per
  call; `--emit-dts` now also writes `<file>.mjs`, a loader that copies typed
  arrays into wasm memory through the new `amrit_alloc_array` runtime entry and
  copies results (and written-through arguments) back. `runtime/runtime_wasm.c`
  is a freestanding arena + arrays runtime for the wasm profile (which now
  passes `-mbulk-memory`). `--emit-header` spells read-only array parameters
  `const amrit_array *` and written ones `amrit_array *`. `examples/arrays.ts`,
  `bench/ffi.mjs` gains the batched `Float64Array` rows.
- **Self-hosting, milestone S3: the body pass and Phase 0**
  (`docs/wp14-selfhost.md` §4). `self/expressions.ts`, `statements.ts`,
  `members.ts`, `arrays.ts`, `builtins.ts` and `validator.ts` are stage0's
  pass 2 and its forbidden-syntax sweep in AmritScript. Two shape decisions
  carry their reasons: the dispatch is **one central `switch`** (D2 of §3a) —
  a table of function values would need function pointers, which AmritScript does
  not have, and a `switch` on a node kind lowers to a jump table — and the
  **contextual type is threaded down** rather than walked up, because the tree
  has no parent pointers; the one place that shows is `console.log` and the
  other `void` builtins, where "must be a statement" is answered by the
  statement checker recording the expression it is about to check.
  `self/` is now **9,702 lines** of AmritScript.
  The proof is both halves of what a checker does. On what it *accepts*,
  `tests/self/checked_oracle.js` compares the `--emit-checked` dump over the
  whole corpus: **207 of 207 files agree over 2,079 lines**, and those lines
  now include the per-body locals and callees, so what is compared is every
  variable's type, every call's resolved callee, every struct's field offsets
  and every folded constant. On what it *refuses*,
  `tests/self/reject_oracle.js` runs every `reject_*` case through stage1 and
  requires the same `.err` fragments the suite already requires of stage0:
  **165 of 165 agree over 168 message fragments**, with nothing left in a
  backlog: definite assignment (`self/assignment.ts`), `super(...)` placement,
  `process.argv` being read-only and the rule that a narrowing does not
  survive a loop that assigns the variable all landed, and the backlog file
  that carried them is gone. The 44 skipped cases are the ones the S2 *parser*
  refuses by name rather than by the wording Phase 0 uses, which is a
  deliberate difference, plus five that need the S5 module driver.
- **A numeric literal in a ternary arm takes the conditional's context.**
  `const x: f64 = c ? 1.5 : 2.5` was rejected — the annotation reached a
  literal written directly but not one behind a `?:`, because the context walk
  had no clause for a conditional. Both arms are the value the context asked
  for, so they inherit it; the condition is a boolean and inherits nothing
  (`tests/cases/f64_ternary_literal`, `reject_ternary_literal_float`). Found
  writing the self-hosted checker, where an `i32`/`f64` limit is chosen with a
  ternary.
- **Self-hosting, milestone S3: the signature pass** (`docs/wp14-selfhost.md`
  §4). `self/checker.ts` and the five modules around it — `program.ts` (the
  side tables), `context.ts`, `annotations.ts`, `declarations.ts`,
  `structs.ts`, `constants.ts` — are stage0's pass 1 in AmritScript: imports and
  class names first so any annotation resolves, then members, layouts and
  function signatures, then `implements`. **206 of 206 corpus files agree with
  stage0 over 1,255 signature lines**, compared through the `--emit-checked`
  dump both compilers write (`tests/self/checked_oracle.js`), so what is
  checked is not "it accepted the file" but every struct's size and alignment,
  every field's index and byte offset, every symbol, every folded constant and
  the order they come out in. The lines later phases fill in — the attribute
  facts, the per-body locals and callees — are filtered rather than left out of
  the format, so they start being compared the moment those phases land.
  Three shape changes carry their reasons: side tables are arrays indexed by a
  dense `Node.id` the parser hands out rather than `WeakMap`s (AmritScript has no
  `WeakMap`, and an index beats hashing a pointer); an annotation's names come
  from a `typeNames` set narrower than the layout registry, which is what keeps
  a reachable layout from becoming a spellable type; and constant folding needs
  no `bigint`, because AmritScript `i64` arithmetic already wraps where stage0 has
  to wrap by hand. The parser now reports into the shared `Diagnostic` of
  `self/diagnostics.ts` rather than a class of its own, so a syntax error and a
  checker error land in one report — and print `file:line:col: syntax error:`
  with an excerpt, exactly as stage0 does.
- **Self-hosting, milestone S3 begun: the type model and the diagnostics**
  (`docs/wp14-selfhost.md` §4). `self/types.ts` is `src/types.ts` with one
  change of representation: a type is an **interned `i32`**, so "are these the
  same type?" — the checker's hottest question — is one integer compare
  instead of a recursive `sameType`, a type fits in the `i32` a `StringMap`
  stores, and `T[]` costs one entry rather than one per mention. It carries a
  thirteenth kind stage0 has no counterpart for: `T_ERROR`, D1's sentinel,
  assignable in both directions so that one bad expression does not produce a
  diagnostic at every site it reaches. `self/diagnostics.ts` is the same
  summary line, source excerpt and `--json` object, over a `SourceFile` that
  indexes its line starts once (a scan per diagnostic is quadratic in a file
  with many errors) and a sink that orders by file-first-mentioned and then
  position with a **stable** bottom-up merge sort — the last outstanding item
  of wave C, and stable because two errors at one position have to keep the
  order the phases produced them in for a multi-error golden to be
  reproducible. Both are checked against stage0's own implementation:
  `tests/self/types_oracle.js` diffs the LLVM type, the alignment, the
  diagnostic spelling and the whole assignability matrix over every type
  either side can build (119 lines), and `tests/self/diagnostics_oracle.js`
  diffs every byte of the messages, the line/column index over *every* offset
  in the fixture, the report order, the `...and N more errors` cut and the
  JSON (570 lines). `self/symbols.ts` is the scope chain and the narrowing
  rules, keyed by identity as `src/checker/scope.ts` is — this is the part of
  the checker a program can observe going wrong, since a narrowing kept one
  statement too long compiles a load through a pointer the checker promised
  was not null, so both implementations are driven through one script
  (shadowing, a narrowing that holds through the chain, an inner one that
  wins, an assignment that drops both) and every answer compared.
- **An imported class or function brings the layouts its signature mentions.** `import
  { Registry }` where `Registry.all(): Entry[]` gives a module `Entry` values
  it can call methods on and read fields of; until now the checker crashed
  with an internal error (`structOf: no struct named \`Entry\``) because
  `Entry` was in no registry there, and the emitter would have had only
  `%struct.Entry = type opaque` to compute a field offset from. The layouts
  now travel with the import, transitively, and their symbols are `declare`d
  the way an imported class's are. Only the layout travels: an annotation
  still needs the name in scope, so `const e: Entry` in that module is
  unchanged (`tests/link/reachable_struct`,
  `tests/link/reachable_struct_annotation`). A base reached through `extends`
  and a `this` parameter are deliberately excluded — both are used through a
  pointer the checker already holds, and including them would turn the
  `%struct.Base = type opaque` of `tests/link/extends_import` into a
  definition. The closure is a whole-program pass after every module has bound
  its imports, not a step inside binding: a struct that reaches a module
  through a chain of two — `main` imports `mid`'s class, whose method returns
  `leaf`'s — would otherwise be found or not depending on the order the
  modules happened to be bound in (`tests/link/reachable_struct_chain`). Found
  by writing the self-hosted compiler's own `diagnostics`, `annotations` and
  `statements` modules — a sink that hands back a `Diagnostic[]`, a context
  that reads a `StringSet` field, and an imported `caseValue(): CaseValue`
  (`tests/link/reachable_struct_return`).
- **Self-hosting, wave C: the support library** (`docs/wp14-selfhost.md` §3).
  `self/strings.ts`, `self/map.ts` and `self/paths.ts` are the 598 lines of
  AmritScript the checker and the emitter are written over, and no language
  change came with them. `StringBuilder` is a `string[]` and one `join`,
  because `s = s + t` in a loop is quadratic in both time and memory — 88 KB
  of IR built that way costs 180 MB of peak RSS. `StringMap` / `StringSet`
  replace the ~200 `Map` / `Set` sites in `src/` with open addressing over a
  *dense entry list*: FNV-1a and linear probing into a bucket table of entry
  indices, so iteration is insertion order (a hash order would make a
  golden-compared diagnostic dump depend on the table size) and `""` needs no
  sentinel. `self/paths.ts` is `node:path`'s POSIX behaviour, which §3a D3
  calls a hazard rather than tedium: module identity is the resolved path, so
  a `..` normalised differently from Node's loads one file twice and stops
  cycles terminating. `tests/self/support_oracle.js` is the test, and every
  line of it has an implementation that already exists on the other side —
  stage0's own `escapeBytes` and `f64Constant` for the two IR escapes,
  `node:path`'s POSIX side for the path functions, and `JSON.stringify`,
  `Buffer.compare` and `Map` for the rest, over the shared case table both
  sides read. **863 lines agree.** One divergence is deliberate and written
  down: `basenameWithout` is not `path.basename(p, ext)`, whose corners are
  artifacts (`basename("///", ".ts")` is `"///"`, and `basename(".ts", ".ts")`
  is `""` while `basename("x/.ts", ".ts")` is `".ts"`).
- **Self-hosting, milestone S2: the parser** (`docs/wp14-selfhost.md` §4).
  `self/parser.ts` is recursive descent over the S1 lexer, building the
  one-`Node`-class tree of `self/nodes.ts` — a `kind` discriminant, a fixed
  child layout per kind, `N_LIST` for the variable-length groups and `N_EMPTY`
  for the absent ones, so nothing ever downcasts. It has no exceptions,
  because AmritScript `throw` discards its value: a failed parse is an `N_ERROR`
  node plus a diagnostic on the parser, and the declaration after it still
  parses. `tests/parser_oracle.js` walks the `typescript` tree, prints it in
  `self/dump_ast.ts`'s format and diffs: **447 files, 53,673 nodes, no
  disagreement**, span for span, with the 43 skipped files all `reject_*`
  cases whose forbidden constructs AmritScript-0 has no grammar for yet. Four
  front-end bugs came out of the two oracles, all the same shape — a lexer or
  parser having an opinion the scanner does not: `==` and `?.` refused rather
  than read, `super` missing from the model although the language has
  inheritance, and `from` and `of` made hard keywords when they are contextual
  (`tests/cases/cls_nested.ts` has a field called `from`). `self/` is 2,817
  lines of AmritScript and parses 84 KB of its own source in 7 ms, against
  14.5 ms for the `typescript` parser warm in a Node process.
- **Self-hosting, milestone S1: the lexer** (`docs/wp14-selfhost.md` §4).
  `self/lexer.ts` tokenises AmritScript-0 and is written in it — 1,222 lines with
  `self/tokens.ts` and `self/dump_tokens.ts`, using nothing the language did
  not already have. It is new code rather than a port: `src/` has no lexer,
  because the `typescript` package is the scanner there. Byte offsets
  throughout, since `s.length` and `charCodeAt` are byte-oriented; template
  literals are lexed without the parser's help, with one brace counter per
  open substitution telling a substitution's `}` from a block's.
  `tests/lexer_oracle.js` is the test: it runs the `typescript` scanner over
  `tests/cases/`, `examples/`, `self/`, `docs/cookbook/`, the differential
  corpus and the new `tests/lexer/` fixtures, prints the token stream in the
  same format and diffs it — **482 files, 50,968 tokens, no disagreement**,
  with the scanner's UTF-16 offsets mapped through the source's byte prefix.
  The lexer has no opinions: `==`, `?.`, `??`, `**`, `...`, `@` and `#name`
  are all tokenised as written, and the parser is where AmritScript refuses them.
- **`switch` / `case` / `default`** (`docs/wp14-selfhost.md` A1). An integer
  discriminant and constant labels — a literal, its negation, or a module
  constant — lower to one LLVM `switch`, so the backend builds a jump table
  (`llc -O2` emits `jmpq *.LJTI0_0(,%rax,8)` for twelve dense labels). Only an
  integer switches: a string one would have been a chain of `amrit_str_eq` calls
  wearing a switch's clothes. There is no implicit fallthrough — a clause with
  statements ends in `break`, `return`, `continue` or `throw` unless it is the
  last, while an *empty* clause falls through, which is how `case 1: case 2:`
  gives several labels one body. A clause may not declare a variable without a
  block of its own, because TypeScript's one shared clause scope would leave it
  visible and unassigned below. `break` inside a `switch` leaves the switch and
  `continue` reaches past it to the enclosing loop
  (`tests/cases/cf_switch`, `cf_switch_break`, six `reject_switch_*` cases,
  `tests/differential/corpus/cf_switch.ts`).
- **The string byte methods** (`docs/wp14-selfhost.md` A2): `charCodeAt`,
  `substring`, `indexOf`, `startsWith`, `endsWith` and `String.fromCharCode`.
  Every offset is a UTF-8 byte offset, like `s.length`, because a lexer walks
  bytes and a code-point index would cost a decode per access. They lower
  inline rather than to runtime calls: `charCodeAt` is the array bounds check
  and a `load i8`, `substring` is JavaScript's clamp — `llvm.smin`/`llvm.smax`
  into `[0, len]`, then the pair in order, which `opt -O2` folds to one
  `max(0, min(n, len))` — plus one `amrit_str_new`, and `indexOf` is a scan in
  the emitted code. The one new runtime symbol is `amrit_str_at(s, at, sub)`,
  which `startsWith`, `endsWith` and the `indexOf` scan share; `runtime.c` is
  3,842 bytes of `.text` at `-Oz`, inside the 4,096-byte budget.
  `charCodeAt` bounds-checks and exits 1 where JavaScript answers `NaN`, which
  `number` cannot hold, and the escape and attribute analyses learned that a
  string method reads its receiver and that `substring` allocates
  (`tests/cases/str_bytes`, `str_search`, four `reject_str_*` cases,
  `tests/differential/corpus/str_methods.ts`).
- **Array `pop`, `indexOf` and `join`** (`docs/wp14-selfhost.md` A4). `pop`
  hands back the last element and stores the shortened length; an empty array
  panics through the same `amrit_panic_index` an index does, because there is no
  `undefined` to return. `indexOf` scans with the `===` of the element type —
  content for strings, identity for classes and arrays, `fcmp oeq` for floats,
  so a `NaN` element is never found. `join` is `string[]` only and is the fast
  shape the port needs: one pass summing the lengths, one `amrit_alloc_struct`,
  one `llvm.memcpy` per part and per separator, with the separator before the
  first part skipped by selecting a length of zero rather than by branching.
  Building the same text with `+` in a loop copies everything again per part
  and never reclaims — 180 MB of peak arena for 88 KB of output. All three
  lower inline, so `runtime.c` gains nothing (a runtime `join` would have cost
  252 bytes of a 254-byte margin). A numeric literal argument to `push` or
  `indexOf` now takes the element type, so `wide.push(3)` on an `i64[]` is an
  `i64` three (`tests/cases/arr_join`, `arr_pop_index`, five `reject_*` cases,
  `tests/differential/corpus/arr_methods.ts`).
- **`console.error`, the newline-free writes, `readFileSyncOrNull` and
  `panic`** (`docs/wp14-selfhost.md` B2, B3 and D1). A compiler's diagnostics
  go to stderr and two of its dumps write without a trailing newline, neither
  of which `console.log` can do: `console.error(x)` takes what `console.log`
  takes and writes it to stderr, and `write(s)` / `writeError(s)` write a
  string as it is, on fd 1 or 2. All three share one runtime entry point,
  `amrit_write(s, fd, newline)`, which `amrit_print` now delegates to, so no
  existing golden moved. `readFileSyncOrNull(path): string | null` is the same
  read as `readFileSync` but answers `null` where that one exits, which is
  what lets a program turn a missing import into its own diagnostic and carry
  on loading the rest; it subsumes an `existsSync` and has no time-of-check
  race. `panic(message)` writes the message to stderr and exits 1, the same
  ending an out-of-range index has, and terminates control flow like
  `process.exit`, so an internal invariant keeps the message that `throw`
  discards. `runtime.c` is 3,950 bytes of `.text` at `-Oz`, inside the
  4,096-byte budget (`tests/cases/io_streams`, three `reject_*` cases,
  `tests/differential/corpus/io_streams.ts`, `io_panic.ts`).
- **Bitwise operators.** `& | ^` (`and` / `or` / `xor`), `~` (`xor x, -1`),
  `<< >> >>>` (`shl` / `ashr` / `lshr`), and the compound forms
  `&= |= ^= <<= >>= >>>=` on a mutable local. Two `i32` or two `i64` of the
  same type; `f64` is refused because AmritScript never converts implicitly, and
  `boolean` is refused with the operator that does the job named in the
  message (`&&`, `||`, `!==`, `!`). Shift counts are masked to the operand
  width, as in JavaScript, so `x << 33` is `x << 1` instead of the poison LLVM
  produces for an over-wide shift; a constant count is masked at compile time
  and emits no `and`. `>>>` on `i32` yields the signed reading of the shifted
  bits (`-1 >>> 0` is `-1`, not JavaScript's `4294967295`), the same choice the
  language already makes when integer arithmetic wraps. None of these has a
  panic path, so a function whose arithmetic is all bitwise keeps `readnone`
  and `willreturn`.
- **Arrays.** `T[]` / `Array<T>`, literals, `new Array<T>(n)`, indexing with
  bounds checks (panic on out-of-range), `.length`, `push`, `for ... of`, and
  `--unchecked-indexing` for benchmarks.
- **Classes and interfaces.** `class` / `interface` as `%struct.<Name>` with
  clang-identical layout (verified against C `_Static_assert`s at test time),
  constructors, methods (`this` as the first parameter), field reads and
  writes, object literals, structural `implements`, `export class` across
  modules, and struct-pointer attributes (`nonnull`, `dereferenceable`,
  `readonly` / `nocapture` by a whole-program escape fixpoint).
- **Single class inheritance (WP2b).** `class D extends B` lays `D` out as
  `B`'s fields followed by its own, so a `D` converts to `B` (or any
  ancestor) with one `bitcast` wherever a `B` is expected (arguments,
  variables, returns, fields, `B[]` elements, `B | null`); `super(...)` as
  the first statement of a derived constructor (implicit when no ancestor
  constructor takes parameters), inherited constructors, `super.m()`,
  overriding with an identical signature, `implements` on the flattened
  layout, and multi-level chains. Dispatch is static: a call uses the method
  of the receiver's declared type, never a vtable (`docs/LANGUAGE.md`,
  Classes). Downcasts, `instanceof`, extending an interface or an imported
  class, cyclic inheritance, redeclared fields, and signature-changing
  overrides are rejected. The generated C header now declares every class
  and interface as a `struct` with the flattened fields and every method
  and constructor as `Class_method(struct Class *, ...)`.
- **Memory strategy (WP6).** Escape-analysed stack allocation: a `new`,
  object literal, array literal or `new Array<T>(<literal>)` that provably
  does not outlive its function becomes an entry-block `alloca`
  (`--no-stack-alloc` disables it). Automatic arena scopes: a function whose
  arena temporaries all die with it brackets its body with the new
  `amrit_arena_mark` / `amrit_arena_release` runtime calls, so hot loops keep the
  arena flat. `Arena.reset` / `mark` / `release` / `used` builtins, and
  `T | null` for class, interface, array and string types with checker-
  enforced narrowing (`if (p !== null)`, early return, `while`, `&&`, `?:`).
  See [docs/wp6-memory.md](docs/wp6-memory.md).

- **Escape analysis fix.** A `new C(...)` whose constructor captures `this`
  (`registry.last = this`) is no longer placed on the stack; `new C(...)`
  where an interface or base type is expected now allocates and constructs
  `C` (it previously allocated the target type and skipped the constructor).
- **Differential testing.** `npm run test:diff` compiles every whole program
  in `tests/cases` and a 50-program corpus, runs the same TypeScript under
  Node through `runtime/shim.mjs` with i32-wrapping rewrites, and compares
  stdout and exit codes byte for byte; a seeded expression fuzzer runs 10
  programs in `npm test` and 200 on demand. Known semantic gaps are listed in
  `tests/differential/known-failures.txt`.
- **Examples.** `examples/nbody.ts` (classes, arrays, `Math` in f64 mode)
  prints the reference energies and is covered by `npm run smoke`.
- **Checked integer division.** `/` and `%` on `i32` / `i64` panic with
  "attempt to divide by zero" / "attempt to divide with overflow" (exit 1)
  instead of executing an `sdiv` / `srem` whose result is poison, matching
  Rust. `Math.pow` follows ECMAScript for `pow(x, NaN)` and `pow(±1, ±Infinity)`.
  Ordering comparisons are numeric only; `?.` and `??` are rejected by the
  validator; the literal `-2147483648` is accepted.
- **Optimisation flags and benchmarks.** `--target <triple>|host` emits
  `target datalayout` / `target triple`; `--nsw` makes signed overflow
  undefined for extra optimisation; array parameters carry
  `dereferenceable(24)`; `scripts/build.sh --pgo-generate` / `--pgo-use`.
  `bench/` holds fib, nbody, spectral-norm, sieve, string building and a
  struct-heavy loop in AmritScript, C and Rust with a checksum-validated runner
  (`node bench/run.mjs`) that writes `docs/BENCHMARKS.md`.
- **CI and diagnostics.** GitHub Actions matrix (Ubuntu + macOS, LLVM 18) with
  a size table in the job summary; every error is
  `<file>:<line>:<col>: error: <message>` followed by a caret excerpt.
- **Multi-error reporting, `--json`, debug dumps, `-g`.** A failed compile
  reports every error (Phase 0: every forbidden construct; pass 1: per
  declaration; pass 2: per statement, the function marked poisoned) in
  source order, 20 at most before `...and N more errors`; a lone error prints
  unchanged. `--json` prints one
  `{file, line, column, endLine, endColumn, severity, message}` object per
  line on stdout for editors. `--emit-ast` dumps the syntax tree,
  `--emit-checked` the checker's tables and attribute facts. `-g` emits DWARF
  (`DICompileUnit`, `DISubprogram` per function, `DILocation` on every
  instruction, `DILocalVariable`s for parameters and locals, struct and array
  composite types); `--link -g` and `scripts/build.sh -g` keep it through
  every profile. Without `-g` the IR is byte-identical.
- **Release engineering.** `--version`; documented exit codes (0 ok, 1 compile
  error, 2 usage, 3 toolchain, 70 internal compiler error, stack trace with
  `AMRITC_DEBUG=1`); a clear per-platform install hint when `--link` cannot
  find `clang`; `scripts/build.sh` and `runtime/runtime.c` resolved from the
  package root so a global `npm install -g amritc` works from any
  directory; npm `files` whitelist, `prepublishOnly`, `LICENSE` (MIT);
  `npm run smoke` (`scripts/smoke.sh`) builds and runs every example with a
  `main`; `.github/workflows/release.yml` attaches the npm tarball to a GitHub
  release on `v*` tags; `docs/INSTALL.md`.
- **Unsigned integers `u8`, `u16`, `u32`, `u64`.** LLVM has no unsigned types,
  so they lower to `i8`/`i16`/`i32`/`i64` and the signedness lives in the
  operations: `udiv`/`urem`, `icmp ult/ule/ugt/uge`, `lshr` for `>>`, `zext`
  for a widening conversion, `uitofp`/`llvm.fptoui.sat` across `f64`, and
  `llvm.umin`/`umax` for `Math.min`/`Math.max`. Representing an unsigned value
  therefore costs nothing, and the unsigned divisor check is *one* compare
  against zero rather than the signed check's three plus an `and` and an `or`,
  because unsigned division has no `MIN / -1` case. Overflow wraps as it does
  for the signed widths (`--nsw` emits `nuw` here, not `nsw`); a conversion
  between two integers of the same width and different signedness emits no
  instruction at all; `toU8`/`toU16`/`toU32`/`toU64` join the conversion
  builtins; a literal in an unsigned context must be non-negative and fit the
  width; mixing signednesses or widths is a type error, as `i32` and `i64`
  already were. `console.log` and template holes print unsigned values
  unsigned through the new `amrit_str_from_u64` (the narrow widths `zext` into
  it, so one runtime symbol serves all four). `--emit-header` spells them
  `uint8_t` … `uint64_t` and `--emit-dts` `number` / `bigint`.
- **32-bit floats: `f32`.** LLVM's `float`, with the same instructions `f64`
  already uses one width down (`fadd`/`fsub`/`fmul`/`fdiv`/`frem`, `fcmp o*`,
  `fneg`); float division stays unchecked. A struct of `f32` is half the
  footprint of one of `f64` and gives twice the SIMD lane count, which serves
  the speed and the size goal at once. `toF32` joins the conversion builtins:
  `fptrunc` down from an `f64`, `fpext` up, `sitofp`/`uitofp` in from an
  integer by the source's signedness, and the saturating
  `llvm.fpto{s,u}i.sat.<T>.f32` out to one. There is no implicit widening, so
  `f32 + f64` is the same same-type error as `u32 + i32`. A non-integer
  literal takes `f32` from context and is emitted as the hex of the double it
  equals, rounded so that double is exactly a float — `0.1` is
  `float 0x3FB99999A0000000`, not the `f64` spelling `0x3FB999999999999A`.
  `console.log` and template holes widen with `fpext` and reuse
  `amrit_str_from_f64`, adding no runtime code, so an `f32` prints
  JavaScript's digits for the float's value (`0.10000000149011612` for `0.1`).
  `Math.abs`/`min`/`max` work through the `.f32` intrinsics; the f64-only
  `Math` functions stay f64-only. `Float32Array` is one more typed-array alias
  for `f32[]`. `--emit-header` spells it `float` and `--emit-dts` `number`.
- **Bitwise operators on every integer width.** `& | ^ ~ << >> >>>` and their
  compound forms already worked on `i32` and `i64`; they now take any integer
  type. `>>` is the one operator whose lowering depends on signedness: `ashr`
  on a signed type, `lshr` on an unsigned one, which makes `>>` and `>>>`
  the same instruction there (`tests/cases/u_shift_logical`). `i32 >>> n`
  keeps its documented behaviour of yielding the raw bits read as signed
  (`-1 >>> 0` is `-1`, not JavaScript's `4294967295`) — with `u32` the other
  answer is now available: `toU32(-1)` is `4294967295`. The shift-count mask
  follows the operand's own width, so `u8` masks to 7 and `u16` to 15 rather
  than to JavaScript's 31 (`tests/cases/bit_shift_narrow`).
- **Documentation.** `docs/LANGUAGE.md` (the normative reference, every rule
  cited to a test case), `docs/IR_COOKBOOK.md` (generated from
  `docs/cookbook/*.ts` by `docs/cookbook/regen.sh`), `docs/ARCHITECTURE.md`,
  `docs/FAQ.md`, the `docs/README.md` index, `docs/check-links.mjs`, and a
  README restructured into a short tour.
- **Module constants (WP14).** `const NAME: T = <constant expression>` at the
  top level, with `export` and `import` (`tests/link/const_export`). A module
  constant is a name for a value, not a global: the checker folds the
  initialiser and every use site carries the value, so no symbol, no
  initialiser and no relocation is emitted, and a module still has no
  top-level code. The initialiser is an ordinary AmritScript expression
  restricted to literals and other constants, so a constant can compute
  exactly what a runtime expression can — integer arithmetic wraps at the
  declared width, `1 / 0` is refused at compile time rather than at run time,
  and a value that does not fit its annotation is an error. Folding is by
  need, so a constant may name one declared later or in another module, and a
  cycle is diagnosed. `--emit-checked` prints each constant's folded value.
  The first item of the self-hosting gap list in
  [docs/wp14-selfhost.md](docs/wp14-selfhost.md).
- **Self-hosting plan.** [docs/wp14-selfhost.md](docs/wp14-selfhost.md): what
  "the compiler compiles itself" means here (a `self/` compiler written in
  AmritScript, and the `IR(stage1) == IR(stage2)` fixed point that proves it),
  the AmritScript-0 subset it is written in, and the ordered list of what the
  language is still missing.
- **`Result<T, E>` and Rust-style error handling (WP16).** A function that can
  fail says so in its return type and hands the caller a `Result`, and the
  caller cannot reach the success value without first deciding what happens to
  the failure. `Ok(v)` / `Err(e)` build one (typed by context, as `null` is);
  `r.isOk()` / `r.isErr()` — and `r.ok`, the discriminant a TypeScript reader
  expects — test it and narrow `r`; `r.value` and `r.error` are legal only in
  the arm that was proved; `r.orReturn()` is Rust's `?`; `r.unwrapOr(d)` and
  `r.expect(message)` handle the failure on the spot. Three rules are checker
  errors rather than lints: a `Result` may not be dropped (neither as a bare
  expression statement nor as a local nobody reads), the payload is
  unreachable until the discriminant is tested, and `orReturn()` is legal only
  inside a function that itself returns a compatible `Result` — so propagating
  a callee's failure is contagious through the signatures. `Result<T, E>` is a
  built-in type constructor, not a user generic: each pair of payload types
  gets one monomorphised `%struct.amrit_result.<T>.<E>`, laid out and allocated
  exactly as a class is, so the WP6 escape analysis turns a `Result` that does
  not outlive its function into an entry-block `alloca` with no allocator call
  at all. `Result<void, E>` is the fallible operation with nothing to hand
  back. Narrowing is the `T | null` engine, extracted into
  `src/checker/narrowing.ts` and shared. Implemented in **both** compilers, as
  S5 requires: `self/` gains the type, the rules and the lowering, and the S3
  and S4 oracles hold it to stage0's exact messages and byte-identical IR.
  Design and the reason the representation is a pointer rather than an LLVM
  aggregate: [docs/wp16-results.md](docs/wp16-results.md).
- **Ambient declarations (`runtime/amritc.d.ts`).** An AmritScript program has
  always *parsed* as TypeScript; with this file on the include path a `Result`
  program also **type-checks** under plain `tsc --strict`, and an editor stops
  underlining `Result`, `Ok`, `i32`, `panic` and the rest. `Result` is
  declared as the tagged union TypeScript would use anyway, intersected with
  the method surface, so `if (r.ok)` and `if (r.isOk())` narrow in `tsc` for
  the same reason and in the same places they narrow in `amritc` — the
  suite asserts both that every `res_*` case type-checks and that `tsc`
  refuses `r.value` before the test, which is what proves the declarations
  model the narrowing and not just the names. `amritc` remains the
  authority: the widths are aliases of `number` there, and `tsc` cannot see
  the three rules above.
- **The random-program fuzzer now compares the two compilers, not only the
  binary against Node (WP13 / WP14).** `tests/differential/fuzz.js --stage1`
  compiles every program it generates with stage0 *and* with the self-hosted
  compiler and requires the emitted IR to be identical byte for byte, module
  set included — the equality `tests/self/ir_oracle.js` asserts over the
  checked-in corpus, now asserted over programs neither compiler has ever seen,
  with stage0 as the oracle and no golden anywhere in the path. It reuses the
  oracle's own `build` and `compare` and links one stage1 binary per run; a
  disagreement (including a stage1 rejection of a program stage0 accepts) saves
  the program as `build/test/differential/fuzz-stage1-fail-<seed>.ts` and
  prints the first differing line and the command that reproduces it,
  `--stage1 --seed <seed> --count 1`. The WP14 block of `npm test` runs 16
  programs from a fixed seed; 300 agreed on every byte. The default
  stage0-against-Node mode is untouched and still runs its own 10-program batch
  in the WP13 block.

### Removed

- **`throw` (WP16).** It never unwound: it evaluated its operand, discarded
  it, and executed `llvm.trap`, which made it an abort wearing the syntax of
  error handling — a program could report a failure in a way no caller could
  see, and the one thing a reader wants when a program dies was the one thing
  it could not keep. Both of its uses have a better spelling now: a failure a
  caller should handle is a `Result<T, E>`, and an invariant that cannot hold
  is `panic(message)`, which keeps the message. Phase 0 rejects `throw` in
  both the compiler and the self-hosted stage1, with a message naming both
  replacements (`tests/cases/reject_throw`), and `try` / `catch` / `finally`
  keeps its own rejection for the same reason.

### Fixed

- **`-g` described an imported class against the wrong file.** A class reached
  through an import — one the importing module never names, as in
  `tests/link/reachable_struct` — was given the importer's `DIFile` and a line
  number looked up in the importer's line table, so a debugger was sent to a
  line in the wrong source. A struct is now described against the file that
  declares it, which is why a program with imports carries more than one
  `DIFile`.

- **A dump written to a pipe is no longer truncated.** The CLI ended with
  `process.exit(code)`, which drops whatever is still buffered in stdout;
  writes to a pipe are asynchronous and take 64 KB at a time, so
  `amritc big.ts --emit-checked | less` came out cut off mid-line while the
  same command redirected to a file was complete. The exit status is set on
  `process.exitCode` instead, so Node flushes and then exits with it.

- **A bare numeric literal takes its type from the other operand (stage1).**
  `self/expressions.ts` preferred the type the whole expression was being
  checked into over the type of the operand beside the literal, where stage0
  consults only the operand (`contextualLiteralType` in
  `src/checker/math.ts`). In `--number-mode f64` that made every `+` of
  `toF64((ij * (ij + 1)) / 2 + i + 1)` mix an `i32` with an `f64` and refused a
  program stage0 compiles (`bench/spectral.ts`).

- **Two pass 1b rejections reach stage1.** Importing one local name twice now
  names the module it first came from (`` `f` is already imported from `./a` ``)
  instead of only reporting the exported-symbol clash behind it, and a
  non-entry module that declares `export function main` is refused as such
  rather than through the entry wrapper's symbol clash. Both are pinned by
  `tests/link/duplicate_import` and `tests/link/main_in_import`, which
  `tests/self/reject_oracle.js` now runs against stage1.

- **A compound integer division contributes its panic callee.** `x /= k`,
  `p.f %= k` and their `/=` twins can call the noreturn `amrit_panic_div` exactly
  as `a / b` can, but the checker resolves the target as an *assignment target*
  and records no type for it, so the fact went missing and the enclosing
  function kept `willreturn` and `readnone` over a call that writes and never
  returns — an attribute LLVM is entitled to delete the call on. Found by the
  S4 IR oracle (`tests/cases/div_compound_attributes`).
- **`readFileSyncOrNull` is an allocation site.** Its result is bumped out of
  the arena exactly as `readFileSync`'s is, but the escape analysis only knew
  about the second name, so a function that returned the bytes could still be
  given an automatic arena scope — and its `amrit_arena_release` rewound past the
  string the caller was about to read. Found by porting the analysis to `self/`
  for milestone S4 (`tests/cases/mem_read_or_null_scope`).
- **Dispatch tables no longer see `Object.prototype`.** The validator, checker
  and emitter are each a table keyed by identifier, read with a key taken from
  the program being compiled. A plain object literal inherits from
  `Object.prototype`, so a program declaring `function valueOf`, `class
  toString`, `const hasOwnProperty` or calling `new constructor()` found a
  native function sitting in the table and used it as a handler — reporting
  `error: function valueOf() { [native code] }`. All ten such lookups now go
  through `src/lookup.ts`, whose one line of `Object.hasOwn` is the fix
  (`tests/cases/decl_prototype_names`).
- **Contextual typing of non-integer literals** reaches two more positions: an
  array-literal element and a field assignment, so `const xs: f64[] = [0.5]`
  and `this.ratio = 0.25` compile in the default i32 number mode rather than
  being rejected as non-integer literals (`tests/cases/conv_f64_context`). An
  empty array literal likewise takes its element type from a field target, so
  `this.children = []` works in a constructor (`docs/wp14-selfhost.md` B4).
- **Fuzzer validity.** `tests/differential/fuzz.js` parses each generated
  program and re-rolls the seed while it has a syntax error, so a run no
  longer reports a compile error for a program TypeScript itself rejects
  (the `a < b > (c)` type-argument ambiguity; roughly one seed in 200).

### Changed

- **Runtime budget (WP9b).** `runtime/runtime.c` is back inside the
  `docs/MASTER_PLAN.md` budget without any observable change: `text` at `-Oz`
  4,195 -> 3,714 bytes (`.text` 2,637 -> 2,245, `.eh_frame` 1,344 -> 1,240),
  source 11,432 -> 9,392 bytes; the plain-message panics share one cold
  `amrit_die` and the two formatted ones (index, file path) are a single
  `dprintf` each instead of hand-written digit loops, the JS `Number#toString`
  formatter indexes the `%.*e` buffer directly and emits all four layouts from
  one digit loop, and the three chunk-freeing loops share `amrit_free_until`.
  Adding `amrit_str_from_u64` for the unsigned widths took it to 3,765 bytes,
  still inside the 4,096-byte budget: it shares the signed formatter's digit
  loop through a static `str_from_digits(value, negative)` helper.
  `scripts/size-report.sh` now prints a `runtime` row (the budget number) above
  the profile rows. Prototypes, symbols and `tests/runtime_test.c` are
  unchanged; see the "Runtime budget" section of
  [docs/wp9-optimisation.md](docs/wp9-optimisation.md).

[Unreleased]: https://github.com/amritk/compiler/compare/v0.1.0...HEAD

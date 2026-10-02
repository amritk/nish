# Codegen: bounds-check elimination, emitted attributes, thread rules

The security audit's record for the codegen stage (issue #363). It says what
was checked, how, what was found, and which test pins each answer. Base is
`main` at `fc12bf9`.

## Scope

| File | What was read |
| --- | --- |
| `src/bounds.ts` | the WP15 §2 prover: `impliesNonNegative`, `initialiserFacts`, `differenceFacts`, `addDisequalityFacts`, `provesClamp`, the loop and call summaries, and the verdicts it writes to `nodeProvenIndex` |
| `src/attributes.ts` | the whole-program fixpoint (`collectFacts`, `propagate`, `propagateCallee`), every attribute it emits (`readnone`/`readonly`, `willreturn`, `nounwind`, `nocapture`, `dereferenceable`, `align`), and the array facts (`collectArrayFacts`) |
| `src/escape.ts` | allocation sites (`visitCall`, `isAllocatingBuiltin`), flows (`flowTarget`, `assignedLocal`, `useOutcome`), the function arena scope, and the per-pass loop scope (`PassWalk.isOld`) |
| `src/parallel.ts` | the `parallelMapInto` / `parallelReduce` rules (`sharedWriteMessage`, `reachesDstMessage`, `resultMessage`, `arenaMessage`, `escapeMessage`, `reduceMessage`) and the `scope()` region rules (`collectUses`, `walkRegion`, `regionCallMessage`, `checkDestinations`) |
| `src/emit-arrays.ts` | `emitNewArray`, `emitArrayLength`, `emitBoundsCheck`, `emitElementAssignment`, `push` and `join` |
| `runtime/runtime.c` | `nish_alloc_struct`, `nish_arena_grow`, `nish_alloc_array`, `nish_array_grow` |

Read beside them, without owning them: `src/emit-ops.ts` (`nsw`), the
emitter's `inbounds` GEPs, `src/runtime.ts` (the inline allocator and the
runtime declarations' attributes), `src/emit-result.ts` (`orReturn`),
`runtime/runtime-os.c`, `runtime/runtime-wasm.c` and `runtime/runtime-parallel.c`.

## Threat model

The attacker controls the *input* of a well-typed program the compiler
accepted: every byte it reads, every length or count it parses from that
input, every file and directory it is pointed at, and how large those are.
The attacker does not write the program and does not choose its flags. The
programmer is honest but writes ordinary code: a length taken from a header,
a name returned from a directory listing, a task spawned on a record. A
finding is a program the compiler accepts, without `--unchecked-indexing`,
whose run reads or writes outside an object, reads freed memory, races, or
reaches LLVM undefined behaviour because of a check the compiler removed or
an attribute it emitted.

Signed overflow is undefined behaviour by the language's own rule
(`docs/LANGUAGE.md`, "Integer overflow"; `--wrapping` defines it), so a proof
that leans on `nsw` is sound by specification, and `--unchecked-indexing` is
the programmer's explicit opt-out of the bounds check. Neither is a finding.

## Method

- **Every elimination rule against a counter-program.** For each rule in
  `src/bounds.ts` a program was written to reach an out-of-range access once
  the check is gone: index arithmetic at `2^31 - 1`, `i - 1` at 0, negative
  and fractional `f64` indices, `u8`/`u16`/`u32`/`i64` indices, a bound
  re-read after `pop`, `push` and a callee that shrinks through an alias, a
  hoisted `const n = xs.length`, a counter assigned in the body, `break`,
  `continue` and nested loops, `for...of`, and a function instantiated with
  a function argument. Each was compiled, the `.ll` read for the
  `nish_panic_index` call, and the binary run natively.
- **Every attribute against its proof.** For each attribute kind the
  emitter writes, the rule in `docs/ARCHITECTURE.md` ("Attribute soundness
  rules") was compared with the code that sets it, and a program built to
  break it: recursion and mutual recursion under `willreturn`, panics,
  `expect`, `charCodeAt` and traps; `nocapture` on a returned, stored or
  `this`-attached parameter; `readonly` through an alias, a stack literal and
  an inline array field; `align`/`dereferenceable` on inline records. `opt
  -O2 -S` showed what LLVM did with each. `nsw` (`src/emit-ops.ts`) was
  checked against the overflow rule; `nuw`, `exact`, `!range`, `!nonnull`,
  fast-math flags and `lifetime.*` are not emitted anywhere.
- **Every arena scope against a use-after-free.** Function scopes and
  per-pass loop scopes were driven with every allocating builtin, with
  callees that push or store into a parameter, with `Map`/`Set` keys built in
  a loop, a template passthrough, and values handed out through a `Result`,
  an interface literal and an array literal. A corruption is visible: the
  freed bytes are overwritten by the next allocation and read back.
- **Every thread rule against a race.** `parallelMapInto`, `parallelReduce`
  and `scope()`/`spawn` were given bodies that write through a stack-literal
  alias, an identity function, a reassigned `let`, `this`, a constructor, a
  `Map`, a wrapper's parameter; a destination reachable through a field; and
  regions with every early exit. Binaries were built with ThreadSanitizer
  (clang for the objects, `libtsan` for the link) and run.
- **Lengths at the `i32` boundary.** Arrays of `2^31 - 1`, `2^31` and
  `2^32 + 5` elements were built by `push`, by `new Array(n)` with `n` of
  every numeric type in both number modes, and read from a sparse file, and
  their `length` read back.
- **What the IR changes.** `tests/nish-cmp.js` was run with the base
  compiler as reference and the declarations emptied, so that every byte
  this stage moves in the corpus is listed rather than admitted.

## Findings

| Id | Severity | Where (base) | Description | Disposition |
| --- | --- | --- | --- | --- |
| CG-1 | High | `src/emit-arrays.ts:1017` (`emitNewArray`) | `new Array<T>(n)` stored `n` in the header and allocated `n * sizeof(T)` bytes with no check on `n`. An `i64` `n` of 2^61 with 8-byte elements wrapped the byte count to 0, in either number mode, so the header claimed 2^61 elements over an empty block and every bounds check passed: `a[i] = v` wrote wherever `i` pointed (SIGSEGV in the reproducer, an arbitrary write in general). An `f64` `n` that is NaN or past 2^63 reached `fptosi`, whose answer is poison; on x86-64 it was -2^63, which wraps the same way. A `number` parsed from input is enough: `new Array<f64>(Number(field))` | **Fixed.** `newArrayLengthChecked` decides when the length needs a check (an `i64`/`u64` or a float in either mode, a `u32` under i32 mode; never an `i32` or a literal up to 2^31 − 1), and `emitNewArrayLength` emits one unsigned compare, or two float compares before the `fptosi`, against `min(mode limit, 2^62 / sizeof(T))`, then panics with `array length out of range`. `collectArrayFacts` reports the panic's callees so `willreturn` stays exact. Tests: `tests/link/cg_sec_new_array_wrap`, `cg_sec_new_array_f64`, `cg_sec_new_array_nan`, `cg_sec_new_array_i64`; IR pinned by `tests/cases/cg_sec_new_array_guard` |
| K1-6 | High | `src/emit-arrays.ts:1098` (`emitArrayLength`); `runtime/runtime.c:1164` (`nish_array_grow`) | Routed from `docs/security/crypto-k1.md`. Under `--number-mode i32` `a.length` truncates the `i64` length to `i32`, and nothing stopped an array growing past 2^31 − 1 elements, so `sha256`, `hmacSha256Verify` and `timingSafeEqual` of a 2^32 + 5 byte array saw 5 bytes | **Fixed for the sources this stage owns.** `nish_array_grow` refuses to take any array past 2^31 − 1 elements (it clamps the doubled capacity there, and panics `array length out of range` when a full array of that length is pushed); `new Array(n)` refuses such an `n` under i32 mode (CG-1). The runtime cannot tell which mode compiled its caller, so the push limit holds in f64 mode too: see the doc corrections. Tests: `tests/link/cg_sec_push_limit`, `tests/link/cg_sec_new_array_i64`, and the `nish_array_grow` block of `tests/runtime-test.c`. **Still open** for arrays and strings longer than that made elsewhere: `readFileBytesSync` and `readFileSync` (`runtime/runtime-os.c:112`, `:120`), `join` and string concatenation, and a C host's `nish_alloc_array` (CG-3) |
| CG-3 | High | `src/bounds.ts:1487` (`impliesNonNegative`), `:1528` (`initialiserFacts`); root in `src/emit-arrays.ts:1099` and `src/emit-strings.ts` (`.length`) | The prover takes every `.length` to be non-negative and at most the length. Under i32 mode a `u8[]` of 2^31 + 16 bytes read from a sparse file has `length` −2147483632, so `const n = xs.length; if (n !== 0) { const j = n - 1; xs[j] }` was proved in range and indexed `xs[-2147483633]` with no check (SIGSEGV). A string of that size loses `substring`'s clamp the same way and copies 2 GB from before its start | **Open.** Every fix moves IR far outside this stage: making `.length` panic (or saturate) when the length passes 2^31 − 1 under i32 mode changes every i32-mode `.length` read, so most `tests/cases/*.ll` goldens, `docs/IR_COOKBOOK.md` and the string half in `src/emit-strings.ts`; making the prover distrust lengths in i32 mode puts checks back into the corpus and std, which the performance gate refuses. This stage closed the two sources it owns (`push`, `new Array`); `runtime/runtime-os.c` (`readFileBytesSync`, `readFileSync`), `join` and concatenation remain. Recommended: the `.length` check under i32 mode, landed with its golden and cookbook regeneration and a `tests/nish-cmp.js` declaration |
| CG-5 | High | `src/escape.ts:120` (`isAllocatingBuiltin`), `:467` (`visitCall`), `:1217` (`PassWalk.isOld`) | `readdirSync` answers an array whose element strings were bumped by the same call. The scope rules assume a pointer read out of memory was not allocated with it, so `const names = readdirSync(d); return names[0]` left `first` with an arena scope that released the name before the caller read it (`CORRUPTED`, length 1364283729), and `keep = names[0]` in a loop pass did the same through the per-pass scope | **Fixed.** A listing's elements now flow as the listing (`isListingCall`, the `listing` mode of `flowTarget`/`assignedLocal`), and a pass's element read of a listing it made is not old (`isPassListing`). No corpus program's IR moved. Tests: `tests/cases/cg_sec_readdir_return`, `cg_sec_readdir_pass` |
| CG-6 | High | `src/emit-result.ts:538` (`emitOrReturn`, root); `src/parallel.ts` (`walkRegion`) | `r.orReturn()` inside a `scope()` block returned without joining it: the task stayed in the thread's list, and the next scope's join ran it, writing through a destination pointer into memory the first function's arena scope had released, which by then held another function's array (`1 5` where `1 5005` is right) | **Fixed by refusal.** `regionCallMessage` refuses a `Result`'s `orReturn` (`resultMethodName`) between a scope's first `spawn` and the end of its block (NL2394, the region rule). The emitter fix — `emitScopeJoins` before `emitScopeExit` in both propagate arms of `emitOrReturn` — is in `src/emit-result.ts`, outside this stage, and would let the refusal go. Test: `tests/cases/cg_sec_scope_or_return` |
| CG-7 | Medium | `src/parallel.ts:1035` (`collectUses`) | A task argument read out of a variable (`s.spawn(sumPt, ps[0], out, 0)`) left `ps` private, so `ps[0] = { x: 100, y: 200 }` before the join was accepted. A record element is the address of its slot and the task reads it at the join, so the native answer was 300 where Node prints 3, and the two raced under `--threads` | **Fixed.** `handOnRoot` hands the root variable of such an argument on (through each arm of a `?:` or `??` too), and the region refuses the store. `tests/link/thread_scope_many_arrays` (`rows[k]` as an argument) still compiles. Test: `tests/cases/cg_sec_scope_record_arg` |
| CG-2 | Medium | `src/runtime.ts:808` (`inlineAllocator`); `src/emit-arrays.ts:1017` | A negative `i32` `n` in `new Array<T>(n)` became a byte count past 2^63. The inline allocator adds 7 and adds the offset without an overflow check, so the bump "fits", moves the arena offset backwards, and the `memset` of ~2^64 bytes writes until it faults. The comment said the arena aborts; it does not. A crash on input (`new Array<u8>(parseInt(field))`) | **Open.** The fix is an overflow-safe fast path in the inline allocator (`src/runtime.ts`, every module's IR) paired with `nish_arena_grow` refusing a size past `SIZE_MAX`; checking `n` in `emitNewArray` instead moves the IR of every `new Array(n)` with an `i32` `n` in the corpus. The comment now says what happens |
| CG-4 | Medium | `src/attributes.ts:439`, `:1813`, `propagateCallee` | `willReturn` starts true and only a non-returning callee clears it, so a function on a call-graph cycle kept `willreturn`: `spin(x)` calling itself with the same `x` was `willreturn readnone`, and `opt -O2` deleted the call, so a program that should hang printed `returned` and exited 0. Mutual recursion behaves the same. `docs/ARCHITECTURE.md` says unbounded recursion is allowed by LangRef; it is not | **Open.** The fix (a walk from each function over its user callees that clears `willReturn` when it reaches itself, before `propagate`, as LLVM's FunctionAttrs never infers `willreturn` through recursion) was written and fixes both reproducers, but it moves at least ten existing `tests/cases/*.ll` goldens (`cf_fib`, `fn_arrow`, `gen_recursive_ground`, `mem_scope_tail_call`, …) and the compiler's own IR, which this stage may not regenerate |
| CG-8 | Low | `src/runtime.ts:337`, `:350`, `:353` | `nish_read_file`, `nish_write_file` and `nish_append_file` are declared `willreturn`, but `runtime-os.c` `_exit(1)`s on a missing or unwritable file and `open()` blocks on a FIFO with no writer; every caller inherits `willreturn`. The allocator's OOM exit is the same pattern, and so is `nish_array_grow`'s new refusal | **Open** (`src/runtime.ts`). No miscompile was observed: the calls write memory, so LLVM cannot delete them |
| CG-9 | Low | `runtime/runtime-wasm.c:61` | The wasm32 runtime's `nish_alloc_struct` rounds and adds without an overflow check, the same shape as CG-2 | **Open**, for the runtime stage |
| CG-10 | Low | `src/emit-arrays.ts:1059` (`emitElementAssignment`) | `xs[0] += grow(xs)` computes the slot's address before evaluating the right side, so when `grow` pushes until `xs` moves, the store lands in the old block: 1 where JavaScript gives 6. `zs[2] += shrink(zs)` stores past the new length, inside the old capacity. Arena memory is not freed, so neither is a memory error | **Open.** Recomputing the address after the right side changes the IR of every compound element assignment and its goldens |

## Properties verified

| Property | How it holds | Pinned by |
| --- | --- | --- |
| A length `new Array` cannot hold is refused before anything is allocated, in both modes | the compare is the first thing after the length is evaluated | `tests/cases/cg_sec_new_array_guard` (the IR and a run), `tests/link/cg_sec_new_array_*` |
| No push takes an array past 2^31 − 1 elements | `nish_array_grow` clamps the capacity and refuses a full array | `tests/link/cg_sec_push_limit`, `tests/runtime-test.c` |
| An `i32` length, a narrower unsigned, a ranged integer and a literal are not checked, so nothing in the corpus moved | `newArrayLengthChecked` | `tests/cases/cg_sec_new_array_guard` (the `plain` and `literal` arrays), and the nish-cmp run in the method |
| An index proved by its declared range (`u8` into 256 elements, `u16` into 65 536) is zero-extended and in range | `convertedRange` | `tests/cases/arr_bounds_ranged` |
| A bound re-read after `pop`, `push` or a shrinking callee keeps its check | the prover drops length facts at a resize (`resizesArray`) | `tests/cases/arr_bounds_shrink_panic`, `arr_bounds_store_rhs` |
| `for...of` re-reads the length every pass | the lowering, not a proof | `tests/cases/arr_for_of` |
| A call through an instantiation with a function argument takes no entry facts from it | the summaries are per instance | `tests/cases/arr_bounds_generic_instances*` |
| `willreturn` is cleared by a reachable panic, trap, `expect` or checked `charCodeAt`, and kept by `substring`'s clamp | `hasTrap`, `callsNoReturn` | `tests/cases/attr_panic_charcodeat`, `tests/cases/dump_shared_write_panic` |
| `nocapture` is withheld from a returned `this`, an identity function's parameter, a parameter a method stores, and one handed out through `Ok`, an interface literal or an array literal | `escaping`, `pointerParams` | `tests/cases/mem_callee_scope_escape`, `mem_callee_scope_return` |
| A callee that pushes into or stores into a parameter denies its caller an arena scope | `allocEscapes` propagated | `tests/cases/mem_callee_scope*`, `mem_loop_scope_escape` |
| Every allocating builtin is an allocation site | `isAllocatingBuiltin` | `tests/cases/mem_read_or_null_scope`, `mem_getenv_scope`, `mem_readdir_scope`, `mem_read_import_scope`, and now `cg_sec_readdir_*` |
| `nsw` appears only on signed `add`/`sub`/`mul` and never under `--wrapping` | `intOpcode` in `src/emit-ops.ts` | `tests/cases/opt_nsw`, `opt_wrapping` |
| A parallel body writes nothing its caller can see, through any alias the facts know | `sharedWrite` | `tests/cases/reject_par_shared_write`, `reject_par_shared_write_via` |
| `dst` is not reachable from an element of `src` | `reachingPath` | `tests/cases/reject_par_reaches_dst` |
| Between a scope's first `spawn` and its join the parent neither reads a destination nor writes what a task reads, and does not return early through `orReturn` | `walkRegion` | `tests/cases/reject_thread_region_*`, `cg_sec_scope_or_return`, `cg_sec_scope_record_arg` |
| `break`, `continue` and `return` join every scope they leave; a spawn argument allocated in a pass lives until the join | `emitScopeJoins` | `tests/link/thread_scope_exit_paths`, `thread_scope_many_arrays` |
| The partition in `runtime-parallel.c` is contiguous and computed in `i64`, and nested regions run sequentially | the runtime | `tests/link/par_map_large`, `par_reduce_blocks` |

## Doc corrections for the security-policy stage

- `docs/LANGUAGE.md`, the array table: `push` "grows capacity by doubling"
  should add that an array never grows past 2^31 − 1 elements, in either
  number mode, and that the push that would is a panic
  (`array length out of range`). `new Array(n)` should say that a length past
  2^31 − 1 under i32 mode, past 2^53 under f64, a negative `i64` or a NaN is
  the same panic.
- `docs/LANGUAGE.md`, `using` and `scope()`: `orReturn` is refused between a
  scope's first `spawn` and the end of its block, and so is a store into a
  variable whose element or field was handed to a task.
- `docs/ARCHITECTURE.md`, "Attribute soundness rules": the `willreturn` row's
  "unbounded recursion is allowed by LangRef" is wrong (CG-4); and the
  `nonnull align 8` row should say that an inline record of 4-byte fields is
  passed `align 4`.
- `std/README.md` (crypto): the K1-6 caveat from `crypto-k1.md` now reads: an
  array built by `push` or `new Array` cannot pass 2^31 − 1 elements, but one
  read by `readFileBytesSync`, and a string read by `readFileSync` or built
  by `join`, still can, and under i32 mode its `length` is wrong (CG-3).
- `tests/nish-cmp.js`: this stage's IR changes (the eight `*_long_f64` crypto
  programs, whose `new Array(n)` takes a `number` `n` under f64 mode) are
  admitted today only by the existing every-program declaration about `!tbaa`
  element tags, which admits any difference in any file. A declaration of
  their own would keep the next unrelated difference visible.

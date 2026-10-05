# WP1: Control flow

**Status: landed** before the first release (merged as `wp1/control-flow`,
b88b503): `if`/`else`, `while`, `do … while`, `for`, `break`/`continue`, the
ternary, short-circuit `&&`/`||`, compound assignment and `++`/`--`. `throw`
shipped too and was later removed (below). The rules are normative in
[LANGUAGE.md: Statements](LANGUAGE.md#statements), the IR for each construct
is in [IR_COOKBOOK.md: Statements](IR_COOKBOOK.md#statements) and
[Expressions](IR_COOKBOOK.md#expressions), and the code is `src/statements.ts`
(checking) and `src/emit-control.ts` (lowering). The goldens are
`tests/cases/cf_*.ts`, with `reject_cf_*.ts` for the refusals.

## Rules, and why

- **Conditions are `boolean`.** There is no truthiness coercion, so a
  condition always lowers to one `br i1`. `if (n)` on a number is an error.
- **Blocks are named as clang names them, unique per function**: `if.then`,
  `while.cond`, `for.inc`, `cond.end`, `land.rhs`, `lor.end` and so on, with a
  `.N` suffix on reuse. Labels are reserved in source order and placed in
  control-flow order. Named blocks consume no SSA number, so `%0` is still a
  function's first temporary.
- **Every block ends in exactly one terminator.** Nothing is appended after a
  `ret`, `br` or `unreachable`; `if.end` is not created when both arms return,
  and the exit block of an infinite loop without `break` ends in
  `unreachable`. Every module passes `llvm-as` and `opt -passes=verify`.
- **Termination analysis** in the checker: a statement terminates when control
  cannot fall out of it (`return`, `break`, `continue`, an `if` whose arms both
  terminate, an infinite loop with no `break` aimed at it). Any other loop may
  run zero times. A non-`void` function must terminate on every path, and code
  after a terminating statement is an error.
- **`break`/`continue` only inside a loop**, without labels; a `for`
  initialiser's `let` is scoped to the loop.
- **Mutable locals stay in allocas**, loaded and stored around loops with no
  hand-built phis. `mem2reg` rebuilds SSA form, so the output optimises
  exactly like clang's. The ternary and `&&`/`||` do use a `phi`, whose
  incoming labels are the blocks each arm *ends* in (a nested ternary's arm
  ends in the inner `cond.end`).
- **`&&`/`||` take and give `boolean`**, with no "value of the last operand"
  semantics; the right operand lives in its own block, so it is not evaluated
  when the left decides (`cf_logical.out`).
- **Compound assignment reads the target before the right-hand side**, as in
  JavaScript, and its value is the stored result; postfix `++`/`--` yields the
  old value, prefix the new. Integer arithmetic goes through one opcode helper,
  so these are flagged like every other integer operation: no `nsw` when this
  landed, `nsw` by default after WP15 §3, and since #426 checked unless the
  bounds walk proves the result fits.

## `throw`, removed

`throw` lowered to `llvm.trap` followed by `unreachable`: no unwinding, the
operand evaluated for its side effects and discarded. It terminated, and it
cost the function and every caller `readnone`/`readonly` and `willreturn`.
WP16 removed it: Phase 0 refuses it (`tests/cases/reject_throw`), a failure a
caller should handle is a `Result<T, E>`, and an invariant that cannot hold is
`panic(message)` ([wp16-results.md](wp16-results.md) §1).

## The `willreturn` rule

`willreturn` is emitted only when the compiler can prove the function returns.
WP1 set the loop half of that proof, and it still holds (`isCountedLoop` in
`src/attributes.ts`; the full current rule, including what panics and
recursion take away, is in
[ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules)):

1. **Every loop is a counted loop**:
   `for (let i = <init>; i CMP bound; STEP)` over `i32`, where `i` is the one
   `let` of the initialiser, `bound` is an identifier or a non-negative integer
   literal, STEP moves `i` toward the bound (`++`/`+= c` with `<`/`<=`,
   `--`/`-= c` with `>`/`>=`), and the body assigns neither `i` nor `bound`
   (matched by name, so a shadowing inner variable disqualifies,
   conservatively).
   - **The step must not be able to wrap.** The analysis takes the wrapping
     reading: `i <= n; i++` runs forever at `n === 2147483647` if arithmetic
     wraps and panics if it is checked, so it is refused either way. With an
     identifier bound only `<` with step `+1` and `>` with step `-1` are safe
     for every bound; with a literal bound any step is safe if the last
     in-range value plus the step still fits in `i32`.
   - **`f64` induction variables never qualify**, because `i++` is a no-op
     once `|i| >= 2^53`; under `--number-mode f64` the same loop drops
     `willreturn`.
   - `while`, `do` and every other `for` shape are unbounded. (`for...of`
     was added to the counted shapes by WP4.)
2. **Every callee is `willreturn`**, by a fixpoint over the call graph.
   Unbounded recursion was once allowed on the grounds that LangRef lets a
   `willreturn` function exhaust the stack; that was wrong in practice
   (`opt -O2` deleted a self-call), and every function on a call-graph cycle
   now loses the attribute (CG-4 in [security/codegen.md](security/codegen.md)).

`mustprogress` is never emitted: JavaScript allows infinite loops.

## Measured

`tests/run.js` requires `opt -O2 -mtriple=x86_64-unknown-linux-gnu` to
vectorise `cf_sum_loop` (`<4 x i32>` or `<8 x i32>`). The triple is needed
because the IR is target-neutral and `opt` will not vectorise without vector
registers; the body is `sum += i % 1000` because LLVM folds a plain
`sum += i` into `n*(n-1)/2` and leaves no loop. `cf_sum_loop_checked` pins
the opposite under today's default: with the overflow check in the loop it
does not vectorise.

At landing, `fib(35)` (`bench/fib.ts` against `bench/fib.c`, speed profile)
ran in 0.030 s for both, with identical 4,592-byte binaries.
[bench/README.md](../bench/README.md) has the current suite.

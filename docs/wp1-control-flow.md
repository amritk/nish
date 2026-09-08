# WP1: Control flow

What `if`/`else`, `while`, `do … while`, `for`, `break`/`continue`, `throw`,
the ternary, short-circuit `&&`/`||`, compound assignment and `++`/`--`
compile to, and the rules the checker enforces around them. Every IR listing
below is the exact text of a golden in `tests/cases/` (module header
omitted), so this file doubles as the cookbook for these constructs.

Code lives in `src/checker/control-flow.ts` (rules, termination analysis)
and `src/codegen/emit/control-flow.ts` (lowering); both register into the
existing dispatch tables with a spread. `src/codegen/attributes.ts` owns the
`willreturn` analysis described at the end.

## Rules

- **Conditions are `boolean`.** `if (n)` on a number is a compile error
  ("Condition must be boolean, got i32"). There is no truthiness coercion,
  so a condition always lowers to `br i1 %c, label %a, label %b`.
- **Blocks are named and unique per function.** `if.then`, `if.else`,
  `if.end`, `while.cond`, `while.body`, `while.end`, `do.body`, `do.cond`,
  `do.end`, `for.cond`, `for.body`, `for.inc`, `for.end`, `cond.true`,
  `cond.false`, `cond.end`, `land.rhs`, `land.end`, `lor.rhs`, `lor.end`.
  A name that is reused gets a `.N` suffix (`if.then.1`). Labels are
  reserved in source order and the blocks placed in control-flow order, as
  clang does. Named blocks never consume an SSA number, so `%0` is still the
  first temporary of every function.
- **Every block ends in a terminator.** A block that already ended with
  `ret`, `br` or `unreachable` (after `return`, `break`, `continue`,
  `throw`) is never appended to. `if.end` is not created when both arms
  return; `for.end` is not created for a `for (;;)` without `break`; the exit
  block of `while (true)` / `do … while (true)` / `for (; true;)` without a
  `break` is created (the `br i1` references it) and ends in `unreachable`.
  Every emitted module passes `llvm-as` and `opt -passes=verify`.
- **Termination analysis.** A statement "terminates" when control cannot
  fall out of it: `return`, `break`, `continue`, `throw`; an `if` whose
  branches both terminate; an infinite loop (`while (true)`, `do … while
  (true)`, `for (;;)`, `for (; true;)`) with no `break` aimed at it. Any other
  loop may run zero times and never terminates. A non-`void` function must
  terminate on every path, and code after a terminating statement is an
  error ("Unreachable code after break").
- **`break`/`continue`** are only valid inside a loop (labels are not
  supported). **`let` in a `for` initializer** is scoped to the loop.
- **Mutable locals stay in allocas.** Loops load and store them; no phis are
  emitted for loop-carried values. `opt -mem2reg` (part of `-O1`) rebuilds
  the SSA form, so the pattern below optimises exactly like clang's output.
- **Integer arithmetic stays plain** (no `nsw`): compound assignment and
  `++`/`--` wrap like every other AmritScript integer operation.

## `if` / `else`

```ts
function abs(x: number): number {
  if (x < 0) {
    return -x;
  }
  return x;
}

function pick(flag: boolean, a: number, b: number): number {
  let r = 0;
  if (flag) {
    r = a;
  } else {
    r = b;
  }
  return r;
}
```

```llvm
define noundef i32 @abs(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub i32 0, %x
  ret i32 %1

if.end:
  ret i32 %x
}

define noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %r.addr = alloca i32, align 4
  store i32 0, i32* %r.addr, align 4
  br i1 %flag, label %if.then, label %if.else

if.then:
  store i32 %a, i32* %r.addr, align 4
  br label %if.end

if.else:
  store i32 %b, i32* %r.addr, align 4
  br label %if.end

if.end:
  %0 = load i32, i32* %r.addr, align 4
  ret i32 %0
}
```

`if.then` in `abs` ends with `ret`, so no `br label %if.end` is added to it.
An `else if` chain is an `if` nested in the `else` arm and gets the next
label numbers (`cf_if_else_chain.ll`: `if.then`, `if.else`, `if.then.1`,
`if.else.1`, `if.then.2`, `if.else.2`; no `if.end` at all because every arm
returns).

## `while`

```ts
function countDigits(n: number): number {
  let digits = 0;
  let rest = n;
  while (rest > 0) {
    rest = rest / 10;
    digits = digits + 1;
  }
  return digits;
}

function firstPowerOver(limit: number): number {
  let x = 1;
  while (true) {
    x = x * 2;
    if (x > limit) {
      return x;
    }
  }
}
```

```llvm
define noundef i32 @countDigits(i32 noundef %n) #0 {
entry:
  %digits.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %digits.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %rest.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %rest.addr, align 4
  %3 = sdiv i32 %2, 10
  store i32 %3, i32* %rest.addr, align 4
  %4 = load i32, i32* %digits.addr, align 4
  %5 = add i32 %4, 1
  store i32 %5, i32* %digits.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %digits.addr, align 4
  ret i32 %6
}

define noundef i32 @firstPowerOver(i32 noundef %limit) #0 {
entry:
  %x.addr = alloca i32, align 4
  store i32 1, i32* %x.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %x.addr, align 4
  %1 = mul i32 %0, 2
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = icmp sgt i32 %2, %limit
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %x.addr, align 4
  ret i32 %4

if.end:
  br label %while.cond

while.end:
  unreachable
}

attributes #0 = { nounwind readnone }
```

`firstPowerOver` has no `return` after the loop and still type-checks: a
`while (true)` without `break` terminates. Its `while.end` is unreachable
and says so. Both functions lose `willreturn` (see below).

## `do … while`

```ts
function sumDigits(n: number): number {
  let sum = 0;
  let rest = n;
  do {
    sum += rest % 10;
    rest = rest / 10;
  } while (rest > 0);
  return sum;
}
```

```llvm
define noundef i32 @sumDigits(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %sum.addr, align 4
  %1 = load i32, i32* %rest.addr, align 4
  %2 = srem i32 %1, 10
  %3 = add i32 %0, %2
  store i32 %3, i32* %sum.addr, align 4
  %4 = load i32, i32* %rest.addr, align 4
  %5 = sdiv i32 %4, 10
  store i32 %5, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %6 = load i32, i32* %rest.addr, align 4
  %7 = icmp sgt i32 %6, 0
  br i1 %7, label %do.body, label %do.end

do.end:
  %8 = load i32, i32* %sum.addr, align 4
  ret i32 %8
}
```

`continue` inside a `do` body jumps to `do.cond`, `break` to `do.end`.

## `for`

```ts
function factorial(n: number): number {
  let acc = 1;
  for (let i = 2; i <= n; i++) {
    acc = acc * i;
  }
  return acc;
}
```

```llvm
define noundef i32 @factorial(i32 noundef %n) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %acc.addr, align 4
  store i32 2, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sle i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %acc.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = mul i32 %2, %3
  store i32 %4, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %acc.addr, align 4
  ret i32 %7
}
```

The `let i` alloca is hoisted to `entry` like every other local, which is
what keeps the loop `mem2reg`-friendly. `continue` jumps to `for.inc`. All
three clauses are optional: without a condition the loop head is `for.body`
and `for.cond` is not emitted; without an incrementor `for.inc` is not
emitted and `continue` jumps to the head; `for.end` is emitted only when the
condition or a `break` can reach it. `largestPowerOfTwo` in
`cf_break_continue.ll` shows the `for (;;)` shape:

```llvm
define noundef i32 @largestPowerOfTwo(i32 noundef %limit) #0 {
entry:
  %p.addr = alloca i32, align 4
  store i32 1, i32* %p.addr, align 4
  br label %for.body

for.body:
  %0 = load i32, i32* %p.addr, align 4
  %1 = mul i32 %0, 2
  %2 = icmp sgt i32 %1, %limit
  br i1 %2, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %3 = load i32, i32* %p.addr, align 4
  %4 = mul i32 %3, 2
  store i32 %4, i32* %p.addr, align 4
  br label %for.body

for.end:
  %5 = load i32, i32* %p.addr, align 4
  ret i32 %5
}
```

## `break` / `continue`

```ts
function sumOdd(n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      continue;
    }
    s += i;
  }
  return s;
}
```

```llvm
define noundef i32 @sumOdd(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = srem i32 %2, 2
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %5 = load i32, i32* %s.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = add i32 %5, %6
  store i32 %7, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %s.addr, align 4
  ret i32 %10
}
```

A `break` is `br label %<loop>.end`, a `continue` is `br label
%<loop>.cond` (`while`, `do`) or `%for.inc` / the loop head (`for`). Both
terminate the statement list they are in, so `if.then` above gets no second
branch. Outside a loop they are errors ("`break` outside of a loop").

## `throw`

> **Superseded by WP16.** `throw` is gone: Phase 0 rejects it
> (`tests/cases/reject_throw`), a failure a caller should handle is a
> `Result<T, E>`, and an invariant that cannot hold is `panic(message)`.
> The reasoning is in [wp16-results.md](wp16-results.md) §1; what follows
> records what `throw` did while it existed.


```ts
function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw 1;
  }
  return a / b;
}

function neverReturns(): number {
  throw 42;
}
```

```llvm
declare void @llvm.trap()

define noundef i32 @checkedDiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @llvm.trap()
  unreachable

if.end:
  %1 = sdiv i32 %a, %b
  ret i32 %1
}

define noundef i32 @neverReturns() #0 {
entry:
  call void @llvm.trap()
  unreachable
}

attributes #0 = { nounwind }
```

There is no unwinding: `throw` evaluates its operand (for side effects),
traps, and the block ends in `unreachable`. Any non-`void` operand type is
accepted; the value is discarded until strings land (WP3), at which point
this becomes print + abort. `throw` terminates, so `neverReturns` needs no
`return`. Because `llvm.trap` is a side effect that never returns, a
function containing `throw` is neither `readnone`/`readonly` nor
`willreturn`, and neither is anything that calls it (`test` above).

## Ternary `c ? a : b`

```ts
function max(a: number, b: number): number {
  return a > b ? a : b;
}

function sign(x: number): number {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}
```

```llvm
define noundef i32 @max(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp sgt i32 %a, %b
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ %a, %cond.true ], [ %b, %cond.false ]
  ret i32 %1
}

define noundef i32 @sign(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = sub i32 0, 1
  br label %cond.end

cond.false:
  %2 = icmp sgt i32 %x, 0
  br i1 %2, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %3 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  br label %cond.end

cond.end:
  %4 = phi i32 [ %1, %cond.true ], [ %3, %cond.end.1 ]
  ret i32 %4
}
```

Both arms must have the same non-`void` type. The phi's incoming labels are
taken from whichever block each arm *ends* in, which is why the outer phi in
`sign` takes its false value from `cond.end.1`, not `cond.false`.

## Short-circuit `&&` / `||`

```ts
function quotientOver(x: number, k: number): boolean {
  return 100 / x > k;
}

function bigQuotient(x: number): boolean {
  return x !== 0 && quotientOver(x, 3);
}

function zeroOrSmallQuotient(x: number): boolean {
  return x === 0 || 100 / x < 50;
}
```

```llvm
define noundef zeroext i1 @bigQuotient(i32 noundef %x) #0 {
entry:
  %0 = icmp ne i32 %x, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = call i1 @quotientOver(i32 %x, i32 3)
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define noundef zeroext i1 @zeroOrSmallQuotient(i32 noundef %x) #0 {
entry:
  %0 = icmp eq i32 %x, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = sdiv i32 100, %x
  %2 = icmp slt i32 %1, 50
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %entry ], [ %2, %lor.rhs ]
  ret i1 %3
}
```

Operands and result are `boolean` (no JS "value of the last operand"
semantics; `a && b` on numbers is an error). The right operand lives in its
own block, so `bigQuotient(0)` never divides by zero; `cf_logical.out`
checks that natively.

## Compound assignment `+= -= *= /= %=`

```ts
let x = 10;
x += 5;
x /= 5;
let y = 2;
y += x += 1;
```

```llvm
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = add i32 %0, 5
  store i32 %1, i32* %x.addr, align 4
  ...
  %6 = load i32, i32* %x.addr, align 4
  %7 = sdiv i32 %6, 5
  store i32 %7, i32* %x.addr, align 4
  ...
  store i32 2, i32* %y.addr, align 4
  %10 = load i32, i32* %y.addr, align 4
  %11 = load i32, i32* %x.addr, align 4
  %12 = add i32 %11, 1
  store i32 %12, i32* %x.addr, align 4
  %13 = add i32 %10, %12
  store i32 %13, i32* %y.addr, align 4
```

Load the target, evaluate the right-hand side, apply the operator, store;
the expression's value is the stored result. As in JS the target is read
before the right-hand side is evaluated (`%10` before `%12`). The target
must be a mutable numeric local (`const` and parameters are rejected with
the usual "Cannot assign to …" message); `f64` targets use `fadd`/`fmul`/…
(`scale` in `cf_compound_assign.ll`).

## `++` / `--`

```ts
let i = 5;
const a = i++;   // a = 5, i = 6
const b = ++i;   // b = 7, i = 7
```

```llvm
  store i32 5, i32* %i.addr, align 4
  %0 = load i32, i32* %i.addr, align 4
  %1 = add i32 %0, 1
  store i32 %1, i32* %i.addr, align 4
  store i32 %0, i32* %a.addr, align 4
  %2 = load i32, i32* %i.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  store i32 %3, i32* %b.addr, align 4
```

Same load/op/store sequence; postfix yields the old value (`%0`), prefix
the new one (`%3`). On `f64` the step is `fadd double %v, 0x3FF0000000000000`
(`bump` in `cf_incdec.ll`).

## The `willreturn` rule

`willreturn` is emitted only when the checker can prove the function cannot
fail to return. A function keeps it when all of the following hold
(`src/codegen/attributes.ts`):

1. **Every loop in the body is a counted loop.** A counted loop is
   `for (let i = <init>; i CMP bound; STEP) body` over `i32` where
   - `i` is a single `let` declared in the initializer;
   - `bound` is an identifier or a non-negative integer literal;
   - STEP moves `i` toward the bound: `i++`, `++i`, `i += c` with `<`/`<=`,
     or `i--`, `--i`, `i -= c` with `>`/`>=` (`c` a positive literal);
   - the body assigns neither `i` nor `bound` (any assignment form, matched
     by name, so assigning a shadowing inner variable of the same name also
     disqualifies, conservatively) and contains no `throw`;
   - the step cannot wrap. i32 arithmetic wraps, so `i <= n; i++` runs
     forever when `n === 2147483647`. With an identifier bound only `<`
     with step `+1` and `>` with step `-1` are wrap-free for every possible
     bound value; with a literal bound any step is fine as long as the last
     in-range value plus the step still fits in i32.

   `f64` induction variables never qualify (`i++` is a no-op once
   `|i| >= 2^53`), so `for (let i = 0; i < n; i++)` under `--number-mode f64`
   drops `willreturn`. `while`, `do`, and every other `for` shape are treated
   as unbounded.
2. **No `throw`** in the body: `llvm.trap` never returns.
3. **Every callee is `willreturn`** (user functions via a fixpoint over the
   call graph, runtime functions via their declared attributes). Unbounded
   recursion is fine: LangRef lets a `willreturn` function exhaust the stack.

`mustprogress` is never emitted: JS allows infinite loops.

Examples from the goldens: `sumTo` in `cf_sum_loop.ll` (`i < n; i++`, `n`
a parameter) keeps `nounwind willreturn readnone`; `factorial` in
`cf_for.ll` (`i <= n`) and every `while` loop drop `willreturn`; `test` in
`cf_while.ll` has no loop of its own but calls two that do, so it drops it
too; `cf_throw.ll` is `nounwind` only.

## Checks

`tests/run.js` compiles every `cf_*.ts` to a golden `.ll`, assembles it with
`llvm-as`, runs `opt -passes=verify`, links `cf_*.out` cases with the C
driver and compares stdout (fib 6765+610, gcd 6, collatz(27) 111, sum 0..999
499500, and one round trip per construct), and rejects each
`reject_cf_*.ts` with its `.err` message. It also runs
`opt -O2 -S -mtriple=x86_64-unknown-linux-gnu build/test/cf_sum_loop.ll` and
requires `<4 x i32>` or `<8 x i32>` in the output. The triple is needed
because the IR is target-neutral and `opt` will not vectorise without
knowing it has vector registers; the loop body is `sum += i % 1000` because
LLVM folds a plain `sum += i` into `n*(n-1)/2` and there is no loop left.

Benchmark (`bench/fib.ts`, `bench/fib.c`, `fib(35)` = 9227465, speed
profile, this container):

```bash
node dist/index.js bench/fib.ts -o build/bench/fib.ll
scripts/build.sh build/bench/fib.ll runtime/runtime.c tests/driver.c -o build/bench/fib_ts --profile speed
scripts/build.sh bench/fib.c -o build/bench/fib_c --profile speed
```

| | run 1 | run 2 | run 3 | binary |
| --- | ---: | ---: | ---: | ---: |
| AmritScript | 0.030 s | 0.031 s | 0.030 s | 4592 B |
| C | 0.030 s | 0.031 s | 0.033 s | 4592 B |

# WP28 spike S4: `Promise.all` as a fork/join, against `parallelReduce`

`--async-model threads` would lower a non-interfering
`await Promise.all([f(), g()])` to a fork/join on `scope()`
([docs/wp28-compatibility-mode.md](../../docs/wp28-compatibility-mode.md), §6.4),
and the note counts the speedup as that model's second payoff. The model is
not built, so this spike writes the lowering by hand and measures it against
the two calls made one after the other and against `parallelReduce` on the
same work.

```sh
npm run build                          # build/nish
node bench/wp28-s4/run.mjs             # six task sizes, 11 rounds, about three minutes
node bench/wp28-s4/run.mjs --quick     # three rounds
```

`--rounds <n>` sets the timed rounds and `--compiler <nish>` names another
compiler.

## The verdict

**The payoff is real above a task of about 16 µs and a loss below it. On
this machine a fork/join of two tasks costs about 16 µs more than the work it
shares out, so it runs the pair in 0.882x of the sequential time at 20 µs a
task, 0.627x at 101 µs and 0.504x at 10.7 ms, and in 1.271x at 10 µs and
9.419x at 1 µs.**

What that argues: §6.4's second payoff holds for calls worth tens of
microseconds or more, and a fork taken on every non-interfering
`Promise.all` whatever its calls cost would make the small ones up to nine
times slower here. How the lowering tells the two apart is a design question
this spike does not answer.

Against `parallelReduce`: below 2^20 elements a reduce is one block on the
calling thread, so at every size but the largest it is the sequential fold
(0.977x to 1.014x of it) and the fork/join is the only form that forks at
all. At the largest size, 5 000 000 elements in five blocks, the reduce runs
in 0.381x of the sequential time and the fork/join in 0.504x: the reduce is
1.32 times as fast because it uses more than the two cores a two-call
`Promise.all` can use. The fork/join is within 1% of the 0.5x two tasks
could reach.

## The programs

One kernel, [`kernel.ts`](kernel.ts): the product of an array's elements
modulo the prime 46337. It is pure, so two calls on two arrays do not
interfere; it is associative, so `parallelReduce` folds the same elements
with the same operator; and each multiply waits on the last, so its cost is
linear in the length, about 4 ns an element.

| program | what it runs per call |
| --- | --- |
| [`sequential.ts`](sequential.ts) | `product(a)`, then `product(b)`, combined |
| [`fork-join.ts`](fork-join.ts) | the two as tasks on `using s = scope()`, joined, combined |
| [`reduce.ts`](reduce.ts) | `parallelReduce` over `a` then `b` as one array |

Each takes the elements per task and the number of calls as arguments,
stores a value derived from the checksum back into the input after every
call, and prints the checksum. The harness stops if two runs of one size
print different checksums.

## The figures

4 logical CPUs, Intel(R) Xeon(R) Processor @ 2.30GHz, no cgroup CPU quota,
linux-x64, nish 0.38.0 at 890bc4f9, node v22.23.4, LLVM 18. 11 interleaved
rounds after one warm-up. 890bc4f9 is the commit that last changed the
programs and the harness; the commits after it change this file only.

One task is half a sequential call. A time is the median wall time of the
whole process less the median of the same binary's zero-call run in the same
rounds, its start-up and the fill of its arrays. A ratio is a form's time
over the sequential time; the band is the gap between the sequential binary
and a byte-identical copy of it in the same rounds.

| elements per task | one task | calls | sequential, per call | fork/join, per call | ratio | reading | reduce, per call | ratio | reading | band | start-up and fill | checksum |
| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| 250 | 0.98 µs | 100000 | 1.96 µs | 18.4 µs | 9.419x | slower | 1.98 µs | 1.014x | slower | ±0.3% | 2.51 ms | 7487678 |
| 2500 | 10.00 µs | 10000 | 20.0 µs | 25.4 µs | 1.271x | slower | 19.8 µs | 0.991x | within the band | ±1.6% | 2.56 ms | 16244414 |
| 5000 | 20.2 µs | 5000 | 40.4 µs | 35.6 µs | 0.882x | faster | 39.8 µs | 0.986x | faster | ±0.5% | 2.35 ms | 10291506 |
| 10000 | 41.1 µs | 4000 | 82.2 µs | 58.1 µs | 0.707x | faster | 80.3 µs | 0.977x | at the band's edge | ±1.9% | 2.75 ms | 13015432 |
| 25000 | 101 µs | 2000 | 203 µs | 127 µs | 0.627x | faster | 201 µs | 0.991x | at the band's edge | ±0.8% | 2.46 ms | 3873713 |
| 2500000 | 10.7 ms | 40 | 21.4 ms | 10.8 ms | 0.504x | faster | 8.17 ms | 0.381x | faster | ±0.4% | 15.3 ms | 14678537 |

Break-even: the fork/join is last slower outside the band at a 10.0 µs task
(1.271x) and first faster outside it at 20.2 µs (0.882x); interpolated
between the sizes either side of 1.000x, the ratio crosses 1 at a task of
about 15.9 µs.

What one fork/join costs over the work it shares out, its call less half a
sequential call: 17.4 µs at 250, 15.4 µs at 2500, 15.4 µs at 5000, 17.0 µs at
10000, 25.8 µs at 25000, 95.9 µs at 2500000.

Reading them:

- **The break-even is the overhead.** A pair costs `2t` in sequence and
  `t + o` forked, so the two meet where a task takes `o`. The measured
  overhead is 15 to 17 µs at the four smallest sizes and the interpolated
  crossing is 15.9 µs: the two readings agree. The 1 µs, 100 µs and 10 ms
  tasks the spike asked for are rows 1, 5 and 6; rows 2 to 4 are there to
  narrow the bracket to 10.0 µs–20.2 µs.
- **The overhead is one hand-off to the pool and one wait for it**, not a
  thread start: a scope's first task runs on the thread that opened it and
  the second on a pooled worker (`nish_scope_join` in
  `runtime/runtime-parallel.c`), plus the two-slot result array and the two
  task records each call allocates.
- **The overhead grows with the task, and stays small beside it.** It is
  25.8 µs at a 101 µs task and 95.9 µs at 10.7 ms, which is 0.9% of that
  task. This run does not say why it grows. The start-up and fill column is
  why it is taken out: at the largest size it is 15.3 ms against 40 calls,
  and left in every time it would put about 190 µs a call into this figure
  that no fork/join spent.
- **At the one-block sizes the reduce is the sequential fold, to within
  2.3%.** It is 1.4% slower at the smallest size, outside the band, and
  0.9% to 2.3% faster at the other four, outside the band at one of them.
  No thread is started, so none of that is a parallel effect.
- **The band is one binary against its copy at one size.** A ratio closer to
  1 than the largest band in the table, ±1.9%, is best read as no
  difference.

## What the lowering has to do with it

- **The compiler sees the calls, not their cost.** The number a fork has to
  beat is about 16 µs a task on this machine; a machine with more expensive
  wake-ups moves it up.
- **Two tasks use two cores.** A `Promise.all` of two calls tops out at 2x
  whatever the machine has. The data-parallel forms are still how a program
  uses every core, and §6.4's payoff does not replace them.
- **The result array is part of the lowering.** A `spawn` destination must be
  a fresh `const` local, so `pair` allocates its two slots on every call,
  as the lowered `Promise.all` would allocate its result. That cost is in
  every figure above.

## The fork/join site

`pair` in [`fork-join.ts`](fork-join.ts):

```typescript
const pair = (a: i32[], b: i32[]): i32 => {
  const out: i32[] = [0, 0]
  {
    using s = scope()
    s.spawn(product, a, out, 0)
    s.spawn(product, b, out, 1)
  }
  return mulmod(out[0], out[1])
}
```

and its IR, `@pair` in `build/bench/wp28-s4/ir-fork-join/fork-join.ll` after
a run, as the compiler writes it before `opt`: the result array, the scope,
the two spawns, the join where the block ends, then the two loads and the
combine.

```llvm
define internal noundef i32 @pair(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %b) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.7.product(%struct.ThreadScope* %12, %struct.nish_array* %a, %struct.nish_array* %13, i32 0)
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.7.product(%struct.ThreadScope* %14, %struct.nish_array* %b, %struct.nish_array* %15, i32 1)
  call void @nish_scope_join(i8* %11)
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 1, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 1
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %arena.mark)
  %34 = tail call i32 @mulmod(i32 %24, i32 %33)
  ret i32 %34
}
```

## What this run does not cover

- One callee over one array argument. `pair` uses the documented form of
  `spawn`, a top-level entry and a destination slot, with `product` as the
  entry of both tasks. A `Promise.all([f(), g()])` of two different callees,
  or of calls with other argument shapes, would need the arrow-capture form,
  and its cost is not measured.
- One machine, four logical CPUs, one run of 11 rounds. The break-even is a
  property of the machine's wake-up cost as much as of the lowering.
- Two tasks only. A `Promise.all` of `N` calls hands `N - 1` tasks to the
  pool and its overhead was not measured.
- A scope opened inside a task or a parallel chunk runs its tasks on that one
  thread, in order (`nish_jobs_run` in `runtime/runtime-parallel.c`), so a
  `Promise.all` nested in another forks nothing. That is not measured here.
- The kernel reads memory and writes none. Two calls that allocate would
  also contend on the allocator.

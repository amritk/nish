# WP51: References to capture-free top-level functions — designed and measured

**Status: proposed, design only.** Nothing in the compiler, the runtime, `std/`
or the tests changes with this note; every program it measured lives in §12 and
was not committed. [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors are
at `350bad84`. Part of #1348.

Today a function is never a value in Nish. A function-typed *parameter* exists
([LANGUAGE.md](LANGUAGE.md#function-parameters),
[wp23-language-surface.md](wp23-language-surface.md) §6), but only for a
callee the checker can name at the call: each callee is its own instantiation
and the IR holds a direct call. A field, a local, an array element or a return
value of function type is refused. This note asks whether a narrow kind of
function value could be admitted without paying what
[wp28-compatibility-mode.md](wp28-compatibility-mode.md) §7.4 measured a
function value to cost (1.26x to 1.40x for the call, 8.76x for the escape proof
it forfeits), measures the proposed lowering, and recommends one answer.

**The proposal.** The whole program is visible, so for each function signature
the set of top-level functions the program ever stores is closed and known at
compile time, and so is, for each call, the part of it that can reach the
call. A *reference* to a capture-free top-level function is a small
integer **tag** into that set. A call through a reference lowers to a `switch`
over the members that can reach it, with a direct call in each arm. The attribute fixpoint, the escape
analysis and every other whole-program pass see that `switch` as an ordinary
function with ordinary direct calls, so they take the **join of the set's
facts** instead of giving up. Closures — anything that captures — stay refused,
and so does passing a reference across the C boundary.

## 1. The decision

**Strict, on one condition: stage 1 ships per-site sets.** Admit references
to capture-free top-level functions in the default language, lowered as a tag
and a `switch` over a closed set (§2.3). Keep closures, `Function` and
references across the C boundary refused.

- **The call.** On a monomorphic site and on a periodic mixed stream the
  switch measured within ±3% of a direct call for sets of up to four, and 3.1x
  to 4.7x faster than an indirect call (§3.2, §3.3). On an aperiodic stream the
  selection itself mispredicts: the switch costs 2.4x to 4.5x a direct call,
  which a hand-written `switch` pays the same, and an indirect call only 1.07x
  to 1.28x more than the switch (§3.4).
- **The escape proof** survives the dispatched call when every member of the
  set keeps the object local (§4). When one member does not, every call of the
  set loses it: 7.0x and 1.5 GB in the spike.
- **The condition.** A hand-written `switch` joins only its own arms; one
  dispatcher per signature joins every function of that signature the program
  names. With per-signature sets a program rewritten from a `switch` to
  references can get slower, which is wp28's test for compat. So the set a
  call dispatches over must be the members that can reach that call (§2.3,
  §8). If stage 1 cannot deliver that, the construct goes to compat until it
  can.

## 2. The rule

### 2.1 What is admitted

A **function reference** is a value of a function type `(p: P, ...) => R`
held anywhere a value can be held: a field, a local, an array element, a
`Map` value, a return value, or an argument to a function-typed parameter. Its
value is one of the program's **capture-free top-level functions** with exactly
that signature, named without calling it: `const h: (x: i32) => i32 = double;`.

| Construct | Today | Proposed |
| --- | --- | --- |
| `const h: (x: i32) => i32 = double;` | refused: a function type annotates only a parameter | admitted: `h` is a reference, an `i32` tag |
| `class Op { f: (a: i32, b: i32) => i32; }` | refused | admitted: the field is an `i32` tag |
| `const ops: ((x: i32) => i32)[] = [inc, dec];` | refused | admitted: an `i32[]` of tags |
| `return pick ? inc : dec;` with a function return type | refused | admitted |
| `h(3)`, `this.f(a, b)`, `ops[i]` called with `x` | — | a call through the reference: `switch` over the signature's set (§2.3) |
| `apply(h, 3)` where `apply` has a function-typed parameter | refused: `h` is not nameable | admitted: `apply` instantiates **once per set**, `$fn.ref.<set>`, its call through the parameter a `switch` |
| `apply(double, 3)` | admitted, a direct-call instantiation | unchanged |
| `h === double`, `h !== k` | refused | admitted: tag equality (§5.1) |
| `h: ((x: i32) => i32) \| null`, `h === null` | refused: `T \| null` takes a class, interface, array or string, never a scalar (`reject_nullable_scalar`) | admitted by a **new rule**, an exception to `reject_nullable_scalar` for function types only: tag `0` is `null` (§2.3), so zero-filled storage reads as `null` as it does for every other `U \| null` |
| `new Array<(x: i32) => i32>(n)`, module storage of a function type | — | refused, as for an enum with no zero member (NL2520; NL2687 in `src/module-storage.ts:306`): zero is no member's tag. Module storage refuses `\| null` already (NL2686), so it holds no reference at all. `new Array<((x: i32) => i32) \| null>(n)` is admitted. A field is covered by definite assignment (`LANGUAGE.md:2764`) |

### 2.2 What stays refused

| Construct | Why | Diagnostic (proposed wording) |
| --- | --- | --- |
| an arrow or nested function that captures a local, a parameter or `this` | a closure needs an environment, which is what wp28 §7.4's 8.76x is about | `` this arrow captures `n`: a function reference names a top-level function and carries no environment `` |
| an arrow that captures nothing, written in value position | admitted only by lifting it to a top-level function with a generated name; deferred to stage 3 | `` an arrow in value position is not yet a function reference: declare it as a top-level function and name it `` |
| a method, `o.m` without a call, or a static method | a method has a receiver | `` `o.m` is a method: a function reference names a top-level function, and a method needs its receiver `` |
| a generic function, `id` or `id<i32>`, by reference | an instantiation is a different function natively and the same object under Node, so `===` would disagree (§5.1) | `` `id` is generic: a function reference names one non-generic top-level function `` |
| a function with a function-typed parameter, by reference | it is a template over its callees; the reference would be a function value by another name (`src/generics.ts:1740`) | `` `apply` takes a function parameter, so it has no single body to refer to `` |
| a function with a rest, default or optional parameter, by reference | a call through the reference cannot fill what the signature leaves out, and Node would gather or default differently; today a function with a rest parameter is never passed as a function value (`LANGUAGE.md:1708`–`1712`, `reject_param_rest_function_value`), and the rule extends to default and optional parameters | `` `f` has a rest parameter: a function reference names a function whose every parameter the caller passes `` |
| an `async` function, by reference | its call makes a promise, and a promise is not a value (wp24); a reference would be one by another route | `` `f` is async: a function reference cannot hold it, because its call is a promise `` |
| a `declare function`, by reference | a C function is in no set: the tag indexes this program's own functions | `` `f` is declared in C: a function reference names a function this program defines `` |
| a reference as `spawn`'s task | a task is named at the call (NL2546) so a debugger and a profiler can name the thread; that stays | NL2546, unchanged |
| a reference crossing an **external symbol**: an exported function of the program's own package called through the C ABI, a `wasm-host` import or export, a `declare function` parameter or return, or a signature `--emit-dts` writes | the tag means nothing outside the program, and a foreign caller could hand back a function the set does not hold. A Nish-module export, like `sortWith` (`std/sort.ts:162`) or `expose` (`std/secret.ts:77`), is not external: its callers are in the program | §5.2 |
| `` `${h}` ``, `console.log(h)`, `typeof h`, `h.name`, `h.length`, `h.call`, `JSON.stringify(h)` | Node prints the function's source or a `[Function: name]`; native has a tag | `` `h` is a function reference: it can be called, compared, stored and passed, nothing else `` |
| a reference read through a container: `ops.sort()`, `console.log(ops)`, `jsonEncode` of a class with a function-typed field | each would compare or print the element. `sort` without a comparator is refused already (NL2620), so is `console.log` of an array or an object (`LANGUAGE.md:7558`), and typed JSON's field whitelist (NL2364) names no function type; stage 1 keeps it so, with a negative test. `ops.indexOf(h)` and `ops.includes(h)` compare by `===` and agree (§5.1) | the existing diagnostics |
| `<`, `>`, arithmetic, or a `Map` key | a tag's number is not part of the language | the same |
| `Function`, `Function.prototype.bind`, `new Function` | Tier 3 of wp28 §2.2 | unchanged (`reject_function_type`) |

### 2.3 The lowering

For each signature `S` the checker collects the **set** `F(S)`: every
top-level function of signature `S` that appears anywhere in value position.
It numbers the set in declaration order (module order, then source order), so
the numbering is stable across builds and independent of call sites. A
reference of type `S` is an `i32` tag in `[1, |F(S)|]`; **tag `0` is `null`**
for `S | null`, so a zero-filled `(S) | null` element or field reads as
`null`, as every other `U | null` does (`LANGUAGE.md:6938`–`6942`). A
non-nullable reference can never hold `0`: zero-filled storage of a
non-nullable function type is refused (§2.1), a field is definitely assigned
before it is read, and a call through `S | null` needs `h !== null` first.

**The set a call dispatches over is the call's, not the signature's.** Each
place a reference can be held — a local, a parameter, a field of a class, the
elements of an array, a `Map`'s values, a function's return — gets the set of
members that can be stored into it, by a flow-insensitive pass over the
program's stores of names and of other places (a store `a = b` adds `b`'s set
to `a`'s). A call through a reference read from place `p` dispatches over
`p`'s set, `F(p) ⊆ F(S)`. The tags stay numbered per signature, so `===`,
stores and loads need no translation; only the dispatcher's arms narrow.
Calls whose sets are equal share one dispatcher.

The compiler then generates one **dispatcher** per distinct set, an internal
function written as the program could have written it:

```ts
// F(p) = { t0, t1, t2, t3 }, tags 1..4
function $ref.S.p(tag: i32, x: i32, acc: i32): i32 {
  switch (tag) {
    case 1: return t0(x, acc);
    case 2: return t1(x, acc);
    case 3: return t2(x, acc);
    default: return t3(x, acc);
  }
}
```

and every call through a reference read from `p` becomes a direct call of
its dispatcher. The last arm is `default` because no other tag can reach
the call: a non-null tag is made only by naming a member, `0` is ruled out
above, and the set pass put every member that can flow to `p` in `F(p)`. A
set of one has no `switch` at all; the tag is never read and the dispatcher
is a direct call.

The spike (§3, §4, §12) numbered its tags from `0` and had no `null`, so its
`switch` cases are `0` to `K - 2`. Numbering from `1` changes only the case
constants, or, for a jump table, subtracts `1` from the index; nothing it
measured depends on which.

That is the whole design. Because the dispatcher is an ordinary function with
ordinary direct calls, **no analysis needs a new case for "a call through a
reference"**: each already handles a call to a known function, and the
dispatcher's facts are the join of its arms' by the rule they already apply to
any function with several call sites in its body. A hand-written `switch` is
the same join over its own arms, and with per-place sets the dispatcher joins
no more than the arms the program could reach — the property §8's
recommendation rests on. §6 lists every place that leaned on "no function
values" and what that join does to each.

### 2.4 How the set is known in time

Pass 2 of the checker runs "now that every callee in the program is known"
(`src/checker.ts:959`, `src/declarations.ts:445`). The set must be known as
early, because a body checked before a later module names a member would
otherwise see too small a dispatcher. A function is in a set exactly when its
name appears in a value position — not the callee of a call and not an
argument to a function-typed parameter — which is syntactic: pass 1 can collect
it while it binds declarations, before any body is checked. The sets are
therefore closed before pass 2, and nothing downstream sees a partial set.

The per-place sets need the checked bodies (which field `this.f = g` stores
into is a type question), so they are computed once pass 2 has checked every
body, and before anything reads a call's callees: the attribute fixpoint, the
region rules, the portability records and the emitter. Each reference call is
recorded in `nodeCallees` as a call of its dispatcher, so every one of those
passes sees an ordinary direct call (§6, the wp49 row).

## 3. The measurements

Every figure in this section is best of seven, with every variant run once per
round in order (interleaved), on the machine below. Each program prints a
checksum folded from every call's result, and every variant of a group prints
the same number, so no row timed a loop the optimiser removed.

- **Machine.** `nproc` 4, `Intel(R) Xeon(R) Processor @ 2.30GHz`, 15 GB, a
  cloud container otherwise idle while timing.
- **Build.** `build/nish` at `350bad84` (built from the 0.34.1 seed), then
  `scripts/build.sh <x>.ll runtime/runtime.c [wp51_fns.c] -o <x> --profile
  speed` (`-O3 -flto`).
- **Noise band.** Each group's baseline, timed against a byte-identical copy
  of its binary in the same interleaved rounds (`.claude/testing.md` → "A
  `Measured:` trailer"): serial 411 / 408 ms (0.7%), array 446 / 446 ms (0%),
  escape 113 / 116 ms (2.7%), so the band is **±3%**; the aperiodic group's
  pair is 826 / 777 ms (6.3%), so its band is **±6%**. A delta inside the band
  is reported as none.
- **What the band does not cover.** It is run-to-run noise of one binary. It
  says nothing about code layout and predictor aliasing between binaries: the
  indirect **same** rows run the same instructions per call at every `K`, yet
  spread from 427 to 516 ms (serial) and 435 to 525 ms (array), up to 21%. A
  difference of that size between two *binaries* is not evidence on its own;
  §3.5 leans only on differences well past it.

### 3.1 The instruments

The program is wp28 §11a's serial hash chain and §11d's array loop, with eight
callees in place of one, so a set can have 1, 2, 4 or 8 members (§12.1).

- **direct** — §11a as wp28 ran it: the loop calls `t0` by name.
- **switch** — the proposed lowering, written by hand in Nish exactly as §2.3
  would generate it, so the IR is the compiler's own: a `call(tag, x, acc)`
  whose body is a `switch` over `t0..t{K-1}`. The loop reads the tag from a
  1,024-element `i32[]` per call, as a call through an array of references
  would.
- **indirect** — the same `.ll` with `@call`'s body hand-edited to load a
  function pointer from a table a C constructor owns and call it (§12.3), the
  position a function value with no closed set is in, and the instrument of
  wp28 §11c. Its attributes drop to `nounwind`, as an opaque callee's would.

Each set size is run with two tag streams, built once at start-up from
`process.argv.length`, so the optimiser cannot know them:

- **same** — every tag is the same member: a monomorphic site, perfectly
  predicted.
- **mixed** — tags drawn by xorshift over the whole set: a polymorphic site.
  The 1,024 tags repeat in the same order every 1,024 calls, which a branch
  predictor can learn (§3.5). §3.4 runs a stream with no period.

Two adaptations of wp28's programs, both forced by the language as it is at
`350bad84`, so none of the figures below compares directly with wp28's:

1. §11a's `x * 1103515245` and `+ 1` now panic on `i32` overflow; the spike
   uses `wrappingMul` and `wrappingAdd` from `nish:unsafe`, which are what the
   original's `.ll` computed.
2. The tag array means the switch and indirect rows read one more element per
   call than **direct** does. The `K = 1` row does **not** isolate that read:
   its dispatcher never reads the tag, so after `opt -O3` the load is dead in
   both shapes, and the bounds check is gone (serial) or hoisted to one check
   before the loop (array). The row runs **direct**'s loop plus building the
   tag array. No row times the element read alone.

### 3.2 Dispatch, serial (§11a's shape, 400M calls)

Baseline **direct** 411 ms (copy 408 ms). Ratios are against **direct**;
the last column is how much the switch saves over a true indirect call.

| K | stream | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | same | 416 | 1.01x | 437 | 1.06x | 1.05x |
| 2 | same | 415 | 1.01x | 516 | 1.26x | 1.24x |
| 2 | mixed | 413 | 1.00x | 1,944 | 4.73x | 4.71x |
| 4 | same | 411 | 1.00x | 427 | 1.04x | 1.04x |
| 4 | mixed | 404 | 0.98x | 1,572 | 3.82x | 3.89x |
| 8 | same | 421 | 1.02x | 515 | 1.25x | 1.22x |
| 8 | mixed | 548 | 1.33x | 1,808 | 4.40x | 3.30x |

Checksums: every **same** row and **direct** print `631536064`; each
**mixed** switch row prints the same number as its indirect row (`966901674`,
`16372346`, `1904994139`). Maximum RSS 12 MB everywhere.

### 3.3 Dispatch, array (§11d's shape, 1,024 elements × 400k rounds)

Baseline **direct** 446 ms (copy 446 ms).

| K | stream | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | same | 436 | 0.98x | 448 | 1.00x | 1.03x |
| 2 | same | 438 | 0.98x | 435 | 0.98x | 0.99x |
| 2 | mixed | 444 | 1.00x | 1,816 | 4.07x | 4.09x |
| 4 | same | 434 | 0.97x | 522 | 1.17x | 1.20x |
| 4 | mixed | 437 | 0.98x | 1,602 | 3.59x | 3.67x |
| 8 | same | 437 | 0.98x | 525 | 1.18x | 1.20x |
| 8 | mixed | 556 | 1.25x | 1,721 | 3.86x | 3.10x |

Checksums: every **same** row and **direct** print `93400201`; mixed pairs
print `738435298`, `71504611`, `829684326`. Maximum RSS 12 MB everywhere.

### 3.4 Dispatch, aperiodic stream (400M calls)

The **mixed** streams above repeat every 1,024 calls. This group draws each
call's tag from the top bits of a xorshift32 state advanced in the loop
(period 2^32 − 1), so there is no pattern short enough to learn (§12.1).
Every variant, **direct** included, advances the same state and passes it as
`x`, so **direct** here is slower than §3.2's and is this group's own
baseline: 826 ms (copy 777 ms, band ±6%).

| K | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 1,968 | 2.38x | 2,519 | 3.05x | 1.28x |
| 4 | 2,889 | 3.50x | 3,504 | 4.24x | 1.21x |
| 8 | 3,732 | 4.52x | 3,976 | 4.81x | 1.07x |

Checksums: **direct** and its copy print `662644096`; each switch row prints
the same number as its indirect row (`1127541019`, `314685327`,
`1853447471`). Maximum RSS 12 MB everywhere.

### 3.5 What the dispatch numbers say

- **On a monomorphic site or a periodic stream, the switch costs nothing
  measurable up to four members**: every `K ≤ 4` row of §3.2 and §3.3 is
  inside the ±3% band of **direct**. `opt -O3` on the `.ll` shows why:
  `@call` and all four members are inlined into `run`, and what is left is
  one `switch` on the loaded tag with each arm the member's four instructions
  (`mul`, `xor`, `ashr`, `xor`) and one `add` after the arms join (§12.2). At
  `K ≤ 4` `llc` lowers that `switch` to a chain of compares — one `cmp` and
  `jne` at `K = 2`, three compares at `K = 4` — and conditional branches are
  what the predictor learned the 1,024-call period on.
- **Eight members on a periodic mixed stream cost 1.25x to 1.33x.** At `K = 8`
  the `switch` has seven cases, past `llc`'s default minimum of four for a
  jump table (`-min-jump-table-entries`), and it becomes
  `notrack jmpq *.LJTI0_0(,%r15,8)` (§12.2): an indirect branch, which
  learned the period less well. The first jump table is expected at five
  members (four cases and `default`); only eight was measured. It is still
  **3.1x to 3.3x faster than the indirect call** it replaces.
- **Why the indirect call costs 3.6x to 4.7x on a periodic stream.** Not the
  call itself: the indirect **same** rows, where the members are not inlined,
  the call keeps the full calling convention and the callee's attributes are
  `nounwind` only, are 0.98x to 1.26x of **direct**, within the 21% layout
  spread above. What costs is the branch-target misprediction of a call whose
  target changes: the indirect predictor did not learn the period that the
  conditional predictor learned for the compare chains.
- **On an aperiodic stream the selection mispredicts whatever the lowering.**
  The switch costs 2.38x to 4.52x **direct**, because which arm runs is
  decided by data no predictor can learn; LLVM did not turn the arms into
  selects. A hand-written `switch` or `if` chain over the same tags is the
  same code and pays the same. Against it the indirect call costs only 1.07x
  to 1.28x more, and at `K = 8`, where both are indirect branches, 1.07x.
- **So the switch's large advantage is a periodic-stream result.** "3.1x to
  4.7x faster than an indirect call" holds where the tags follow a pattern
  (or a site is monomorphic); where they are decided by input, the advantage
  is 7% to 28%. What holds in every stream is that the dispatcher is the
  `switch` a program writes by hand today, so at the call a reference costs
  what today's code costs. §4 is where that stops being true.

## 4. The escape proof through a dispatched call

wp28 §7.4 found that the call's own cost is the small half: the escape analysis
is worth 8.76x, and a callee the analysis cannot see forfeits it. The question
for a reference is whether the dispatcher keeps the proof when every member
keeps the object local, and what it costs when one member does not.

### 4.1 The programs

§11e's `P`, made once per iteration in `run`, is passed through a dispatched
call over four members `u0..u3`, each `(p: P, k: Keep): i32` (§12.4). `Keep` is
one object made in `main` and passed down, so a member has somewhere to put
`p` if it wants to.

- **A — every member local.** `u0..u3` read `p.x` and `p.y` and return.
- **B — one member escapes.** `u3` also stores `k.last = p`.

Each is run with the **same** stream (every tag `0`, so the escaping arm of B
is never taken and the row isolates the lost proof from the store) and the
**mixed** one. The baselines are §11e as wp28 wrote it, calling `u0` directly,
compiled as is and with `--no-stack-alloc` — wp28's instrument for "the
object is not provable".

### 4.2 The fact table

Exactly as the compiler emitted them (`build/nish`, no flags), with
`"probe-stack"` elided:

| Program | members `u0..u2` | member `u3` | `dispatch` | `run` | `P` in `run` | `Keep` in `main` |
| --- | --- | --- | --- | --- | --- | --- |
| direct | `u0`: `nounwind willreturn readonly`; `p`, `k` `readonly nocapture` | — | — | `nounwind willreturn`; `k` `readonly nocapture` | `%P.obj = alloca %struct.P` | `%Keep.obj = alloca` |
| direct, `--no-stack-alloc` | as direct | — | — | as direct | `nish_alloc_struct(i64 8)` per iteration, inside a per-iteration `nish_arena_mark` / `nish_arena_release` | arena |
| **A** (every member local) | `nounwind willreturn readonly`; `p`, `k` `readonly nocapture` | the same | **the same: `nounwind willreturn readonly`; `p`, `k` `readonly nocapture`** | `nounwind`; `k` `readonly nocapture` | **`%P.obj = alloca %struct.P`** | `%Keep.obj = alloca` |
| **B** (`u3` stores `p`) | the same as A | `nounwind willreturn`; **`p` neither `readonly` nor `nocapture`**; `k` `nocapture` | **`nounwind willreturn`; `p` neither `readonly` nor `nocapture`** | `nounwind`; `k` `nocapture`, not `readonly` | **`nish_alloc_struct(i64 8)` per iteration, no per-iteration release** | `%Keep.obj = alloca` |

`run` in A and B is `nounwind` without `willreturn` because it reads the tag
array, whose bounds check can panic; **direct** reads no array. The rows are
the same for the **same** and **mixed** builds: the facts are a property of the
set, not of the stream.

The dispatcher's facts in A are its members' facts, and in B they are `u3`'s:
**the join**, by the attribute pass as it is today, with no change. In A the
stack proof survives the dispatched call; in B it is lost for every call of
`dispatch`, including the ones whose tag is `0`.

### 4.3 What it costs

| Program | stream | ms | / direct | max RSS | checksum |
| --- | --- | ---: | ---: | ---: | --- |
| direct | — | 113 | 1.00x | 12 MB | `208457217` |
| direct (copy) | — | 116 | 1.03x | 12 MB | `208457217` |
| direct, `--no-stack-alloc` | — | 209 | 1.85x | 12 MB | `208457217` |
| A, every member local | same | 168 | 1.49x | 12 MB | `208457217` |
| A, every member local | mixed | 166 | 1.47x | 12 MB | `230433138` |
| B, `u3` escapes | same | 792 | 7.01x | **1,527 MB** | `208457217` |
| B, `u3` escapes | mixed | 726 | 6.42x | **1,527 MB** | `230433138` |

- **A keeps the proof.** `P` stays an `alloca` and SROA dissolves it; after
  `opt -O3` neither A nor **direct** has an allocation in the loop. A's 1.47x
  to 1.49x over **direct** is not the proof (the facts are identical) but the
  rest of the loop. After `opt -O3` **direct**'s loop is six instructions
  (`mul`, `add`, `xor`, `add`, the induction `add` and the compare), while A's
  loads `ts[i & 1023]` and switches into four arms that pick two constants
  for a shared `mul`, `add`, `xor` and `add` (§12.5). How the 1.47x splits
  between the load and the switch was not measured (§7).
- **B loses it, and the loss is not the stream's.** With every tag `0` the
  escaping arm never runs, yet B is 7.0x **direct** and holds 1.5 GB: `P` goes
  to the arena, and because `dispatch` may capture `p`, the loop gets no
  per-iteration release either, so every `P` of the 200M iterations stays
  until `run` returns. That is worse than `--no-stack-alloc` (1.85x, 12 MB),
  which still releases each iteration because `u0` is known not to keep `p`.
- **This is the price of the join, and the join is wider than a
  hand-written `switch`'s.** A program that calls `u3` by name pays B's cost,
  correctly, because `u3` does keep `p`. A hand-written `switch` — what a
  Nish program writes today in place of a table of handlers — joins only its
  own arms: a `switch` over `u0..u2` keeps the proof even if `u3`, elsewhere
  in the program, escapes. A per-*signature* dispatcher joins every function
  of that signature the program names, so the same three-way site written
  with references would pay B's 7.0x and 1.5 GB for a member it never calls.
  That is a program made slower than it can be written today, which is why
  §2.3 makes the set per place and §8 makes that a condition of strict. With
  per-place sets the dispatcher at that site is `{u0, u1, u2}`, the hand
  `switch`'s arms exactly, and A's figures apply.

## 5. Semantics

### 5.1 Node and `--emit-ts`: identity and `===`

Under `--emit-ts` and under Node, a reference is the function object itself:
`const h: (x: i32) => i32 = double;` is emitted as written, and `h(3)` is an
ordinary JavaScript call. Native identity is tag identity. The two agree
exactly when **one function has one tag and one object**:

- A top-level function is one object per module in JavaScript and one member
  of one set natively (its signature is fixed, so it is in exactly one set).
  `h === double` is `true` in both, `inc === dec` is `false` in both, and a
  reference compared with itself after a round trip through a field, an array
  or a `Map` value is `true` in both.
- An imported function is the same object in every importer under ES modules,
  and the same member natively. Agrees.
- `null` is `null` in Node and tag `0` natively; `h === null` agrees, and so
  does a zero-filled `(S) | null` element, which is `null` in both.
- **A generic function does not agree.** `f<i32>` and `f<u8>` with the same
  signature are two functions natively and one object in JavaScript, so
  `===` would be `false` natively and `true` in Node. **Refused** (§2.2).
- **A function with a function-typed parameter does not agree** for the same
  reason (one object, many instantiations). **Refused.**
- **Printing does not agree.** Node prints `[Function: double]` or the source;
  native holds a number. Every direct read but a call, a comparison, a store
  and a pass is **refused** (§2.2), and so is every container read that would
  print or order an element: `sort` with no comparator (NL2620), `console.log`
  of an array or an object, and typed JSON, whose field whitelist names no
  function type. `indexOf` and `includes` compare by `===`, which agrees. No
  program can observe the tag through a path that exists at `350bad84`; a new
  builtin that formats or orders values must refuse a reference too (§10).

What does not change: Node's call through `h` is a real indirect call, and a
site that sees several targets is the polymorphic site
[wp22-arrow-functions.md](wp22-arrow-functions.md) §2 measured at 7.6x
*in V8*. That cost is Node's, at a site the program asked for; the native
build pays §3's figures instead.

### 5.2 The C ABI

A tag is an index into one program's set; to C it is a meaningless `int`, and a
C function cannot be turned into a tag because it is not in any set. So a
reference never crosses the boundary in either direction:

- a `declare function` parameter or return of function type — today an arrow
  passed there is refused with NL2651 (`` An arrow may only be written as the
  argument for a function-typed parameter of a top-level function ``, pinned
  by `tests/cases/reject_ffi_callback`). A reference gets a new code in
  `src/codes.ts`: `` `h` is a function reference: C cannot call it, because a
  reference is a tag this program's dispatcher reads, not an address ``,
  pinned by a new `tests/cases/reject_fnref_ffi`;
- a field of function type in a class a `declare function` is handed or
  returns (the same diagnostic, against the field);
- a function type in the signature of an **external symbol**: an exported
  function of the program's own package called through the C ABI, an entry of
  the `wasm-host` export list, or a declaration `--emit-dts` writes. A foreign
  caller could hand in a function no set holds, which breaks the closed-set
  premise everything else rests on. An `export` between Nish modules is not
  external and is not refused: `sortWith` (`std/sort.ts:162`) and `expose`
  (`std/secret.ts:77`) take function-typed parameters, and every caller of
  them is in the program.

A real C callback — a code pointer C can call — is
[wp27-ffi.md](wp27-ffi.md)'s and [wp40-ffi-buffers-handles.md](wp40-ffi-buffers-handles.md)'s
question, and this note does not move it: it would need an exported
trampoline per function, which is a different construct.

### 5.3 `-g` and DWARF

- **The tag in a debugger.** A reference's debug type is a
  `DW_TAG_enumeration_type` named for the signature, one `DIEnumerator` per
  member (`name: "t2", value: 3`). `src/debug.ts` already emits exactly this
  for an `enum` (the `DIEnumerator` at `:454`, the
  `DW_TAG_enumeration_type` at `:461`), so gdb and lldb print `h = t2` rather than `h = 2`, and
  `p h == t2` works. Nothing new in the emitter but the source of the names.
- **Line info on the switch.** The dispatcher is synthetic. It gets a
  `DISubprogram` flagged `DIFlagArtificial`, and its `switch` and every arm's
  call carry the **call site's** location, so a step into `h(3)` lands on the
  call line and then in the member's first line, and a backtrace shows
  `$ref.S` between the two with the call's line — the frame a reader expects
  from a call through a pointer.
- **The optimised build** inlines the dispatcher into its callers (it is a few
  instructions), so in `--profile speed` the debugger sees the switch at the
  call site, as `-O3` shows any inlined function.

### 5.4 The rolling freeze

`src/` may not use a construct until the release after it ships (CLAUDE.md,
CI's `bootstrap` job). The first release that builds references cannot use
them in `src/`, and nothing in `src/` needs them first: the dispatch tables
`src/` has (wp23 §6.2, D2 of [wp14-selfhost.md](wp14-selfhost.md) §3a) are
central `switch`es, which is the lowering this proposal generates. The release
after could rewrite a table as an array of references; whether it should is a
readability question, not a performance one, since §3 shows the code is the
same.

## 6. What leaned on "no function values"

The proposal keeps every whole-program fact, **as the join over the set**. A
place that leaned on "every callee is named at the call" is therefore
*weakened* — its fact is now as strong as the weakest member that can reach
the call — or *intact*, where the fact was about something a reference cannot
reach. **Broken** marks a place whose claim is false under the proposal and
must be rewritten. Most of the prose rows say "Nish has no function values"
to explain an API's shape; under the proposal each becomes "Nish has no
closures", and the shape it explains may stay or change.

Every row was read at `350bad84`. Hits for "never a value" that are about
promises, module storage, classes or a parameter's own storage, not functions
(`src/annotations.ts:292`, 298; `src/async-check.ts`; `src/codes.ts:304`,
310, 428, 460, 816; `src/checker.ts:1869`; `src/constants.ts:287`;
`src/inline-arrays.ts:25`; `src/module-storage.ts:20`, 821;
`src/parser.ts:4371`; `src/statements.ts:875`; `docs/AI.md:184`, 904;
`docs/guide/language/async.md:82`; `docs/guide/getting-started/from-typescript.md:345`;
`docs/guide/using-nish/threads.md:614`; `docs/security/postgres.md:533`;
`docs/wp49-async-server.md:43`; `docs/ARCHITECTURE.md:393`), are unrelated
and have no row.

**The compiler and its diagnostics**

| Where | What it leans on | Verdict | What the compiler or the text would need |
| --- | --- | --- | --- |
| `src/codes.ts:274` (NL2651), `docs/LANGUAGE.md:3392`, `src/generics.ts:2398` | an arrow outside a function-typed argument is refused: "a function is never a value" | **broken** | the reason changes: a *capturing* arrow is refused; a capture-free one names a top-level function (stage 3 lifts it) |
| `src/codes.ts:480` (NL2566), `src/expressions.ts:984`–`993`, `docs/LANGUAGE.md:3337` | a function parameter can only be called or passed on | **broken** | a parameter holding a reference (the `$fn.ref.<set>` instantiation) may be stored; a parameter bound to a named callee stays as today |
| `src/generics.ts:2008`–`2010` | an argument for a function-typed parameter must be a name or an arrow: "a function is never a value computed at run time" | **broken** | a reference-typed expression is admitted and selects the `$fn.ref.<set>` instantiation (stage 2) |
| `src/codes.ts:494` (NL2492), `docs/LANGUAGE.md:3409`, `src/annotations.ts:224` | a function type annotates only a parameter | **broken** | the annotation resolver gives a function type in a field, local, element or return the `i32` tag representation |
| `src/nodes.ts:129` | an `N_ARROW` is never a value | intact until stage 3 | stage 3's lifted arrow is a reference, not an `N_ARROW` value |
| `docs/LANGUAGE.md:12476`, `src/validator.ts:146` | `Function` as a type name is forbidden | intact | `Function` stays refused (§2.2) |
| `docs/LANGUAGE.md:1708`–`1712` (`reject_param_rest_function_value`) | a function with a rest parameter is never passed as a function value | intact, extended | the rule covers a reference too, and widens to default and optional parameters (§2.2) |
| `src/attributes.ts:13`–`17`, 830, 4967, 5677 | the fact collector records direct callees; an unknown callee is `EFFECT_ANY` | weakened | none: the dispatcher's direct calls are recorded like any other; §4.2 is the evidence |
| `src/attributes.ts:27`, `src/expressions.ts:4`–`10`, `src/emit.ts:24`, `src/emit-classes.ts:19` | "a table needs function values; D2 took a central `switch`" | weakened | a table becomes possible after the freeze (§5.4); the `switch` stays valid |
| `src/emit-async.ts:27` | async state machines dispatch by `switch` | intact | — |
| `src/generics.ts:1693`, 1740 | a function-typed parameter instantiates per callee | intact | a reference argument adds one `$fn.ref.<set>` instantiation per set |
| `src/members.ts:883` | `Map.forEach` waits for function values | weakened | `forEach` with a capture-free callback could ship; with a closure it still waits |
| `src/portability-records.ts:904`, 1093 | a call through a function value is `EFFECT_ANY` | weakened | a reference call's effect is the join of its set's effects, not `EFFECT_ANY` |
| `src/region-rules.ts:206` (`noFactsMessage`, used at 810 and 987) | a callee without facts is refused inside a region | intact, if | the reference call is recorded in `nodeCallees` as its dispatcher, which has facts (§2.4); otherwise every reference call in a region would be refused |
| `src/checker.ts:959`, `src/declarations.ts:445` | pass 2 runs once every callee is known | intact, if | pass 1 collects the signature sets; the per-place sets follow pass 2 (§2.4) |
| `src/parallel.ts:1238`, `docs/wp20-threads.md:57` | a parallel body's callee is named, so its captures and sendability are known | intact in kind | the walk of a reference call visits every member of its set: the join again |
| `docs/LANGUAGE.md:7259`, `src/bounds.ts:5637` | a builtin's callee argument is named | intact | if no builtin takes a reference; otherwise the builtin needs the dispatcher's summary |
| `docs/LANGUAGE.md:9922` (NL2425) | a callee without facts is refused in a hot position | intact | the dispatcher has facts |
| `docs/LANGUAGE.md:8766`, `src/builtins.ts:1060`, `src/arrays.ts:1068` | a builtin or array method takes no function value | intact | no builtin takes a reference in stage 1 |
| `docs/LANGUAGE.md:9537`, `docs/IR_COOKBOOK.md:942`, 1236 | `sort`'s comparator is called directly, no pointer | weakened | a reference comparator gives one `switch` instantiation, inlined like §3's |
| `docs/LANGUAGE.md:6267`, `docs/wp27-ffi.md:510`, `docs/wp40-ffi-buffers-handles.md:1270` (and 620, 679, 835, 869, 1389) | no C callbacks (`reject_ffi_callback`) | intact, extended | `reject_ffi_callback_reference` (§5.2) |
| `docs/security/async.md:130` | a dispatch is a `switch` over known handlers | intact | a tag can only be made by naming a member; the `default` arm cannot reach outside the set |

**The language reference and the user guide**

| Where | What it leans on | Verdict | What the text would need |
| --- | --- | --- | --- |
| `docs/LANGUAGE.md:1585`–`1590` (`reject_arrow_as_value`) | "A function is not a value": `const alias = double` is an unknown identifier; a function in a field, a local or an array does not exist | **broken** | the rule becomes §2.1's; `reject_arrow_as_value` keeps only a capturing arrow |
| `docs/AI.md:178`, 421, 584, 827 | a stored or returned callback is refused; write a `switch` | **broken** (178, 584), weakened (421, 827) | the AI rows split: a stored capture-free function is admitted, a stored closure is not |
| `docs/guide/language/functions.md:195` | "A function is not a value in Nish: you cannot store one" | **broken** | the guide page for references replaces it (stage 1, checklist item 10) |
| `docs/guide/language/errors.md:236`–`237`, `docs/wp16-results.md:112`, `docs/LANGUAGE.md:1276` | no `map` / `andThen` / `orElse` on a `Result`, because they would take a function | weakened | the reason now holds for capturing callbacks only; a `map(r, double)` taking a reference becomes expressible |
| `docs/guide/using-nish/http-router.md:9`, `std/net/router.ts:15` | "a route is not a handler": a route is the index `add` answered | weakened | the index can become a reference; the dispatcher is the same code. The page and the module change only if `std/` adopts it |
| `docs/guide/using-nish/standard-library.md:1768`, `std/README.md:478`, `std/cli-args.ts:18`, `std/net/handler.ts:31`, `std/net/tls-tcp.ts:22`, `std/testing.ts:26` | an API is a handle, a builder or a pull loop "because Nish has no function values" | weakened | each sentence's reason becomes "no closures"; whether the API takes a reference is its own change after stage 2 |

**The design notes**

| Where | What it leans on | Verdict | What the text would need |
| --- | --- | --- | --- |
| `docs/wp22-arrow-functions.md:56`–`59` | a callback site in Node is monomorphic, because each callee is its own instantiation and "there are no function values" | **broken** for a reference site | a reference site is polymorphic under Node (§5.1); the native build pays §3 instead |
| `docs/wp22-arrow-functions.md:65`, 82–85 (rule 2) | "Function values stay forbidden"; a name bound to a function appears only in call position, so `const g = double`, `[double]` and `obj.f = double` are refused | **broken** | reworded to "closures and `Function` stay forbidden"; rule 2's three examples become admitted |
| `docs/wp23-language-surface.md:21`–`23`, §6 (188–192, 205) | function values are refused and why; "a function is still never a value" | weakened | the pointer this PR adds; the text is replaced by this table when stage 1 ships |
| `docs/wp28-compatibility-mode.md:141` (row), 183, 189, 463 (C2b), 481 | function values are a compat-tier construct: an indirect call and a lost fixpoint; the `NL9xxx` sort warning names "a function value" | weakened | capture-free references move to strict, on §8's condition; closures stay in the compat row |
| `docs/wp26-stdlib.md:93`–`95` (§3a), 149 (§3f), 162 | no `test(name, callback)`; `jsonFields` shares a step, not a loop; `std/` APIs avoid callbacks | weakened | a capture-free test body or field step could be a reference once stage 2 ships |
| `docs/wp49-async-server.md:127`–`129`, 147–150 | a handler cannot be stored in the router | weakened (128), intact (the rest) | a router holding an array of handler references becomes expressible |
| `docs/wp49-async-server.md:756`–`761` | a call through a function-typed parameter in a spawned task is judged by worst-case facts; lifting that "needs facts per function value" | weakened | a reference call has its dispatcher's facts, so the region rules judge it by its set's join, not the worst case — the per-function-value facts this row asks for, if §2.4's `nodeCallees` record holds |
| `docs/wp18-generics.md:28` | a generic is instantiated per use | intact | a generic cannot be referenced (§2.2) |
| `docs/wp15-performance.md:15`, 64 | no closures, so no environment allocation | intact | closures stay refused |
| `docs/wp25-inheritance.md:40`, 159; `docs/wp2-classes.md:125` | no vtables: dispatch is closed-world | intact | the dispatcher is the closed-world `switch` those notes name as the alternative |
| `docs/wp24-async.md:94`, 198, 239 | no promise values, no capturing callbacks | intact | — |
| `docs/wp43-http-app-layer.md:48`, 172 | a route is an index because there are no function values | weakened | the index can become a reference; the dispatcher is the same code |
| `docs/wp9-optimisation.md:230` | no closure allocations to elide | intact | a tag holds no allocation |
| `docs/wp1-control-flow.md:83`, `docs/ARCHITECTURE.md:361`, 370 | every call's callee is known to the fixpoint | weakened | known as a set; the dispatcher must exist in the module before the fixpoint runs, and then no change |
| `docs/ARCHITECTURE.md:48`, 359 | the fixpoint runs over the whole program at once | intact | it is what makes each set closed |
| `docs/wp14-selfhost.md:50`, `docs/ARCHITECTURE.md:136` | Nish-0 has no function values, so the emitter has no tables of closures | intact | the freeze keeps `src/` off references for a release (§5.4); a table of references is not a table of closures |

## 7. Not measured

- **Where the jump table starts, and what it costs past eight.** `K = 8` was
  a jump table (§3.5); `K = 5` to `7`, where `llc`'s threshold says the first
  one appears, were not timed, and neither was any set larger than eight.
- **How A's 1.47x splits** between the tag load and the `switch` (§4.3).
- **A `K = 1` control for the escape shape.** With one member there is no
  `switch`, so it would separate the tag array's cost from the dispatch's; it
  was not built.
- **The per-place set pass.** §2.3's sets were reasoned, not built: the spike
  wrote each dispatcher by hand over the members it meant. That a
  flow-insensitive pass gives `{u0, u1, u2}` at the site §4.3 describes, and
  what it costs to compute, are stage 1's to show.
- **A loop-invariant reference.** `const h = pick(); for (...) h(x)` could be
  unswitched; whether LLVM does it from the dispatcher was not checked.
- **Node.** No `--emit-ts` build was timed; §5.1 relies on wp22's 7.6x for a
  polymorphic V8 site.
- **The cost of the compiler change**: compile time, `.ll` size and debug-info
  size for a program with many sets.
- **A large real program.** Every figure is a microbenchmark; no router, no
  parser table, no `std/` API was rewritten with references.

## 8. The recommendation

**Strict, on the condition that stage 1 ships per-place sets (§2.3).**
Without them, compat.

The three possible answers, against the numbers:

- **Decline** would be right if a reference cost what wp28 §7.4 measured for a
  function value. It does not. On a monomorphic site or a periodic stream the
  call is free up to four members (every `K ≤ 4` row in §3.2 and §3.3 is
  within ±3% of **direct**) and 1.25x to 1.33x at eight, against 3.6x to 4.7x
  for the indirect call. On an aperiodic stream every lowering mispredicts:
  the switch costs 2.4x to 4.5x **direct** and the indirect call 1.07x to
  1.28x more than the switch (§3.4) — but a hand-written `switch` over the same
  tags is the same code and pays the same, so the reference costs nothing over
  what a program writes today. The escape proof, wp28's 8.76x, is kept
  whenever the set keeps it (§4.2, A). Declining leaves programs writing the
  `switch` by hand for no gain.
- **Compat** (wp28's tier for constructs that cost the native build) is right
  if admitting references makes some program slower than it can be written
  today. With **one dispatcher per signature**, one is: a three-way site over
  `u0..u2`, rewritten from a hand `switch` to references, pays B's 7.0x and
  1.5 GB because `u3`, elsewhere in the program, keeps `p` (§4.3). So a
  per-signature lowering belongs in compat.
- **Strict** follows once the set is per place: the dispatcher at a site joins
  only the members that can reach it, which is the hand `switch`'s arms when
  the program was a hand `switch`, so the construct's native cost is the cost
  of the code a user writes without it. Its TypeScript reading is identical
  (class A of [wp33-round-trip.md](wp33-round-trip.md) §2), because every read
  that could tell a tag from a function object is refused (§5.1).

What the recommendation does not rest on, because it was not measured (§7):
`K = 5` to `7` and sets above eight, Node timings, a real program, the `K = 1`
escape control, and the per-place pass itself. The aperiodic stream was
measured, and it narrows the claim rather than reversing it: the switch's
large advantage over an indirect call is a periodic-stream result, while its
parity with a hand-written `switch` holds on every stream.

The join stays a cliff within a site's set: a member that escapes, stored
into a place that a hot call reads, removes the stack proof for that call.
That is the program's own cost, as it is for a hand `switch` with that arm,
but it is easy to cause by adding one store, so stage 1 ships a warning
naming the member that weakened a dispatcher.

## 9. If it ships: stages

Each stage is one PR, follows the checklist of
[ARCHITECTURE.md](ARCHITECTURE.md#how-to-add-a-construct), and lands green on
its own.

1. **Stage 1 — references in fields, locals, arrays and returns; calls; `===`;
   per-place sets.** Pass 1 collects the signature sets and the numbering
   (§2.4); after pass 2 the per-place pass computes each place's set (§2.3)
   and records each reference call in `nodeCallees` as a call of its
   dispatcher; `src/annotations.ts` admits a function type outside a
   parameter as an `i32` tag; the checker refuses everything in §2.2 and the
   zero-filled storage of §2.1 with new codes in `src/codes.ts`; `src/emit.ts`
   generates one `$ref.S.p` per distinct set and lowers a reference call to
   it; `===` lowers to `icmp eq`; `-g` gets the enumeration type and the
   artificial dispatcher (§5.3). NL2492, NL2566 and NL2651's wordings change
   (§6), and their `tests/wordings/` programs with them. A test pins that
   §4.3's three-way site over `{u0, u1, u2}` keeps `P` an `alloca` with `u3`
   escaping elsewhere; without it, the stage does not meet §8's condition.
2. **Stage 2 — references as arguments, `| null` and `Map` values.** A
   function-typed parameter accepts a reference, instantiating
   `$fn.ref.<set>` once per set; `S | null` with tag `0`, the exception to
   `reject_nullable_scalar` (§2.1), and zero-filled `new Array<S | null>(n)`;
   `Map` values.
3. **Stage 3 — capture-free arrows in value position**, lifted to a generated
   top-level function and then a reference. Capturing arrows stay refused.

`src/` uses none of them until the release after stage 1 (§5.4).

**The construct checklist, for stage 1:**

| Item | What it is for references |
| --- | --- |
| 1. Rule, lowering and TypeScript reading | §2 and §2.3; the expected `.ll` is §12.2's `@call`, renumbered from tag `1`, checked with `llvm-as` and `opt -passes=verify`; TypeScript reading **A**, identical (§5.1) |
| 2. Parser and validator | no new syntax: a function type and a bare name already parse; the validator keeps `Function` refused |
| 3. Types | a function type outside a parameter: `llvmType` `i32`, `alignOf` 4, `assignable` by signature; `cType` and `tsKeyword` refuse it (§5.2); `src/debug.ts` the enumeration type |
| 4. Checker | pass-1 signature sets; the post-pass-2 per-place sets; value-position names; reference calls; the §2.2 refusals and §2.1's zero-fill refusals (`new Array<S>(n)`, module storage); side tables for each set and each reference call |
| 5. Diagnostics | new NL codes for each §2.2 wording, the zero-fill refusals and `reject_ffi_callback_reference`, each with a `tests/wordings/` program; the dispatcher-weakened warning |
| 6. Emitter | `$ref.S.p` generation and the call lowering; named blocks (`sw.case.N`, `sw.default`) |
| 7. Runtime | none: no C symbol |
| 8. Attributes | none expected: the dispatcher is an ordinary function, and its facts are the join of its place's set. A test pins §4.2's A and B facts and the three-way site of stage 1 |
| 9. Tests | goldens `tests/cases/fnref_field`, `fnref_array`, `fnref_eq`, `fnref_escape_join`, `fnref_place_set` (`.ll`, `llvm-as`, `.out`); `reject_fnref_capture`, `reject_fnref_generic`, `reject_fnref_ffi`, `reject_fnref_print`, `reject_fnref_zero_fill`, `reject_fnref_rest`, `reject_fnref_async`, `reject_fnref_json`; an `--emit-ts` fixture; `tests/self/goldens/checked/` regenerated; `DECLARED` entries in `tests/nish-cmp.js` for the reworded diagnostics |
| 10. Docs | the `docs/LANGUAGE.md` rule replacing "a function is not a value" (1585) and the function-type rules (3337, 3392, 3409); a cookbook entry with the dispatcher's IR; a `docs/guide/` page on function references; §6's broken rows rewritten |
| 11. Security record | none: no attacker-facing code. `docs/security/async.md:130`'s claim holds (§6) |

## 10. Risks

- **The join within a site's set** (§4.3, §8). Per-place sets confine it to
  the members a site can reach; one escaping member there still weakens that
  site. Mitigated by stage 1's warning.
- **A set of five or more members becomes a jump table**, an indirect branch
  again: seen at eight (§3.5), expected at five, not timed between (§7). It
  stays faster than an indirect call on a periodic stream and equal to a hand
  `switch` of the same size on any stream. A program with dozens of handlers
  at one site is the case to measure before stage 1 closes.
- **A per-place set wider than it needs to be.** The pass is
  flow-insensitive: a place that receives stores from two branches holds both
  sets on both paths. Per-alias sets (§11) are the cheap fallback if a real
  program needs a site narrower than its place.
- **Compile-time cost.** Pass 1 now scans every value-position name, the
  per-place pass walks every store of a reference, and each distinct set gets
  a function. All are linear and small; none was measured.
- **A reference read the rules forgot.** Any read that exposes the tag
  (a new builtin that formats values, a `Map` key path, `JSON`, a container
  method that compares or prints its elements) would break §5.1's agreement.
  Every such read is refused by default because a reference admits only call,
  compare, store and pass; a new builtin or container method must opt in.
- **Pressure toward closures.** Once a field can hold `double`, a user will
  want it to hold `x => x * n`. The answer stays wp28's, and the diagnostic
  says why (§2.2).

## 11. Open

- Whether a program should be able to name a set: a per-*declared*-type-alias
  set, which keeps two aliases of one signature apart, is cheaper than the
  per-place pass and could serve as its fallback, or as an explicit way to
  narrow a place the pass makes too wide.
- Whether a reference may cross an external symbol for an `--emit-ts`
  library, where the JavaScript caller can only pass functions; this note
  refuses it (§5.2) for one rule across targets.
- The numbering is declaration order; whether a debugger or a
  `nish-cmp` diff would prefer a name-sorted order.

## 12. Appendix: the programs

Every program below was generated into a temporary directory by a short
script, compiled with `build/nish` at `350bad84`, and never committed. The
`.ll` excerpts are verbatim, with `"probe-stack"="inline-asm"` left in the
attribute lines and the metadata kept.

### 12.1 The dispatch programs

`serial_k4_mixed.ts`, in full:

```ts
import { wrappingAdd, wrappingMul } from "nish:unsafe";

function t0(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 1103515245);
  return wrappingAdd((m >> 13) ^ m, 1);
}

function t1(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 22695477);
  return wrappingAdd((m >> 11) ^ m, 1);
}

function t2(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 1664525);
  return wrappingAdd((m >> 15) ^ m, 1);
}

function t3(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 134775813);
  return wrappingAdd((m >> 9) ^ m, 1);
}

// The lowering under test: a switch over the closed set, a direct call per arm.
function call(tag: i32, x: i32, acc: i32): i32 {
  switch (tag) {
    case 0:
      return t0(x, acc);
    case 1:
      return t1(x, acc);
    case 2:
      return t2(x, acc);
    default:
      return t3(x, acc);
  }
}

function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    t.push((s ^ base) & 3);
  }
  return t;
}

function run(n: i32, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    acc = call(ts[i % 1024], i, acc);
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  console.log(`${run(400000000, ts)}`);
  return 0;
}
```

The other variants differ only where stated:

- **`K` members.** `t0..t{K-1}` with the multipliers `1103515245`,
  `22695477`, `1664525`, `134775813`, `214013`, `1103515243`, `69069`,
  `-1403630843` and the shifts `13, 11, 15, 9, 7, 17, 5, 19`; `call`'s
  `switch` has `case 0` to `case K-2` and `default` for the last member; the
  stream masks with `& (K - 1)`.
- **`K = 1`.** `call`'s body is `return t0(x, acc);` and nothing else.
- **same.** `t.push(base);` in place of `t.push((s ^ base) & (K - 1));`;
  `base` is `process.argv.length - 1`, which is `0`.
- **direct.** Only `t0`, no `call`; the loop is `acc = t0(i, acc);` (the tag
  array is still built, and not read).
- **array shape.** `run` and `main` become:

```ts
function run(rounds: i32, xs: i32[], ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let r: i32 = 0; r < rounds; r++) {
    for (let j: i32 = 0; j < xs.length; j++) {
      acc = call(ts[j], xs[j], acc);
    }
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  const xs: i32[] = [];
  for (let i: i32 = 0; i < 1024; i++) {
    xs.push(wrappingMul(i, 654435761) >> 3);
  }
  console.log(`${run(400000, xs, ts)}`);
  return 0;
}
```

  and **direct**'s inner statement is `acc = t0(xs[j], acc);`.

- **aperiodic (§3.4).** `rand_direct.ts` and `rand_k{2,4,8}_mixed.ts` keep
  the members and `call` of the serial programs and replace `run` and `main`
  with a xorshift32 loop; the tag is the state's top bits, so no tag array is
  built. `genrand.mjs` wrote them from the serial programs; the `_ind`
  variants are §12.3's hand-edit of each:

```js
// The aperiodic stream: each call's tag is the top bits of a xorshift32 state
// advanced in the loop (period 2^32 - 1), so no 1,024-call pattern exists to learn.
// Every variant, direct included, advances the same state and passes it as x.
import { writeFileSync, readFileSync } from "node:fs"
const src = readFileSync("serial_k8_mixed.ts", "utf8")
const fns = (k) => src.split("\n\n").filter((b) => b.startsWith("function t")).slice(0, k).join("\n\n")
const callOf = (k) => readFileSync(`serial_k${k}_mixed.ts`, "utf8").split("\n\n").find((b) => b.includes("function call("))
const run = (k) => `function run(n: i32, seed: i32): i32 {
  let acc: i32 = 1;
  let s: i32 = seed;
  for (let i: i32 = 0; i < n; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    acc = ${k === 0 ? "t0(s, acc)" : `call((s >>> 24) & ${k - 1}, s, acc)`};
  }
  return acc;
}

export function main(): i32 {
  console.log(\`\${run(400000000, 463534242 + process.argv.length)}\`);
  return 0;
}`
const head = `import { wrappingAdd, wrappingMul } from "nish:unsafe";\n\n`
writeFileSync("rand_direct.ts", head + fns(1) + "\n\n" + run(0) + "\n")
for (const k of [2, 4, 8]) writeFileSync(`rand_k${k}_mixed.ts`, head + fns(k) + "\n\n" + callOf(k) + "\n\n" + run(k) + "\n")
```

### 12.2 The `.ll` the compiler emitted for it

`build/nish serial_k4_mixed.ts -o serial_k4_mixed.ll`, the member, the
dispatcher and the loop:

```llvm
define internal noundef i32 @t0(i32 noundef %x, i32 noundef %acc) #0 {
entry:
  %m.addr = alloca i32, align 4
  %0 = mul i32 %x, 1103515245
  %1 = xor i32 %acc, %0
  store i32 %1, i32* %m.addr, align 4
  %2 = load i32, i32* %m.addr, align 4
  %3 = ashr i32 %2, 13
  %4 = load i32, i32* %m.addr, align 4
  %5 = xor i32 %3, %4
  %6 = add i32 %5, 1
  ret i32 %6
}

define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #0 {
entry:
  switch i32 %tag, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %0 = tail call i32 @t0(i32 %x, i32 %acc)
  ret i32 %0

sw.case.1:
  %1 = tail call i32 @t1(i32 %x, i32 %acc)
  ret i32 %1

sw.case.2:
  %2 = tail call i32 @t2(i32 %x, i32 %acc)
  ret i32 %2

sw.default:
  %3 = tail call i32 @t3(i32 %x, i32 %acc)
  ret i32 %3
}

define internal noundef i32 @run(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 1024
  %8 = sext i32 %7 to i64
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %8
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %acc.addr, align 4
  %15 = call i32 @call(i32 %12, i32 %13, i32 %14)
  store i32 %15, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = load i32, i32* %acc.addr, align 4
  ret i32 %18
}
attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
```

After `opt -O3` (what `--profile speed` runs before linking), the loop in
`nish_main`: the dispatcher and all four members are inlined, the bounds
check is gone, and one `switch` is left:

```llvm
bounds.ok.i:                                      ; preds = %push.store.i, %call.exit.i
  %i.addr.03.i = phi i32 [ %44, %call.exit.i ], [ 0, %push.store.i ]
  %acc.addr.02.i = phi i32 [ %common.ret.op.i.i3, %call.exit.i ], [ 1, %push.store.i ]
  %24 = and i32 %i.addr.03.i, 1023
  %25 = zext nneg i32 %24 to i64
  %26 = getelementptr inbounds i32, ptr %.val1, i64 %25
  %27 = load i32, ptr %26, align 4, !tbaa !18, !alias.scope !14, !noalias !11
  switch i32 %27, label %sw.default.i.i [
    i32 0, label %sw.case.i.i
    i32 1, label %sw.case.1.i.i
    i32 2, label %sw.case.2.i.i
  ]

sw.case.i.i:                                      ; preds = %bounds.ok.i
  %28 = mul i32 %i.addr.03.i, 1103515245
  %29 = xor i32 %28, %acc.addr.02.i
  %30 = ashr i32 %29, 13
  %31 = xor i32 %30, %29
  br label %call.exit.i

sw.case.1.i.i:                                    ; preds = %bounds.ok.i
  %32 = mul i32 %i.addr.03.i, 22695477
  %33 = xor i32 %32, %acc.addr.02.i
  %34 = ashr i32 %33, 11
  %35 = xor i32 %34, %33
  br label %call.exit.i

sw.case.2.i.i:                                    ; preds = %bounds.ok.i
  %36 = mul i32 %i.addr.03.i, 1664525
  %37 = xor i32 %36, %acc.addr.02.i
  %38 = ashr i32 %37, 15
  %39 = xor i32 %38, %37
  br label %call.exit.i

sw.default.i.i:                                   ; preds = %bounds.ok.i
  %40 = mul i32 %i.addr.03.i, 134775813
  %41 = xor i32 %40, %acc.addr.02.i
  %42 = ashr i32 %41, 9
  %43 = xor i32 %42, %41
  br label %call.exit.i

call.exit.i:                                      ; preds = %sw.default.i.i, %sw.case.2.i.i, %sw.case.1.i.i, %sw.case.i.i
  %common.ret.op.in.i.i = phi i32 [ %31, %sw.case.i.i ], [ %35, %sw.case.1.i.i ], [ %39, %sw.case.2.i.i ], [ %43, %sw.default.i.i ]
  %common.ret.op.i.i3 = add i32 %common.ret.op.in.i.i, 1
  %44 = add nuw nsw i32 %i.addr.03.i, 1
  %45 = icmp ult i32 %i.addr.03.i, 399999999
  br i1 %45, label %bounds.ok.i, label %run.exit
```

At `K = 8` (`serial_k8_mixed.ll` through `opt -O3`, then `llc`), the same
`switch` is a jump table: the tag is loaded, checked against the seven cases
and used as the index of an indirect branch.

```asm
	incl	%ecx
	movl	%ecx, %r15d
	andl	$1023, %r15d                    # imm = 0x3FF
	movl	(%rax,%r15,4), %r15d
	cmpq	$6, %r15
	ja	.LBB0_18
# %bb.10:                               # %bounds.ok.i
                                        #   in Loop: Header=BB0_9 Depth=1
	notrack		jmpq	*.LJTI0_0(,%r15,8)
```

### 12.3 The indirect variant: the hand-edit

`mkind.mjs` rewrote `@call` and added the table; the diff against §12.2's
file:

```diff
@@ -43,6 +43,8 @@
   ret i8* %grown
 }
 
+@wp51_fns = global [8 x i32 (i32, i32)*] [i32 (i32, i32)* @t0, i32 (i32, i32)* @t1, i32 (i32, i32)* @t2, i32 (i32, i32)* @t3, i32 (i32, i32)* null, i32 (i32, i32)* null, i32 (i32, i32)* null, i32 (i32, i32)* null], align 16
+
 define internal noundef i32 @t0(i32 noundef %x, i32 noundef %acc) #0 {
 entry:
   %m.addr = alloca i32, align 4
@@ -99,29 +101,13 @@
   ret i32 %6
 }
 
-define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #0 {
+define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #2 {
 entry:
-  switch i32 %tag, label %sw.default [
-    i32 0, label %sw.case
-    i32 1, label %sw.case.1
-    i32 2, label %sw.case.2
-  ]
-
-sw.case:
-  %0 = tail call i32 @t0(i32 %x, i32 %acc)
-  ret i32 %0
-
-sw.case.1:
-  %1 = tail call i32 @t1(i32 %x, i32 %acc)
-  ret i32 %1
-
-sw.case.2:
-  %2 = tail call i32 @t2(i32 %x, i32 %acc)
-  ret i32 %2
-
-sw.default:
-  %3 = tail call i32 @t3(i32 %x, i32 %acc)
-  ret i32 %3
+  %ix = sext i32 %tag to i64
+  %slot = getelementptr inbounds [8 x i32 (i32, i32)*], [8 x i32 (i32, i32)*]* @wp51_fns, i64 0, i64 %ix
+  %fp = load i32 (i32, i32)*, i32 (i32, i32)** %slot, align 8
+  %r = call i32 %fp(i32 %x, i32 %acc)
+  ret i32 %r
 }
 
 define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @tags(i32 noundef %base) #1 {
```

and linked this beside the runtime, so link-time optimisation cannot treat
the table as constant:

```c
/* WP51 spike: owns the function table the indirect variant loads from.
   The constructor rewrites it only when WP51_SWAP is set (never, when timed),
   so link-time optimisation cannot treat the table as constant. */
#include <stdlib.h>
typedef int (*fn)(int, int);
extern fn wp51_fns[8];
__attribute__((constructor)) static void wp51_init(void) {
  if (getenv("WP51_SWAP")) { fn t = wp51_fns[0]; wp51_fns[0] = wp51_fns[1]; wp51_fns[1] = t; }
}
```

### 12.4 The escape programs

`esc_b_mixed.ts`, in full:

```ts
import { wrappingAdd, wrappingMul } from "nish:unsafe";

class P {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Keep {
  last: P | null = null;
}

function u0(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 3) ^ wrappingAdd(p.y, 1);
}

function u1(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 5) ^ wrappingAdd(p.y, 2);
}

function u2(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 7) ^ wrappingAdd(p.y, 3);
}

function u3(p: P, k: Keep): i32 {
  k.last = p;
  return wrappingMul(p.x, 9) ^ wrappingAdd(p.y, 4);
}

// The lowering under test: a switch over the closed set, a direct call per arm.
function dispatch(tag: i32, p: P, k: Keep): i32 {
  switch (tag) {
    case 0:
      return u0(p, k);
    case 1:
      return u1(p, k);
    case 2:
      return u2(p, k);
    default:
      return u3(p, k);
  }
}

function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    t.push((s ^ base) & 3);
  }
  return t;
}

function run(n: i32, k: Keep, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const p = new P(i, acc);
    acc = wrappingAdd(dispatch(ts[i % 1024], p, k), 1);
  }
  return acc;
}

export function main(): i32 {
  const k = new Keep();
  const ts = tags(process.argv.length - 1);
  console.log(`${run(200000000, k, ts)}`);
  return 0;
}
```

- **A** drops `k.last = p;` from `u3`.
- **same** pushes `base` (`0`) in place of `(s ^ base) & 3`.
- **direct** is wp28 §11e's shape: only `u0`, no `dispatch`, no tag array,
  `run(n: i32, k: Keep)` with `acc = wrappingAdd(u0(p, k), 1);`.

### 12.5 The escape programs' `.ll`

The signatures §4.2 reads, verbatim:

```llvm
; direct
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #0 {
define noundef i32 @nish_main() #0 {
attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

; A (mixed; same is identical)
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @u3(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
define noundef i32 @nish_main() #2 {

; B (mixed; same is identical)
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @u3(%struct.P* noundef nonnull align 8 dereferenceable(8) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull align 8 dereferenceable(8) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
define noundef i32 @nish_main() #2 {
attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
```

`run` in A, where `P` is made:

```llvm
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %6, i32 %7)
  store %struct.P* %P.obj, %struct.P** %p.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = srem i32 %8, 1024
  %10 = sext i32 %9 to i64
  %11 = icmp ult i64 %10, %1
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %1)
  unreachable

bounds.ok:
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %10
  %14 = load i32, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %15 = load %struct.P*, %struct.P** %p.addr, align 8
  %16 = call i32 @dispatch(i32 %14, %struct.P* %15, %struct.Keep* %k)
  %17 = add i32 %16, 1
  store i32 %17, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i32, i32* %acc.addr, align 4
  ret i32 %20
}
```

`run` in B:

```llvm
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.P*
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %7, i32 %8, i32 %9)
  store %struct.P* %7, %struct.P** %p.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = srem i32 %10, 1024
  %12 = sext i32 %11 to i64
  %13 = icmp ult i64 %12, %1
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %12, i64 %1)
  unreachable

bounds.ok:
  %14 = bitcast i8* %3 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %12
  %16 = load i32, i32* %15, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %17 = load %struct.P*, %struct.P** %p.addr, align 8
  %18 = call i32 @dispatch(i32 %16, %struct.P* %17, %struct.Keep* %k)
  %19 = add i32 %18, 1
  store i32 %19, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %acc.addr, align 4
  ret i32 %22
}
```

After `opt -O3`, the loop of `nish_main` in each (`run` inlined). **direct**,
six instructions and the branch:

```llvm
for.body.i:                                       ; preds = %for.body.i, %entry
  %acc.addr.02.i = phi i32 [ 1, %entry ], [ %3, %for.body.i ]
  %i.addr.01.i = phi i32 [ 0, %entry ], [ %4, %for.body.i ]
  %0 = mul nuw nsw i32 %i.addr.01.i, 3
  %1 = add i32 %acc.addr.02.i, 1
  %2 = xor i32 %0, %1
  %3 = add i32 %2, 1
  %4 = add nuw nsw i32 %i.addr.01.i, 1
  %5 = icmp ult i32 %i.addr.01.i, 199999999
  br i1 %5, label %for.body.i, label %run.exit
```

**A** (`esc_a_same`): the tag load, a `switch` into empty arms, and two phis
that pick each member's constants for one shared body; no allocation:

```llvm
bounds.ok.i:                                      ; preds = %push.store.i, %dispatch.exit.i
  %acc.addr.03.i = phi i32 [ %23, %dispatch.exit.i ], [ 1, %push.store.i ]
  %i.addr.02.i = phi i32 [ %24, %dispatch.exit.i ], [ 0, %push.store.i ]
  %16 = and i32 %i.addr.02.i, 1023
  %17 = zext nneg i32 %16 to i64
  %18 = getelementptr inbounds i32, ptr %.val1, i64 %17
  %19 = load i32, ptr %18, align 4, !tbaa !18, !alias.scope !14, !noalias !11
  switch i32 %19, label %sw.default.i.i [
    i32 0, label %dispatch.exit.i
    i32 1, label %sw.case.1.i.i
    i32 2, label %sw.case.2.i.i
  ]

sw.case.1.i.i:                                    ; preds = %bounds.ok.i
  br label %dispatch.exit.i

sw.case.2.i.i:                                    ; preds = %bounds.ok.i
  br label %dispatch.exit.i

sw.default.i.i:                                   ; preds = %bounds.ok.i
  br label %dispatch.exit.i

dispatch.exit.i:                                  ; preds = %sw.default.i.i, %sw.case.2.i.i, %sw.case.1.i.i, %bounds.ok.i
  %.sink.i.i = phi i32 [ 9, %sw.default.i.i ], [ 7, %sw.case.2.i.i ], [ 5, %sw.case.1.i.i ], [ 3, %bounds.ok.i ]
  %.sink2.i.i = phi i32 [ 4, %sw.default.i.i ], [ 3, %sw.case.2.i.i ], [ 2, %sw.case.1.i.i ], [ 1, %bounds.ok.i ]
  %20 = mul nuw nsw i32 %.sink.i.i, %i.addr.02.i
  %21 = add i32 %.sink2.i.i, %acc.addr.03.i
  %22 = xor i32 %21, %20
  %23 = add i32 %22, 1
  %24 = add nuw nsw i32 %i.addr.02.i, 1
  %25 = icmp ult i32 %i.addr.02.i, 199999999
  br i1 %25, label %bounds.ok.i, label %run.exit
```

**B** (`esc_b_same`): the same `switch` and phis, after an inline arena bump
for `P` and its two stores in every iteration; `k.last = p` was optimised away
with `u3`'s arm folded into the phis, and nothing releases the arena in the
loop:

```llvm
for.body.i2:                                      ; preds = %push.store.i, %dispatch.exit.i
  %acc.addr.03.i = phi i32 [ %24, %dispatch.exit.i ], [ 1, %push.store.i ]
  %i.addr.02.i = phi i32 [ %25, %dispatch.exit.i ], [ 0, %push.store.i ]
  %off.i.i3 = load i64, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 1), align 8
  %new.off.i.i4 = add i64 %off.i.i3, 8
  %cap.i.i5 = load i64, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 2), align 8
  %fits.not.i.i6 = icmp ugt i64 %new.off.i.i4, %cap.i.i5
  br i1 %fits.not.i.i6, label %slow.i.i12, label %fast.i.i7

fast.i.i7:                                        ; preds = %for.body.i2
  store i64 %new.off.i.i4, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 1), align 8
  %buf.i.i8 = load ptr, ptr @nish_arena, align 8
  %obj.i.i9 = getelementptr inbounds i8, ptr %buf.i.i8, i64 %off.i.i3
  br label %bounds.ok.i

slow.i.i12:                                       ; preds = %for.body.i2
  %grown.i.i13 = tail call dereferenceable(8) ptr @nish_arena_grow(i64 8)
  br label %bounds.ok.i

bounds.ok.i:                                      ; preds = %fast.i.i7, %slow.i.i12
  %common.ret.op.i.i11 = phi ptr [ %obj.i.i9, %fast.i.i7 ], [ %grown.i.i13, %slow.i.i12 ]
  store i32 %i.addr.02.i, ptr %common.ret.op.i.i11, align 4, !tbaa !20, !alias.scope !23
  %16 = getelementptr inbounds %struct.P, ptr %common.ret.op.i.i11, i64 0, i32 1
  store i32 %acc.addr.03.i, ptr %16, align 4, !tbaa !26, !alias.scope !23
  ; ... the switch, the arms and the phis as in A
```

### 12.6 How it was run

```sh
build/nish <x>.ts -o <x>.ll                 # esc_direct also with --no-stack-alloc
llvm-as <x>.ll -o /dev/null                 # every .ll, the _ind ones included
scripts/build.sh <x>.ll runtime/runtime.c [wp51_fns.c] -o bin/<x> --profile speed
cp bin/serial_direct bin/serial_direct_copy # and array_, esc_, rand_: the noise band
python3 bench.py "$(cat groups.json)" 7     # best of 7, interleaved
node genrand.mjs                            # §3.4's group, then the steps above
python3 bench.py "$(cat groups_rand.json)" 7
```

`groups.json` and `groups_rand.json`:

```json
[["serial_direct", "serial_direct_copy", "serial_k1_same", "serial_k1_same_ind", "serial_k2_same", "serial_k2_same_ind", "serial_k2_mixed", "serial_k2_mixed_ind", "serial_k4_same", "serial_k4_same_ind", "serial_k4_mixed", "serial_k4_mixed_ind", "serial_k8_same", "serial_k8_same_ind", "serial_k8_mixed", "serial_k8_mixed_ind"], ["array_direct", "array_direct_copy", "array_k1_same", "array_k1_same_ind", "array_k2_same", "array_k2_same_ind", "array_k2_mixed", "array_k2_mixed_ind", "array_k4_same", "array_k4_same_ind", "array_k4_mixed", "array_k4_mixed_ind", "array_k8_same", "array_k8_same_ind", "array_k8_mixed", "array_k8_mixed_ind"], ["esc_direct", "esc_direct_copy", "esc_direct_nostack", "esc_a_same", "esc_a_mixed", "esc_b_same", "esc_b_mixed"]]
[["rand_direct","rand_direct_copy","rand_k2_mixed","rand_k2_mixed_ind","rand_k4_mixed","rand_k4_mixed_ind","rand_k8_mixed","rand_k8_mixed_ind"]]
```

`bench.py`:

```python
# WP51 spike runner: best of N, every variant run once per round (interleaved).
import os, subprocess, sys, time, resource, json
BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")
groups = json.loads(sys.argv[1]); rounds = int(sys.argv[2])
best, rss, outs = {}, {}, {}
for r in range(rounds):
    for g in groups:
        for v in g:
            t0 = time.perf_counter()
            p = subprocess.Popen([os.path.join(BIN, v)], stdout=subprocess.PIPE)
            out = p.stdout.read(); _, status, ru = os.wait4(p.pid, 0)
            dt = (time.perf_counter() - t0) * 1000
            assert status == 0, v
            best[v] = min(best.get(v, 1e18), dt); rss[v] = max(rss.get(v, 0), ru.ru_maxrss)
            outs.setdefault(v, set()).add(out.strip().decode())
    print(f"round {r + 1} done", flush=True)
for g in groups:
    print("--")
    for v in g:
        print(f"{v:28} {best[v]:9.0f} ms  {rss[v] // 1024:6d} MB  out={','.join(outs[v])}")
```

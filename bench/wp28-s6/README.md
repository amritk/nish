# WP28 spike S6: `try`/`catch` by landing pads against a `Result` desugaring

Compatibility mode (WP28) has to lower `throw`, `try` and `catch`. There are
two candidates, and stage C5 needs one of them chosen. This spike writes the
same three programs both ways, times them against each other and measures what
each costs in bytes and in what the rest of the compiler may assume.

**Recommendation for C5: lower `try`/`catch` to the
`Result` desugaring.** The rule and the rows it rests on are under
[Verdict](#verdict).

## The two lowerings

**`Result` desugaring.** A function that may throw returns
`Result<T, E>`; `throw e` is `return Err(e)`; a call that may throw is followed
by a test and a branch to the enclosing `catch`, or by an early return when
there is none (`.orReturn()`). This is what Nish emits today for a program
written with `Result`, so this side is `hot.ts`, `parse.ts` and `deep.ts`
compiled by `build/nish`, untouched. A `Result<i32, i32>` comes back as
`{ i1, i32, i32 }`.

**Landing pads.** A function that may throw returns `T`; `throw e` raises
through the platform's Itanium unwinder; a call under a `try` is an `invoke`
whose unwind edge is a `landingpad`; a call with no `try` around it is a plain
`call` and the unwinder walks through its frame. This side is `hot.ll`,
`parse.ll` and `deep.ll`, written by hand as the IR the compiler would emit:
the same arithmetic, the same overflow checks, the same exported signatures.
Each `.ts` file's header shows the `try`/`catch` source both stand for.

Both sides share one driver (`main.ts`, compiled once) and the same runtime.

### The unwinder and the personality

The unwinder is the toolchain's: `_Unwind_RaiseException` from `libgcc_s` on
Linux (`libunwind` inside `libSystem` on macOS). Shipping one of our own is
the alternative, and it is a DWARF CFI interpreter, not spike-sized.

The personality is our own, `nish_s6_personality` in `unwind.c` (about 120
lines), not one of the two a toolchain carries:

- `__gxx_personality_v0` links the C++ runtime and matches a thrown type
  against `type_info` records. Nish's `catch` takes everything, so the
  matching is pure cost and the dependency is a second shared library.
- `__gcc_personality_v0` (C's, for `__attribute__((cleanup))`) runs cleanups
  and never catches, so it cannot express `catch` at all.

Ours reads the call-site table LLVM writes into `.gcc_except_table`, and where
the faulting call has a landing pad it says "handler found" in the search
phase and installs it in the cleanup phase. No type table, no action table.

Everything else is chosen to flatter landing pads, so the figures below are
their floor, not their typical cost:

- the exception object is one thread-local struct, so a throw allocates
  nothing (C++ calls `malloc` in `__cxa_allocate_exception`);
- the thrown value is an `i32`;
- no frame between the throw and the catch has a cleanup (nothing to release,
  no `finally`), so the cleanup phase stops nowhere on the way;
- the binary has two shared objects for the unwinder to search, not a
  hundred.

## Running it

```sh
npm run build && node bench/wp28-s6/run.mjs --rounds 15
```

`run.mjs` assembles every hand-written `.ll` with `llvm-as`, builds both sides
with `scripts/build.sh --profile speed` (the release profile: `-O3`, LTO),
checks that every binary prints the same checksum on every row, and then times
them in shuffled interleaved rounds. Its header describes the method. It builds
each side twice:

- **inlined**: as the optimiser leaves it. LTO inlines these small callees,
  and that is not neutral: an inlined `throw` under its own `catch` is still
  a call into the unwinder, an inlined `Err` is a branch.
- **outlined**: every function that can fail marked `noinline` on both sides,
  so a failure crosses the calls its source shows. This is the shape of a
  larger program, where callees are not all inlined.

## Figures

Machine: 4 vCPUs of an Intel Xeon @ 2.30GHz (a shared cloud VM), Linux 6.18,
glibc 2.39, clang and LLVM 18.1.3, x86-64. 15 rounds, medians. The noise band
of a row is the median gap between the `Result` binary and a byte-identical
copy of it timed in the same rounds; a ratio marked "inside the band" is no
difference. Everything below this line up to [Reading the
figures](#reading-the-figures) is `run.mjs`'s output, pasted.

### Time, inlined

| program | `Result` ms | landing pads ms | pads / `Result` | noise band |
| --- | ---: | ---: | ---: | ---: |
| hot loop, never throws | 289.0 | 284.4 | 0.98x (inside the band) | ±2.0% |
| parser, never throws | 158.9 | 107.1 | 0.67x | ±3.9% |
| parser, throws 1 in 1000 | 159.4 | 113.4 | 0.71x | ±2.1% |
| parser, throws 1 in 100 | 159.3 | 155.9 | 0.98x (inside the band) | ±2.9% |
| parser, throws 1 in 10 | 159.5 | 576.6 | 3.62x | ±3.8% |
| call chain, unwinds 1 frame | 0.34 | 153.6 | 447.82x | ±6.2% |
| call chain, unwinds 8 frames | 2.03 | 349.8 | 172.44x | ±3.7% |
| call chain, unwinds 32 frames | 7.62 | 1009.0 | 132.45x | ±0.8% |

### Time, outlined

| program | `Result` ms | landing pads ms | pads / `Result` | noise band |
| --- | ---: | ---: | ---: | ---: |
| hot loop, never throws | 322.0 | 320.1 | 0.99x (inside the band) | ±2.6% |
| parser, never throws | 178.1 | 167.1 | 0.94x | ±1.6% |
| parser, throws 1 in 1000 | 177.6 | 175.7 | 0.99x (inside the band) | ±2.9% |
| parser, throws 1 in 100 | 178.5 | 272.6 | 1.53x | ±5.3% |
| parser, throws 1 in 10 | 187.7 | 1257.5 | 6.70x | ±2.5% |
| call chain, unwinds 1 frame | 0.42 | 153.0 | 367.28x | ±7.7% |
| call chain, unwinds 8 frames | 2.51 | 348.3 | 138.87x | ±10.2% |
| call chain, unwinds 32 frames | 8.79 | 983.6 | 111.97x | ±4.0% |

### One failure, in nanoseconds

| program | mode | `Result` | landing pads |
| --- | --- | ---: | ---: |
| parser, throws 1 in 1000 | inlined | inside the band | 628.6 |
| parser, throws 1 in 1000 | outlined | inside the band | 859.7 |
| parser, throws 1 in 100 | inlined | inside the band | 488.0 |
| parser, throws 1 in 100 | outlined | inside the band | 1054.9 |
| parser, throws 1 in 10 | inlined | inside the band | 469.5 |
| parser, throws 1 in 10 | outlined | 9.5 | 1090.4 |
| call chain, unwinds 1 frame | inlined | 1.7 | 768.2 |
| call chain, unwinds 1 frame | outlined | 2.1 | 764.9 |
| call chain, unwinds 8 frames | inlined | 10.1 | 1749.0 |
| call chain, unwinds 8 frames | outlined | 12.5 | 1741.7 |
| call chain, unwinds 32 frames | inlined | 38.1 | 5044.8 |
| call chain, unwinds 32 frames | outlined | 43.9 | 4918.1 |

- inlined: each frame more costs 1.2 ns by `Result`, 138.0 ns by landing pads

- outlined: each frame more costs 1.3 ns by `Result`, 134.0 ns by landing pads

### Break-even, the parser

- inlined: landing pads save 5.18 ns a record that parses and cost 469 ns more a failure: they win below about one failure in 90 records
- outlined: landing pads save 1.10 ns a record that parses and cost 1081 ns more a failure: they win below about one failure in 980 records

### Size, bytes, each kernel compiled alone

| kernel | lowering | `.text` | `.eh_frame` | `.gcc_except_table` | total |
| --- | --- | ---: | ---: | ---: | ---: |
| hot | `Result` | 149 | 0 | 0 | 149 |
| hot | `Result`, no `nounwind` on definitions | 149 | 0 | 0 | 149 |
| hot | `Result`, no `nounwind` anywhere | 149 | 0 | 0 | 149 |
| hot | landing pads | 138 | 56 | 4 | 198 |
| parse | `Result` | 624 | 0 | 0 | 624 |
| parse | `Result`, no `nounwind` on definitions | 624 | 0 | 0 | 624 |
| parse | `Result`, no `nounwind` anywhere | 624 | 128 | 0 | 752 |
| parse | landing pads | 766 | 112 | 20 | 898 |
| deep | `Result` | 184 | 0 | 0 | 184 |
| deep | `Result`, no `nounwind` on definitions | 184 | 0 | 0 | 184 |
| deep | `Result`, no `nounwind` anywhere | 184 | 128 | 0 | 312 |
| deep | landing pads | 179 | 160 | 16 | 355 |
| throw.ll | landing pads, once a program | 20 | 48 | 0 | 68 |
| unwind.c | landing pads, once a program | 738 | 0 | 0 | 738 |

### Size, bytes, the linked binaries

| binary | file | `.text` | `.eh_frame` + `.eh_frame_hdr` | `.gcc_except_table` | shared libraries |
| --- | ---: | ---: | ---: | ---: | --- |
| inlined-result | 10584 | 4339 | 68 | 0 | libc.so.6 |
| inlined-pads | 12904 | 5379 | 268 | 32 | libgcc_s.so.1 libc.so.6 |
| outlined-result | 10472 | 4227 | 68 | 0 | libc.so.6 |
| outlined-pads | 12696 | 5011 | 436 | 32 | libgcc_s.so.1 libc.so.6 |

### `nounwind`, with and without, under `opt -O2`

- hot: off the definitions identical, off everything identical
- parse: off the definitions identical, off everything differs
- deep: off the definitions identical, off everything differs
- nounwind.ll: 1 store left with `nounwind`, 2 without

## Reading the figures

**A program that never throws runs the same.** The hot loop is inside the
band in both modes: the `Result` test after the call is one predicted branch
on a register. Landing pads are "zero-cost" on this path, and so, to what this
machine can measure, is `Result`.

**The parser is where landing pads win, and by how much depends on
inlining.** With nothing thrown, landing pads run it in 0.67x the time
inlined and 0.94x outlined. The inlined gap is mostly not the checks: without
the three-word returns the optimiser folds the whole parser into `parse`
while the `Result` side keeps `parseField` out of line and passes each
`{ i1, i32, i32 }` back through it. The evidence for that is the kernel
compiled alone: `llvm-nm build/wp28-s6/result-parse.o` lists `parse` and
`parseField`, the landing-pad object lists `parse` only, and its `.text` is
766 bytes against 624. The linked binaries are stripped and went through LTO,
so the same shape was not confirmed in them.
The outlined row, where both sides make the same calls, prices the checks
themselves: 1.1 ns a record of twelve digits, 6%. That row moves: an earlier
run of this head put it inside its band. So the honest range for what the
`Result` checks cost a parser that never fails is "0 to 6%, more where they
block inlining".

**A failure costs landing pads two to three orders of magnitude more.** A
throw caught one frame up is about 770 ns against 2 ns; each further frame is
about 135 ns against 1.2 ns. An `Err` in the parser is inside the band in
every row but one (9.5 ns); a throw there is 470 to 1090 ns. The 770 ns is
the unwinder's fixed work (two phases, each finding the frame's description
and running its CFI), and it is the floor described above.

**So landing pads win only when failures are rare, and the line is close.**
The parser breaks even at about one failure in 90 records inlined and one in
980 outlined. Those are approximate: they divide the saving by the cost of a
failure at one in 10, and that cost moves with density (860, 1055 and 1090 ns
outlined at one in 1000, 100 and 10). At one in 100 the outlined build is already 1.53x slower; at one in
10 it is 3.6x and 6.7x.

**Landing pads are larger everywhere.** Each kernel is bigger in total (hot
149 to 198 bytes, parse 624 to 898, deep 184 to 355) because every function
the unwinder may cross needs a frame description in `.eh_frame` and every
`try` a call-site table, even where `.text` shrinks. The linked binary grows
by 2.2 to 2.3 KB, of which 806 bytes are the throw and the personality, paid
once a program, and it gains a second shared library.

## What landing pads cost outside the timing

### An unwinder on every target

| target | unwinder | what it takes |
| --- | --- | --- |
| Linux (`speed`, `size`) | `libgcc_s.so.1`, dynamic | A second `NEEDED` library (the table above); today a Nish binary needs `libc` only. A static link pulls `libgcc_eh` instead. Not measured. |
| macOS | `libunwind` in `libSystem` | Already linked, so no new dependency. Not built or run here. |
| WASI | none in the engine-neutral subset | `landingpad` does not exist there. The wasm backend lowers `invoke` to `call` unless exception handling is turned on: `llc -mtriple=wasm32-wasi hot.ll` succeeds and emits a plain `call step`, so the `catch` is silently gone. Turning it on is a different IR (`catchswitch`/`catchpad`, a wasm personality) and the exception-handling proposal in every host, which Nish does not require today. |
| freestanding (`--profile wasm`, `wasm-host`) | none | As WASI, and with no libc there is nothing to link an unwinder from. `runtime-wasm.c` would have to carry one. |

The `Result` desugaring needs nothing on any of the four: it is calls,
returns and branches.

Two more things follow from the unwinder on the native targets:

- **The release profiles drop unwind tables** (`scripts/build.sh` passes
  `-fno-unwind-tables -fno-asynchronous-unwind-tables`, part of what keeps a
  hello-world small). IR functions that are not `nounwind` get their tables
  regardless, which is why this spike works, but the C runtime does not: a
  throw cannot cross a `runtime/*.c` frame (a callback from a C kernel, a
  thread's entry). That is why the throw site here is `throw.ll` and not a C
  function. Either the runtime is built with tables (size, on every program)
  or the compiler proves no throw crosses it.
- **An uncaught throw** returns from `_Unwind_RaiseException`; `throw.ll`
  traps. The search phase has by then walked the whole stack for nothing.

### `nounwind`

Every function Nish emits today is `nounwind`, and every runtime declaration
too. Under landing pads a function keeps it only if nothing it calls can
throw, so the compiler needs that fixpoint, and any call it cannot see
through (a closure, an interface method, an import from compatibility-mode
JavaScript) must be assumed to throw.

What it buys today, from `opt -O2` with and without it. `run.mjs` strips the
attribute from two copies of each `Result` kernel, one losing it on the
definitions only and one on the declarations too, and compares the optimised
IR with its `; Function Attrs:` lines kept:

- **Off the definitions only, nothing**: the optimised IR and the attributes
  LLVM infers are identical, and so are the sizes. LLVM re-derives `nounwind`
  for a function when every callee it can see has it, and the declarations
  still do.
- **Off the declarations too, 128 bytes of `.eh_frame` in `parse` and in
  `deep`** (20% and 70% of the kernel) and the same `.text`. Both still call
  `nish_panic_overflow` after optimisation, and once that declaration may
  unwind, so may they, and each gets an unwind table. `hot` keeps no such
  call and does not change. So the cost is not for being reachable by a
  throw; it is for calling anything LLVM cannot prove `nounwind`, which under
  landing pads is every indirect or imported callee.
- **A dead store, where there is memory**: in `nounwind.ll` a store before a
  call is overwritten after it. With a `nounwind` callee `opt -O2` deletes
  the first store; without, it keeps both, because a landing pad up the stack
  could read the memory. Any write through a pointer the caller can still
  reach, made before a call and finished after it, is this shape.

Which attributes the fixpoint loses on a function that may throw or may call
one that does: `nounwind` itself; `readnone` where it has it (the compiler
gives `mix` and `byteAt` `willreturn readnone` today), since a throw writes
the exception object and calls the unwinder; and the `nounwind` on every
declaration of an indirect or imported callee. `willreturn` survives in
LLVM's definition (unwinding to a caller counts as returning), but LLVM does
not infer it through a call to the opaque thrower. A function that only ever
returns `Err` keeps all of them.

### Not measured

- Frames with cleanups. A `finally`, or a frame that must release an arena
  mark or a region on the way out, turns its `call`s into `invoke`s with a
  cleanup pad, adds a call-site table, and makes the cleanup phase stop
  there. `Result` pays an ordinary branch for the same thing.
- A large binary. The unwinder finds a frame's description by walking the
  loaded objects; these binaries have two.
- AArch64 and macOS timings.
- A heap-allocated or string-carrying error, which costs both sides the same
  allocation.

## Verdict

**C5 lowers `try`/`catch` to the `Result` desugaring.** The rule, which a
reader can check against the tables:

> Take landing pads only if (a) in the outlined build they are faster outside
> the noise band both on a program that never throws and at one failure in
> 1000, and (b) every target has an unwinder.

Neither holds as written, but **the recommendation stands on (b) alone**. Clause (a) is
judged on the outlined build, and "a program that never throws" covers two
rows that disagree, the hot loop and the parser; in the inlined build the
parser rows (0.67x and 0.71x) would satisfy it. A reader who weighs (a)
otherwise reaches the same verdict through (b).

- (a) The hot loop is inside the band in both builds (inlined, that row
  compares two near-identical loops: the throw is provably dead once `step`
  is inlined, so it says little about landing pads). The outlined parser
  saves 1.1 ns a record when nothing fails (0.94x, and inside the band in
  another run), at one failure in 1000 it is inside the band, and at one in
  100 landing pads are 1.53x slower. Nothing holds compatibility-mode
  JavaScript to one in 1000: `JSON.parse` in a probe and validate-or-throw
  helpers throw as control flow.
- (b) WASI and the freestanding profile have none, and the wasm backend drops
  the `catch` without a diagnostic.

And on the other columns the table points one way: a failure costs 770 ns and
135 ns a frame against 2 ns and 1.2 ns, every kernel is larger in total, and
the binary gains `libgcc_s`.

What the rule leaves on the table is the inlined parser's 0.67x. It is real,
and it is the three-word `Result` return blocking inlining, not exception
handling as such; if C5's programs show it, the remedy to measure first is in
the `Result` ABI and the inliner's view of it (out of this spike's scope),
which keeps the cheap failure path and every target.

Revisit if a compatibility-mode benchmark that never throws shows the
`Result` checks outside the band by more than the 6% seen here.

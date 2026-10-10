# WP6: Memory strategy

**Status: complete.** §1–§4 and the call-site reclaim shipped in 0.1.0; the
tail-call release and marker (§2b) in 0.3.0 (#85, #86); callee-earned scopes
(§2c, #210) and loop-pass scopes (§2d, #221) in 0.11.0. After 0.16.0,
`using a = arena()` (#420) added a checked bracket and `Arena.release` /
`Arena.reset` became deprecated (#428, NL7001); see §3. Reference counting
was never built (see "Left out"). The living rules are
[LANGUAGE.md "Memory model"](LANGUAGE.md#memory-model) and
[`Arena`](LANGUAGE.md#arena). This note keeps the decisions and the reasons
behind them.

There is no garbage collector. Each value is placed by a compile-time proof,
not a heuristic, and every mechanism leaves what the program computes
unchanged:

1. stack allocation (§1);
2. automatic arena scopes: per function (§2), around a tail call (§2b),
   earned through callees (§2c), per loop pass (§2d);
3. the call-site reclaim of a returned string (§2a);
4. explicit control (§3);
5. `T | null` for pointer types, narrowed by the checker (§4).

Code: `src/escape.ts` (the analysis, loop scopes, the NL9011 findings),
`src/attributes.ts` (the `FunctionFacts` fixpoint), the emitters, and
`runtime/runtime.c` / `runtime/nish.h`. Tests: `tests/cases/mem_*`,
`reject_null*`, `reject_nullable_scalar`, `reject_arena_release_type`,
`reject_using_arena_*`, `tests/link/tail_call_depth{,_debug}`, the scope checks
in `tests/runtime-test.c` and the `WP6: memory` block in `tests/run.js`.

## 1. Stack allocation

`new C(...)`, an object literal, an array literal and `new Array<T>(<literal>)`
are allocation sites. The analysis follows a site's value through parentheses,
ternary arms and `const`-like locals and their aliases, and classifies every
use with `classifyUse`, the same classifier that decides `nocapture`:

- **`local`**: consumed on the spot (an operand, a field or element access,
  `.length`, `for...of`, a non-capturing argument, a runtime builtin);
- **`returned`**;
- **`leaks`**: anything else (stored, pushed, assigned to another variable,
  `let q = p` included, or passed to a capturing callee).

A site becomes an entry-block `alloca` when it is stackable (array data at most
4,096 bytes, `STACK_ARRAY_BYTES`; a non-literal length never is), its flow is
`local`, and no local on its path is reassigned. This is sound because every
reference is either consumed in the site's own statement or held by a
never-reassigned local in scope, so nothing can name the object after the block
exits. A site in a loop gets one slot, reused on every pass. Reuse is correct
because the previous pass's object is unreachable, and any use that would keep
it alive is a `leaks` flow. A stack array is a header alloca plus a data
alloca. A later `push` moves the data into the arena, and the header stays
valid. Every stack object is `align 8`, so every pointer attribute stays true.
Field access through a local that only ever holds a stack object is not a
memory effect, which is how `swapped` in `mem_stack_struct` becomes `readnone`.
`--no-stack-alloc` turns the rule off.

## 2. Arena scopes

A function brackets its body with `nish_arena_mark` on entry and
`nish_arena_release` before every `ret` (after the return value is computed)
when all four of these hold:

- it has a direct arena allocation whose flow is `local`;
- none of its sites is `returned` or `leaks`;
- no callee, transitively, leaks an allocation (`allocLeaks`);
- neither it nor a callee calls `Arena.reset` / `Arena.release`
  (`usesArenaControl`).

The facts (`allocates`, `allocLeaks`, `returnsAllocation`, `usesArenaControl`,
`directArena`) propagate in the same fixpoint as purity. A `push` onto an array
the function did not allocate counts as a leak.

`mem_scope_dynamic_array` and `mem_scope_string_temp` call such a function
100,000 times and print the same `Arena.used()` before and after. A mark is
the absolute bump address (`0` for an empty arena). `nish_arena_release`
rewinds within the current chunk, or frees every newer chunk and rewinds an
older one, and ignores a mark that names no live chunk. Scopes nest LIFO with
the call stack.

## 2a. The call-site reclaim (WP9)

A function that returns a string has `returnsAllocation` set, so it gets no
scope. Its caller brackets the call instead:
`nish_arena_mark()` after the arguments, then
`nish_arena_keep(mark, s)`, which moves the string down onto the mark and
releases everything the callee bumped beneath it. The bracket is emitted when
the callee returns a plain `string`, allocates, and has neither `allocEscapes`
nor `usesArenaControl`. Only a `string` qualifies, because it is one flat block
with no interior pointers. An array, a struct, a `Result` or a `T | null` names
other memory, or may be null, and cannot be moved. `allocEscapes` asks
whether the caller can reach an allocation other than through the return
value. It does not count an assignment to a frame local, so it implies
`allocLeaks` and never the reverse, and the §2 scopes are unchanged.
`nish_arena_keep` refuses whenever it is uncertain (`p` is not in the current
chunk, the mark is stale or `0`, or the mark is newer than `p`). Refusing only
reclaims less. The bracket is independent of `--no-stack-alloc`
(`mem_reclaim_no_stack_alloc`). `mem_reclaim_guards` covers the refused shapes,
and `runtime-wasm.c` does not provide `nish_arena_keep` because the
freestanding wasm profile has no strings. The rule, its soundness argument and
the measurements are in
[wp9-optimisation.md](wp9-optimisation.md#the-call-site-reclaim).

## 2b. The tail call: the marker, and the release ahead of it

A `return g(a1, …, an)` is emitted as a `tail call` when every argument is a
scalar, `g` has exactly `n` parameters (which refuses a method, whose receiver
is a pointer the argument list does not carry), `g` does not return a packed
`Result`, and the call has no reclaim bracket. In a function with a scope,
`nish_arena_release` moves ahead of that call, provided `g` does not read the
bump position (`readsArenaState`: `Arena.mark` / `Arena.used`).

Why it is sound: the language has no address-of operator, and a stack site
never flows anywhere but `local`, so with only scalar arguments the callee
cannot reach this frame's memory. That is the claim the `tail` marker makes.
The release is safe because the call is the whole of the `return` and its
arguments are not arena memory. `readsArenaState` is a separate fact from
`usesArenaControl` because reading the position invalidates nothing and must
not cost a function its scope.

The marker is what makes `--profile debug` (`-O0`, where no pass finds tail
calls) run deep recursion in constant stack. `tests/link/tail_call_depth`
(a million levels with the release moved) and `tail_call_depth_debug` (a
million levels at `-O0`) both segfault without it. At `-O0`, peak RSS stayed at
about 1,840 KB from 1,000 to 100,000,000 levels, while the unmarked build
overflowed at about 170,000. `mem_scope_tail_call` and
`mem_scope_tail_call_guards` pin the instruction order and the refusals.

## 2c. Scopes earned through callees

A function that allocates nothing of its own, but calls functions that do,
used to reclaim nothing. It now gets the scope when all four of these hold:

- it is **contained**;
- it returns a number, `boolean`, `enum` or `void`;
- no arena control is reachable from it;
- some callee **net-allocates**: it allocates and has no scope of its own.

Containment has two proofs:

- `!allocEscapes`, which counts *any* store of an allocation as an escape;
- `rootsHoldNoPointer`: every parameter, `this` included, is a scalar, a
  string, or an object with only scalar fields. With no mutable globals, older
  memory is then reachable only through slots that cannot hold a pointer.

A first version made containment its own fixpoint over callees. That was
unsound: `k.f = mk(n).x` reads a nested allocation back out and stores it, and
`mem_callee_scope_nested` pins the refusal. `settleCalleeScopes` settles
callees depth first. On a cycle it can only over-state net-allocation, which
costs an unneeded scope, never a missing one.

The arena-loop warning **NL9011** names whatever refused a scope to a call in a
loop that drops its result. It runs after the fixpoint (`arenaLoopFindings`),
and its count over `src/` is pinned in `tests/perf-baseline.json`.

Measured (0.11.0, Are We Fast Yet ports, `--profile speed`): with its manual
`Arena.mark`/`release` removed, `Storage` went from 373.1 ms and 390,064 KB
peak RSS to 166.6 ms and 10,180 KB. `List 1 100000` went from 49,840 KB to
10,168 KB.

## 2d. Scopes around a loop's pass (#216)

A pointer-returning function has no scope, and a scalar function's scope
releases only at its return, so a loop that builds and drops a temporary on
every pass kept them all. #216's `summarise` peaked at 85 MB at 4,000 rounds.
`decideLoopScopes` now brackets the body when the pass allocates (directly, by
a `push`, by printing a number, or through a net-allocating callee) and nothing
allocated during it outlives the pass except as a scalar. Each clause closes
one way out of the pass:

- **memory**: no site in the body escapes, and no callee has `allocEscapes`;
- **outer locals**: a pointer-typed outer local is assigned only values that
  `isOld` proves predate the pass, and `x op= e` is refused;
- **growth**: `push` only onto an array the body itself declared fresh;
- **return**: only an old pointer may be returned, and `orReturn` is refused;
- **control**: no arena control is reachable from the function.

An inline element (`xs[i]` over inline structs) is followed as its array
(`yieldsInteriorPointer`). Before that fix, `mem_loop_scope_interior` printed
`8 16` instead of `49 98`.

The mark is read inline from `@nish_arena` (`buf`, `off`) rather than by
calling the runtime. An unchanged `buf` means rewinding `off` is the whole
release, and otherwise the code calls `nish_arena_release(buf + off)`. Calling
the runtime both times doubled the cost of the worst-case loop. The fall-through,
`continue` and `break` each release their pass; `return` releases the outermost
open scope; a scalar tail call sinks that release as §2b does.

Measured: 10⁸ passes of a scalar loop went from 1.6–16.4 s and 3,127,848 KB to
0.23 s and 1,448 KB. #216's probe stays at 1,448 KB at every round count. The
cost is about a third of a nanosecond per pass on a loop that never faults a
page. No benchmark loop was affected: their IR is byte-identical.

## 3. Explicit control

`Arena.mark(): i64` (`nish_arena_mark`) and `Arena.used(): i64`
(`nish_arena_used`, bytes in the current chunk) are unchanged. `Arena.release(m)`
and `Arena.reset()` still compile and run, but since #428 every call prints the
NL7001 deprecation warning. They are the one way ordinary code can reach
undefined behaviour in the arena: releasing while anything allocated after the
mark is still referenced. Their replacement, `using a = arena()` (#420), makes
the same release on every exit of its block and *refuses* (NL2418–NL2427) any
value that would outlive the block, holding the block to §2d's rules
(`mem_using_arena*`, `reject_using_arena_*`). A function that reaches
`Arena.release` or `Arena.reset` gets no automatic scope (`usesArenaControl`),
so a user reset never invalidates a compiler mark. All four builtins have
effect `write`, which is conservative so that a `readonly` caller is never
hoisted across an allocation.

## 4. `T | null`

`T | null` is accepted where `T` is a class, interface, array or string, and
rejected for scalars (`reject_nullable_scalar`). It is the same LLVM pointer
type, with `null` as the constant. `T` is assignable to `T | null`, but the
reverse is an error, as is `null` with no contextual type.
`new Array<T | null>(n)` is allowed because the zero fill is `null`. Narrowing
applies to locals and parameters only, never to property paths. It holds under
`!==` / `===` guards, in `while` and `for` conditions, in `&&` / `||` / `?:`,
and after an `if` whose other arm cannot fall through. An assignment ends it,
and so does entering a loop that assigns the variable
(`reject_null_narrowing_leaks`, `reject_null_narrowing_assigned`). A nullable
parameter or return loses `nonnull` and `dereferenceable` and keeps `align 8`
(`mem_nullable`).

## Left out

- **Reference counting**: not started, so that this package kept to
  transformations proved safe.
- **`llvm.lifetime.start/end`** on the hoisted allocas: precise `end`s need
  scope exits that the emitter does not track.
- **Objects stored into a local container** never move to the stack. A
  constructor that stores a parameter into `this` makes the argument a leak,
  and a "captured only into `this`" fact would lift that.
- **Narrowing of property paths**: copy the value into a local first.
- **`new Array<T>(n)` with `const n = 4`** is not stackable; only a literal
  length is.
- **§2d's gaps**: a callee that stores fresh values into the object it returns
  has `allocEscapes`, so loops calling it are not scoped. Fixing that needs a
  "stored only into fresh memory" fact and reads that follow it. A pass that
  `return`s a fresh value is refused, even with scalar inputs.
- **A branch-assigned local** (`let what = …` assigned in each arm) sets
  `allocLeaks`, so the function loses its scope silently unless §2c's rule
  rescues it. No warning is given, because no rewrite could be named. It can be
  closed in one of two ways: a stack rule that does not need a fixed binding
  (the "captured only into one binding" fact, which `allocEscapes` already
  approximates), or an opt-in `--report-arena` audit listing each site's
  placement. The audit is built, as `--emit-arena`
  ([LANGUAGE.md](LANGUAGE.md#arena-placement)); the stack rule is not. Its loop form, a local declared outside a loop
  and handed a new allocation on every pass, is no longer silent: NL9016
  reports it whatever the local was declared holding, because the value each
  pass drops is the previous pass's own and keeping numbers across passes is a
  rewrite that can be named.

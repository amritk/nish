# WP6: Memory strategy

The zero-GC model in four layers, each a proven guarantee rather than a
heuristic, plus `T | null`:

1. **Escape-analysed stack allocation.** A `new C(...)`, object literal,
   array literal, or `new Array<T>(<literal>)` whose value provably does not
   outlive its function becomes an `alloca` in the entry block. The module
   then often needs no arena at all.
2. **Automatic arena scopes.** A function whose arena temporaries all die
   with it brackets its body with `amrit_arena_mark` / `amrit_arena_release`, so
   calling it a million times keeps the arena flat.
3. **The call-site reclaim** (WP9, section 2a). A function that *returns* a
   string cannot have a scope, because the string has to outlive it — so its
   caller brackets the call instead, with `amrit_arena_mark` /
   `amrit_arena_keep`, and reclaims everything the callee bumped underneath the
   value it handed back.
4. **Explicit control.** `Arena.reset()`, `Arena.mark()`, `Arena.release(m)`,
   `Arena.used()` for programs that manage batches themselves.
5. **`T | null`** for pointer types, with narrowing enforced by the checker.

Reference counting is not in this package (see "Left out").

Files: `src/codegen/escape.ts` (the analysis), `src/codegen/attributes.ts`
(integration into the fact fixpoint), `src/codegen/emit/{classes,arrays}.ts`
(allocas), `src/codegen/emitter.ts` and `emit/statements.ts` (scopes),
`src/checker/nullable.ts`, `src/checker/arena.ts`, `src/codegen/emit/arena.ts`,
`runtime/runtime.c`, `runtime/amritc.h`; the call-site reclaim adds
`src/codegen/emit/{expressions,classes}.ts` (the bracket) and
`amrit_arena_keep`. Tests: `tests/cases/mem_*`,
`tests/cases/reject_null_*`, `reject_nullable_scalar`,
`reject_arena_release_type`, the `WP6: memory` block in `tests/run.js`, and
the scope checks in `tests/runtime_test.c`.

## 1. Stack allocation

### Allocation sites and flows

An *allocation site* is an expression that produces fresh memory:

| Site | Kind | Stackable |
| --- | --- | --- |
| `new C(...)`, `{ ... }` | struct | yes |
| `[a, b, c]`, `new Array<T>(<non-negative integer literal>)` | array | yes, while `n * sizeof(T) <= 4096` bytes (`STACK_ARRAY_BYTES`) |
| `new Array<T>(n)` with a non-literal `n` | array | no (dynamic size) |
| `a + b` on strings, a template with a hole, `readFileSync(p)` | string | no |
| a call to a user function returning a pointer type | whatever the callee allocated and returned | no |

The value of a site *flows* somewhere. The analysis follows it through the
transparent wrappers (parentheses, ternary arms) and through the `const` /
`let` local it is stored in and every alias of that local (`const y = x`),
and classifies each use with `classifyUse`, the same classifier that decides
`nocapture` on parameters (docs/wp2-classes.md, docs/wp4-arrays.md):

| Flow | Uses |
| --- | --- |
| `local` | consumed on the spot: an operand of an operator or condition, a field / element read or write through it, `.length`, a `for...of` source, an `===` operand, the receiver of a method whose `this` is not captured, an argument to a user function whose matching parameter is not captured (the `pointerParams` fixpoint for structs and arrays, `escaping` for strings), an argument to a runtime builtin (all `nocapture`) |
| `returned` | returned, directly or through an alias |
| `leaks` | anything else: stored into a field, an element, an array or object literal, `push`ed, assigned to another variable (`y = x`, including a `let` alias), passed to a callee that captures the parameter, or any use not listed |

### The rule, as implemented

A site becomes an entry-block `alloca` when

- it is stackable,
- its flow is `local`, and
- no local on the path from the site to its uses is ever reassigned
  (`let p = new P(); ... p = other;` disqualifies, as does `let q = p;`,
  which is an assignment-style alias and therefore `leaks`).

Why this is sound: every reference to the object is either consumed inside
the site's own statement or lives in a local declared at or below the site's
block, so once control leaves that block, or the function returns, nothing
can name the object. The holding locals are `const`-like (never reassigned),
so the object they name is always the site's.

**Loops.** A site inside a loop is allocated once, in the entry block, and
the slot is reused on every iteration. This is correct because the previous
iteration's object is unreachable by the argument above (its locals are out
of scope when the block is re-entered) and the initializer stores or the
constructor run again on every pass, so the slot never holds a stale object
that is still observable. Storing the object anywhere that survives the
iteration (`xs.push(p)`, `best = p`, `node.child = p`) is a `leaks` flow and
keeps the site in the arena, which is exactly the case where slot reuse
would be wrong.

**Arrays.** A stack array is a header alloca plus a data alloca:
`%arr.hdr = alloca %struct.amrit_array, align 8` and
`%arr.data = alloca [n x T], align 8` (an empty literal has `data = null`).
A later `xs.push(v)` calls `amrit_array_grow`, which moves the elements into
the arena and repoints the header; the header stays on the stack and stays
valid. The data cap keeps stack frames bounded.

**Alignment.** Every stack object is `align 8`, like arena objects, so every
pointer attribute the compiler emits (`align 8`, `dereferenceable(sizeof)`,
`noalias` on a constructor's `this`) remains true for stack objects.

**Effects.** A stack object is the function's own memory: its allocation is
no longer a write or an allocator call, and a field access through a local
that only ever holds a stack object (`stackLocals`) is no longer a memory
read or write. So a function like `swapped` below is `readnone`; a function
that runs a constructor still inherits the constructor's `write` effect, per
the existing effect rules. Element reads and writes on stack arrays are
still counted, because a `push` may have moved the data into the arena.

**Disable.** `--no-stack-alloc` keeps every allocation in the arena (the
scopes of section 2 still apply). Use it to compare IR or to rule the
analysis out while debugging.

### IR before and after

`tests/cases/mem_stack_struct.ts` (excerpt):

```ts
interface Pair { first: number; second: number; }
class Point { x: number; y: number; constructor(x: number, y: number) { ... } manhattan(): number { ... } }
function sumX(p: Point, q: Point): number { return p.x + q.x; }

function swapped(a: number, b: number): number {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
}

function nearest(): number {
  const p = new Point(3, 4);
  const q = new Point(10, 20);
  const alias = p;
  return sumX(alias, q) + p.manhattan() + new Point(1, 1).manhattan();
}
```

With `--no-stack-alloc` (before), every object is bumped from the arena and,
because they all die with the function, each function gets an arena scope:

```llvm
define noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i8* @amrit_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %b, i32* %2, align 4
  ...
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %11
}

define noundef i32 @nearest() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %q.addr = alloca %struct.Point*, align 8
  %alias.addr = alloca %struct.Point*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i8* @amrit_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 3, i32 4)
  ...
  %11 = call i8* @amrit_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Point*
  call void @Point.constructor(%struct.Point* %12, i32 1, i32 1)
  %13 = call i32 @Point.manhattan(%struct.Point* %12)
  %14 = add i32 %10, %13
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %14
}

attributes #0 = { nounwind willreturn }
```

By default (after), the module contains no `amrit_alloc_struct`, no arena
prelude, and `swapped` is `readnone` (golden `mem_stack_struct.ll`):

```llvm
define noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #2 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %Pair.obj = alloca %struct.Pair, align 8
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i32 %b, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 1
  store i32 %a, i32* %1, align 4
  store %struct.Pair* %Pair.obj, %struct.Pair** %p.addr, align 8
  ...
  ret i32 %9
}

define noundef i32 @nearest() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %alias.addr = alloca %struct.Point*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  call void @Point.constructor(%struct.Point* %Point.obj.1, i32 10, i32 20)
  ...
  call void @Point.constructor(%struct.Point* %Point.obj.2, i32 1, i32 1)
  %7 = call i32 @Point.manhattan(%struct.Point* %Point.obj.2)
  %8 = add i32 %6, %7
  ret i32 %8
}

attributes #0 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
```

After `opt -O2`, `mem2reg` and SROA turn `%Pair.obj` into registers and
`swapped` becomes `a + b * 10`; `Point.constructor` inlines into `nearest`
and the three `Point` slots disappear entirely.

A loop temporary (`tests/cases/mem_stack_loop.ts`): `const v = new Vec(i, 1)`
inside `for` becomes one `%Vec.obj = alloca %struct.Vec, align 8` in the
entry block, re-initialised by the constructor call in `for.body`; 100000
iterations leave `Arena.used()` unchanged.

## 2. Arena scopes

### Rule

A function gets an automatic scope when

- it has a *direct* arena allocation whose flow is `local`: a non-stack
  site (a dynamic `new Array<T>(n)`, a string concatenation or template, a
  `readFileSync`), `push` growth on an array that is a local allocation of
  this function, a number-to-string conversion inside `console.log(n)`, or
  the result of a user call whose callee allocates;
- none of its sites is `returned` (the caller owns that memory) and none
  `leaks`;
- no callee, transitively, leaks an allocation (`allocLeaks`), because
  memory a callee stores into an object the caller can still reach must not
  be freed; a callee's returned allocation is instead treated as a site of
  the caller and classified there;
- neither it nor a callee calls `Arena.reset` / `Arena.release`
  (`usesArenaControl`): those move the arena under the compiler's mark.

These facts (`allocates`, `allocLeaks`, `returnsAllocation`,
`usesArenaControl`, `directArena`) live in `FunctionFacts` and propagate over
the call graph in the same fixpoint as purity. `push` on an array that is not
a local allocation site (a parameter, a field, an element, a returned array)
is a leak: the growth belongs to an array someone else owns.

The scope is emitted as `%arena.mark = call i64 @amrit_arena_mark()` as the
first instruction after the allocas and `call void @amrit_arena_release(i64
%arena.mark)` before every `ret`, after the return value has been computed.
Paths that end in `unreachable` (`process.exit`, `throw`) need no release.
Both runtime calls are `willreturn` and the function already writes memory
(it allocates), so no attribute changes.

### Example

`tests/cases/mem_scope_dynamic_array.ts`:

```ts
function histogram(n: number, seed: number): number {
  const counts = new Array<number>(n); // dynamic size: arena, non-escaping
  ...
  return best;
}
```

```llvm
define noundef i32 @histogram(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %counts.addr = alloca %struct.amrit_array*, align 8
  ...
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = sext i32 %n to i64
  %1 = call i8* @amrit_alloc_struct(i64 24)
  ...
for.end.1:
  %57 = load i32, i32* %best.addr, align 4
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %57
}
```

`main` calls `histogram` 100000 times and prints `Arena.used()` before and
after the loop; the two lines are identical (`tests/run.js` checks that, no
RSS tooling needed). `mem_scope_string_temp.ts` does the same for
`"hello, " + label(i, name) + "!"`; `label` returns its template, so it has no
scope and the caller `greet` owns and releases the string.

### Runtime ABI

```c
uint64_t amrit_arena_mark(void);            /* buf + off, or 0 while the arena is empty */
void     amrit_arena_release(uint64_t mark);
uint64_t amrit_arena_used(void);            /* bytes bumped in the current chunk */
```

A mark is the absolute bump address, which identifies both the chunk and the
offset in one `i64`. `amrit_arena_release(mark)`:

- `mark == 0` (the arena was empty when marked): behaves like
  `amrit_reset_arena`, keeping the newest chunk so a hot loop does not
  `malloc`/`free` a chunk per call;
- the mark lies in the current chunk: `off = mark - buf`;
- the mark lies in an older chunk: every newer chunk is freed, that chunk
  becomes current, and `off` is rewound;
- the mark is in no live chunk (a stale mark, undefined behaviour by the
  rule below): nothing happens.

Scopes nest LIFO with the call stack, so a scoped function calling another
scoped function is always released innermost first. `tests/runtime_test.c`
exercises all four cases and a 100000-iteration mark/release loop.

## 2a. The call-site reclaim (WP9)

Section 2's scopes stop at the one function that most needs them. A string
builder returns what it built, so `returnsAllocation` is set and it gets no
scope: every intermediate it made lives as long as the program. That is the
whole of strbuild's 48 MB, and the full account — the rule, the soundness
argument, the runtime primitive and the measurements — is in
[wp9-optimisation.md](wp9-optimisation.md#the-call-site-reclaim). What belongs
here is how it fits beside the two mechanisms above.

### Rule

A call to a user function `f` is bracketed by

```llvm
%mark = call i64 @amrit_arena_mark()
%t    = call i8* @f(…)
%kept = call i8* @amrit_arena_keep(i64 %mark, i8* %t)
```

when `f` returns a plain `string`, `f.allocates` is true, and neither
`f.allocEscapes` nor `f.usesArenaControl` is. The mark is taken *after* the
arguments, so the bracket contains only what the callee bumped, and `%kept`
replaces `%t` at every later use.

The value is not freed — it is *moved* down onto the mark, and only the bytes
underneath it are released. That is why the rule needs no claim at all about how
the caller uses the result, and why only a `string` qualifies: a string is one
flat block with no interior pointers, so relocating its bytes relocates the whole
value. An array header names a separate data block, a struct or a `Result` may
name other blocks, and a `T | null` may be null; none of them may be moved.

### How the facts relate

`allocLeaks` (section 2) answers "may an allocation survive this call at all",
and it counts `s = s + t` — an assignment to a local of the frame — as a leak,
because the *stack* rule needs a fixed binding. `allocEscapes` is the same walk
asking the narrower question the reclaim needs: "may an allocation be reached by
the **caller** after the call, other than through the return value". An
assignment to a local is not that; a store into a field, an element, a literal, a
`push` or a capturing callee is. So `allocEscapes` implies `allocLeaks` and never
the reverse, and the automatic scopes still read `allocLeaks` and decide exactly
what they decided before.

### Interactions

| With | What happens |
| --- | --- |
| an automatic scope in the *caller* | Nested LIFO, like any two scopes: the caller's mark is older, so a reclaim only ever frees chunks newer than it. `tests/cases/mem_reclaim_argument.ts` has both. |
| an automatic scope in the *callee* | Cannot arise. A callee with a scope releases its own temporaries and does not return an allocation, so `allocates` is false at the boundary that matters and no bracket is emitted. |
| `Arena.mark()` / `Arena.release(m)` in the caller | Safe: a user mark taken before the call is older than the reclaim's, so nothing it names is released. A callee that touches `Arena.reset` / `Arena.release` itself is excluded by `usesArenaControl`. |
| `--no-stack-alloc` | No effect. The reclaim is in this layer, not layer 1: the flag moves allocations into the arena and leaves every bracket where it was (`tests/cases/mem_reclaim_no_stack_alloc.ts`). |
| a `Result` carrying a string payload | No bracket. `Ok(s)` bumps the payload *before* the `Result` object that names it, so relocating the object would release its own payload. Only a plain `string` return qualifies (`tests/cases/mem_reclaim_guards.ts`). |
| a temporary passed on rather than concatenated | Bracketed like any other, and the callee is handed `%kept`. Nothing about the rule depends on the temporary dying soon. |

### Runtime ABI

```c
void *amrit_arena_keep(uint64_t mark, void *p);
```

`p` must be the newest block the arena handed out; the call is emitted directly
after the allocation it keeps, which is what makes that true. Two outcomes and
three refusals:

- the mark's chunk has room below it: `p` moves down onto `mark` and every newer
  chunk is freed;
- it does not (the mark sat at the end of a full chunk): `p` stays put and the
  chunks strictly between it and the mark's chunk are unlinked and freed;
- `p` is not in the current chunk (a literal, a parameter, anything older than
  the mark), the mark is in no live chunk (stale, or `0` for an arena that was
  empty), or the mark is newer than `p`: nothing happens and `p` is answered
  unchanged.

Refusing is always safe — it reclaims less — which is why every uncertain case
takes that branch. `tests/runtime_test.c` exercises both outcomes and all three
refusals.

`runtime/runtime_wasm.c` does not provide it, and does not need to: the
freestanding wasm profile has no strings at all (WP8), and the bracket is only
ever emitted around a call that returns one.

## 3. Explicit control

| Builtin | Lowering | Notes |
| --- | --- | --- |
| `Arena.reset(): void` | `amrit_reset_arena` | statement position only |
| `Arena.mark(): i64` | `amrit_arena_mark` | |
| `Arena.release(m: i64): void` | `amrit_arena_release` | statement position only; an integer literal argument is typed `i64` by context |
| `Arena.used(): i64` | `amrit_arena_used` | bytes in the current chunk |

All four are registered in `builtinCalls` next to `console.log`, with effect
`write` (`mark` and `used` only read the arena, but a `readonly` caller could
be hoisted across an allocation, so they are kept conservative).

**Safety rule.** Releasing or resetting while any object, array or string
allocated after the mark is still referenced is undefined behaviour: the
memory is reused by the next allocation. The automatic scopes never do that,
because a scope is only emitted when every allocation made during the call
is provably unreachable afterwards. A function that calls `Arena.reset` or
`Arena.release` itself (or through a callee) never gets an automatic scope,
so the compiler's marks are never invalidated by user resets. Marks taken
before a user `Arena.release` and released after it are fine; a mark taken
*after* a point the user later releases past is stale.

## 4. `T | null`

`T | null` is accepted for `T` a class, interface, array, or string (the
validator already allowed only this union shape; `number | null` is rejected
with a message). It is the same LLVM pointer type as `T`; `null` is the
constant `null`, so a store of `null` is `store %struct.Node* null, ...` and
a test is `icmp eq %struct.Node* %p, null`.

Operations:

- `p === null`, `p !== null`, `null === p`: pointer comparison. Two nullable
  values cannot be compared with each other (for strings that would be
  pointer identity, not `===`): narrow both first.
- Assignment, initialization, `return`, arguments, fields, object literal
  properties, `push`, element stores accept a `T` where `T | null` is
  expected (`assignable` in `types.ts`). The reverse is an error, and so is
  `null` with no contextual type (`let p = null`).
- `new Array<T | null>(n)` is allowed: the zero fill *is* `null`.
- A field `next: Node | null = null` may use `null` as its literal
  initializer.
- `c ? p : null` has type `T | null`.

Narrowing (`src/checker/nullable.ts`): inside the region a condition guards,
the nullable *variable* (a local or parameter, never a property path) reads
as `T`:

| Form | Where `p` is `T` |
| --- | --- |
| `if (p !== null) A else B` | in `A`; and after the `if` when `B` cannot fall through |
| `if (p === null) A else B` | in `B`; and after the `if` when `A` cannot fall through (`return`, `throw`, `break`, `continue`, `process.exit`) |
| `while (p !== null) A`, `for (...; p !== null; ...) A` | in `A`, on every iteration |
| `p !== null && e`, `p === null \|\| e` | in `e` |
| `p !== null ? a : b` | in `a` (and `b` for `=== null`) |
| `!cond`, `(cond)`, `a && b`, `a \|\| b` | composed as expected |

A narrowing ends at any assignment to the variable (`cur = cur.next` reads
the narrowed `cur` on the right and then drops it), and before a loop whose
body, condition or update assigns the variable, because the second iteration
sees the assigned value before the statements that precede the assignment
textually. Constants and parameters are never assigned, so their narrowings
last for the whole region. `tests/cases/reject_null_narrowing_leaks.ts` and
`reject_null_narrowing_assigned.ts` pin the two ends.

Attributes: a nullable parameter or return loses `nonnull` and
`dereferenceable`; `align 8` (null is aligned), `readonly` and `nocapture`
follow the usual rules, e.g. from `mem_nullable.ll`:

```llvm
define noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #2
define noundef align 8 %struct.Node* @find(%struct.Node* noundef align 8 %head, i32 noundef %want) #1
```

## Goldens that changed

Every existing golden that changed did so for one of two reasons, both
verified by the unchanged `.out` round trips:

- An allocation moved to the stack (`alloca %struct.C` / `alloca
  %struct.amrit_array` + `alloca [n x T]` replacing `amrit_alloc_struct` calls),
  and when no arena allocation was left the arena prelude (type, global,
  `amrit_arena_grow`, the inline allocator and its attribute groups)
  disappeared from the module: `cls_point` (both `Point`s), `cls_nested`
  (the `Segment`; its `Point`s are stored by the constructor and stay in
  the arena), `cls_this_method_call`, `cls_field_write`,
  `cls_compound_field`, `cls_initializers`, `cls_readonly_ok`,
  `cls_interface_literal` (`t`; `p` is stored into `t.pair`, the inner
  `pair` literal is a property of `t`), `cls_vector` (the loop temporary in
  `centroid` and the argument of `dot`; `acc` and `scaled`'s result are
  returned), `arr_literal`, `arr_length`, `arr_for_of`, `arr_f64`,
  `arr_index_read_write`, `arr_bounds_panic`, `arr_sort`, `arr_strings`,
  `arr_push` (header only; the growth is arena), `arr_nested` (the outer
  literals; inner literals and pushed rows are elements), `arr_new_zeroed`
  (`new Array<boolean>(2)`; `new Array<number>(n)` with `const n = 4` stays
  dynamic).
- An automatic arena scope was added to a function whose temporaries all
  die with it: `arr_sum` and `arr_new_zeroed` (dynamic arrays), `str_concat`,
  `str_template`, `str_console_log`, `str_escape`, `str_f64_mode`,
  `conversions`, `i64_basic`, `io_files`, `math_i32`, `math_intrinsics`,
  `math_random` (string temporaries from concatenation or from printing
  numbers), and `main` in most class/array cases for the same reason.

`tests/layout/structs.ts` is unaffected: its `make<X>` functions return the
object, so the `amrit_alloc_struct(i64 N)` the layout test reads is still there.

## Left out

- Reference counting (optional per-class RC from the master plan): not
  started, to keep this package to proven-safe transformations.
- `llvm.lifetime.start/end` markers on the hoisted allocas: a `start` alone
  is easy but gives LLVM little; precise `end`s need scope exits through
  `break` / `continue` / `return`, which the emitter does not track yet.
- Objects stored into fields or arrays never move to the stack or get
  reclaimed by a scope, even when the container is local; a constructor
  that stores a parameter into `this` makes every caller's argument a leak.
  A "captured only into `this`" fact would lift this.
- Narrowing of property paths (`if (n.next !== null) n.next.x`): copy into a
  local first.
- `new Array<T>(n)` with a `const n = 4` is not stackable: only a literal
  length is.
- Arena scopes are per function; a temporary allocated inside a loop is
  released when the function returns, not per iteration (write the loop
  body as a function to get per-iteration release).

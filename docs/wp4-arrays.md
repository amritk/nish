# WP4: Arrays

What the compiler does with `T[]` / `Array<T>` values: the memory layout,
every construct with its TypeScript and the exact LLVM IR, the bounds-check
policy, the attribute rules, and what was deliberately left out. Test cases
live in `tests/cases/arr_*.ts` (goldens in the matching `.ll`, native output
in `.out`) and `tests/cases/reject_arr_*.ts` for the rejected forms.

## Layout (ABI)

An array value is a pointer to an arena-allocated header. Every element type
shares one header type:

```llvm
%struct.nish_array = type { i64, i64, i8* }     ; { len, cap, data }
```

```c
struct nish_array { uint64_t len; uint64_t cap; char *data; };   /* runtime/runtime.c */
```

`data` points at `cap` elements of `sizeof(T)` bytes (`i32` 4, `double` 8,
`i1` 1, pointers 8), arena-allocated and therefore 8-byte aligned. Element
access bitcasts `data` to `T*` and indexes with an `i64`. The header is 24
bytes; header and data are separate allocations so a future slice can share
storage. `data` is `null` only for a `[]` literal (`cap = 0`); nothing reads
through it before the first `push` grows the array.

The type is `%struct.nish_array*` in every signature, alloca, and load, so
`number[]`, `string[]`, `boolean[]`, `number[][]` and (once WP2 lands)
`User[]` all use the same header; only the element size and the `T*` cast
differ. `T[]` and `Array<T>` are the same type.

Three runtime functions belong to arrays (`src/codegen/runtime.ts`,
`runtime/runtime.c`, and the freestanding `runtime/runtime_wasm.c`):

| Symbol | Purpose | Attributes |
| --- | --- | --- |
| `nish_array_grow(hdr, elemSize)` | `push` when `len == cap`: doubles `cap` (4 from 0), moves the elements to fresh arena storage. `len` untouched. | `nounwind willreturn`, param `nonnull align 8 nocapture` |
| `nish_panic_index(idx, len)` | Failed bounds check: writes `index out of range: <idx> >= <len>` to stderr, `_exit(1)` (`unreachable` in wasm). | `nounwind noreturn cold` |
| `nish_alloc_array(elemSize, len)` | Host entry (WP8): header plus `len` uninitialised elements, `len == cap`. Compiled code never calls it; the wasm loader and C hosts do. | `nounwind willreturn`, returns `noalias nonnull align 8` |

Header and element storage come from the compiler's inline
`nish_alloc_struct` (`call i8* @nish_alloc_struct(i64 bytes)`), not from C.
`tests/runtime_test.c` checks `nish_array_grow` and `nish_alloc_array`;
`runtime.c` is 8,594 bytes of source and 3,600 bytes of `.text` at `-Oz`
(budget: 8 KB / 4 KB; `nish_alloc_array` added 102 bytes of `.text`).

### Typed-array aliases

`Int32Array`, `Float64Array` and `BigInt64Array` are accepted as type
annotations and as `new Int32Array(n)` / `new Float64Array(n)` /
`new BigInt64Array(n)`. They resolve to the *same* `StaticType` as `i32[]`,
`f64[]` and `i64[]` (`TYPED_ARRAY_ALIASES` in `src/types.ts`; the `new`
forms share `newCheckers.Array` / `newEmitters.Array`), so there is no
second layout, no view semantics, and no conversion: a `Float64Array`
parameter accepts an `f64[]` argument and vice versa, `push` works, and the
IR is byte for byte the `new Array<T>(n)` lowering above
(`tests/cases/arr_typed_views`). A type argument on the alias is rejected
(`reject_arr_typed_view_typearg`, `reject_arr_typed_view_type_annotation_arg`).
The names exist for the host boundary: they are what a Node host passes and
receives, and `--emit-dts` / `--emit-napi` map exactly these element types
to JS typed arrays ([wp8-interop.md](wp8-interop.md#arrays-and-strings-across-the-boundary)).
`boolean[]` has no alias: a JS `Uint8Array` could carry values other than 0
and 1, which an `i1` load may not see.

## Decisions

- **One element type per array.** `[1, "two"]` is an error; there are no
  union element types.
- **`[]` needs a contextual type.** `const xs: number[] = []`, `return []`
  in a function returning `T[]`, `xs = []`, `m[i] = []`, `xs.push([])`, an
  inner `[]` of an annotated literal, and `f([])` for a `T[]` parameter all
  work; a bare `const xs = []` is an error. Nothing is inferred from later
  pushes.
- **`new Array<T>(n)` zero-fills, and only for scalar `T`.** JavaScript
  would create `n` holes; Nish has no holes, so `number` elements start
  at `0` and `boolean` elements at `false`. For pointer element types
  (`string`, nested arrays, and structs once WP2 lands) a zeroed element
  would be a null pointer, which no Nish value may be (`nonnull` is
  emitted everywhere), so `new Array<string>(n)` is rejected with a pointer
  to `[]` + `push`. The type argument is required: `new Array(3)` is an
  error.
- **Indices are numbers.** `a[i]` needs a numeric `i`; `sext` from i32, or
  `fptosi` (truncation toward zero) from `double` in f64 mode. A negative
  index is caught by the unsigned bounds compare.
- **`const xs = [...]` freezes the binding, not the contents**, exactly as
  in JavaScript: `xs[0] = 1` and `xs.push(1)` are fine, `xs = []` is not.
- **`.length` is read-only**; `xs.length = 0` is rejected with a pointer to
  `push`. There is no `pop`, `slice`, `indexOf`, ... yet.
- **`for (const x of a)` re-reads `a.length` every iteration**, so a `push`
  inside the body extends the iteration, as JavaScript's array iterator
  does. `let x` makes the loop variable assignable; `const x` does not.
- **Element assignment order** follows JavaScript: `a[i] = v` evaluates
  `a`, `i`, `v`, then checks and stores; `a[i] op= v` evaluates `a`, `i`,
  checks, loads the old element, evaluates `v`, computes, stores.
- **Arrays compare by reference** with `===` / `!==` (`icmp eq` on the
  header pointer), as in JavaScript.

## Bounds-check policy

Every `a[i]` read or write (not `for...of`, whose loop condition is the
check) lowers to

```llvm
  %len = load i64, i64* <len field>, align 8
  %ok = icmp ult i64 %idx, %len
  br i1 %ok, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %idx, i64 %len)
  unreachable

bounds.ok:
  ...
```

The compare is unsigned, so `-1` (sign-extended to `0xFFFF...`) fails like
any other out-of-range index. `nish_panic_index` is declared `noreturn cold`:
the block is laid out as cold code and nothing after the call is reachable,
so the check costs one compare and one predicted-not-taken branch. The
message is `index out of range: <idx> >= <len>` and the exit code is 1
(`arr_bounds_panic.ts` in `tests/run.js`).

`--unchecked-indexing` removes the compare, the branch, and the panic block
(`arr_unchecked.ll`); an out-of-range index is then undefined behaviour
(a wild load or store). It exists for benchmarks and for code that carries
its own proof; the flag is global and documented as unsafe.

Attribute cost of the check: a function that indexes an array calls a
`noreturn` symbol whose effect is `write` (it performs I/O and exits), so it
loses `willreturn` and cannot be `readonly`. With `--unchecked-indexing` the
same function is `willreturn readonly` (`arr_unchecked.ll`: `get` is
`nounwind willreturn readonly`, `set` is `nounwind willreturn`).

### Vectorisation

`tests/run.js` runs `opt -O2 -mtriple=x86_64-unknown-linux-gnu` over
`arr_sum.ts` (`fill` stores `0..n-1`, `sum` adds them back) in both modes:

- **`--unchecked-indexing`**: the sum loop is a plain load/add reduction and
  vectorises to `<4 x i32>` (two accumulators, `llvm.vector.reduce.add`).
- **checked (default)**: the standalone `sum` does *not* vectorise. `opt`
  hoists the length compare (`icmp ugt i64 %len, %n-1`) out of the loop, but
  the branch to the panic block stays inside it, and LLVM 18's loop
  vectoriser does not handle loops with a second exit. Once `sum` is inlined
  into `main`, where the array came from `new Array<number>(1000)` and the
  length is a known constant, the check folds away and the same `<4 x i32>`
  body appears. Both facts are asserted by the harness.

So checked code vectorises when LLVM can prove the index range from the
context; a hoisted range check that keeps the panic out of the loop
(Rust-style `assert!(n <= a.len())` before the loop) is the natural follow-up
for WP9.

## Constructs

### Literal `[a, b, c]`

```ts
export function main(): number {
  const xs = [10, 20, 30];
  ...
}
```

```llvm
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
```

Elements are evaluated first, left to right, then the header (24 bytes,
`len = cap = n`) and the data (`n * sizeof(T)` bytes) are allocated and the
elements stored. `[]` stores `len = cap = 0` and `data = null` with no data
allocation.

### `new Array<T>(n)`

```ts
const xs = new Array<number>(n);
```

```llvm
  %1 = sext i32 %0 to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8
  %6 = mul i64 %1, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8
```

with `declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)`
added to the module. The `mul` is skipped for 1-byte elements (`boolean[]`).
A negative `n` sign-extends to a huge size and aborts inside the arena
(`nish: out of memory`) rather than corrupting memory.

### Read `a[i]`

```ts
function get(a: number[], i: number): number {
  return a[i];
}
```

```llvm
define noundef i32 @get(%struct.nish_array* noundef nonnull align 8 readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

attributes #0 = { nounwind }
```

A literal index is folded (`icmp ult i64 2, %len`, `getelementptr ... i64 2`)
instead of `sext i32 2 to i64`. Block labels are `bounds.ok`, `bounds.fail`,
then `bounds.ok.1`, ... within a function.

### Write `a[i] = v`, `a[i] op= v`

```ts
function set(a: number[], i: number, v: number): void {
  a[i] = v;
}
```

```llvm
define void @set(%struct.nish_array* noundef nonnull align 8 nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4
  ret void
}
```

`a` is `nocapture` but not `readonly`: the body stores through it. The
value of the assignment expression is `v`. Compound assignment
(`xs[0] += 5`, from `arr_index_read_write.ll`) loads, computes, and stores
through the same element pointer:

```llvm
bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4
  %20 = add i32 %19, 5
  store i32 %20, i32* %18, align 4
```

Element targets are handled by wrapping the `=` / `op=` handlers already in
the binary-operator tables (`installArrayAssignmentCheckers` /
`installArrayAssignmentEmitters`): an element-access target comes to the
array module, every other target goes to whatever handler was registered
before, so a property-target path from the classes work package composes
with it in either order.

### `a.length`

```ts
function len(xs: number[]): number {
  return xs.length;
}
```

```llvm
define noundef i32 @len(%struct.nish_array* noundef nonnull align 8 readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn readonly }
```

One `load` of the header, then `trunc` to i32 (i32 mode) or `sitofp` to
`double` (f64 mode), like a string's `.length`. No call, and the function is
`readonly`.

### `a.push(v)`

```ts
xs.push(i * i);
```

```llvm
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8
  %21 = trunc i64 %20 to i32
```

The value (`%10`) is evaluated before the length is read. `push.grow` is
taken only when `len == cap`; `nish_array_grow` doubles the capacity (4 from
an empty array), so `n` pushes cost `O(log n)` grow calls. The data pointer
is re-read after the possible grow. The expression's value is the new length
as a `number`, which is dead in statement position and dropped by LLVM.

### `for (const x of a)`

```ts
function total(xs: number[]): number {
  let sum = 0;
  for (const x of xs) {
    if (x < 0) {
      continue;
    }
    if (x > 100) {
      break;
    }
    sum += x;
  }
  return sum;
}
```

```llvm
define noundef i32 @total(%struct.nish_array* noundef nonnull align 8 readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = icmp slt i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %11 = load i32, i32* %x.addr, align 4
  %12 = icmp sgt i32 %11, 100
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end

if.end.1:
  %13 = load i32, i32* %sum.addr, align 4
  %14 = load i32, i32* %x.addr, align 4
  %15 = add i32 %13, %14
  store i32 %15, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

attributes #0 = { nounwind willreturn readonly }
```

An index loop over the header's `len`: the i64 index lives in `%forof.idx`
(an entry-block alloca, promoted by `mem2reg`), the element is copied into
the loop variable's slot `%x.addr` at the top of the body, `continue` jumps
to `forof.inc`, `break` to `forof.end`. No bounds check is needed: the loop
condition is the check. The array expression is evaluated once, before the
loop. Two loops with the same variable name in one function get `%x.addr`
and `%x.addr.1` (`IRFunction.emitAlloca` now suffixes repeated names, which
also fixes two sibling `for (let i ...)` loops that previously emitted a
duplicate `%i.addr`).

## Attributes

`src/codegen/attributes.ts` extends the fact analysis; every rule is a
guarantee the checker or the emitter proves.

| Attribute | Where | Rule |
| --- | --- | --- |
| `noundef nonnull align 8` | array params and returns | No null type; headers come from the arena, which rounds to 8. |
| `readonly` on a param | array params | The body never stores through the param: no `p[i] = v`, `p[i] op= v`, `p.push(v)`, and none of those through anything indexed from `p` (`p[i][j] = v` counts, conservatively); the param is never aliased (`let q = p`, `[p]`, `xs.push(p)`, `return p`, `c ? p : q`: an alias could be written through, and LLVM may fold the alias back into `p`); and it is only passed to callees whose matching parameter is itself `readonly`. |
| `nocapture` on a param | array params | Every use is an indexing base, a `.length` or `push` receiver, a `for...of` source, an `===` / `!==` operand, or a direct argument to a callee that does not capture its matching parameter. |
| no `noalias` | array params | Two array params may be the same array, and arrays are mutable. |
| `readonly` on the function | any | Element reads, `.length`, and `for...of` set `readsMemory`; a checked `a[i]` adds the callee `nish_panic_index` (effect `write`), so only unchecked or `for...of`-only readers stay `readonly`. |
| `willreturn` | any | Lost by a checked `a[i]` (`nish_panic_index` is `noreturn`) and by any loop that is not counted. A `for...of` is counted when its body has no `push` (on any array, since the source may be aliased), no call to a user function (which could push through an alias), and no `throw`. |
| effect `write` | any | Literals, `new Array`, element writes, and `push` (which may call `nish_array_grow`). The inline allocator is `willreturn`, so it is folded into the effect rather than listed as a callee. |

The param rules run as a fixpoint over the whole program's call graph
(`paramPasses` in `FunctionFacts`): a parameter handed to a callee inherits
the callee's `written` / `captured` facts for the matching parameter, and an
unknown callee counts as both. The fixpoint is optimistic on cycles, which
is sound: a parameter is only ever marked written when some actual store
reaches it.

Examples from the goldens: `get` and `len` above are `readonly nocapture`;
`set` is `nocapture` only; in `arr_index_read_write.ts`, `main` passes `xs`
to `set`, so the write is visible through the fixpoint (a local, so no
attribute changes, but the facts are what an `xs` parameter would get).

## Rejected forms

| Source | Diagnostic |
| --- | --- |
| `[1, "two"]` | `Array literal elements must all have the same type, got i32 and string` |
| `const xs = []` | `Empty array literal needs a type annotation, e.g. `const xs: number[] = []`` |
| `xs[key]` with `key: string` | `Array index must be a number, got string` (a string *literal* key is already refused by the validator) |
| `xs.push("x")` on `number[]` | `Cannot push string onto i32[]` |
| `xs.length = 0` | `Cannot assign to `length` of i32[] (array length is read-only; use `push`)` |
| `n[0]` with `n: number` | `Cannot index a value of type i32 (only arrays can be indexed)` |
| `for (const x of xs) { x = 1; }` | `Cannot assign to `x` because it is a const` |
| `for (const c of s)` with `s: string` | ``for...of` requires an array, got string` |
| `xs[0] = 1` on `string[]` | `Cannot assign i32 to an element of string[]` |
| `new Array(3)`, `new Array<number>()` | type argument / length argument required |
| `new Array<string>(3)` | ``new Array<string>(n)` would zero-fill with null string values; build it with `[]` and `push` instead` |
| `xs.pop()`, `xs.slice(...)` | `Unknown method `pop` on i32[] (supported: push)` |

## Left out

- `pop`, `slice`, `indexOf`, `map`, `forEach`, spread, destructuring,
  holes, `Array.from`, `length` assignment, negative-index wraparound.
- Typed *views* in the JavaScript sense (`subarray`, a byte offset into a
  shared buffer, `Uint8Array` / `Float32Array`): the aliases above are plain
  arrays; the host-side view is built by the interop layer (WP8).
- Hoisting a range check out of a counted loop so checked code vectorises
  without inlining (WP9).
- Escape-analysed stack allocation of arrays that do not outlive the
  function (WP6).
- A per-file or per-function form of `--unchecked-indexing`; the flag is
  global.

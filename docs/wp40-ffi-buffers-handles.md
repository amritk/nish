# WP40: byte buffers and owned handles across `declare function`

**Status: proposed, and unbuilt.** This is a design for the owner to review
before anything in it is built. It widens [WP27](wp27-ffi.md) in two places.
The first is B, a `u8[]` parameter on a `declare function`: plan stage 5 of
the ffi-reach run, built as B1. The second is H, a class that owns one `CPtr`
and is closed by `using`: plan stage 6, built as H1. The stage names are B and
H, so they collide with neither WP27's S4 (struct layout) nor its S5 (errno).
The design sits on top of WP27 §8, the S3 string borrow, as §8 is written.
§8 is being built in parallel, and this document does not change it.

Every claim about today's compiler is anchored at commit `249cbe9`
(`249cbe987c922d8257febb08a01f9e7d68b2c9d7`). The tests §2 cites exist, as do
those marked existing. Every other test named here is planned.

## 1. The decision

**A `declare function` may take a `u8[]` or a `readonly u8[]`. It crosses as
the array's data pointer: `uint8_t *` for `u8[]` and `const uint8_t *` for
`readonly u8[]`. The declaration must follow it with a `u64` parameter that
gives the byte count, and every call checks that count against the array's
length.**

**A class may hold one field of type `CPtr` if its `[Symbol.dispose]` method
calls one declared C function on that field, in one of the two shapes §4b
allows: a bare call on `this.f`, or a call on a `const` local read from it and
guarded by a null test. Such a class is a
*handle class*. Its instances are created only as the initialiser of a `using`
declaration, and they are bound nowhere else. The compiler emits the close at
every exit of the block that returns control to the program; a panic or
`process.exit` ends the process without it (§4e).**

```ts
declare function read(fd: i32, buf: u8[], n: u64): i64;
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

declare function fopen(path: string, mode: string): CPtr | null;
declare function fgetc(file: CPtr): i32;
declare function fclose(file: CPtr): i32;

class File {
  readonly file: CPtr | null;
  constructor(path: string) {
    this.file = fopen(path, "r");
  }
  readByte(): i32 {
    const p = this.file;      // the field is read only inside the class (§4a)
    return p === null ? -1 : fgetc(p);
  }
  [Symbol.dispose](): void {
    const p = this.file;      // a field is not narrowed, so bind it first
    if (p !== null) {
      fclose(p);
    }
  }
}

const firstByte = (path: string): i32 => {
  using f = new File(path);   // fclose runs on every way out of this block
  return f.readByte();
};
```

Both halves reuse a rule WP27 already decided. A buffer is the same **borrow**
as S3's `string` (WP27 §8b): C may read or write the bytes until it returns,
and it may keep no address. A handle keeps **§7a's placement rule**: a `CPtr`
can still go only where the compiler can see all of its uses. This document
adds one place for it to go, a field whose lifetime a `using` block bounds.
With every exit of that block known, a use after close or a double close
through the `using` binding cannot be written. A close written by hand inside
the class's own methods is the one way left, and §4c lays out the two answers
to it for the owner (Q9).

## 2. What exists at `249cbe9`

- **The foreign signature check.** `checkForeignSignature`
  (src/declarations.ts:152) refuses every parameter that is not `isForeignType`
  (src/types.ts:88): a scalar, or `CPtr`. It also refuses a nullable parameter
  (src/declarations.ts:173-182) and checks the return type (:188).
- **The foreign declaration.** `foreignDeclarationFor`
  (src/emit.ts:879) emits a bare `declare` with no attributes. This is
  because `isPointerParam` (src/attributes.ts:1673) is an allow-list, and
  `CPtr` falls out of it.
- **The foreign callee's facts** (src/attributes.ts:3386-3398) are the worst
  case of everything:
  - `EFFECT_WRITE`, `sharedWrite`, `writesPastParams`;
  - `willReturn = false`, `readsMemory`;
  - `resizesArray = true`.

  The comment at :3392-3396 says that S1's C body could not reach an array
  header, and that the next widening "must revisit the block rather than
  inherit" its answer. `resizesArray` reaches every caller through the fixpoint
  (:4238). Its cost is visible in `--emit-panics`: after a call that may resize
  an array, the second check of a compound store `a[i] += f()` is kept
  (docs/LANGUAGE.md, "Panic sites", the `index` row).
- **The `CPtr` placement rule.** `rejectForeignPointer`
  (src/annotations.ts:166) refuses `CPtr` in each of these positions:
  - a field (src/structs.ts:541);
  - an array element (src/annotations.ts:134, src/arrays.ts:681);
  - a `Result` arm (src/annotations.ts:518, :521);
  - a generic type argument of a function template (src/generics.ts:1248).
    The class-template path has no such check: src/generics.ts:993-1001 is a
    TODO, and `new Empty<CPtr>()` compiles at `249cbe9`. §6 row 5 depends on
    closing that path;
  - a parameter or return of a function the program defines
    (src/declarations.ts:92, :132; src/structs.ts:687).
- **Readonly arrays.** `readonly T[]` exists already (docs/LANGUAGE.md,
  "Readonly arrays"). It has the same header and the same LLVM type as `T[]`,
  and every write is refused. A `T[]` widens to it, and nothing converts it
  back. The C header already renders it as `const nish_array *`
  (docs/LANGUAGE.md:169; src/interop-abi.ts:357).
- **The element-reference rule.** A call that is handed an array as a
  non-`readonly` parameter is taken to push through it. So an element
  reference cannot be held across the call (docs/LANGUAGE.md:4926-4945,
  `reject_arr_element_across_push`).
- **`using` today.** It takes only `scope()`, a `Mutex`'s `lock()` and
  `arena()`.
  - `walkScopes` (src/parallel.ts:1329) enforces this, with
    `usingNotScopeMessage` (:1207) at :1352.
  - A `[Symbol.dispose]` method outside `nish/threads` is refused
    (src/structs.ts:619-623, `disposeElsewhereMessage` at
    src/parallel.ts:155).
  - The emitter opens each declarator on a stack (`openScope`,
    src/emit-parallel.ts:751; `openOneScope`, :762). It closes the stack in
    LIFO order (`closeScope`, :808):
    - on the fall-through (`closeBlockScopes`, :849);
    - on `break`, `continue` and `return` (`emitScopeJoins`, :833);
    - for locks, through `emitLockReleases` (:867).
  - `emitScopeExit` (src/emit.ts:698) releases after the return value is
    computed, because the value may read what the block allocated (the comment
    at src/emit.ts:1149).
- **No inheritance.** `extends` is refused (docs/LANGUAGE.md:1979,
  `reject_cls_extends`). `implements` is the one subtyping relation
  (docs/LANGUAGE.md:150-151).
- **The capability.** Every call to a declared function offers `ffi`
  (src/attributes.ts:2720-2722, `CAP_FFI` at src/capabilities.ts:39).
- **The closed build.** If any module of the program declares a C function,
  the closed build is off (`declaresForeign`, src/visibility.ts:82;
  `buildModeOf`, :94-104).
- **The differential oracle.** Every FFI program is outside the oracle by
  construction (tests/differential/known-failures.txt:40-47).
  `runtime/shim.mjs` has no counterpart for a C call.
- **Sidecars.** A case's own `<case>.c` replaces the default driver when the
  case is linked (tests/run.js:969).

## 3. Buffers

### 3a. How the length crosses: a declared `u64`, checked at the call

**Decision (recommended, Q1):** the parameter right after a buffer must be a
`u64`, and it is that buffer's byte count. The call lowers to an unsigned
compare of `n` against the array's length, and panics if `n` is larger. The
declaration then promises that C touches no byte at or past `buf.data + n`.
That is the same kind of promise `free(block: CPtr)` makes about what `free`
does.

```ts
declare function read(fd: i32, buf: u8[], n: u64): i64;
const got = read(0, buf, toU64(buf.length));   // proved: the count is the length, no check emitted
const head = read(0, buf, 16);                 // checked: panics `ffi-length` if buf.length < 16
```

`buf.length` is an `i32` (an `f64` under `--number-mode f64`), and the
language converts no integer implicitly, so the count is written
`toU64(buf.length)`, as any `u64` built from a length is (docs/LANGUAGE.md,
"convert with toU32 or toU64").

**The compare is unsigned.** `n` is a `u64`, and the header's `len` is an
`i64` (`%struct.nish_array = type { i64, i64, i8* }`, src/runtime.ts:30). The
check is `icmp ule i64 %n, %len`, and the panic branch is its negation. A
signed `icmp sle` would read `toU64(0) - toU64(1)`, which is 2^64 − 1
(docs/LANGUAGE.md:441), as −1, pass it, and let C run past the block. `len` is
never negative, so reading it unsigned changes nothing for it. The header is
the same `{ i64, i64, ptr }` on wasm32, so the compare is the same `i64` one
there. Pinned by `panics_ffi_length_wrapped`: `read(fd, buf,
toU64(0) - toU64(1))` panics `ffi-length`, and its golden `.ll` shows the
`icmp ule`.

Three options were weighed.

1. **Expansion.** `buf: u8[]` lowers to two C arguments: the pointer, then
   `buf.length`. The length can then never be wrong. But it cannot write
   `read(fd, buf, n)` for any `n` but the whole length, and a loop that reads
   a prefix of a large buffer is the most common use of `read`. The C order
   would also be fixed by the compiler, not by C: `getrandom(buf, len, flags)`
   fits it, and `memcpy(dst, src, n)` does not. The motivating declaration is
   `read(fd: i32, buf: u8[], n: u64)`, with the count spelled out, and
   expansion cannot write it.
2. **A declared count, paired by position and checked (chosen).** It writes
   `read` and `write` as C declares them. It also writes `recv`, `send`,
   `getrandom` and `SHA256_Update(ctx, data, len)`. The check is one compare,
   and `--emit-panics` lists it. The common call passes
   `toU64(buf.length)`, and B1.2 proves exactly that call away (below). Any
   other count keeps its check: the bounds machinery credits no `u64` against
   a length today (docs/LANGUAGE.md:4584), and teaching it guards on `u64`
   counts is a follow-up, not part of B1. A failing check is a new panic kind,
   **`ffi-length`**, listed by `--emit-panics` (`panics_ffi_length`).
3. **A declared count, paired by a spelling.** For example a type
   `ByteCount<"buf">`, or `n: (typeof buf)["length"]`. This is more explicit
   than position, but it needs a type-level string or an indexed-access type
   that the checker does not parse today. It would also have to type-check
   under `tsc` against `runtime/nish.d.ts`. That is a new type-system feature
   for one declaration form.

The cost of option 2, stated plainly: pairing by position is an assertion, not
a proof. Take `fwrite(ptr, size, nmemb, stream)`, which touches
`size * nmemb` bytes. Declared as `fwrite(buf: u8[], size: u64, n: u64, f:
CPtr)`, it pairs `size` with the buffer, and `fwrite(buf, 1, 1000, f)` on a
10-byte array passes the check and overflows. That is a wrong declaration of
the same class as declaring `free` with two parameters, and the language
cannot see either one. `docs/LANGUAGE.md` must say so in the rule's first
paragraph. It must name `fwrite` as the example and give the safe spelling:
declare the size as the count and pass `1` as `nmemb`. Even then, nothing
stops a call from passing another `nmemb`. If the owner finds that
unacceptable, the fallback is option 1 without prefix reads.

**The pairing rule, exactly.** A run of one or more consecutive buffer
parameters is followed by one `u64`, and that `u64` is the byte count of every
buffer in the run. The call checks `n <= len` once per buffer in the run. So
`memcpy(dst: u8[], src: readonly u8[], n: u64)` and `memmove` are declarable as
C declares them, and `memcpy(dst, src, n)` panics if either array is shorter
than `n`. A run followed by anything but a `u64`, or by nothing, is refused
(`reject_ffi_buffer_length_missing`, `reject_ffi_buffer_length_type`), and a
two-buffer run with one count is pinned positive in `ffi_buffer_memcpy`. A C
function with one count per buffer (`(a, na, b, nb)`) is two runs and is
declarable as it is. The check compares against `len`, never `cap`.

**When the pointer and the length are read: after every argument.** The
emitted call evaluates every argument left to right, as any call does, and
only then loads `buf->data` and `buf->len` for each buffer and runs the check.
Nothing is evaluated between those loads and the `call` instruction. The
reason is that a later argument may change the array: in
`write(1, buf, grow(buf))`, where `grow` pushes `buf` past its capacity and
returns the new length as a `u64`, a `data` pointer loaded when `buf` was
evaluated points at the old block, which `nish_array_grow` leaves in the
arena rather than freeing, so C's writes would land there and be lost to every
later read of `buf`; and a `len` loaded then is the old length. Loading both last means C gets the block and the length that exist
when C runs. That holds whatever path the later argument reaches the array
by: an alias (`write(1, a, grow(b))` with `const b = a`), a field or an
element. The loads go through the header pointer the buffer argument produced,
and a push moves the data block, never the header. Pinned by `ffi_buffer_late_load` (golden `.ll` showing the `data` and
`len` loads after the call to `grow`, and a native round trip whose output is
the bytes `grow` appended).

**The proof that elides the check** is a named piece of B1.2, not something
the bounds machinery already does. A buffer's check is elided when all of
these hold, and kept otherwise:
- the count argument is spelled `toU64(x.length)`, in the call itself, where
  `x` is the very binding the buffer argument is: a `const` local or a
  parameter, named alone. A field path (`toU64(o.bytes.length)`), an element,
  or another binding that aliases the buffer is not credited, because a
  later argument could reassign the path between the two reads;
- no argument evaluated after the count can resize any array: it contains
  no `push` or `pop` call on any receiver, and no call to a callee whose facts
  say `resizesArray`. `len` is loaded last, so a resize between the count and
  the load would make them differ. The receiver is not matched against `x`,
  because aliases are not tracked (`const b = x; … toI64(b.pop())` resizes
  `x`): any resizing call disqualifies. `push` and `pop` must be named here
  because they are array methods, not callees, so they never appear in a
  callee's facts; `collectMethodFacts` records them only as `resizesArray` on
  the *enclosing* function, which is the function making the foreign call and
  says nothing about which argument resized.

`toU64` of a length is its zero extension, and in f64 mode a conversion of an
exact non-negative integer, so the elided compare is `len <= len`. For a run,
the proof is per buffer: `memcpy(dst, src, toU64(dst.length))` elides `dst`'s
check and keeps `src`'s. The count is the last argument of `read` and
`write`, so their common call is proved. `ffi_buffer_count_proved` pins the
credited shape (no check in the golden `.ll`) and three that are not
credited: a field path, an aliasing local, and a count from another array.
`ffi_buffer_late_load` pins the resize arm with `pwrite(fd, buf, n, off:
i64)`: `pwrite(fd, buf, toU64(buf.length), 0)` has no check, and
`pwrite(fd, buf, toU64(buf.length), shrink(buf))`, where `shrink` pops, keeps
it and panics `ffi-length` in a `panics_ffi_length` variant; and so does the
inline arm `pwrite(fd, buf, toU64(buf.length), toI64(buf.pop()))`, whose `pop`
no callee fact records, in a second panics variant
(`panics_ffi_length_inline_pop`).

The other answer, for the owner: emit the check on every call and prove
nothing. It is one compare and one branch per call, on a call that is about
to enter C, and it removes the proof and its test. The recommendation is the
narrow proof, because `read(fd, buf, toU64(buf.length))` is the shape the
guide teaches, and `--emit-panics` would otherwise list every such call as an
unproven site.

Concurrency adds nothing new here. Another task that resizes `buf` while C
runs is the data race the existing `scope()` rule refuses for an array a
task writes while its parent can reach it (`writesThroughMessage`, which a
foreign `u8[]` argument now feeds through every path, §5).

The other answer, for the owner: refuse a call in which an argument after a
buffer may resize it, using the same `resizesArray` fact, and load at the
argument's own position. It is simpler to read in the IR and costs programs
nothing they write today, but it adds a refusal whose message talks about
callee facts. Q10 records the choice. The recommendation is the late load,
because it makes the stale pointer impossible rather than refused.

### 3b. How read-only and writable are spelled: `readonly u8[]` and `u8[]`

**Decision (recommended, Q2):** `readonly u8[]` is `const uint8_t *`, and
`u8[]` is `uint8_t *`. No new spelling is needed.
- `readonly` already means that this code writes no element (§2). It already
  maps to `const` in the C header, and a `u8[]` argument already widens to it.
  `write(1, bytes, n)` with a mutable `bytes` type-checks with no cast.
- `u8[]` in a signature already means "may be written". The element-reference
  rule (§2) already treats a non-`readonly` array parameter as one the callee
  may push through.

Other options were weighed:
- A `nish:unsafe` wrapper type (`Out<u8[]>`) is a type that exists only for
  C, and every one of its rules would duplicate `readonly`'s.
- Making every buffer writable would take `const` from the C side for nothing.
- Making every buffer read-only would make `read` impossible.

The `const` is the same promise the borrow is. C can cast it away, and the
compiler cannot check that (§3c).

Only `u8` is admitted. `i32[]` or `f64[]` across the boundary is refused
(`reject_ffi_buffer_element`). Other element types raise endianness, alignment
and BLAS-shaped questions that no motivating program asks yet. The rest of
the shape is refused too:
- a nullable buffer, `u8[] | null` (`reject_ffi_buffer_nullable`), as S2
  refuses `CPtr | null`;
- a buffer as a return type (`reject_ffi_buffer_return`), since C would hand
  back a pointer whose length the compiler does not know.

### 3c. What a write through a borrowed buffer does to facts and aliases

A `u8[]` crosses as `data` alone. The header, which holds `len`, `cap` and
`data` (runtime/nish.h:241), never crosses. So **C can change bytes, and it
cannot change the length or move the block.** Three consequences follow, each
of them a rule.

- **Bounds facts survive the call.** A proof that `i < buf.length` holds
  across `read(fd, buf, n)`, because `buf.length` cannot move. That claim is
  only true once the foreign facts stop saying `resizesArray = true`.
  - **Decision (recommended, Q3):** B1 re-derives the block, as the comment at
    src/attributes.ts:3392-3396 asks. After B1, the only Nish addresses that
    reach C are data pointers: S3's `s->data` and B1's `buf->data`. No header
    crosses, and a `CPtr` comes only from C. So no C body can reach an array
    header, and `resizesArray` becomes `false` for a foreign callee.
  - This is a separate commit inside B1 (B1.3, §10), with its own golden, so
    that a reviewer can read it alone.
  - It stops holding the day anything carries a header to C. A later stage
    that passes a `nish_array *` must set it back. The comment that replaces
    :3392-3396 says so.
  - The other worst-case facts stay: `sharedWrite`, `writesPastParams` and
    `willReturn = false`.
- **Element facts do not survive.** After a call that takes a `u8[]`
  (writable), nothing the checker knew about that array's element values
  holds. That is already true of any call that may write memory
  (`EFFECT_WRITE`). B1 adds no fact and removes none.
- **Aliases see the write.** A Nish array is a reference, so `const b = a;
  read(fd, a, n)` changes `b[0]`. That is what any Nish function that writes
  through a `u8[]` parameter does today. `u8` elements are copied by value, so
  the element-reference rule (§2), which is about record elements, never
  applies to a byte. A call that is handed a `u8[]` is still a call that "could
  push" for that rule, because the rule reads the parameter type, not the
  callee. This keeps the rule one sentence long.

**The borrow.** C may write the bytes until it returns, and it may keep no
address. A buffer kept past the call is worse than S3's kept string, because a
later write changes a Nish array without anything in the program writing it.
`setvbuf(f, buf, mode, size)` is the example WP27 §8b names for S3's borrow
(wp27-ffi.md:295): it keeps `buf` as the stream's buffer. So does `aio_read`. Declaring either with a
`u8[]` has undefined behaviour, and the compiler cannot see that. S3 weighed
the alternatives to the borrow (WP27 §8b) and found none safer. A buffer
changes none of that weighing.

Two buffers from the same array, as in `memmove(a, a, n)` declared with the
two-buffer run of §3a, are not refused. C sees two pointers to one block, and
the one count is checked against that block's length twice. `memmove` allows
the overlap. `memcpy` is `restrict` and does not, so `memcpy(a, a, n)` has
undefined behaviour the compiler cannot see: a wrong call of the same class as
§3a's `fwrite`, which the LANGUAGE.md rule names.

### 3d. A returned count larger than the length: neither clamped nor a panic

**Decision (recommended, Q4):** the return value of `read` is an ordinary
`i64`. The compiler does not know that it is a count, and it does nothing to
it.

To clamp the value or to panic on it, the compiler would have to know that
this return describes that buffer. That would be a second positional
assertion about C, and nothing would check it. There is also no memory hole
to close:
- the check in §3a has already bounded what C may touch;
- the array's length never moves (§3c);
- every later `buf[i]` is bounds-checked as usual.

So a `read` that lies and returns 9000 from a 16-byte buffer yields a wrong
number, which the program's own bounds checks then catch. It does not yield an
out-of-bounds access. A clamp would hide a C bug, and a panic would need the
assertion. `buf.length` is never set from the count: reading 5 bytes into a
4,096-byte array leaves its length at 4,096, and the program slices it. The
user-guide page shows that loop.

## 4. Handles

### 4a. The shape: what a handle class may declare, and where its field may go

The handle rule is an allow-list. This section and §4d list every position a
handle class's `CPtr` field and a handle object may occupy, and **one general
rule refuses everything else**. §6's rows and §4d's walk are examples of that
rule, not extra rules: a form neither of them names is refused because it is
not on the list, not because someone thought of it.

A **handle class** is a class that declares a field of type `CPtr` or
`CPtr | null`. That field is the one widening of §7a's "no field".

**The declaration.** A handle class's declaration may contain only:
- **D1.** Exactly one `CPtr` or `CPtr | null` field, `readonly`, with no
  initialiser. A second one is refused (`reject_ffi_handle_two_fields`), and
  so is one that is not `readonly` (`reject_ffi_handle_field_mutable`) or that
  has an initialiser.
- **D2.** Other fields, of any type the language already allows in a field
  except one that names the handle class itself (§4d's type rule).
- **D3.** At most one constructor. Its parameters follow
  src/declarations.ts:92, so none is a `CPtr`, and §4d's H2 does not include
  constructor parameters, so none is a handle either.
- **D4.** Instance methods, whose parameters and return types follow §4d's
  type rule. `static` and accessors are refused for every class already
  (docs/LANGUAGE.md:1990, `reject_cls_accessor`).
- **D5.** Exactly one `[Symbol.dispose](): void` method of §4b's shape. A
  handle class without one is refused (`reject_ffi_handle_no_dispose`): it
  would own a pointer that nothing closes.

The class header has no type parameters, no `implements` clause and no
`export`; `extends` is refused for every class (docs/LANGUAGE.md:1979). It
is declared at module level, as every class is.

**The field: the one write.** The field is written by exactly one statement,
and nowhere else:
- **F.** `this.f = g(args);`, where `g` is a `declare function` and the call,
  parenthesised or not, is the whole right-hand side. The assignment is an
  expression statement whose value is unused, at the top level of the
  constructor body: not inside an `if`, a loop, a nested block or a closure,
  and with no `return` statement, `orReturn()` or `orElse` that leaves the
  constructor in any statement before it. Its value is born from C inside the
  object, so the object owns it from the first instruction.

Every other write is refused (`reject_ffi_handle_field_copy`): a second
`this.f = …` anywhere, including a second one in the constructor, which the
seed's `readonly` check admits today because `assignableReadonly`
(src/members.ts) does not count assignments; a write in a loop or a branch; a
write in a method; a compound assignment; an assignment from anything but a
foreign call (`this.f = other.f`, `this.f = null`, `this.f = c ? fopen(a) :
fopen(b)`); and an assignment used as an expression, which the seed accepts
today, as in `const q = this.f = fopen(p, "r")` or `fclose(this.f =
fopen(p, "r"))`.

**The field: the reads.** The field is read only as the literal member access
`this.f`, written directly in the body of a method of its own class (never the
constructor, and never inside a closure in the method), in one of two
positions:
- **R1.** A direct argument to a call of a `declare function`: the whole
  argument expression, parenthesised or not.
- **R2.** The whole initialiser of a `const` declarator that binds a single
  identifier, such as `const p = this.f`. Each declarator of
  `const p = this.f, q = this.f` is checked on its own. The identifier is a
  **field-derived local**.

A field-derived local `p` is used only in the body that declares it, never
inside a closure there, and only as:
- **L1.** A direct argument to a call of a `declare function`.
- **L2.** An operand of `=== null` or `!== null` whose other operand is the
  literal `null`, which is what narrows it.

`const p = this.file; return p === null ? -1 : fgetc(p);` in §1 is L2 then
L1. The dispose method's two shapes (§4b) are R1, and R2 then L2 then L1.

Every other path to the field is refused by the general field rule
(`reject_ffi_handle_field_position`, "a handle's pointer may be read only as
`this.f`, passed straight to C or bound once to a `const`"). Its examples, each
with its own case in §6: a read from outside the class (row 16), `other.f` on
another instance and destructuring `const { f } = this` (row 16a), copying a
field-derived local, binding the field to a `let`, or yielding it from a
ternary or a logical operator (row 16b), a closure that captures either (row
4), and a read in the constructor. `const self = this; self.f` never reaches
the field rule, because binding `this` is refused by §4d's general rule.

A field-derived local is a `CPtr` local, and S2's placement rule already keeps
it out of every field, element, `Result` and signature, so L1 and L2 are the
only uses that rule leaves anyway. The pointer leaves the object only into a C
call, and that call borrows it. Which declared functions the field may be
passed to is §4c's question.

`CPtr | null` is what makes a failed `fopen` expressible without a panic in
the constructor. The class narrows the field where it is used, through a
field-derived local, and the example in §1 shows this. A non-nullable field
needs a constructor that panics on `null`. Both are allowed.

### 4b. How the class names its close function

**Decision (recommended, Q5):** a `[Symbol.dispose](): void` method whose body
has one of two shapes, and no other:
- `close(this.f);` for a `CPtr` field;
- `const p = this.f; if (p !== null) { close(p); }` for a `CPtr | null`
  field. The local is needed because a property path is not narrowed
  (docs/LANGUAGE.md:603-604): `if (this.f !== null) { close(this.f); }` does
  not type, since `this.f` is still `CPtr | null` inside the `if`.

In both shapes, `close` is a `declare function` and the call's result is
discarded. Any other body is refused (`reject_ffi_handle_dispose_body`). A
dispose method on a class with no `CPtr` field keeps today's refusal
(src/structs.ts:619-623).

This is TypeScript's own protocol, so `tsc` reads the class and Node runs it
(where the C exists). The close function is a declared symbol named in the
source. It is not a Nish function pointer, which the language does not have
(§8). The checker can read the call straight off the body.

The emitter does not call the method. Like a lock's release, the close is
emitted by the construct: `using` pushes a fourth kind onto the stack that
`openOneScope` (src/emit-parallel.ts:762) keeps beside scope, arena and lock.
`closeScope` (:808) then emits the null test and the call in LIFO order on
every exit, the same exits a lock is released on (§2).

"Every exit" is a list of emitter paths, and each one is wired for the fourth
kind, as each was for locks:
- the fall-through, `closeBlockScopes` (src/emit-parallel.ts:849);
- `break`, `continue` and `return`, through `emitScopeJoins` (:833). Its
  `later` test at :836, `openScopeArenas[i] || openScopeLocks[i]`, gains the
  handle stack, or a scope holding only a handle would be skipped;
- `emitScopeExit` (src/emit.ts:698), called at src/emit.ts:588, :1153, :1180,
  :1192 and :1519, and on the `orReturn()` propagation path at
  src/emit-result.ts:560 and :564. It calls a close pass beside
  `emitLockReleases` (src/emit-parallel.ts:867);
- the tail-call suppression. `holdsLock` (src/emit-parallel.ts:878) stops
  src/emit.ts:662 from marking a call in return position `tail` while a lock
  is held, because the release runs after it. An open handle needs the same,
  or `return f.readByte()` would be a tail call with the close after it. The
  test widens to "holds a lock or a handle".

`ffi_handle_file` (§9) exercises each path: the fall-through, `break`,
`continue`, an early `return`, an `orReturn()` that propagates, and
`return f.readByte()` in tail position, whose golden shows no `tail` marker.

Other options were weighed:
- **A decorator or a magic static** (`static close = fclose`). Nish parses
  neither. The static would also be a function value, which is a function
  pointer by another name.
- **A free-form dispose body.** It would let Nish code run at every exit,
  including code that panics or that uses `this` after the close. That would
  bring back exactly the questions §4c answers statically.
- **A builtin wrapper type** (`Handle<"fclose">`) needs a type-level string
  (as in §3a, option 3).

### 4c. Use after close and double close

**Decision (recommended, Q6):** no run-time flag and no `ffi-closed` panic
kind. What is static and what is a C contract is Q9, below, and is the
owner's call.

**What placement proves.** Outside its own methods, an instance is named only
by the `using` binding that created it and by the H2 parameters it is lent to
(§4d). A parameter's name ends when its call returns, which is inside the
`using` block, and the binding goes out of scope at the exact point where the
close is emitted. So no code can
follow the emitted close and name the object. The program cannot call the
dispose method: `f[Symbol.dispose]()` is refused
(`reject_ffi_handle_dispose_call`), and so are `this[Symbol.dispose]()` and
`other[Symbol.dispose]()` inside the class, on any receiver. The emitted close runs once per exit path,
and each path runs exactly one exit.

**What placement does not prove.** A method of the class can call the close
function itself:

```ts
class File {
  // … as in §1
  done(): void {
    const p = this.file;
    if (p !== null) { fclose(p); }   // a second close follows at the block's exit
  }
}
```

`f.done(); f.readByte();` is then a use after close, and the block's exit is a
double close. Placement says nothing about it, because the call happens inside
the object. There are two answers, and the choice is Q9.

- **Option A: refuse it statically.** A written call to the dispose method's
  close function (`fclose` above) whose argument is the owned field, or a
  `const` local read from it, is refused anywhere in the class
  (`reject_ffi_handle_close_call`). The check is local to the class, and it
  sees every name the pointer can have, because §4a closes every other path:
  the field is readable nowhere else, only as `this.f` (never `other.f`, by
  destructuring or through an alias of `this`), a field-derived local cannot
  be copied, and closures over either are refused
  (`reject_ffi_handle_field_capture`). So the names of the pointer in a class
  body are `this.f` and the field-derived locals, and the rule tests a close's
  argument against exactly those. Another instance's pointer cannot be named
  at all, so `merge(other: File)` borrows `other` and may call its methods,
  but cannot close it. Its cost and its edges:
  - It is one more checker rule with one message, beside the dispose-shape
    check, which already resolves the close's name. The dispose method's own
    call is the one exempt site.
  - The constructor is covered too: `this.file = fopen(…); fclose(this.file)`
    in the constructor is refused, since the constructor is a method of the
    class for this walk.
  - It covers only the close the class names. Other C functions that close,
    replace or keep the pointer cannot be seen: `freopen(path, mode, p)`
    closes `p`'s descriptor, `fdclose` and `fclose` through a C wrapper with
    another name free it, and `setvbuf(p, …)` makes the stream keep a buffer.
    Two more launder the pointer through C: a C function that returns its
    argument (`const q = ident(this.f)` gives a `CPtr` the rule does not
    know is the field, and `fclose(q)` then passes), and `close(fileno(p))`,
    which closes the descriptor under the stream without passing the
    pointer to a close at all. These stay a C contract, stated in the
    LANGUAGE.md rule like §3a's count: "the class's methods pass the field
    only to functions that use it and return, and that neither close what
    it owns nor hand it back".
  - Ownership itself stays a C contract. Two objects built from one C getter
    that returns a shared pointer (`stdin`'s `FILE *` through a C helper, for
    example) both close it. The rule is that the constructor's foreign call
    returns a pointer the object owns, and the compiler cannot check that.
- **Option B: a stated C contract.** Drop the claim that a close through a
  method is refused. The LANGUAGE.md rule says that a method which closes the
  field, through the named close or any other function, makes the next use
  and the block's emitted close undefined behaviour. It costs no checker code
  and admits the same programs as option A plus the wrong ones. It is the
  status S3's borrow and §3a's count already have, so the design states three
  C contracts instead of two.

**Recommended: option A**, with the remaining C functions named in the rule.
It makes the mistake a program is most likely to write, calling the close it
already named, a refusal. What it leaves is the same class of unchecked
declaration the borrow already has.

The alternative to both was a defined panic. A `closed` flag in the object
would be set by every close and tested on every method call. It costs a word,
a load and a branch per call, and under option A it would catch only closes
through other C functions, which would have to set the flag and cannot. It
would be the right design if handles could escape. They cannot (§4d), so it
is not needed.

### 4d. Where an instance may live: the allow-list

Write `C` for a handle class. A **handle name** is one of three things, and
these are the only places a `C` value is ever bound:
- **H1. A `using` binding.** The binding of a `using` declarator, in a block of
  a function or method body, whose whole initialiser, parenthesised or not, is
  exactly `new C(args)`. `using f = c ? g : new File(p)` and
  `using f = g as File` are refused (`reject_ffi_handle_using_initialiser`):
  the declarator would close a value it did not create. A `new C(…)`
  anywhere else is refused, whatever surrounds it (row 1).
- **H2. A borrowing parameter.** A parameter whose declared type is exactly
  `C`, with no default and not optional, of a module-level program function
  (a `function` declaration or a module-level `const` arrow) or of an instance
  method of any class. Neither the function nor the method's class is
  exported. A constructor parameter, a closure's parameter, a nested
  function's parameter and a rest parameter are not H2.
- **H3. `this`**, inside a method of `C`, and inside `C`'s constructor only as
  the target of a field write (`this.g = v` for a field `g`, and F).

A handle name `n` may be used only in the function body that binds it, never
inside a closure or nested function there, and only as:
- **U1. A receiver.** `n.m(args)`, a call of a method of `C` other than
  `[Symbol.dispose]`, in any expression position; or `n.g`, a read of a field
  of `C` that is not its `CPtr` field. Both give an ordinary value, since no
  method returns `C` and no field holds one. For `this`, also the field
  writes of H3 and the reads of §4a.
- **U2. A borrowed argument.** The whole argument expression, parenthesised or
  not, at an H2 parameter's position in a direct call of that function or
  method, as in `useFile(f)` or `g.merge(f)`.

**The general rule.** A handle name in any other position, and any other
expression whose type is `C`, is refused with one message
(`reject_ffi_handle_position`, "a handle may only be opened by `using`,
called, or lent to a parameter of its type"). The class's type name is
written in one place only: as an H2 parameter's type. Written anywhere else,
it is refused with a sibling message (`reject_ffi_handle_type_position`): a
variable's or field's annotation, a return type, a type argument, a union, a
type alias, an array or `Result` element, a `Map` or `Set` argument, an
interface field, a function type and an `as` target. An H2 function or
method is only ever called directly: naming one as a value would give it a
function type that writes `C`, which this rule refuses. Each §6 row keeps its
own negative case, and the cases share these two messages, so the case names
in §6 and §9 are files, not diagnostics.

**The walk.** Every form of the language, in the order of docs/AI.md, against
the list. "Value" is a handle object, "field" its `CPtr` field.

| Form | Value | Field |
| --- | --- | --- |
| Types: primitives, `CPtr`, nullable `T \| null`, unions, `Result<T, E>`, `Secret<T>`, tuples and fixed arrays where the language has them | `C` as any of their parts is refused by the type rule (rows 5, 7, 14) | A field-derived local is a `CPtr` local, and S2 keeps it out of all of them |
| Absence: `null`, `undefined`, `!`, `?.`, `??` | `f === null`, `f!`, `f?.m()` and `f ?? g` are refused: a handle is never nullable (row 14) | L2 is the only comparison; `p ?? q` and `p!` are refused (row 16b) |
| Functions: declarations, module-level arrows, return | A parameter is H2. A return of `C`, a return type naming it, and a default value `f: File = new File(p)` are refused (rows 1, 8) | Never a parameter (S2) |
| Generic functions, classes, interfaces and methods | `C` as a type argument, explicit or inferred (`id(f)`), is refused, on both template paths, and `C` may not have type parameters (row 5) | Unchanged from S2 |
| Function parameters: callbacks and function types | `(f: File) => void` as a type is refused by the type rule; a callback that captures a handle is refused (row 4) | A closure capturing either is refused (row 4) |
| `nish:threads`, `scope()`, `spawnWith`, `Channel`, `Mutex` | A task capturing a handle (row 10), `spawnWith<File>` and `Channel<File>` (type rule), `ch.send(f)` (not U2) are refused | A task capturing the field or a local is refused (row 4) |
| Calling C: `declare function` | A declared parameter of type `C` is refused by the type rule and by src/declarations.ts | R1 and L1 are the field's only way out |
| Module constants and module-level bindings | Refused: H1 is inside a function body (row 15) | Unchanged from S2 |
| Classes: fields, constructors, methods, `this` | A field of type `C` in any class (row 12); a constructor parameter (not H2); a method parameter is H2 unless the class is exported (row 19); `this` is H3, and `h.l = this`, `return this`, `xs.push(this)`, `{ me: this }` and `const self = this` are refused (rows 3, 15) | §4a: D1, F, R1, R2 |
| Interfaces | An interface field of type `C`, and `implements` on a handle class, are refused (rows 13, 28). Interface methods are refused for every interface (docs/LANGUAGE.md:3971) | An interface field of type `CPtr` is S2's |
| Object literals | `{ file: f }` and `{ f }` are refused, whatever the literal's type (row 29) | Refused as a `CPtr` value in a field (S2) |
| Type aliases and enums | `type F = File` is refused by the type rule | — |
| Modules: `export`, `import`, re-export | `export class C`, a re-export, and an exported function or class whose method takes `C` are refused (row 19). A non-exported class cannot be imported, so a handle class and every function that takes one live in one module | — |
| `const`, `let`, `using` | Only H1. `const g = f`, `let g: File`, `using g = f`, a ternary or `as` initialiser, and a second declarator `b = a` are refused (rows 2, 15) | R2 only, each declarator alone |
| Expression statement | `f.m();` is U1. A bare `f;` is refused | `this.f;` is refused |
| `if`, `while`, `for`, `for…of`, `switch`, labelled blocks | A handle as a condition, a `switch` subject or a `for…of` source (`for (const g of [f])`) is refused; U1 and U2 inside them are allowed, and a `using` in a loop body opens and closes once per iteration | F outside the constructor body's top level is refused |
| `return`, `break`, `continue` | `return f` is refused; `return f.m()` is U1, with the close after it (§4b, §4e) | `return this.f` and `return p` are refused (S2 keeps `CPtr` out of a return) |
| `throw`, `try`/`catch` | Both are refused for every program (`reject_throw`, `reject_try_catch`, docs/LANGUAGE.md:4312-4325), so neither is a position or an exit | — |
| Assignment, as a statement or used as an expression, either side, and compound assignment | `g = f`, `f = g`, `x.h = f` and `const q = (g = f)` are refused (row 15) | Every write but F is refused, including `const q = this.f = fopen(…)` (row 17); `x = this.f` and `x = p` are refused (row 16b) |
| Ternary, `&&`, `\|\|`, `!` | A handle as any operand is refused | `c ? this.f : q` and `p && q` are refused (row 16b); `p === null ? -1 : fgetc(p)` is L2 then L1 |
| Comparison: `===`, `!==`, `<` | Refused for a handle on either side | L2 only |
| Casts: `as`, `satisfies` | Refused (type rule, and not a position) | `this.f as CPtr` is refused |
| Calls | U2 into an H2 parameter; any other argument position, including `console.log(f)`, `String(f)`, a generic and a builtin, is refused | R1, L1 |
| Method calls and member access | U1. `f.m` without a call, `f[k]`, `f[Symbol.dispose]()` and `this[Symbol.dispose]()` are refused (row 18) | `other.f`, `f.file` from outside, `this["f"]` are refused (rows 16, 16a) |
| `new` | Only as H1's whole initialiser (row 1) | — |
| Arrow functions and closures | Capturing a handle name or `this` of `C` is refused, even for an arrow called at once (row 4) | Capturing `this.f` or `p` is refused (row 4) |
| Template literals, string concatenation, spread, destructuring | All refused for a handle (`` `${f}` ``, `[...f]`, `const { g } = f`) | All refused, including `const { f } = this` (row 16a) |
| Array, `Map` and `Set` builtins, json-typed values, `JSON.stringify` | `[f]`, `xs.push(f)`, `m.set(k, f)` and `JSON.stringify(f)` are refused (rows 6, 29) | Refused (S2) |
| Memory: arenas, `nish_arena_keep` | Unchanged: the object lives in its function's scope (§5) | — |

**Is the allow-list too restrictive?** It admits every program this design
set out to admit: §1's `File`, a `readByte` or `readLine` method, a helper
that borrows the handle (`countLines(f: File)`), and a method that takes a
second handle (`copyTo(out: File)`). What it refuses that a real program
might want, each a cost, and Q13 for the owner:
- **No handle in a constructor parameter**, so a wrapper (`class Reader {
  constructor(f: File) }`) cannot borrow one. It would need the wrapper to
  be a handle-scoped object of its own.
- **No closures that touch a handle.** `forEachLine(f, (line) => …)` is
  written as a loop inside a method of `File` or a function taking `File`.
- **One module.** A handle class cannot be exported, so it and every function
  taking it live in one module. Admitting an import by another Nish module
  needs the export refusal to tell a Nish import from the generators' ABI
  surface (§5), which today it does not.
- **Nothing in the constructor but field writes.** `this` there is only a
  write target, and the field is not read there (§4a), so a constructor that
  wants to `fseek` after `fopen` cannot. That work goes in a method the caller
  invokes after `using`.

None of these is unsound to widen later; each needs its own walk against this
list, decided on a program that needs it.

This is the shape §7a gave `CPtr` one level up. When the owning object would
escape, be copied, be stored or be captured, the program is refused. The
object is never quietly closed early or late.

The cost is that a handle cannot outlive the function that opens it. A
connection pool or a cache of open files cannot be written with H1. That is
deliberate. A handle that outlives a block needs either the run-time flag
weighed in §4c or ownership transfer, and Nish has neither. Both are a later
design, decided on a program that needs them.

### 4e. Panics and the order of exits

- **Panics.** A panic does not run the close. The process exits, and the
  operating system reclaims file descriptors and memory, as it does for an
  arena. Stdio buffering matters here: `panic`, `expect` and a failed range
  entry call `exit(1)`, which flushes stdio, but a failed check calls
  `_exit(1)`, which does not (runtime/runtime.c:92-100). So a `FILE *` written
  through `fwrite` and not yet flushed loses its tail on a bounds panic. The
  LANGUAGE.md rule says this, and the guide page recommends `fflush` before
  any code that may panic.
- **`process.exit`.** `process.exit(code)` is typed `never`
  (runtime/nish.d.ts:404) and ends the process where it is called, as a
  panic does, and so does `nish:process`'s `exit`. Neither runs the close,
  for the same reason: the operating system reclaims the descriptor, and
  stdio is flushed by `exit` but not by a check's `_exit`. "Every exit" in
  §1 and §4b means every exit that returns control to the program: the
  fall-through, `break`, `continue`, `return` and `orReturn()`.
- **`throw`.** There is no third exit through `throw`: it is refused for every
  program by Phase 0 (`reject_throw`, docs/LANGUAGE.md:4314), as `try` is
  (`reject_try_catch`). The emitter still has `emitThrow`
  (src/emit-control.ts:324-329), which evaluates its operand and calls
  `llvm.trap`; if `throw` were ever admitted, it would be an exit like a panic,
  ending the process without the close, and the LANGUAGE.md rule would say so.
- **The return value.** As with an arena, the return value is computed before
  the close (src/emit.ts:1149), so `return f.readByte()` reads from an open
  file.
- **Multiple declarators.** `using a = new File(p), b = new File(q)` closes
  `b`, then `a`, as `openScope` already orders declarators. That holds once
  both are open. It does not hold while the second initialiser runs:
  src/emit.ts:1100-1104 runs `emitVariableDeclarations` for every
  declarator first and calls `openScope` after them. So
  `using a = new File(p), b = new File(q.orReturn())` returns from the
  `orReturn()` with `a` open and nothing on the stack to close it, a leak.
  JavaScript disposes
  each declarator as soon as its own initialiser completes. Two answers, for
  the owner (Q12):
  - **(a) JavaScript's order (recommended).** `using` emits each declarator
    and pushes it onto the stack before the next initialiser runs, so a
    later initialiser's exit closes the earlier handles. The cost: the emit
    order in `emitStatementKind` changes for every kind `using` opens
    (scope, arena, lock, handle), the multi-declarator goldens move, and
    H1.2 reads each moved `.ll` in its commit body. A panic in a later
    initialiser is unaffected, since panics never close (above).
  - **(b) Refuse the exit.** An `orReturn()` (or any other expression that
    can leave the block) inside a later declarator's initialiser, once an
    earlier declarator of the same statement opened a handle, is refused
    (`reject_ffi_handle_using_exit_in_initialiser`). No emit order changes,
    and nothing moves, but a program that is valid TypeScript and correct
    under JavaScript's order is refused, and the user writes two `using`
    statements instead.

  The gap is not the handle's alone. An earlier `scope()`, `arena()` or
  lock declarator leaks the same way today: in
  `using l = m.lock(), b = new File(q.orReturn())` the lock is never
  released, and in `using s = scope(), x = f(q.orReturn())` the scope never
  joins. (a) fixes every kind at once, since the order change is in
  `using` itself. (b) as written covers only an earlier handle; widened to
  "an earlier declarator of any kind", it costs the same rule and refuses the
  same shape for locks, scopes and arenas, and moves nothing. Under either
  answer, the existing lock and scope leak is a bug on `main` that deserves
  its own issue, independent of H1.

  Under (a), `ffi_handle_file` gains
  `using a = new File(p), b = new File(q.orReturn())` with `q` an `Err`, and
  the sidecar's close count shows `a` closed once. Under (b), the refusal is
  the negative case and `ffi_handle_file` keeps two plain declarators.
- **The object's memory.** The object is allocated in the arena that is live
  at the `new`. It is popped from the stack before any arena opened earlier
  releases, so the close never reads freed memory.

## 5. Interactions

**src/escape.ts and the arena scopes.**
- *Buffers.* A buffer argument does not escape, exactly as S3's string does
  not, so an array allocated in a released scope may be passed. Escape
  analysis decides that at `useOutcome` (src/escape.ts:691): an argument
  flows out only when `calleeCaptures` (src/escape.ts:638, read at :711)
  says the callee keeps it, and `calleeCaptures` answers `true` for a callee
  with no facts entry, which a foreign callee is today. So B1.2 gives each
  declared function that takes a buffer a facts entry whose buffer
  parameters are pointer parameters with `captured = false` (and
  `writesThrough = true` for `u8[]`), which is the borrow written as a fact.
  The comment at src/escape.ts:1320-1321, "No pointer this compiler
  allocated crosses the C boundary", goes stale the moment `buf->data`
  crosses, so B1.2 rewrites it to say that one does, borrowed and not kept.
  (B1.3 then rewrites the attributes comment of §3c; the escape comment
  belongs to the step that first passes the pointer, which is B1.2.) It is not a read, though. A
  foreign callee gets no per-argument facts today: `addCallee`
  (src/attributes.ts:2713-2722) returns before `noteArguments` for a foreign
  callee, which was sound while no array could reach one. B1.2 adds the
  missing step, and it is path-aware. For each `u8[]` argument of a foreign
  call, B1.2 calls `noteSlotWrite(call, arg)` (src/attributes.ts:1887), the
  recorder an element store `arg[i] = v` already goes through, so the call
  records exactly what a store through that argument would:
  - a parameter `b` sets its `writesThrough`, and `noteSharedWrite`;
  - a field path `o.bytes` or an element `bufs[i]` pushes its path onto
    `memWrites` (`pathOf`), which becomes `writesReach` on the parameter the
    path starts from, the fact parallel.ts:1918 reads beside
    `writesThrough`;
  - an array private to the function (a `ROOT_OWN` local) records the call
    as its write site, as a store does;
  - an argument with no path (a call's result) is a past write, the
    conservative arm.

  A `readonly u8[]` argument records nothing, and it cannot carry a writable
  array's write, because a `readonly u8[]` is never converted to `u8[]`.

  Every fact derived from `writesThrough` then follows, and each is a place
  where leaving it unset would be a miscompile or a lie in a generated file:
  - the LLVM attributes on the caller's own array parameter: an
    `f(b: u8[])` that calls `read(fd, b, n)` must not get `readonly` on `b`;
  - `--emit-header`'s `const`, which `writtenArrayParams`
    (src/interop-abi.ts:231-250) derives from `writesThrough`: that `f`, if
    exported, renders as `nish_array *b`, not `const nish_array *b`;
  - the wasm glue's copy-back of an exported `u8[]` parameter
    (src/interop-wasm.ts:570-576, [wp30-bytes-interop.md](wp30-bytes-interop.md)),
    which copies the bytes back to the host only for a written parameter, and
    the `const` of napi's C declaration (src/interop-napi.ts:318);
  - the `scope()` sharing rule (`writesThroughMessage`, src/parallel.ts:1897),
    which refuses a task that writes an array its parent also reads, through
    `writesThrough || writesReach` (src/parallel.ts:1918). §3a's concurrency
    claim depends on it for every path: a task that calls `read(fd, b, n)`
    on a parameter (`reject_ffi_buffer_scope_race`), on a field path
    `o.bytes` (`reject_ffi_buffer_scope_field_race`), or on an element
    `bufs[i]` (`reject_ffi_buffer_scope_element_race`) while the parent
    reads the same array is refused.

  `captured` stays `false`, by the borrow (WP27 §8b): C keeps no address. That
  is the assertion §3c already states, now written into a fact.
  `ffi_buffer_export_written` pins it: an exported `fill(b: u8[])` that calls
  `read` has an `--emit-header` golden with `nish_array *b`, a `.ll` golden
  with no `readonly` on `b`, and a wasm32 build whose JavaScript glue copies
  `b` back.
- *Handles.* A handle-class instance cannot escape, because every way out is
  refused (§4d). Escape analysis therefore never sees one leave and needs no
  new case, but B1/H1 adds a golden `.ll` showing that the object is
  allocated and released inside the function's own scope
  (`ffi_handle_arena`).

**`nish_arena_keep`.**
- *Buffers.* `reclaimsReturnedString` (src/escape.ts:1212) applies only to a
  callee that returns a `string`, and a buffer is never returned (§3b).
  Nothing changes.
- *Handles.* A method of a handle class that returns a string, such as
  `readLine`, is an ordinary program method, and its string may be reclaimed
  with `nish_arena_keep` (src/emit.ts:623) as today. The handle object itself
  is never returned, so it never passes through a keep.

**`--deny ffi` and the capability report.**
- *Buffers.* A call with a buffer is a call to a declared function, so it
  offers `ffi` at that call (src/attributes.ts:2721). There is nothing new.
- *Handles.* The constructor's `fopen` offers `ffi` as written. The close is
  emitted, not written, so the `using` statement offers `ffi` itself, naming
  the close function, and the report points to the `using` line. Otherwise
  `--deny ffi` would let a program that only closes slip through. That is
  pinned by `caps_ffi_handle` (a `.caps.json` naming both sites) and
  `reject_ffi_handle_deny`.

**`--emit-header`, `--emit-dts` and `--emit-napi`.**
- *Buffers.* A buffer parameter on a `declare function` is never exported
  (`reject_ffi_export`, existing), so no generator renders the declaration.
  The generators do see what a buffer call does to an exported program
  function's own `u8[]` parameter
  ([wp30-bytes-interop.md](wp30-bytes-interop.md)): it is written, so it
  renders without `const` and is copied back. That comes from `writesThrough`
  (src/escape.ts and the arena scopes, above), and no generator changes.
- *Handles.* A handle class may not be exported (`reject_ffi_handle_export`),
  and a program function that takes one may not be exported either (§4d). So
  none of the three generators is ever asked to render one, and each of them
  is left unchanged. If they were asked:
  - the header would flatten the class into a C `struct` (src/interop-abi.ts:360-364)
    whose `CPtr` field has no case in `cType` (:322), and that is the default,
    `""` (:375-376);
  - a host could copy the struct, which would give two owners;
  - JavaScript has no `using` that the compiler can see.

  Refusing the export at the checker is one message. Teaching three generators
  a type that must not cross would be three surfaces.

**wasm32 and `--profile wasm`.**
- *Buffers.* B1 adds no wasm32 guard and no wasm32 lowering. A `declare
  function` is not refused under `--target wasm32` today, and its symbol is
  left to `wasm-ld`. The two wasm routes still see different IR. `--target
  wasm32` compiles for wasm32, with 32-bit pointers. The freestanding
  `--profile wasm` route links IR compiled for the host, not with `--target
  wasm32` (the comment at scripts/build.sh:375, in the `wasm)` case at :367),
  so its `buf->data` loads, header offsets and `u64` count are the host's,
  linked by `wasm-ld`. Because B1 skips nothing for wasm32, there is no guard
  for that route to bypass, but "same IR" is not a claim this design can make,
  and neither route is tested today.

  So B1 adds both checks to the `wasi` section of `tests/run.js`, which skips
  without a WASI sysroot (CLAUDE.md): a `--target wasm32` build of
  `ffi_buffer_write` whose IR passes `llvm-as` and whose `ptr` loads and
  `n <= len` compare are read at wasm32 widths, and a `--profile wasm` link of
  the same case against a stub `write` that must resolve. H1 adds the same
  pair for `ffi_handle_file`, with stub `fopen`, `fgetc` and `fclose`.

  One width question is S1's, not new: a `u64` declared where C has `size_t`
  is 32 bits on wasm32. `wasm-ld` reports the signature mismatch instead of
  linking it silently, and that already applies to `calloc(count: u64, …)`
  today. B1 records it in the LANGUAGE.md rule and leaves the fix to a
  follow-up issue. Native round trips do not run on wasm.
- *Handles.* The close is an ordinary call in the IR, emitted the same way
  for either target. The `--profile wasm` link above checks that it resolves
  on the route that links host IR.

**The differential oracle.**
- *Buffers.* Outside it, by construction (known-failures.txt:40-47).
  `ffi_buffer_read` and `ffi_buffer_write` are added to that block with the
  same comment. Their coverage is a golden `.ll`, an `llvm-as` pass and a
  native round trip.
- *Handles.* The same, for `ffi_handle_file`. The
  `reject_ffi_handle_*` cases are checker refusals and never reach the oracle.

## 6. Siblings: every way a value reaches the new rules

The handle rows are examples of §4a's and §4d's allow-lists, not the rules
themselves: a form no row names is still refused, by the general rule, and
§4d's walk lists every form. The handle rows' negative cases share the
general messages (`reject_ffi_handle_position`,
`reject_ffi_handle_type_position`, `reject_ffi_handle_field_position`), apart
from the declaration refusals of §4a and the dispose rules of §4b and §4c;
the names in the last column are case files. CLAUDE.md's three recurring
shapes (a constructor reached by `new`, every declarator of `using`, and
`this` leaving a constructor) are rows 1 to 3. Every row gets its own negative
case. A review that finds one of them probes the rest in the same round.

| # | Way in | What happens | Negative case |
| --- | --- | --- | --- |
| 1 | A constructor reached by `new`, outside a `using` initialiser, including `new File()` inside another class's constructor, a default parameter value, or an argument | Refused: a handle-class `new` is legal only as a `using` initialiser | `reject_ffi_handle_new_outside_using` |
| 2 | Every declarator of `using a = …, b = …` | Each declarator is checked on its own, and each initialiser must be exactly `new C(args)` (H1), so `using a = new File(p), b = a`, `using b = c ? a : new File(q)` and `using b = a as File` are refused at `b`. An exit inside a later declarator's initialiser closes the earlier handles under Q12(a) and is refused under Q12(b) (§4e) | `reject_ffi_handle_using_second_declarator`, `reject_ffi_handle_using_initialiser`; `reject_ffi_handle_using_exit_in_initialiser` (Q12(b) only) |
| 3 | `this` leaving a constructor or method (`h.l = this`, `return this`, `xs.push(this)`, `{ me: this }`, an interface field), or used in the constructor as anything but a field-write target | Refused: `this` is H3, whose only uses are U1, U2 and, in the constructor, field writes (§4d) | `reject_ffi_handle_this_escapes` |
| 4 | A closure capture of the `using` binding or of a handle parameter; inside the class, a closure capture of the `CPtr` field or of a `const` local read from it | Refused, even for an arrow called at once (§4a) | `reject_ffi_handle_closure_capture`, `reject_ffi_handle_field_capture` |
| 5 | A generic type argument (`Box<File>`, `new Box<File>()`, `id<File>(f)`, `Secret<File>`), and a generic handle class (`class File<T>`) | Refused on both template paths. src/generics.ts:1248 checks function templates only, and the class-template path (src/generics.ts:993-1001) has no check today, so H1.1 adds one there for the handle rule and for `CPtr` alike. A handle class may not have type parameters | `reject_ffi_handle_type_argument` (a function and a class template each), `reject_ffi_handle_generic_class` |
| 6 | An array element (`File[]`, `[f]`) | Refused | `reject_ffi_handle_array` |
| 7 | A `Result` arm (`Result<File, E>`) | Refused. A fallible open is written with a `CPtr \| null` field (§4a) | `reject_ffi_handle_result` |
| 8 | A return from a program function or method | Refused | `reject_ffi_handle_return` |
| 9 | An `async` function: a handle parameter, or a `using` of one, in its body | Closed by an existing rule: `async` is refused outright (docs/LANGUAGE.md:8705), so no suspension point can split the close from the code that uses the handle. If `async` arrives, this row comes back | `reject_async_function` (existing) |
| 10 | A `scope()` task capturing a handle, `spawnWith<File>`, or a `Channel<File>` | Refused: a capture is not U1 or U2, and `File` as a type argument is not H2. Two tasks would otherwise call the same C handle concurrently. Ordering is then safe too: in `using s = scope(); using f = new File(p);`, `f` closes before `s` joins (LIFO), and no task of `s` can name `f` | `reject_ffi_handle_scope_task` |
| 11 | An inherited field, or a `static` member of a handle class | Closed by existing rules: there is no `extends` (docs/LANGUAGE.md:1979) and no `static` (docs/LANGUAGE.md:1990). If either arrives, this row comes back | `reject_cls_extends` (existing) |
| 12 | A field of another class, or of the handle class itself, whose type is the handle class | Refused by the type rule (§4d) | `reject_ffi_handle_field` |
| 13 | Widening to an interface (`class File implements Closer`, then `const c: Closer = f`) | Refused: a handle class may not `implements`, so it has no other type to widen to | `reject_ffi_handle_implements` |
| 14 | A nullable handle type (`File \| null`) | Refused. Nullability lives in the field, not in the object | `reject_ffi_handle_nullable` |
| 15 | An alias, `let`, assignment on either side (as a statement or used as an expression), or module-level binding, including `const self = this` inside the class | Refused (§4d, §4a) | `reject_ffi_handle_alias`, `reject_ffi_handle_module_binding` |
| 16 | Reading the `CPtr` field from outside the class, by member access or destructuring | Refused (§4a) | `reject_ffi_handle_field_read_outside` |
| 16a | Reading the `CPtr` field inside the class by any path but `this.f`: another instance (`other.f`) or destructuring (`const { f } = this`) | Refused (§4a) | `reject_ffi_handle_field_other_instance` |
| 16b | Copying a field-derived local (`const q = p`), binding the field to a `let`, or yielding it from a ternary or logical operator | Refused (§4a), so the field's names in a class are `this.f` and its direct `const` locals | `reject_ffi_handle_field_alias` |
| 17 | Any write of the `CPtr` field but F: outside the constructor, a second one in it, one in a loop or a branch, one from anything but a foreign call, an initialiser, or an assignment used as an expression (`const q = this.f = fopen(p, "r")`, `fclose(this.f = fopen(p, "r"))`) | Refused (§4a). The seed's `readonly` check admits the second assignment today, since it does not count | `reject_ffi_handle_field_copy` |
| 18 | An explicit dispose call on any receiver: `f[Symbol.dispose]()`, and inside the class `this[Symbol.dispose]()` and `other[Symbol.dispose]()` | Refused (§4c) | `reject_ffi_handle_dispose_call` |
| 19 | An exported handle class or a re-export of one, an exported function taking one, or a method of an exported class (handle or not) taking one | Refused: an H2 parameter's function and class are not exported (§4d, §5) | `reject_ffi_handle_export`, `reject_ffi_handle_exported_param` |
| 20 | A buffer, through its paired count: the next parameter is missing or is not a `u64` | Refused (§3a) | `reject_ffi_buffer_length_missing`, `reject_ffi_buffer_length_type` |
| 21 | A buffer of another element type, a nullable buffer, or a returned buffer | Refused (§3b) | `reject_ffi_buffer_element`, `reject_ffi_buffer_nullable`, `reject_ffi_buffer_return` |
| 22 | A close of the owned field written by hand, in a method or the constructor, through the dispose's close function, on `this.f` or a field-derived local | Option A: refused, and rows 15, 16a and 16b leave it no other name to reach. Option B: a stated C contract. The owner chooses (§4c, Q9) | `reject_ffi_handle_close_call` (option A only) |
| 23 | The owned field passed to another C function that closes, replaces, keeps or returns it (`freopen`, `setvbuf`, `ident(this.f)`, `close(fileno(p))`), or two objects owning one pointer a C getter shares | A C contract under either option, named in the LANGUAGE.md rule (§4c) | none: the compiler cannot see it |
| 24 | A buffer's `data` or `len` read at a stale moment, because a later argument resizes the array | Both are loaded after every argument is evaluated (§3a, Q10). The elided check also requires that no later argument may resize | `ffi_buffer_late_load` (positive, both arms) |
| 25 | A foreign write reaching the caller of a program function through its `u8[]` parameter, directly, through a field path or through an element, where that function is exported, its parameter's facts feed LLVM attributes, or a `scope()` task holds it | The foreign call records what an element store through the argument would (`noteSlotWrite`, §5): `writesThrough` for the parameter, `writesReach` for a path from it. The parameter loses `readonly`, renders without `const`, is copied back by the wasm glue, and a task race is refused | `ffi_buffer_export_written` (positive); `reject_ffi_buffer_scope_race`, `reject_ffi_buffer_scope_field_race`, `reject_ffi_buffer_scope_element_race` |
| 26 | A run of buffers sharing one count | Each buffer in the run is checked against the count, unsigned, and the proof elides only the buffer whose own length is the count (§3a) | `ffi_buffer_memcpy` (positive) |
| 27 | A count that is not the buffer's own length: a field path, an element, an aliasing local, another array, or a wrapped `u64` | Checked at run time, never proved; a wrapped count fails the unsigned compare (§3a) | `ffi_buffer_count_proved` (positive, the uncredited arms), `panics_ffi_length_wrapped` |
| 28 | An interface field of type `File`, an object of that interface built from a handle, and returned from a block (the seed accepts a class instance in an interface field today) | Refused by the type rule: an interface field is not H2 (§4d) | `reject_ffi_handle_interface_field` |
| 29 | An object literal holding a handle (`{ file: f }`, `{ f }`), or a handle passed to a builtin (`m.set(k, f)`, `JSON.stringify(f)`, `console.log(f)`) | Refused by the general rule: neither is U1 or U2 (§4d) | `reject_ffi_handle_object_literal`, `reject_ffi_handle_builtin_arg` |
| 30 | A handle class with no `[Symbol.dispose]` | Refused: D5 (§4a) | `reject_ffi_handle_no_dispose` |
| 31 | A read of the `CPtr` field in the constructor, or a closure in a method reading it | Refused by the field rule: R1 and R2 are in a method body, directly (§4a) | `reject_ffi_handle_field_position` |

## 7. Stage 9's precondition: the finding

Plan stage 9 asked whether a `std/` function that calls a `declare function`
can keep everything that the builtin it replaces has today. The candidate is
the `getenv` builtin (src/builtins.ts:924), which is `nish_getenv` in the
runtime. It is the smallest builtin whose C is one libc call, and S3 makes its
string argument expressible. Moved to `std/` over `declare function getenv`,
it loses all four properties:

1. **Its attributes.** `nish_getenv` is declared with `plain()`
   (src/runtime.ts:153, used at :503), which gives `nounwind willreturn`. A
   `std/` wrapper's foreign callee gets the worst case
   (src/attributes.ts:3386-3398). `willReturn = false` and `sharedWrite` then
   reach every caller through the fixpoint, so a program that reads one
   environment variable loses `willreturn` from `main` down.
2. **Its capability.** `getenv` is `env` (src/capabilities.ts:243). A call to
   a declared function is `ffi` (src/attributes.ts:2721). So `--deny ffi`
   would refuse every program that reads an environment variable, and
   `--emit-capabilities` would report `ffi` where it reports `env` today.
3. **Its closed-build status.** `declaresForeign` (src/visibility.ts:82)
   walks every module of the program, `std/` included, so importing the
   wrapper turns the closed build off (:100-101) for the whole program.
4. **Its oracle coverage.** `runtime/shim.mjs` cannot run a C call, so every
   program that used the wrapper would move outside the oracle
   (known-failures.txt:40-47), including the drivers in `tests/` that read
   `NISH_*` variables today.

A trusted-std mechanism could restore all four. It would be a summary that
only a `std/` module may write beside a declaration, saying "`willreturn`,
capability `env`, no closed-build cost, shim counterpart `process.env`". It
would cost:
- four overrides in four analyses (facts, capabilities, visibility and the
  oracle);
- a summary syntax that `tsc` must accept;
- a check that confines it to `std/`;
- and, above all, a channel for unchecked attributes in a compiler whose rule
  is "no attribute without a proof" (src/attributes.ts).

What it would buy is the deletion of a C function a few lines long that
already works. **It is not worth building, and stage 9 is this finding:** no
builtin moves to `std/` over `declare function` until the language has a
proof, not a promise, for one of the four. That proof is the natural trigger
for revisiting this, and none is planned.

## 8. Out of scope: what stays refused

Each of these stays refused, and each refusal is pinned by a reject case,
including the ones that have no spelling today: for those, the case pins the
diagnostic that refuses the nearest thing a program could write, so a change
that starts accepting it turns a test red. A case marked existing is a case
today. The others are planned with B1 or H1, so the refusal is tested in the
same pull request that widens the boundary next to it.

The last column is the rolling freeze for each row: whether the seed already
refuses it, or which stage adds the refusal. Nothing in the table waits on a
release, because a refusal binds `src/` from the commit that adds it (the rolling freeze, below).

| Refused | Why | Case | Rolling freeze |
| --- | --- | --- | --- |
| Raw pointers, pointer arithmetic, dereference | A `CPtr` stays opaque. `readCString` (WP27 §8e) copies in C and is the only read | `reject_ffi_pointer_arithmetic` (existing), `reject_ffi_pointer_deref` | Refused by the seed already |
| `CPtr` in an array or a generic type argument | §7a's placement rule. A handle field is the one widening (§4a) | `reject_ffi_pointer_array` (existing), `reject_ffi_pointer_type_argument` (existing), and the class-template path in `reject_ffi_handle_type_argument` (§6 row 5) | The function-template and array refusals are in the seed. The class-template refusal lands with H1.1; until the release after it, the seed accepts `new Empty<CPtr>()`, and `src/` does not write one |
| Inline asm | No TypeScript spelling, and no attribute could be proved for it | `reject_ffi_asm`: `asm("nop")`, pinning the existing unknown-name diagnostic. A `declare function asm(…)` is an ordinary C declaration of a symbol named `asm`, not an instruction, and needs no case of its own | Refused by the seed already |
| Direct syscalls that bypass libc | `syscall(2)` is variadic. A raw `svc`/`syscall` instruction is inline asm. A fixed-arity `declare function syscall(n: i64, a: i64, b: i64): i64` is accepted today (`checkForeignSignature`, src/declarations.ts:152, checks arity only), so the refusal is Q11's choice | `reject_ffi_syscall` under Q11(a); none under Q11(b) | Under Q11(a), the refusal lands with B1.1, and `src/` makes no syscall |
| User allocators | Every Nish allocation is the arena's or the runtime's, and an allocator hook would make escape analysis's facts about them unprovable | `reject_ffi_allocator`: `using a = arena(p)` with a `CPtr` argument. The builtin takes no argument, and the case pins the diagnostic that call gets today | Refused by the seed already |
| Function pointers and C callbacks | Nish has no function pointer type, and a callback would run Nish code from inside C, under facts that say C calls nothing | `reject_ffi_callback` (an arrow passed to a `declare function`) | Refused by the seed already (an arrow is not `isForeignType`) |
| Variadic C functions, spelled variadically | `declare function printf(fmt: string, ...args: i32[])`: the C variadic ABI differs from a fixed one and is not expressed by the IR `declare` | `reject_ffi_variadic` | Refused by the seed already (a rest parameter is an array, not `isForeignType`). B1.1 makes `u8[]` a foreign type, so it keeps a rest parameter refused by its form, before its type is read: `...bytes: u8[]` gets the variadic message, not a buffer's, and `reject_ffi_variadic` gains that arm |
| Variadic C functions, declared with a fixed arity | `declare function printf(fmt: string, x: i32): i32` is accepted today and calls a variadic function through a fixed-arity type, which is undefined behaviour on some ABIs (arm64 Apple passes variadic arguments on the stack). The compiler cannot tell a variadic C function from its name in general: `open` is variadic too. Q11 | `reject_ffi_syscall` covers `syscall` only, under Q11(a). The rest is a stated C contract | Not a refusal |
| A SIMD type | [WP38](wp38-simd.md) owns it. Once its first stage adds `f32x4` and its siblings, `isForeignType` (src/types.ts:88) refuses them with no new code, since they are neither scalar nor `CPtr` | `reject_ffi_simd_param`, planned with WP38's first stage, because the types do not exist in `src/` today and the case cannot be written before them | Refused by the seed as an unknown type today |
| `string[]` across the boundary | It would need an array of borrowed `char *` built per call, which is a C struct layout question (WP27 S4) | `reject_ffi_string_array_param` (WP27 §8g) | Refused by the seed already |
| C struct layout | WP27 S4 | WP27 S4's own cases | WP27's |
| `errno` | WP27 S5 | WP27 S5's own cases | WP27's |

**Q11, syscall and fixed-arity variadics, for the owner.**
- **(a) A name denylist.** `declare function syscall` is refused by name
  (`reject_ffi_syscall`), and optionally so are the variadic libc names
  (`printf`, `fprintf`, `sprintf`, `snprintf`, `scanf`, `open`, `openat`,
  `fcntl`, `ioctl`, `execl`). Its cost: a denylist is incomplete by nature,
  since a C library or a wrapper adds names the list does not know; and it
  catches `open`, S3.1's own example, whose two-argument call works on the
  ABIs Nish targets today, so the guide's `open` would need a non-variadic C
  wrapper.
- **(b) A stated risk.** Both stay accepted, and the LANGUAGE.md rule says
  that a fixed-arity declaration of a variadic C function, `syscall`
  included, is undefined behaviour the compiler cannot see, of the class of
  §3a's `fwrite`.

**Recommended:** (a) for `syscall` alone, because it is the one name whose
whole purpose is to bypass libc and whose arguments are untyped register
values; and (b) for the variadic libc functions, which a denylist would get
wrong.

### The rolling freeze

`std/` may use B1 and H1 from the commit that lands each one. `src/` may not
until the release after each lands, because the seed must accept a `u8[]`
parameter on a `declare function`, or a handle class, before the compiler's
own source writes one. CI's `bootstrap` job checks that. Nothing in `src/`
waits on either: every operating-system call the compiler makes is a builtin,
and §7 is why that stays so. The refusals each stage adds (§8's table, and
every case in §6) restrict `src/` from the commit that lands them, since a
refusal in the new compiler applies to the compiler's own source at once;
the seed lags only in still accepting them, which `src/` does not use.

## 9. Stages, tests and the bar each must clear

Each step is one pull request. Each ships, as CLAUDE.md's definition of done
requires:
- a golden `.ll`, an `llvm-as` pass, a native round trip and negative cases;
- the `docs/LANGUAGE.md` rule (under "Calling C"), the cookbook entry
  (`docs/IR_COOKBOOK.md`, "declare function: calling C") and the user-guide
  page;
- a `known-failures.txt` line for each new positive case (§5).

Cases mirror `tests/cases/ffi_pointer.ts` (positive) and
`reject_ffi_pointer_param.ts` (negative). A case that needs C helpers has a
sidecar `<case>.c` (tests/run.js:969), which is its driver.

**B1, plan stage 5: buffers.** It depends on S3.1 only for `open` in the
guide, and the cases below do not need S3.

| Step | What | Tests |
| --- | --- | --- |
| B1.1 | `u8[]` and `readonly u8[]` parameters in `checkForeignSignature`, the run-and-count rule (§3a) and the refusals, with a rest `...b: u8[]` still refused as variadic (§8); `reject_ffi_syscall` if Q11 is (a) | `reject_ffi_buffer_length_missing`, `reject_ffi_buffer_length_type`, `reject_ffi_buffer_element`, `reject_ffi_buffer_nullable`, `reject_ffi_buffer_return`, `reject_ffi_variadic`, `reject_ffi_callback`, `reject_ffi_pointer_deref`, `reject_ffi_asm`, `reject_ffi_allocator`, and `reject_ffi_syscall` under Q11(a) |
| B1.2 | Lowering: `buf->data` as `ptr` and `len` loaded after every argument (§3a), the `n <= len` check per buffer of a run and the `ffi-length` panic kind; the unsigned `icmp ule` and the narrow proof (§3a); the foreign argument facts through `noteSlotWrite`, path-aware, nothing for `readonly u8[]`, and the callee's facts entry with `captured = false` (§5); the rewritten comment at src/escape.ts:1320-1321 (§5); the wasm32 checks (§5) | `ffi_buffer_write` (golden `.ll` + native round trip: `write(1, bytes, toU64(bytes.length))` and a prefix `write(1, bytes, 3)`, with all output through `write` so that it does not interleave with `console.log`'s buffer); `ffi_buffer_read` (sidecar `ffi_buffer_read.c` whose `main` makes a pipe, fills it and calls the case's exported `run(fd)`, which `read`s into a `new Array<u8>(64)` from a function whose arena scope releases after the call and prints the bytes); `panics_ffi_length` (a count past the length: exit 1 and the message, plus the `--emit-panics` entry, `proven: false`); `panics_ffi_length_wrapped` (`toU64(0) - toU64(1)` as the count: the unsigned compare fails); the proof of `read(fd, buf, toU64(buf.length))` shown in `ffi_buffer_read.ll` as no check, and `ffi_buffer_count_proved` (§3a: the credited shape and the three uncredited ones); `ffi_buffer_late_load` (§3a, both arms); `ffi_buffer_memcpy` (a two-buffer run, a native round trip and a `panics_ffi_length` program whose source is the shorter array); `ffi_buffer_export_written` (§5: the header, `.ll` and wasm glue goldens); `reject_ffi_buffer_scope_race`, `reject_ffi_buffer_scope_field_race` and `reject_ffi_buffer_scope_element_race` (§5); in the `wasi` section, the `--target wasm32` IR check and the `--profile wasm` link of `ffi_buffer_write` |
| B1.3 | Re-derive `resizesArray = false` for a foreign callee (§3c), and rewrite the comment at src/attributes.ts:3392-3396 that asks for it | `ffi_buffer_bounds_survive` (golden `.ll`: an element loop over `buf` after `read`, whose compound-store re-check is gone, compared in the commit body against the `.ll` before B1.3) |

B1's bar is that `read` and `write` on a `u8[]` are callable with no shim.
`ffi_buffer_read` and `ffi_buffer_write` are that bar.

**H1, plan stage 6: handles.** It depends on S3.1, because `fopen` takes a
`string`.

| Step | What | Tests |
| --- | --- | --- |
| H1.1 | The handle rule as the allow-lists of §4a (D1–D5, F, R1, R2, L1, L2) and §4d (H1–H3, U1, U2, the type rule), each enforced as one positive check with one general refusal (`reject_ffi_handle_position`, `reject_ffi_handle_type_position`, `reject_ffi_handle_field_position`) rather than one check per way in; the dispose shape; the class-template check (§6 row 5); and `reject_ffi_handle_close_call` if Q9 is option A | Every new `reject_ffi_handle_*` case in §6, rows 1–19 (rows 9 and 11 are existing refusals and add none), 16a, 16b, 22 (under Q9's option A only) and 28–31; and one negative case per row of §4d's walk that no §6 row already covers (`reject_ffi_handle_walk_*`), so that each form the walk names is pinned |
| H1.2 | The emitted close as a fourth kind on `openScope`'s stack, wired into every exit path §4b lists (fall-through, `emitScopeJoins` and its `later` test, `emitScopeExit` including `orReturn()` propagation, and the tail-call suppression); per-declarator opening under Q12(a), or `reject_ffi_handle_using_exit_in_initialiser` under Q12(b) (§4e); the `ffi` offer at the `using`; the wasm32 checks (§5) | `ffi_handle_file` (golden `.ll` + native round trip: a class owning an `fopen` handle, closed by `using`, reading a file the sidecar `ffi_handle_file.c` writes first, with an early `return`, a `break` and a `continue` in a loop, an `orReturn()` that propagates out of the block, `return f.readByte()` in tail position (no `tail` marker in the golden), and two declarators (under Q12(a), the second initialiser's `orReturn()` propagating with the first open), and the sidecar counting the closes through an `fclose` wrapper it exports, so that the output shows exactly one close per open); `ffi_handle_arena` (§5); `caps_ffi_handle`; in the `wasi` section, the `--target wasm32` IR check and the `--profile wasm` link of `ffi_handle_file` |
| H1.3 | Use after close, refused | `reject_ffi_handle_use_after_close`: the binding named after its block (`let x = 0; { using f = new File(p) } f.read()`) is already a scope error; the case pins its message, and a second program reaches the object through a callee that tries to keep it, refused by row 15 |

H1's bar is a class that owns an `fopen` handle and is closed by `using`, with
use after close refused and one negative case per sibling. `ffi_handle_file`
and the §6 cases are that bar.

## 10. Decisions

All open. Each row is a recommendation for the owner. A stage that finds the
reason untrue comes back here before building anything else.

| # | Question | Options | Decided |
| --- | --- | --- | --- |
| Q1 | How a buffer's length crosses | (a) expanded into a pointer and `buf.length`; (b) a declared `u64` right after the buffer, checked at the call; (c) a declared count paired by a type-level spelling | **Open. Recommended: (b).** It writes `read(fd, buf, n)` as C does, the common call is proved, and its cost (`fwrite`'s `size * nmemb`) is an unchecked declaration like any other (§3a). |
| Q2 | Read-only against writable | (a) `readonly u8[]` / `u8[]`; (b) a `nish:unsafe` wrapper type; (c) all writable; (d) all read-only | **Open. Recommended: (a).** It reuses a type that already means "writes no element" and already maps to `const` (§3b). |
| Q3 | Bounds facts after a write | (a) re-derive `resizesArray = false` for foreign callees; (b) keep `true` | **Open. Recommended: (a), in its own step (B1.3).** No header crosses after B1, so C cannot resize (§3c). |
| Q4 | A returned count larger than the length | (a) neither, since it is an ordinary integer; (b) clamp; (c) panic | **Open. Recommended: (a).** The compiler does not know that the return is a count, and §3a's check plus the bounds checks leave no hole to close (§3d). |
| Q5 | How a handle class names its close | (a) a one-call `[Symbol.dispose]` on a declared function; (b) a decorator or a static function value; (c) a free-form dispose body; (d) a builtin `Handle<"name">` | **Open. Recommended: (a).** It is TypeScript's own protocol, and the close is a symbol the checker reads off the body (§4b). |
| Q6 | Use after close and double close through the binding | (a) refused statically, by the `using`-only placement; (b) a defined panic, `ffi-closed`, with a flag | **Open. Recommended: (a).** The placement rule makes both impossible to write through the binding, and (b) costs a check per call. A close written inside the class is Q9 (§4c). |
| Q7 | Where a handle may live | (a) the allow-list of §4d: a `using` binding, a non-exported borrowing parameter and `this`, with everything else refused by one rule; (b) anywhere, with run-time ownership | **Open. Recommended: (a).** It is §7a's rule one level up. A handle that outlives its block is a later design (§4d). |
| Q8 | Stage 9 | (a) move `getenv` to `std/` with a trusted summary; (b) the finding | **Open. Recommended: (b).** All four properties would be lost, and the mechanism that restores them is the unchecked attribute channel this compiler exists without (§7). |
| Q9 | A close of the owned field written by hand in the class | (A) refused statically for the dispose's named close function, everywhere in the class, with the field readable only as `this.f` and its uncopyable `const` locals so the rule sees every name; other closing C functions, C functions that return the pointer, and shared pointers stated as a C contract; (B) all of it a stated C contract | **Open. Recommended: (A).** It refuses the mistake a program is most likely to write for one checker rule plus §4a's two path refusals, and what it leaves is the same class of unchecked declaration as the borrow. (B) costs nothing and adds a third C contract (§4c). |
| Q10 | A buffer argument whose array a later argument resizes | (a) load `data` and `len` after every argument, and elide the check only when no later argument may resize; (b) refuse the call by the `resizesArray` fact and load at the argument's position | **Open. Recommended: (a).** C gets the block and length that exist when it runs, and no program is refused. (b) is simpler IR and a refusal phrased in callee facts (§3a). |
| Q11 | `syscall` and fixed-arity declarations of variadic C functions | (a) a name denylist, for `syscall` and optionally the variadic libc names; (b) a stated C contract | **Open. Recommended: (a) for `syscall` alone, (b) for the rest.** A denylist of libc names is incomplete and catches `open` (§8). |
| Q12 | An exit inside a later declarator's initialiser of a `using` that already opened a handle | (a) open each declarator before the next initialiser runs, as JavaScript does; (b) refuse the exit | **Open. Recommended: (a).** It is the semantics `tsc` and Node give the same source, and the leak is otherwise silent. It moves the emit order for every kind `using` opens and the goldens with multi-declarator `using`; (b) moves nothing and refuses valid programs; widened to every kind, it also closes the existing lock and scope leak, which deserves its own issue either way (§4e). |
| Q13 | Whether §4d's allow-list is too restrictive | (a) ship it as written: no handle in a constructor parameter, a closure or another module, and nothing in the constructor but field writes; (b) widen one position now, each needing its own walk against the list (most likely a cross-module import, which needs the export refusal to tell a Nish import from the ABI surface) | **Open. Recommended: (a).** It admits every program this design set out to admit, it is sound by construction because nothing off the list is admitted, and each widening is additive and can wait for a program that needs it (§4d). |

## 11. Declined

- **A length expanded from the array** (§3a, option 1). It cannot write a
  prefix read, and the motivating declaration spells its count out.
- **A run-time `closed` flag on every handle** (§4c). Placement makes it
  unnecessary.
- **A free-form `[Symbol.dispose]` body** (§4b). It would bring back the use
  after close that placement removes.
- **A trusted-std attribute channel** (§7). No builtin is worth an unchecked
  attribute.
- **Handles in `Result`, arrays or fields of other classes** (§6). Each would
  need ownership transfer, which the language does not have.
- **Generic handle classes** (§6 row 5). A type parameter adds nothing a
  handle needs and is one more path to check.
- **Refusing a call whose later argument resizes a buffer** (§3a, Q10(b)),
  in favour of loading after every argument. It is declined only if the owner
  takes Q10(a).

## 12. What a reviewer should push back on

Two rules here are assertions the compiler states and cannot check. Both
follow S3's borrow (WP27 §8i), and both are where a program that looks correct
has undefined behaviour. Two more depend on Q9 and Q11, below.

- The **buffer borrow** (§3c). Name `setvbuf` first.
- The **paired count** (§3a). Name `fwrite` first.

If the paired count is not acceptable, the fallback is Q1(a): expansion, with
no prefix reads. That makes the count impossible to get wrong, at the cost of
`read`'s most common shape.

A third is the owner's choice. Under Q9's option A, a close written by hand
through the dispose's own close function is refused, and closes through other
C functions (`freopen`, a renamed wrapper) and pointers shared between objects
stay a C contract. Under option B, all of it is. Name `freopen` first.

Fixed-arity declarations of variadic C functions (`printf(fmt, x)`) are a
fourth, whatever Q11 decides for `syscall`.

The rest of the handle rules are checked, and they are written as allow-lists
(§4a, §4d): a review that finds a form the walk does not name should find it
refused by the general rule, and if it is admitted instead, that is the bug
to report. The thing to push back on there is their reach: a handle cannot
leave the function that opens it, nor its module (Q13). If a motivating
program needs it to (a pool or a cache), it needs ownership transfer, which is
a design of its own, not a widening of §4d.

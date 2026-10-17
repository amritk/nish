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
allows: a bare call, or a call guarded by a null test. Such a class is a
*handle class*. Its instances are created only as the initialiser of a `using`
declaration, and they are bound nowhere else. The compiler emits the close at
every exit of the block.**

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
    if (this.file !== null) {
      fclose(this.file);
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
`u64`, and it is that buffer's byte count. The call lowers to
`n <= buf.length` and panics if that is false. The declaration then promises
that C touches no byte at or past `buf.data + n`. That is the same kind of
promise `free(block: CPtr)` makes about what `free` does.

```ts
declare function read(fd: i32, buf: u8[], n: u64): i64;
const got = read(0, buf, buf.length);   // proved: n is buf.length, no check emitted
const head = read(0, buf, 16);          // checked: panics `ffi-length` if buf.length < 16
```

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
   and `--emit-panics` lists it. The common call passes `buf.length`, or a
   value that a guard or loop bound already proves `<= buf.length`, and the
   bounds machinery proves those calls away exactly as it proves an `index`
   site. A failing check is a new panic kind, **`ffi-length`**, listed by
   `--emit-panics` (`panics_ffi_length`).
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
returns the new length, a `data` pointer loaded when `buf` was evaluated
points at the block the push freed, and a `len` loaded then is the old length.
Loading both last means C gets the block and the length that exist when C
runs. Pinned by `ffi_buffer_late_load` (golden `.ll` showing the `data` and
`len` loads after the call to `grow`, and a native round trip whose output is
the bytes `grow` appended).

The sibling is the proof that elides the check. `read(0, buf, buf.length)`
needs no check only if nothing evaluated after the count argument may resize
`buf`. The count is the last argument of `read` and `write`, so for them
the proof holds, but the rule is stated on the facts, not on the position:
the check is elided when the count is `buf.length` and no argument evaluated
after it calls a callee whose facts say `resizesArray`, and kept otherwise.
`ffi_buffer_late_load` pins both arms with `pwrite(fd, buf, n, off: i64)`:
`pwrite(fd, buf, buf.length, 0)` has no check, and
`pwrite(fd, buf, buf.length, shrink(buf))`, where `shrink` pops, keeps it and
panics `ffi-length` in a `panics_ffi_length` variant.

Concurrency adds nothing new here. Another task that resizes `buf` while C
runs is the data race the existing `scope()` rule refuses for an array a
task writes while its parent can reach it (`writesThroughMessage`, which a
foreign `u8[]` argument now feeds, §5).

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

### 4a. The shape

A **handle class** is a class with exactly one field of type `CPtr` or
`CPtr | null`. That field is the one widening of §7a's "no field".
- The field is `readonly`. A second `CPtr` field is refused
  (`reject_ffi_handle_two_fields`), and so is a field that is not `readonly`
  (`reject_ffi_handle_field_mutable`).
- The field is assigned once, in the constructor, from a foreign call:
  `this.file = fopen(path, "r")`. Its value is born from C inside the object,
  so the object owns it from the first instruction.
- A constructor cannot take a `CPtr` (src/declarations.ts:92 holds for
  constructors). It cannot copy one from another object either: an assignment
  from anything but a foreign call is refused (`reject_ffi_handle_field_copy`).
- A `CPtr` field is read only inside the class's own methods. It is read
  either as a direct argument to a declared function, or into a `const` local
  that is then narrowed and passed. A read from outside the class is refused
  (`reject_ffi_handle_field_read_outside`). A closure in a method that captures
  the field, or a `const` local read from it, is refused too
  (`reject_ffi_handle_field_capture`): a closure is a value that could carry
  the pointer past the method, which §7a's rule does not allow for a `CPtr`
  local either. Which declared functions the field may be passed to is §4c's
  question.
- Such a local is a `CPtr` local, and S2's placement rule already keeps it out
  of every field, element, `Result` and signature. So the pointer leaves the
  object only into a C call, and that call borrows it.

`CPtr | null` is what makes a failed `fopen` expressible without a panic in
the constructor. The class narrows the field where it is used, and the example
in §1 shows this. A non-nullable field needs a constructor that panics on
`null`. Both are allowed.

### 4b. How the class names its close function

**Decision (recommended, Q5):** a `[Symbol.dispose](): void` method whose body
has one of two shapes, and no other:
- `close(this.f);` for a `CPtr` field;
- `if (this.f !== null) { close(this.f); }` for a `CPtr | null` field.

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

**What placement proves.** The binding that `using` introduces is the only
name an instance ever has outside its own methods (§4d), and that binding goes
out of scope at the exact point where the close is emitted. So no code can
follow the emitted close and name the object. The program cannot call the
dispose method: `f[Symbol.dispose]()` is refused
(`reject_ffi_handle_dispose_call`). The emitted close runs once per exit path,
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
  (`reject_ffi_handle_close_call`). The check is local to the class, because
  the field is readable nowhere else (§4a), and closures over it are refused
  (`reject_ffi_handle_field_capture`), so the class body is every place the
  pointer can be named. Its cost and its edges:
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
    These stay a C contract, stated in the LANGUAGE.md rule like §3a's
    count: "the class's methods pass the field only to functions that use it
    and return".
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

### 4d. Where an instance may live

An instance of a handle class:
- is created only as the initialiser of a `using` declarator:
  `using f = new File(p)`. A `new` anywhere else is refused
  (`reject_ffi_handle_new_outside_using`);
- is bound only by that declarator. `const g = f`, `let g: File`, an
  assignment, and a module-level binding are all refused
  (`reject_ffi_handle_alias`, `reject_ffi_handle_module_binding`);
- may be passed as an argument to a program function whose parameter has the
  class's type. That function may not be exported
  (`reject_ffi_handle_exported_param`). Inside it, the parameter obeys the
  same rule, so it can be used and passed on but not stored, returned or
  captured. A callee therefore borrows the object for the call, just as C
  borrows a buffer, and the borrow ends before the block's close runs;
- has its methods called on it as usual.

This is the shape §7a gave `CPtr` one level up. The handle class's type may go
only where the compiler sees the whole of its lifetime. Every other way in is
refused: §6 lists each way, with its case. When the owning object would
escape, be copied, be stored in an array or be captured, the program is
refused. The object is never quietly closed early or late.

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
- **The return value.** As with an arena, the return value is computed before
  the close (src/emit.ts:1149), so `return f.readByte()` reads from an open
  file.
- **Multiple declarators.** `using a = new File(p), b = new File(q)` closes
  `b`, then `a`, as `openScope` already orders declarators.
- **The object's memory.** The object is allocated in the arena that is live
  at the `new`. It is popped from the stack before any arena opened earlier
  releases, so the close never reads freed memory.

## 5. Interactions

**src/escape.ts and the arena scopes.**
- *Buffers.* A buffer argument does not escape, exactly as S3's string does
  not and as `console.log`'s does not (src/escape.ts:552), so an array
  allocated in a released scope may be passed. It is not a read, though. A
  foreign callee gets no per-argument facts today: `addCallee`
  (src/attributes.ts:2713-2722) returns before `noteArguments` for a foreign
  callee, which was sound while no array could reach one. B1.2 adds the
  missing step. A `u8[]` argument to a declared function sets the caller's
  `PointerParamFacts` for that array to `writesThrough = true` and
  `captured = false`, as a Nish callee that writes its parameter would. A
  `readonly u8[]` argument sets neither.

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
    which refuses a task that writes an array its parent also reads. §3a's
    concurrency claim depends on it.

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

CLAUDE.md's three recurring shapes (a constructor reached by `new`, every
declarator of `using`, and `this` leaving a constructor) are rows 1 to 3.
Every row gets its own negative case. A review that finds one of them probes
the rest in the same round.

| # | Way in | What happens | Negative case |
| --- | --- | --- | --- |
| 1 | A constructor reached by `new`, outside a `using` initialiser, including `new File()` inside another class's constructor, a default parameter value, or an argument | Refused: a handle-class `new` is legal only as a `using` initialiser | `reject_ffi_handle_new_outside_using` |
| 2 | Every declarator of `using a = …, b = …` | Each declarator is checked on its own. `using a = new File(p), b = a` is refused at `b` | `reject_ffi_handle_using_second_declarator` |
| 3 | `this` leaving a constructor or method (`h.l = this`, `return this`, `xs.push(this)`) | Refused, because the target's type would have to be the handle class (a field, an element or a return, rows 6, 7 and 8) | `reject_ffi_handle_this_escapes` |
| 4 | A closure capture of the `using` binding or of a handle parameter; inside the class, a closure capture of the `CPtr` field or of a `const` local read from it | Refused, even for an arrow called at once (§4a) | `reject_ffi_handle_closure_capture`, `reject_ffi_handle_field_capture` |
| 5 | A generic type argument (`Box<File>`, `new Box<File>()`, `id<File>(f)`, `Secret<File>`), and a generic handle class (`class File<T>`) | Refused on both template paths. src/generics.ts:1248 checks function templates only, and the class-template path (src/generics.ts:993-1001) has no check today, so H1.1 adds one there for the handle rule and for `CPtr` alike. A handle class may not have type parameters | `reject_ffi_handle_type_argument` (a function and a class template each), `reject_ffi_handle_generic_class` |
| 6 | An array element (`File[]`, `[f]`) | Refused | `reject_ffi_handle_array` |
| 7 | A `Result` arm (`Result<File, E>`) | Refused. A fallible open is written with a `CPtr \| null` field (§4a) | `reject_ffi_handle_result` |
| 8 | A return from a program function or method | Refused | `reject_ffi_handle_return` |
| 9 | An `async` function: a handle parameter, or a `using` of one, in its body | Refused. A suspension point inside the block would split the close from the code that uses the handle | `reject_ffi_handle_async` |
| 10 | A `scope()` task capturing a handle | Refused. Two tasks would call the same C handle concurrently, and C handles are not thread-safe by default | `reject_ffi_handle_scope_task` |
| 11 | An inherited field | Closed by an existing rule: there is no `extends` (docs/LANGUAGE.md:1979). If inheritance arrives, this row comes back | `reject_cls_extends` (existing) |
| 12 | A field of another class whose type is the handle class, including a static field | Refused | `reject_ffi_handle_field` |
| 13 | Widening to an interface (`class File implements Closer`, then `const c: Closer = f`) | Refused: a handle class may not `implements`, so it has no other type to widen to | `reject_ffi_handle_implements` |
| 14 | A nullable handle type (`File \| null`) | Refused. Nullability lives in the field, not in the object | `reject_ffi_handle_nullable` |
| 15 | An alias, `let`, assignment or module-level binding | Refused (§4d) | `reject_ffi_handle_alias`, `reject_ffi_handle_module_binding` |
| 16 | Reading the `CPtr` field from outside the class, by member access or destructuring | Refused (§4a) | `reject_ffi_handle_field_read_outside` |
| 17 | Assigning the `CPtr` field anywhere but the constructor, or from another object's field | Refused (§4a) | `reject_ffi_handle_field_copy` |
| 18 | An explicit `f[Symbol.dispose]()` call | Refused (§4c) | `reject_ffi_handle_dispose_call` |
| 19 | An exported class, or an exported function taking one | Refused (§5) | `reject_ffi_handle_export`, `reject_ffi_handle_exported_param` |
| 20 | A buffer, through its paired count: the next parameter is missing or is not a `u64` | Refused (§3a) | `reject_ffi_buffer_length_missing`, `reject_ffi_buffer_length_type` |
| 21 | A buffer of another element type, a nullable buffer, or a returned buffer | Refused (§3b) | `reject_ffi_buffer_element`, `reject_ffi_buffer_nullable`, `reject_ffi_buffer_return` |
| 22 | A close of the owned field written by hand, in a method or the constructor, through the dispose's close function | Option A: refused. Option B: a stated C contract. The owner chooses (§4c, Q9) | `reject_ffi_handle_close_call` (option A only) |
| 23 | The owned field passed to another C function that closes, replaces or keeps it (`freopen`, `setvbuf`), or two objects owning one pointer a C getter shares | A C contract under either option, named in the LANGUAGE.md rule (§4c) | none: the compiler cannot see it |
| 24 | A buffer's `data` or `len` read at a stale moment, because a later argument resizes the array | Both are loaded after every argument is evaluated (§3a, Q10). The elided check also requires that no later argument may resize | `ffi_buffer_late_load` (positive, both arms) |
| 25 | A foreign write reaching the caller of a program function through its `u8[]` parameter, where that function is exported or its parameter's facts feed LLVM attributes | The foreign call marks the argument array `writesThrough` (§5), so the parameter loses `readonly`, renders without `const`, and is copied back by the wasm glue | `ffi_buffer_export_written` (positive) |
| 26 | A run of buffers sharing one count | Each buffer in the run is checked against the count (§3a) | `ffi_buffer_memcpy` (positive) |

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
| Variadic C functions, spelled variadically | `declare function printf(fmt: string, ...args: i32[])`: the C variadic ABI differs from a fixed one and is not expressed by the IR `declare` | `reject_ffi_variadic` | Refused by the seed already (a rest parameter is an array, not `isForeignType`) |
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
| B1.1 | `u8[]` and `readonly u8[]` parameters in `checkForeignSignature`, the run-and-count rule (§3a) and the refusals; `reject_ffi_syscall` if Q11 is (a) | `reject_ffi_buffer_length_missing`, `reject_ffi_buffer_length_type`, `reject_ffi_buffer_element`, `reject_ffi_buffer_nullable`, `reject_ffi_buffer_return`, `reject_ffi_variadic`, `reject_ffi_callback`, `reject_ffi_pointer_deref`, `reject_ffi_asm`, `reject_ffi_allocator`, and `reject_ffi_syscall` under Q11(a) |
| B1.2 | Lowering: `buf->data` as `ptr` and `len` loaded after every argument (§3a), the `n <= len` check per buffer of a run and the `ffi-length` panic kind; the foreign argument facts, `writesThrough` for `u8[]` and nothing for `readonly u8[]`, `captured = false` (§5); the wasm32 checks (§5) | `ffi_buffer_write` (golden `.ll` + native round trip: `write(1, bytes, bytes.length)` and a prefix `write(1, bytes, 3)`, with all output through `write` so that it does not interleave with `console.log`'s buffer); `ffi_buffer_read` (sidecar `ffi_buffer_read.c` whose `main` makes a pipe, fills it and calls the case's exported `run(fd)`, which `read`s into a `new Array<u8>(64)` from a function whose arena scope releases after the call and prints the bytes); `panics_ffi_length` (a count past the length: exit 1 and the message, plus the `--emit-panics` entry, `proven: false`); the proof of `read(fd, buf, buf.length)` shown in `ffi_buffer_read.ll` as no check; `ffi_buffer_late_load` (§3a, both arms); `ffi_buffer_memcpy` (a two-buffer run, a native round trip and a `panics_ffi_length` program whose source is the shorter array); `ffi_buffer_export_written` (§5: the header, `.ll` and wasm glue goldens); in the `wasi` section, the `--target wasm32` IR check and the `--profile wasm` link of `ffi_buffer_write` |
| B1.3 | Re-derive `resizesArray = false` for a foreign callee (§3c) | `ffi_buffer_bounds_survive` (golden `.ll`: an element loop over `buf` after `read`, whose compound-store re-check is gone, compared in the commit body against the `.ll` before B1.3) |

B1's bar is that `read` and `write` on a `u8[]` are callable with no shim.
`ffi_buffer_read` and `ffi_buffer_write` are that bar.

**H1, plan stage 6: handles.** It depends on S3.1, because `fopen` takes a
`string`.

| Step | What | Tests |
| --- | --- | --- |
| H1.1 | The handle-class rule: the one `CPtr` field, the dispose shape, the `using`-only placement with every sibling in §6, the class-template check (§6 row 5), and `reject_ffi_handle_close_call` if Q9 is option A | Every `reject_ffi_handle_*` case in §6, rows 1–19 and 22 (row 22 under Q9's option A only) |
| H1.2 | The emitted close as a fourth kind on `openScope`'s stack, wired into every exit path §4b lists (fall-through, `emitScopeJoins` and its `later` test, `emitScopeExit` including `orReturn()` propagation, and the tail-call suppression); the `ffi` offer at the `using`; the wasm32 checks (§5) | `ffi_handle_file` (golden `.ll` + native round trip: a class owning an `fopen` handle, closed by `using`, reading a file the sidecar `ffi_handle_file.c` writes first, with an early `return`, a `break` and a `continue` in a loop, an `orReturn()` that propagates out of the block, `return f.readByte()` in tail position (no `tail` marker in the golden), and two declarators, and the sidecar counting the closes through an `fclose` wrapper it exports, so that the output shows exactly one close per open); `ffi_handle_arena` (§5); `caps_ffi_handle`; in the `wasi` section, the `--target wasm32` IR check and the `--profile wasm` link of `ffi_handle_file` |
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
| Q7 | Where a handle may live | (a) only a `using` binding and non-exported parameters; (b) anywhere, with run-time ownership | **Open. Recommended: (a).** It is §7a's rule one level up. A handle that outlives its block is a later design (§4d). |
| Q8 | Stage 9 | (a) move `getenv` to `std/` with a trusted summary; (b) the finding | **Open. Recommended: (b).** All four properties would be lost, and the mechanism that restores them is the unchecked attribute channel this compiler exists without (§7). |
| Q9 | A close of the owned field written by hand in the class | (A) refused statically for the dispose's named close function, everywhere in the class, with other closing C functions and shared pointers stated as a C contract; (B) all of it a stated C contract | **Open. Recommended: (A).** It refuses the mistake a program is most likely to write for one checker rule, and what it leaves is the same class of unchecked declaration as the borrow. (B) costs nothing and adds a third C contract (§4c). |
| Q10 | A buffer argument whose array a later argument resizes | (a) load `data` and `len` after every argument, and elide the check only when no later argument may resize; (b) refuse the call by the `resizesArray` fact and load at the argument's position | **Open. Recommended: (a).** C gets the block and length that exist when it runs, and no program is refused. (b) is simpler IR and a refusal phrased in callee facts (§3a). |
| Q11 | `syscall` and fixed-arity declarations of variadic C functions | (a) a name denylist, for `syscall` and optionally the variadic libc names; (b) a stated C contract | **Open. Recommended: (a) for `syscall` alone, (b) for the rest.** A denylist of libc names is incomplete and catches `open` (§8). |

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

The rest of the handle rules are checked. The thing to push back on there is
their reach: a handle cannot leave the function that opens it. If a motivating
program needs it to (a pool or a cache), it needs ownership transfer, which is
a design of its own, not a widening of §4d.

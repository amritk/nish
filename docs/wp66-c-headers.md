# WP66: C libraries from their headers

**Status: S1 to S5, S7 and S8 are built; S6 is open.** The stages are in
§11 and on [its open-work issue](https://github.com/amritk/nish/issues/1996). S6 waits on the
owner (§9). [LANGUAGE.md](LANGUAGE.md#calling-c) stays normative.

Every claim about today's code is anchored at commit `1673f40e`, on `main`,
and was checked against the released 0.42.0 compiler (`build/seed`) on x86-64
Linux with clang 18.1.3. The programs this note measured are described in §4
and were not committed.

Read [WP27](wp27-ffi.md) (calling C) and [WP53](wp53-ffi-buffers-handles.md)
(buffers and handles) first. This package does not change what may cross
the C boundary; it changes who writes the declarations. Where it does need
the boundary widened, each widening is its own stage, with its own reason.

## 1. The problem

A Nish program reaches a C library through `declare function`, and every
declaration is typed by hand from the library's header. That has three
costs.

- **It is slow.** `sqlite3.h` declares 300 functions and 517 object-like
  macros. `std/sqlite.ts` binds 27 functions and copies its `SQLITE_*`
  constants by hand, one by one.
- **It is unchecked.** A declaration that disagrees with the header is not a
  diagnostic: it is undefined behaviour at the call. The guide says it
  already for buffer counts ("The count is paired by position, so it is your
  word, not the compiler's proof"); it is true of every type. A header that
  widens a parameter in its next release breaks the binding silently.
- **It pushes authors into C.** Where a declaration cannot say what the
  header says, the author writes a C adapter. The standard library's own
  SQLite binding needed one (§2.2).

The header already holds most of what a declaration says. Reading it by
machine removes the typing and the drift, and shows exactly which parts of a
library the language cannot yet reach.

## 2. What exists today

### 2.1 What a declaration can say

| C | Nish today | Rule |
| --- | --- | --- |
| `int`, `unsigned`, `long long`, `size_t`, `double`, `float`, `uint8_t`, `uint16_t`, `_Bool` | `i32`, `u32`, `i64`, `u64`, `f64`, `f32`, `u8`, `u16`, `boolean` | WP27 S1 |
| `signed char`, `short` | no type | the language has no `i8` or `i16` |
| any pointer C owns | `CPtr`, `CPtr \| null`; locals only, no field, array or arithmetic | WP27 S2 |
| `const char *` argument | `string`, borrowed for the call; `string \| null` passes `NULL` | WP27 S3.1 |
| `const char *` result | `string` or `string \| null`, copied at the call | WP27 S3.2 |
| a struct C fills | `declare class`, passed by pointer, fields in C order | WP27 S4.1 |
| a struct C owns | `readStruct` from `nish:unsafe`, a copy | WP27 S4.2 |
| `errno` | `cErrno()` from `nish:unsafe` | WP27 S5 |
| `void *buf, size_t n` | `u8[]` or `readonly u8[]` followed immediately by one `u64` | WP53 B1 |
| a resource with a close function | a handle class with one `CPtr` field, opened with `using` | WP53 H1 |
| a function pointer | refused | WP27 "Not planned" |
| `...` | refused | WP27 "Not planned" |
| `char **` | refused | WP27 "Not planned" |

Two things the table implies were checked here rather than assumed.

- **Out-pointers work through a one-field `declare class`.** `int
  sqlite3_open(const char *, sqlite3 **)` binds as
  `sqlite3_open(path: string, out: DbOut): i32`, with
  `declare class DbOut { db: CPtr | null }`. Under `nish run` it opened
  `:memory:` and the program read `out.db` back into a local. The same
  spelling serves `int *`, `sqlite3_int64 *` and every other out-parameter
  of a scalar.
- **A field-less `declare class` is accepted.** `declare class Opaque {}`
  with `declare function f(p: Opaque): i32` compiles to
  `declare i32 @f(%struct.Opaque*)`. It is meant as an empty layout, not an
  opaque type: `new Opaque()` makes a zero-byte instance, and a
  `declare function` cannot return one. §8 S3 builds on the spelling.

### 2.2 The C that the standard library's SQLite binding needed

`runtime/sqlite/nish-sqlite.c` is 359 lines. Its header comment gives the
reasons: "A Nish program cannot hold an `sqlite3 *` in a value it exports,
take an out-pointer (`sqlite3 **`) or name `SQLITE_TRANSIENT`". Read against
§2.1 at `1673f40e`:

- *Hold an `sqlite3 *` in a value it exports.* Still true. A handle class
  cannot be returned, stored or put in a `Result` (WP53, "Not planned"), so
  `openDatabase(...): Result<Database, SqliteError>` cannot carry the
  pointer, and the adapter keeps it in a table behind an `i32`. The table
  also refuses a handle used after `close`. That is a safety property worth
  keeping, but it should be a choice, not a necessity.
- *Take an out-pointer.* No longer true: the one-field `declare class`
  (§2.1) does it.
- *Name `SQLITE_TRANSIENT`.* Still true. It is `((sqlite3_destructor_type)-1)`,
  a function-pointer constant, and no declaration can pass one.

### 2.3 Linking

`nish run` and `nish --link` link the runtime and nothing else the program
names. A library of the user's (`-lz`) or a C file of their own means
running `scripts/build.sh` by hand, which passes extra arguments through to
clang. SQLite is linked because `scripts/build.sh` looks for a declared
`sqlite3_` or `nishsqlite_` symbol in the IR (its header, "SQLite: an input
.ll that declares..."). That rule is SQLite's alone. No package can say
"link zlib".

### 2.4 The ABI defect found on the way

A `declare function` taking `u8`, `u16` or `boolean` is emitted with no
`zeroext` (`declare i8 @takes_u8(i8, i16, i1)`). The C convention on x86-64
and Apple arm64 leaves the widening to the caller, and clang-compiled
callees rely on it. Against a separately built shared library, under
`--profile speed`, `widen_u8(toU8(ident(511)))` delivered 511 to C. The
report and reproduction are
[amritk/nish#1755](https://github.com/amritk/nish/issues/1755). The fix is S1
here: a generator multiplies the number of narrow parameters a program
declares.

## 3. Where a library's interface is

The interface of a C library is its header, read by a C compiler. Three
sources were considered.

| Source | Keeps | Loses |
| --- | --- | --- |
| **clang's AST of the header** (`clang -Xclang -ast-dump=json`) | every declaration, typedef chain, `const`, signedness, struct fields and their names, enum constants, nullability attributes, `variadic`, the file each declaration came from | macros, which the preprocessor has already expanded |
| **clang's macro table** (`clang -dM -E`) | every macro and its text | types; which macros are constants |
| **LLVM IR of the compiled library** | the functions one translation unit defines or calls | signedness (`int` and `unsigned` are both `i32`), `const`, pointee types (LLVM 18's pointers are opaque, so `sqlite3 *` and `sqlite3_stmt *` are one type), field names, enum names, every macro, and every function the unit neither defines nor calls |

IR is the implementation, not the interface: it needs the library's source
compiled, and it has erased exactly what tells a borrowed string from a
writable buffer. The design reads the AST, and evaluates macros by asking
clang (§4.3).

clang is already a requirement: `--link`, `nish run` and `scripts/build.sh`
all need it (`docs/INSTALL.md`). A generator that runs clang adds no tool.

## 4. Measured

A prototype was written in Node (about 100 lines) and run against four
headers. Its mapping is §6's, simplified. "Exact" means every parameter and
the result has a precise Nish type. "Via `CPtr`" means it binds, but some
pointer was typed `CPtr` where a better type exists (a `declare class`, a
buffer, an out-parameter), so a person or an override (§7) should look.
"Not expressible" means today's language cannot declare it.

### 4.1 Functions

| Header | Version | Functions | Exact | Via `CPtr` | Not expressible | Of those: callback / variadic |
| --- | --- | --- | --- | --- | --- | --- |
| `sqlite3.h` (vendored, `runtime/sqlite/`) | 3.54.1 | 300 | 44 | 202 | 54 | 46 / 8 |
| `zlib.h` | 1.3 | 81 | 11 | 68 | 2 | 1 / 1 |
| `png.h` | 1.6.43 | 246 | 1 | 230 | 15 | 15 / 0 |
| `openssl/sha.h` | 3.0.13 | 23 | 0 | 23 | 0 | 0 / 0 |

Across the 300 functions of `sqlite3.h`, the parameters the prototype
recognised by shape were: 90 `const char *` arguments (a `string`); 27
`T **` out-parameters and 17 scalar out-parameters (a one-field
`declare class` each, §2.1); and 60 pointer arguments followed by an integer
that looks like their count. Of those 60, the ones whose count is not a
`size_t` immediately after the buffer do not fit WP53's rule (§8 S5).
`zlib.h` has 27 such pairs, and its counts are mostly `uInt` (32 bits).

The heuristics are the prototype's, not a specification; the figures show
the order of magnitude, not a verdict on any one function.

### 4.2 Structs

| Header | Complete structs | Fit a `declare class` | Why the rest do not |
| --- | --- | --- | --- |
| `sqlite3.h` | 20 | 19 | a fixed-size array field |
| `zlib.h` | 3 | 3 | — |
| `png.h` | 10 | 8 | fixed-size array fields |
| `openssl/sha.h` | 3 | 0 | fixed-size array fields, a union |

A function-pointer field is counted as fitting, as a `CPtr | null` that the
program leaves `NULL` or copies from C. 13 of `sqlite3.h`'s structs have
one: they are its VFS, virtual-table module and configuration method tables.

### 4.3 Constants

Each object-like macro whose name does not start with `_` was written into
a scratch C file as `enum : long long { __m_NAME = (long long)(NAME) };`.
Lines clang rejected were dropped and the file reparsed until it was clean,
and the values were read from the AST. The counts include macros from the
headers each header includes.

| Header | Object-like macros | Plain integer literals | Evaluate to an integer with clang |
| --- | --- | --- | --- |
| `sqlite3.h` | 517 | 423 | 510 |
| `zlib.h` | 117 | 74 | 111 |
| `png.h` | 344 | 255 | 324 |

Letting clang evaluate a macro takes `SQLITE_IOERR_READ`,
`(SQLITE_IOERR | (1<<8))`, from text to `266` with no expression parser of
our own.

### 4.4 What a header cannot say

A header's types do not say:

- who owns a returned `char *` (`sqlite3_mprintf`'s is the caller's to
  `sqlite3_free`; `sqlite3_errmsg`'s is not);
- whether a pointer may be `NULL`, unless the header writes `_Nullable` or
  `__attribute__((nonnull))`;
- which integer counts which buffer;
- that `deflateInit(strm, level)`, which the header also prototypes, is defined as a function-like macro over
  `deflateInit_(strm, level, ZLIB_VERSION, (int)sizeof(z_stream))`. That is
  zlib's documented entry point, and the AST has no trace of it.

So a generator does the mechanical part with defaults that are never
unsafe, and a small override file says the rest (§7).

## 5. The decision

**A generator, `nish c-import`, reads a C header through clang and writes
an ordinary Nish module: `declare function`s, `declare class`es and
`export const`s. The module is checked in and reviewed like any other
source. It is regenerated, never edited.**

```console
$ nish c-import /usr/include/zlib.h --overrides zlib.c-import.json -o src/zlib.ts
```

It is a writer of source rather than a compile-time import, for these
reasons.

1. **Nish source is TypeScript.** `tsc`, editors, Biome and
   `npm run check` read the generated file as they read any other. An
   `import ... from "c:zlib.h"` would be a module none of them can resolve.
2. **The build stays a function of the source.** A compile-time import
   makes the output depend on the headers installed on the machine that
   builds, so two machines with the same checkout could build different
   programs. A checked-in file pins what was reviewed.
3. **The checker does not start processes.** A compile-time import would
   run clang during type checking, and key `nish run`'s cache on header
   contents, include paths and the clang version.
4. **A reviewer sees the boundary.** The capability report already names
   `ffi`. The generated file shows which functions a package reaches, in a
   diff.

The cost is that a generated file is per target (§6.1). That is the one
argument for a compile-time import, and it is recorded as the open question
S6, to be decided once S2 has been used.

## 6. The mapping

### 6.1 Integers come from the target, not the spelling

Every typedef is followed to its canonical C type, and that type's width on
the generation target picks the Nish type. `long` is `i64` on x86-64 Linux
and macOS, but `i32` on Windows (LLP64) and on wasm32. The generator takes
`--target` as the compiler does, passes it to clang, and records the triple
in the generated file's header comment. A file generated for one data model
is refused by a build for another (D3).

| Canonical C type | Nish |
| --- | --- |
| `_Bool` | `boolean` |
| `unsigned char`, `uint8_t` | `u8` |
| plain `char` as a value | `u8` where the target's `char` is unsigned (AArch64 Linux); refused where it is signed (x86-64), as `signed char` is |
| `unsigned short` | `u16` |
| `int`, `unsigned int` | `i32`, `u32` |
| `long long`, `unsigned long long` | `i64`, `u64` |
| `long`, `unsigned long` | by the target's data model |
| `float`, `double` | `f32`, `f64` |
| `enum E` | its underlying integer type, usually `i32`, with each enumerator an `export const` |
| `signed char`, `short` | refused: no Nish type (D4) |
| `long double`, `_Complex`, `__int128` | refused |

### 6.2 Pointers

| C | Default | With an override (§7) |
| --- | --- | --- |
| `const char *` argument | `string` (borrowed) | `string \| null` when `nullable` or `_Nullable` |
| `char *` argument | `CPtr` | `buffer` (a `u8[]`) |
| `const char *` result | `string \| null` (copied) | `string` when `nonnull`; `CPtr \| null` when `owned` |
| `char *` result | `CPtr \| null` | `owned: <free function>` |
| `const void *`, `const unsigned char *` argument | `CPtr \| null` | `buffer: <count param>` gives `readonly u8[]` |
| `void *`, `unsigned char *` argument | `CPtr \| null` | `buffer: <count param>` gives `u8[]` |
| `T *` to a scalar | a one-field out class (§6.3) | `in` passes a value; `inout` |
| `T **` to a pointer | a one-field out class holding `CPtr \| null` | — |
| `struct S *`, `S` complete and fits | the `declare class S` | — |
| `struct S *`, `S` opaque | `CPtr` (after S3, the opaque class `S`) | — |
| any other result pointer | `CPtr \| null` | `nonnull` gives `CPtr` |

The defaults never claim more than the header says. A result is nullable
unless the header or an override says otherwise, so the program narrows it
before use. An argument is `CPtr`, so the program must have a pointer from
C to pass. A wrong default costs a `!== null` or an override, never a
wrong call.

### 6.3 Out-parameters

A scalar out-parameter becomes a one-field `declare class`, named for its
type and shared across the file:

```ts
declare class OutI32 { value: i32 }
declare class OutPtr { value: CPtr | null }
declare function sqlite3_open(filename: string, ppDb: OutPtr): i32
```

### 6.4 Structs

A complete struct becomes a `declare class` with the same field names, in
order. A function-pointer field becomes `CPtr | null`. A struct that cannot
be one (a bitfield, a union, a fixed-size array field until S4) is left out.
Each function that names it is reported as using the struct by pointer, and
is bound with `CPtr`.

### 6.5 Constants

An object-like macro that clang evaluates to an integer (§4.3) becomes
`export const NAME: <type> = <value>`. The type is `i32` when the value
fits, `i64` otherwise, and the macro's own type when it casts to one
(`(uLong)0`). A string macro becomes an `export const` string. Anything else
is listed in the report and left out.

### 6.6 What is refused, and said so

The generator never fails silently. A function it cannot bind is left out
of the module and listed in a block comment at the end, with the reason, in
the order of the header:

```ts
/* Not bound:
 *   inflateBack: parameter `in` is a function pointer (WP66 S6)
 *   gzprintf: variadic
 *   deflateInit: a function-like macro; bind deflateInit_ and pass ZLIB_VERSION
 */
```

So a reader learns from the file what the library offers that the binding
does not, and S5–S6 have a measurable backlog.

## 7. The override file

An override names what a header cannot say (§4.4). It is JSON, beside the
generated module, and it is the only hand-written input:

```json
{
  "header": "zlib.h",
  "allow": ["compress*", "uncompress*", "crc32", "adler32", "zlibVersion"],
  "functions": {
    "compress2": {
      "dest": { "buffer": "destLen" },
      "source": { "buffer": "sourceLen", "readonly": true }
    },
    "zlibVersion": { "return": "nonnull" }
  }
}
```

- `allow` is a list of name globs. Without it every function in the
  header's own file is bound, and none from the files it includes.
- A role names a parameter by its C name, so an override survives a header
  that reorders parameters. A name that is not in the header is an error,
  not a no-op, so an override cannot rot quietly.
- `"return": { "owned": "<free function>" }` types a result the caller
  frees as `CPtr | null` and names the function that frees it, as for
  `sqlite3_str_finish` and `sqlite3_free`. With S3 the generator can wrap
  such a result in a handle class.
- `_Nullable`, `_Nonnull` and `__attribute__((nonnull))` in the header are
  read as if an override said them.

An override never reaches past the header: it narrows a default or names a
pairing; it cannot declare a function or a type the header lacks.

## 8. What the language needs, in order of what it unlocks

### S1: `zeroext` on narrow foreign parameters

[amritk/nish#1755](https://github.com/amritk/nish/issues/1755). A
prerequisite: a generated file declares far more narrow parameters than a
hand-written one does. No new surface.

### S2: the generator, against today's language

§5–§7, and nothing else. The output uses only what §2.1 lists. Acceptance:

- every function in §4.1's table is either bound or listed with its reason;
- the module generated from the vendored `sqlite3.h` compiles, and a round
  trip opens a database through `sqlite3_open` with an out class;
- the generated module for a fixed set of test headers under `tests/` is a
  golden, regenerated with `--update` like the others.

### S3: opaque types

Today every C pointer is one `CPtr`, so passing a statement where a
connection is wanted type-checks. A field-less `declare class` (§2.1)
becomes an **opaque** class: it cannot be built with `new`, a
`declare function` may return it (as `S` or `S | null`), and a local may
hold it, under exactly `CPtr`'s placement rule (WP27 §7b). It is lowered as
`CPtr` is. The generator then emits one per opaque struct in the header.

This changes the meaning of a spelling that compiles today, though nothing
in the repository or the guide uses it. That is D5.

### S4: fixed-size array fields

A fixed-length array field in a `declare class` (the spelling is S4's to
choose), read and written by index and laid out inline as C lays out
`unsigned h[5]`. That unlocks `SHA_CTX`,
`struct dirent`'s `d_name` and §4.2's other refusals. A union stays refused.

### S5: buffers paired by name, with any count width

WP53 pairs a buffer with the `u64` that follows it. A header pairs them by
documentation, often with a 32-bit count (`zlib.h`'s `uInt len`) or a
pointer to the count (`compress`'s `uLongf *destLen`). S5 lets a declaration
name its count parameter, of any unsigned width or as an out class's
field, and keeps the check WP53 makes: the count is compared with the
buffer's length before C runs, and proved away where it is the buffer's
own length.

### S6: callbacks (open question)

46 of `sqlite3.h`'s functions and 15 of `png.h`'s take a function pointer.
A WP51 function reference is an `i32` tag, not an address, and WP51 refuses
to let one cross the C ABI. So a callback is a separate construct:

- the argument is a top-level function named at the call, as a `spawn`
  task is, never a reference held in a variable;
- it is lowered to the address of a C-ABI entry for that function, of the
  kind `--emit-header` already writes for an export;
- that function is analysed as an export is: C may call it from anywhere,
  so it gets no fact the fixpoint cannot prove for an unknown caller;
- what it may not do is the open part. Whether C may call it on another
  thread, after the call that registered it has returned, or with a panic
  unwinding through C's frames, each decides what the arena, `--threads`
  and `--deny-panics` must do around it.

A `void *` user-data argument stays a `CPtr`. With S3, the program can put
an opaque handle of its own there. `SQLITE_TRANSIENT` (§2.2), a
function-pointer constant, is the same question in miniature.

### S7: linking a library from a package

A package says what it links, in its `package.json`:

```json
{ "nish": { "link": { "libraries": ["z"], "sources": ["c/shim.c"] } } }
```

`nish run` and `--link` pass `-l` and compile the sources beside the
runtime. SQLite's symbol-prefix rule (§2.3) becomes one entry of this
mechanism. Whether to read `pkg-config` is part of D6.

### Not planned here

Variadic functions (8 in `sqlite3.h`, 1 in `zlib.h`), function-like macros,
unions, bitfields, `long double`, C++ headers, and a compile-time
`import` unless S6's question is answered for it.

## 9. Decisions for the owner

- **D1, the name.** `nish c-import`, beside WP62's proposed `nish schema`.
  The alternative, `nish bindgen`, borrows a Rust name.
- **D2, where the generator lives.** As a `nish` subcommand it is in `src/`,
  written in Nish under the rolling freeze, and reads clang's JSON with
  `std/json`. The AST of `sqlite3.h` is about 1 MB; one that includes
  `<stdio.h>` is larger, and S2 measures it. Starting as a Node script in
  `scripts/` would be faster to write but is not a feature users get.
  **Recommended:** `src/`, because the users are the point.
- **D3, one file per target, or one file per data model.** The integer
  table (§6.1) differs only between LP64, LLP64 and ILP32. **Recommended:**
  the generated header comment records the data model, and a build whose
  target has another refuses the module with a diagnostic naming the
  regeneration command.
- **D4, `i8` and `i16`.** `signed char` and `short` appear in real headers.
  Adding the two types is a language change well beyond FFI. Until then
  those functions are listed as not bound.
- **D5, S3's spelling.** Reusing the field-less `declare class` costs nothing
  in the repository but changes a compiling program's meaning. The
  alternative is a new marker on the class.
- **D6, what linking may run.** A library name only adds `-l`. A C source
  is code the build compiles, and `pkg-config` is a program it runs (§10).
- **D7, the standard library.** Whether `std/sqlite.ts` is regenerated from
  the vendored header with S2, keeping the adapter only for what S3 and S6
  have not yet replaced. That would be S2's best test.

## 10. Security

- **The generator reads package-controlled input and runs clang on it.**
  clang preprocesses the header, which may `#include` any file the user can
  read, and its JSON output is parsed by the generator. Nothing generated
  runs at generation time. Because the subcommand reads another process's
  output, S2 lands with its `docs/security/` record and index row in the same
  pull request.
- **The generated module is source the user reviews.** It reaches C only
  through `declare function`, so it carries the `ffi` capability, and
  `--deny ffi` and a dependency's grant (WP40) apply to it unchanged.
- **Linking is a grant (S7).** A package that names C sources asks the build
  to compile code the Nish compiler cannot see; a `pkg-config` name asks it
  to run a program. Under the rule for code that decides what a package may
  grant, S7 treats every key it does not know as a grant, and asks the root
  package before a dependency's `link` takes effect.
- **A wrong override is a wrong declaration.** `buffer` and `owned` are the
  author's word, as a hand-written count is today (WP53). The generator
  checks that the parameters exist and that a buffer is a pointer and its
  count an integer; it cannot check the library's behaviour.

## 11. Stages

| | Deliverable | Depends on |
| --- | --- | --- |
| S1 | `zeroext` on `u8`, `u16` and `boolean` foreign parameters and results ([#1755](https://github.com/amritk/nish/issues/1755)) | — |
| S2 | `nish c-import`: functions, structs, out classes, constants, the override file, the not-bound report | S1 |
| S3 | opaque classes | S2 (to measure), D5 |
| S4 | fixed-size array fields in a `declare class` | — |
| S5 | buffers paired by name, any unsigned count width | — |
| S6 | callbacks *(open question)* | S3 |
| S7 | a package links a library or its own C | D6 |
| S8 | `nish c-import` writes S3's opaque classes, S4's array fields and S5's named buffer pairs *(done)* | S2, S3, S4, S5 |

S3, S4, S5 and S7 do not depend on one another. Each one that lands
re-runs §4's four headers and records how many functions moved from "via
`CPtr`" or "not expressible" to "exact".

### 11.1 S8, measured

S3, S4 and S5 changed the language; S8 is the stage where the generator
writes them, so its re-run is the one that moves §4's figures. Each column
is a count in the module `nish c-import` writes for the header, before S8
→ after it. "Exact" is a `declare function` with no `CPtr` in it, "via
`CPtr`" one with at least one, and "not bound" a function the module's
not-bound list names; the three count only functions declared in the
header itself. "Classes" counts every `declare class` but the out classes;
"struct lines" counts the not-bound list's `struct` and `union` entries,
which after S8 also name each struct that stays a `CPtr` and why.

| Header | Exact | Via `CPtr` | Not bound | Classes | Of those: opaque / with an array field | Struct lines |
| --- | --- | --- | --- | --- | --- | --- |
| `sqlite3.h` (vendored, `runtime/sqlite/`) | 52 → 72 | 190 → 170 | 58 → 58 | 22 → 26 | 0 → 3 / 0 → 1 | 1 → 5 |
| `zlib.h` 1.3 | 57 → 57 | 21 → 21 | 3 → 3 | 3 → 3 | 0 → 0 / 0 → 0 | 0 → 1 |
| `png.h` 1.6.43 | 6 → 6 | 222 → 222 | 18 → 18 | 8 → 9 | 0 → 0 / 0 → 1 | 2 → 3 |
| `openssl/sha.h` 3.0.13 | 0 → 3 | 23 → 20 | 0 → 0 | 0 → 2 | 0 → 0 / 0 → 2 | 3 → 1 |

What moved, and what did not:

- `sqlite3.h`: `sqlite3_mutex`, `sqlite3_str` and `sqlite3_backup` became
  opaque classes, and `sqlite3_snapshot` a class with an array field; the
  20 functions that take or return only those, and no other pointer,
  moved to exact. `sqlite3`,
  `sqlite3_stmt`, `sqlite3_value` and `sqlite3_blob` stay `CPtr`: each is
  handed out through a `T **` out-parameter, which only a `CPtr` can stand
  for. `sqlite3_context` stays `CPtr` because no function returns one.
- `openssl/sha.h`: `SHA_CTX` and `SHA256_CTX` are classes with array
  fields, so `SHA1_Init`, `SHA224_Init` and `SHA256_Init` are exact; the
  rest still take a `const void *` or `unsigned char *` as `CPtr`.
  `SHA512_CTX` holds an unnamed union, which stays refused.
- `png.h`: `png_unknown_chunk_t` gained its class; `png_image`'s array is
  of plain `char`, signed on this target, which has no Nish type. libpng's
  handles come through `T **` too, so no function moved.
- `zlib.h`: unchanged. Its one incomplete struct, `internal_state`, is
  pointed to by a field of `z_stream`, and a field holds only a `CPtr`.
- No module uses `CountedBy`: a header names no count clang 18 reports on
  a parameter, so a named pair comes only from an override file, and these
  runs pass none.

Before is `main` at 1d6311f8, after is this branch at b28937b3, each built
with `bash scripts/bootstrap.sh -o build/<name> --stages 1`. Each module was
written with
`build/<name> c-import <header> --target x86_64-unknown-linux-gnu -o <name>.ts`,
`<header>` being `runtime/sqlite/sqlite3.h`, `/usr/include/zlib.h`,
`/usr/include/png.h` and `/usr/include/openssl/sha.h`, and counted against
the functions clang's JSON AST lists for the same header. The three system
headers are Ubuntu 24.04's packages in the cloud container the run used:
`zlib1g-dev` 1.3.dfsg-3.1ubuntu2.3, `libpng-dev` 1.6.43-5ubuntu0.7 and
`libssl-dev` 3.0.13-0ubuntu3.16; a machine without them cannot repeat those
three rows. The "before" figures differ from §4.1's (52 exact `sqlite3.h`
functions here, 44 there) because §4.1 counts with the Node prototype's
simplified mapping, not with `nish c-import`.

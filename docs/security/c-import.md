# Security record: `nish c-import`

The record of `nish c-import` (issue #1793, stage S2): the subcommand that
runs clang on a C header, reads clang's JSON AST and macro answers, applies an
overrides file, and writes a Nish module of `declare` functions, `declare`
classes, out classes and `export const`s. It says what the command trusts,
what an attacker who wrote the header, the overrides file or a path on the
command line can do with it, and the test that pins each property. It is
written with the code, at base commit `4199a3a6`, rather than after an audit.
It names functions rather than lines, so it holds at any commit that has them.

**Result.** clang is started from an argument vector, never through a shell,
and only to preprocess (`-E -dD`) or to check and dump the AST
(`-fsyntax-only`), so nothing in the header is compiled to an object or run,
and neither is the module: the command writes it and exits. clang's output is read up to
16 MiB per run, and its JSON up to 64 levels deep and 4,194,304 values; past
either the import is refused with exit 1 and nothing is written. Every path the
command is given is refused when it holds a double or single quote, a
backslash, `/*`, `*/` or a byte that is not printable ASCII, since the probe
names the header in an `#include "..."` line and the module names every path
in a `//` comment. What the header puts into
the module goes through one check as it is written (`emittable`): a name must be
an ASCII identifier (`[A-Za-z_][A-Za-z0-9_]*`), a number a decimal integer
clang computed, a string macro one literal of printable ASCII with no quote or
backslash inside it, and a comment line printable ASCII. A declaration that
fails the check is listed as not bound, and if a string reaches the writer
unchecked anyway the import is refused and nothing is written. An override is
trusted to describe the library: one that names nothing in the header, or
changes nothing, is refused, but a hostile overrides file can still make a
binding wrong (CI-A4). A module written for one data model is refused by a
build for the other (NL3062).

Eight findings were fixed while the code was written or reviewed (CI-5, CI-6 and CI-7,
Medium; CI-1, CI-2, CI-3, CI-8 and CI-9, Low); one is open, accepted (CI-4, Low). Four more
properties of the threat model, each Low, are recorded as accepted under
[Accepted limits](#accepted-limits) (CI-A1 to CI-A4) and are not counted in
the index row.

## Scope

| File | Functions |
| --- | --- |
| `src/c-import.ts` | `cImport`, `parseArgs`, `unsafePath`, `importCompiler`, `runClang`, `readCapped`, `scratchBeside`, and the `Importer` methods `clang`, `parse`, `dumpAst`, `readHeader`, `readTypedef`, `readRecord`, `readEnum`, `readFunction`, `attrWhy`, `typeWhy`, `resolve`, `enumType`, `readMacros`, `readDefine`, `probeText`, `probePath`, `probeArgs`, `probeMacros`, `probeBatch`, `readProbe`, `readOverrides`, `readAllow`, `readFunctionOverrides`, `readReturnOverride`, `readParamOverride`, `isCountType`, `countOf`, `isNamedCount`, `selected`, `refuseDuplicate`, `functionDecl`, `whyNotClass`, `fieldType`, `arrayField`, `decideOpaque`, `keepCPtr`, `pointee`, `claimConst`, `decideNames`, `checkOverride`, `whyNotDeclared`, `shellWord`, `word` and `emit`, and the functions `arrayType`, `firstDeclarator`, `closingParen`, `emittable`, `isIdent`, `isPrintable` and `reportLine` |
| `src/c-import-json.ts` | `CJson`, the JSON reader the AST, the macro probe's AST and the overrides file go through, with its depth and value limits |
| `src/c-import-model.ts` | `dataModelOf`, `dataModelRefusal` |
| `src/compilation.ts` | the call into `dataModelRefusal` that raises NL3062 |

Read but not owned: the spawn the CLI shares with `nish build` (recorded in
[`cli.md`](cli.md)).

## Threat model

The attacker may control:

- **The header**, and every header it includes: a library's header pulled
  from a package or a vendored tree, imported without being read first.
- **The overrides file**, which ships beside the header.
- **A path on the command line**: the header, the overrides file, or `-o`,
  as a build script in someone else's repository spells them.

Out of scope: a header that declares a function with another prototype than
the library it links against, which a hand-written `declare function` gets as
wrong; the C library itself, which the module only names; and a user who sets
`CC`, which is this user choosing their compiler, as `nish build` lets them.

## What is defended

### Nothing in the header runs

`runClang` starts clang through `spawnSyncTo` with an argument vector:
`$CC` (else `clang`), then fixed flags, `--target=<triple>`, `-x c`, and the
header's absolute path or the probe's. No shell reads it, so no path or flag
can add a command. The probe and clang's two output streams are files in a
directory `scratchBeside` makes beside the module with mode 0700; `mkdir`
refuses a name already taken, so a symbolic link planted there is never
followed, and the directory is removed before the command exits. clang runs
four ways, none of which produces an object: `-Xclang -ast-dump=json
-fsyntax-only` over the header (its declarations), `-E -dD` over the header
(the preprocessed text with its `#define` lines, for the list of macros),
`-fsyntax-only` over the probe (which of its lines clang refuses), and
`-Xclang -ast-dump=json -fsyntax-only` over the probe (the values). Each path follows a
`--`, so a path that begins with `-` is not read as a flag. The macro probe (`probeText`) writes, for each object-like
macro, one `enum` line that names the macro and asks clang for its value, its
kind, its size and its sign; the macro's own text is never copied into the
probe, and the names in it are C identifiers `readDefine` read. The module is
written with `writeFileSync` and never built by the command.

A clang that cannot start is exit 3, and a header clang refuses is exit 1 with
clang's errors; neither writes the module.

Tests: `c-import: a CC that cannot run exits 3, the toolchain status`,
`c-import: a header clang refuses exits 1 with clang's errors`,
`c-import: the scratch directory beside the module is removed after a written and a refused import`,
``c-import: `basic.h -o no-such-dir/out.ts` exits 1 with "c-import: cannot create a scratch directory beside"``.

### A header too large or too deep to read

`clang` refuses a run either of whose streams passes 16 MiB, which
`readCapped` checks from the file's size before it reads the file, and `parse` refuses JSON more than 64 levels deep or of more than
4,194,304 values (`CJson.parse`, `CJ_MAX_DEPTH` and `CJ_MAX_VALUES`). For scale, under clang 18.1.3 the AST of the
vendored `sqlite3.h` is 1,014,247 bytes, 22 levels and 32,176 values, and
zlib's `zlib.h` is 1.9 MB and 45 levels; the probe's AST is about 37 KB per
macro, so macros are asked 64 at a time (`PROBE_BATCH`). Following a typedef
always ends: a typedef declared again is the type it already names, so
`readTypedef` keeps the first, and each one names only typedefs declared
before it (CI-1).

Tests: `c-import: a header whose AST is more than 16 MiB is refused` (sixty
thousand enumerators), `c-import: a header whose AST is deeper than 64 levels is refused`
(forty nested parentheses), and `c-import: every tests/c-import header writes its golden module`
(`basic.h`'s `typedef i64t i64t;` binds `f6` as `i64`).

### A path that escapes its line

`cImport` refuses, before clang runs, a header (as given and as resolved),
overrides or output path that holds `"`, `'`, `\`, `/*`, `*/` or a byte
outside 0x20 to 0x7e, which takes in U+2028, U+2029 and every other
non-ASCII character (`unsafePath`): the header's path sits inside the probe's
`#include "..."`, and all three are named in the module's first `//` lines,
which a line break would end (CI-2). The `Regenerate:` line is a command a
reader may paste into a shell, so `shellWord` puts a path holding anything
outside `[0-9A-Za-z+,-./:=@_]` (a space, `$`, `;`) in single quotes, which the
refusal of `'` keeps closed. An output path that resolves to the header itself
is refused, so the command cannot overwrite the header it reads.

Tests: `c-import: a header whose path holds a quote is refused before clang runs`,
`c-import: ${what} is refused before clang runs, and nothing is written` (an
output name with a newline, an output name with U+2028, an overrides path with
a newline), `c-import: a header path with a space is quoted in the Regenerate line`,
`c-import: -o naming the header itself is refused, and the header is kept`.

### What the header can write into the module

clang accepts more in a name than Nish should copy: `$` and, since C23 and
as an extension before it, any Unicode letter, so a name can hold a Cyrillic
letter that looks like a Latin one or a bidirectional control. Every string
taken from the header, the overrides or the command line is therefore
written through one method, `Importer.word`,
which calls `emittable` with what the string is: an identifier
(`[A-Za-z_][A-Za-z0-9_]*`), a decimal integer, a string literal's body
(printable ASCII, no `"` or `\`) or a comment line (printable ASCII). The
declaration is checked with the same function before it is chosen, so one
whose function, parameter, struct, field, enum constant or macro name is not
an ASCII identifier is listed as not bound (`its name is not an ASCII
identifier`), and a not-bound line whose name is not printable ASCII names it
as `a declaration whose name is not printable ASCII` (CI-6). If a string
fails `word` anyway, the import exits 1 and writes nothing. A parameter whose name is a Nish reserved word gets a
trailing `_`. Any other name Nish reserves (a keyword, `eval`, `arguments`, a
built-in type such as `Array` or `u32`, an out class name such as `OutI64`)
is not written: the function, the struct (or the struct holding the field), the enum constant or the macro is
listed as not bound, naming the reason. Two declarations that want one name
are settled in a fixed order (functions, then out classes, then structs, then
enum constants, then macros, `claimConst`); the later one is listed, so the
module never declares a name twice. Numbers are the values clang computed, written as decimal
literals of the declared width. A string macro is written only when its body
is one literal of printable ASCII, with quotes only at its ends and no
backslash, so it cannot close the Nish string it is copied into or carry a
bidirectional control into it; any other string, an escape, two pieces or a
byte outside 0x20 to 0x7e, is listed as `a string the generator does not copy
(escapes, pieces, or bytes that are not printable ASCII)` (CI-7). An integer
macro is written only when clang gives it a size of 1, 2, 4 or 8 bytes; an
`__int128` is listed. An enum constant gets the Nish scalar of its enum's C
type (the same decision the enum's own type uses), not one chosen from its
value.
The not-bound comment is fixed text and names: no reason quotes clang's
spelling of a type, which carries an attribute's string argument verbatim
(CI-5), and `reportLine` writes any report line holding `*/`, `/*` or a byte
that is not printable ASCII as its name and a fixed reason. A function from a header the
first one includes is bound only when the overrides file's `allow` names it
(`selected`). `allow` selects functions only: structs, enums and macros come
from the header itself whether or not `allow` is given.

Three spellings carry more of the header into the module, each through the
same `word` check. A struct the header only names becomes `declare class X {}`
(`decideOpaque`) under the name the struct's class would have had, so it is
claimed in the same order as any class (`claimConst`) and a name another
declaration takes leaves it a `CPtr` with the reason listed; each such struct
gets its own class, so two C types never share one. An array field's length
is the decimal clang wrote in the field's type (`arrayType` reads `T [N]` and
nothing else; a length that is not plain digits, a flexible member, a zero
length and an array of arrays are listed); the last index, the length less
one, is written through `word` as an integer (`arrayField`), and its element is one of `i32`, `i64`, `u8`, `u16`, `u32`, `u64`,
`f32` or `f64`, which a `declare class` lays out inline at C's size and
alignment for an element of that type; any other element, and an element type
with its own `aligned` attribute, leaves the struct listed. In a
`CountedBy<u8[], "n">` the overrides file picks which parameter is the count
(`readParamOverride` finds it among the function's parameters); the name
written is that parameter's name from the header, after the same renaming as
any parameter (`nishName`; an unnamed one is `argN`, N its position from 0,
or `argN_K` while another parameter already holds that name, in
`uniqueArgNames`), and goes through `word` as an identifier.

clang's `_Nonnull` and `_Nullable` are read on a parameter's or result's
outermost pointer only, and `returns_nonnull` (`ReturnsNonNullAttr`) on a
result. The `nonnull` function attribute (`NonNullAttr`) is not read: clang's
JSON AST names the attribute but not the parameter indices it covers, so
honouring it would mean guessing; a parameter it covers is bound as the
defaults say: `string` for a `const char *`, the struct's class or `CPtr` for
a struct pointer, both non-null, so the caller cannot pass `NULL` there even
where the library accepts it; `CPtr | null` for a `void *`, an `unsigned char
*` or a `const` pointer to a number; and an out class for a pointer to a
number the function writes. `"nullable": true` in the overrides file adds the
`| null` to a `const char *` or a struct pointer; `paramType` never adds a
`| null` that a header's `_Nonnull` removes.

Tests: `c-import: every tests/c-import header writes its golden module`
(`basic.h`'s `KE` and `KP`, an escape and two pieces, are listed, not
copied; `hostile.h`'s `get$value`, `pаss`, `wіdget`, `box.$bad`, `MODE_$B`,
`SNEAKY` and `CAFE` are listed, and only `use_box`, `MODE_A` and `GREETING`
are written; `attrs.h`'s `WIDE_ONE` is listed; `enums.h`'s `HIGH_A` is `u32`),
the goldens `names.h` (reserved names and collisions), `nullability.h`
(outer pointer only), `complex.h` and `layout.h` (types and layouts that are
listed, not bound), `c-import: sqlite3.h binds sqlite3_open with an out class and lists what it cannot bind`,
and `c-import: each of the 300 functions clang finds in sqlite3.h is bound or listed as not bound`.

### An override the header does not support

`readOverrides` refuses, with exit 1 and nothing written, a file that is not a
JSON object, names another header, has an unknown key, names a function,
parameter or free function the header does not declare, makes a non-pointer
nullable, sets `return` on a function that does not return a pointer (CI-3),
or binds a buffer that is not a `void *` or `char *`, or whose count is not
another parameter of the function, is the buffer itself, is another buffer,
or is not a `u8`, `u16`, `u32` or `u64` (an `unsigned char` included) passed
by value or through a non-`const` pointer (`isCountType`). Which parameter
is the count comes only from the overrides file (the name written is that
parameter's own, renamed as any parameter is and checked by `word`): no count
is guessed from a parameter's name, and clang 18's JSON AST carries no `counted_by` on a parameter, so the
header cannot name one. `readonly` is refused on a buffer the header lets the function
write, and on a `const` one, which is bound `readonly` already. `"return":
"nullable"` is refused on a result the header marks `_Nonnull` or
`returns_nonnull`. A file with neither `allow` nor `functions`, an empty
`"functions"` and an empty parameter object are refused. An
override that would change nothing is refused too (`checkOverride`, after
every name is decided): one on a function that is not bound for any reason
(variadic, `static` or `inline`, declared with an `asm` label or `alias`,
outside `allow`, declared only in an included
header, a name Nish reserves, or a type the generator cannot read), one whose
declaration comes out the same with and without it, an owned freer that is not
bound, an empty function object, `"nullable": false`, `"readonly": false`, an
empty `"buffer"`, `"nullable"` on a buffer, on a `_Nonnull` parameter or on one
already bound with `| null` or as an out class, a `"return"` the result already
has, an `allow` glob that matches no function, and a key written twice in one
object, which JSON readers settle differently (the JSON reader refuses it while
parsing). A stale override cannot silently bind a renamed function, or silently
stop applying. `-o` naming the overrides file is refused before clang runs.

Tests: `c-import: the override file ${json} is refused` (twenty-one files, one per
refusal), `c-import: the override file ${json} for ${header} is refused`
(nineteen files, one per change-nothing case or count shape) and `c-import: -o naming the
overrides file is refused, and the file is kept`.

### A module for another data model

The module's third line names its data model (`dataModelOf`: ILP32 for wasm32,
LP64 for the other targets). `dataModelRefusal` makes a build for the other
model refuse the module with NL3062, rather than call C with `long` and
pointers of the wrong width. The line is read through a CRLF line end, so a
module checked out with CRLF records the same model. A module whose first
line is not the generator's marker (one edited by hand, or behind a byte-order
mark, which the parser refuses on its own) is not checked: the refusal guards
against a stale generated module, not a forged one. Only an ILP32 module in an
LP64 build is tested; the other direction is the same comparison.

Tests: `tests/link/c_import_data_model` (an ILP32 module in an LP64 build, the
whole message), `c-import: the data model is read through CRLF line ends`.

## Accepted limits

These follow from running clang on a header the attacker wrote, and are the
same as running `clang` on that header by hand. Each is accepted, not fixed.

- **CI-A1 (Low). An `#include` reads any file the user can.** The header can include any
  path (`#include "/home/user/.ssh/id_ed25519"`). Nothing of it reaches the
  module: only declarations clang parsed are written, by name. It can reach
  the terminal, in clang's errors when the file is not C (CI-4).
- **CI-A2 (Low). clang runs with no timeout.** A header can make the preprocessor work for
  a long time (deep macro expansion, many includes). The command waits for
  clang as `nish build` waits for its toolchain; the user stops it.
- **CI-A3 (Low). The 16 MiB cap applies after clang has written.** `readCapped` checks the
  size of each stream's file before reading it, so the command never reads
  more than 16 MiB, but clang has already written the whole stream to the
  scratch directory, which `scratchBeside` removes afterwards. A header that
  expands to gigabytes fills the disk beside `-o` for the length of the run.
- **CI-A4 (Low). A hostile overrides file can make a binding wrong.** The overrides
  file says what the header cannot: that a pointer may be null, that a result
  is owned and by which freer, that two parameters are a buffer and its
  length. `readOverrides` refuses one that names something the header does not
  declare or changes nothing, but it cannot check a claim against the library:
  an override that pairs a buffer with the wrong count, or calls a result
  nullable that never is, binds a declaration that is wrong in the way a
  hand-written `declare function` can be. The file is as trusted as the
  header beside it; review it with the header.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| CI-1 | Low | `src/c-import.ts` (`readTypedef`, `resolve`) | A typedef declared again as itself (`typedef T T;`, which C11 allows) was stored over the first, so following `T` led back to `T` until a depth cap of 32 stopped it, and every function using `T` was listed as not bound. | **Fixed** before the command shipped: the first declaration is kept, so a typedef names only earlier ones and following them ends; the depth cap is gone. Before, `c-import: every tests/c-import header writes its golden module` listed `f6: returns a typedef chain deeper than 32`; after, `f6` is `declare function f6(): i64`. |
| CI-2 | Low | `src/c-import.ts` (`cImport`, `unsafePath`) | Only the header's resolved path was checked, and only for a quote, a backslash and a newline, but the overrides and output paths are also written into the module's first comment lines: a newline or U+2028 in either began a line of code in the generated module. | **Fixed** before the command shipped: every path is refused when it holds a quote, a backslash, a control byte, U+2028 or U+2029, before clang runs. Before, `c-import: ${what} is refused before clang runs, and nothing is written` wrote the module; after, each case exits 1 and writes nothing. |
| CI-3 | Low | `src/c-import.ts` (`readFunctionOverrides`) | `"return": "nullable"` (or `"nonnull"`, or `owned`) on a function that returns no pointer was accepted and ignored, so an override file that no longer matched its header was not caught. | **Fixed** before the command shipped: it is refused, naming the function. Before, `c-import: the override file { "functions": { "db_close": { "return": "nullable" } } } is refused` exited 0; after, it exits 1 with `` `db_close` does not return a pointer``. |
| CI-5 | Medium | `src/c-import.ts` (`resolve`, `emit`) | A parameter or result type clang spells with an `__attribute__` or `typeof` was listed as not bound with clang's spelling quoted, and that spelling carries an attribute's string argument as written: `int __attribute__((btf_type_tag("*/ export const pwned = 1 /*"))) *p` closed the not-bound comment and put a line of code into the generated module. | **Fixed** before the command shipped: a declaration with an attribute, a `typeof` or an unnamed type is listed with a fixed reason and no spelling, and `reportLine` (then named `commentSafe`) replaces any report line that holds `*/`, `/*` or a line break with its name and a fixed reason. Before, `attrs.h`'s `tagged` wrote `export const pwned = 1` into the module; after, `c-import: every tests/c-import header writes its golden module` pins `tagged: declared with an attribute the generator cannot read`. |
| CI-6 | Medium | `src/c-import.ts` (`emit`, `functionDecl`, `decideNames`, `whyNotClass`, `readEnum`) | Names were copied into the module as clang gave them, and clang accepts `$` and Unicode letters in an identifier: a function `pаss` with a Cyrillic `а` was declared under a name that reads as `pass`, a struct `wіdget` became `declare class wіdget`, and `get$value`, a field `$bad` and an enumerator `MODE_$B` were written as they stood, so a header could put look-alike or bidirectional-control names into a module that is read as reviewed code. | **Fixed** before the command shipped: every string taken from the header, the overrides or the command line is written through `Importer.word`, which checks it with `emittable` as an identifier, integer, string body or comment line, and the same check before a declaration is chosen lists it as not bound (`its name is not an ASCII identifier`). Before, `hostile.h` wrote `declare function get$value(x: i32): i32`, `declare function pаss(x: i32): i32`, `declare class wіdget`, `$bad: i32` and `export const MODE_$B: i32 = 1`; after, `c-import: every tests/c-import header writes its golden module` pins each listed and only `use_box(b: CPtr)` and `MODE_A` written. |
| CI-7 | Medium | `src/c-import.ts` (`readDefine`, `emit`) | A string macro was copied when its body was one literal with no backslash, whatever bytes it held, so `#define SNEAKY "admin<U+202E>txt.exe"` put a right-to-left override into a Nish string literal, which an editor shows reversed (`adminexe.txt`). | **Fixed** before the command shipped: a string body is copied only when every byte is printable ASCII (0x20 to 0x7e) with no `"` or `\` inside, checked by `emittable` when the macro is read and again when it is written. Before, `hostile.h` wrote `export const SNEAKY: string = "admin\u202etxt.exe"` (the byte itself) and `export const CAFE: string = "café"`; after, both are listed as `a string the generator does not copy (escapes, pieces, or bytes that are not printable ASCII)` and only `GREETING` is written. |
| CI-8 | Low | `src/c-import.ts` (`readFunction`, `attrWhy`, `readDefine`) | Only a function's first declaration was read, so `int f(int); int f(int) __asm__("g");` bound `f` though the linker resolves it as `g`, and the same held for `alias` and `overloadable`; and a macro's name was cut at the first byte that is not an identifier byte, so `#define INT_MAX$X 0` in a header that includes `<limits.h>` was read as `INT_MAX` and exported a constant the header itself never defines. | **Fixed** in review: every redeclaration's attributes and type are read and refuse the function as the first's would, and a macro's name runs to a space, tab, `(` or the line's end and is listed when it is not an ASCII identifier. Before, `attrs.h` wrote `declare function late_label(x: i32): i32`, `late_alias` and `over`, and `hostile.h` wrote `export const INT_MAX: i32 = 2147483647`; after, `c-import: every tests/c-import header writes its golden module` lists each as not bound (`declared with an asm label or alias, so its symbol is not its name`, `declared overloadable, so clang mangles its symbol`, `INT_MAX$X: its name is not an ASCII identifier`). |
| CI-9 | Low | `src/c-import.ts` (`readTypedef`, `readEnum`, `readFunction`) | A typedef or function declared again kept only what its first declaration said, though clang puts an attribute on the declaration that spells it, and an enum declared again was read as a new one: `typedef T T __attribute__((aligned(16)));` after `typedef long long T;` left `T` unmarked, so a struct with a `T` field was bound as a `declare class` whose layout is not the C one; and `enum high;` after the definition replaced the enum with an empty one, so every parameter of type `enum high`, those declared before it included, was bound as `i32` though the enum is unsigned. | **Fixed** in review: an `aligned` on any declaration of a typedef marks it, an enum declaration with no enumerators names the enum already read, and a later `returns_nonnull` marks the function. Before, `layout.h` wrote `declare class la` and `declare function use_la(v: la): i32`, and `enums.h` wrote `take_high(h: i32)` and `take_high_again(h: i32)`; after, `c-import: every tests/c-import header writes its golden module` pins `struct la: field \`a\` is a typedef with its own \`aligned\` attribute`, `use_la(v: CPtr)` and both functions taking `u32`. The mark is not ordered: a struct declared before the `aligned` redeclaration, which clang lays out with the typedef's natural alignment, is listed as not bound too. That over-refusal is accepted, since it fails closed (the struct stays a `CPtr`). |
| CI-4 | Low | `src/c-import.ts` (`readHeader`, `readMacros`) | A header clang refuses has clang's errors printed to stderr as clang wrote them, so a header that puts escape bytes into an `#error` line writes them to the terminal. | **Open, accepted.** The same text running clang on the header prints; the module is not written. The text can include lines of any file the header `#include`s (see [Accepted limits](#accepted-limits)). |

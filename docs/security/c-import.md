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
with `-fsyntax-only`, so nothing in the header is compiled or run, and neither
is the module: the command writes it and exits. clang's output is read up to
16 MiB per run, and its JSON up to 64 levels deep and 4,194,304 values; past
either the import is refused with exit 1 and nothing is written. Every path the
command is given is refused when it holds a quote, a backslash, a control byte,
U+2028 or U+2029, since the probe names the header in an `#include "..."` line
and the module names every path in a `//` comment. What the header puts into
the module is names, which are C identifiers, integer values clang computed,
and the text of a string macro only when it is one plain literal with no
backslash. An override that says something the header does not is refused, and
a module written for one data model is refused by a build for the other
(NL3059).

Three findings were fixed while the code was written (CI-1, CI-2 and CI-3,
Low); one is open, accepted (CI-4, Low).

## Scope

| File | Functions |
| --- | --- |
| `src/c-import.ts` | `cImport`, `parseArgs`, `unsafePath`, `importCompiler`, `runClang`, `newDocument`, `readCapped`, `scratchBeside`, and the `Importer` methods `clang`, `parse`, `dumpAst`, `readHeader`, `readTypedef`, `readRecord`, `readEnum`, `readFunction`, `resolve`, `enumType`, `readMacros`, `readDefine`, `probeText`, `probePath`, `probeArgs`, `probeMacros`, `probeBatch`, `readProbe`, `readOverrides`, `readAllow`, `readFunctionOverrides`, `readReturnOverride`, `readParamOverride`, `selected` and `emit` |
| `src/c-import-model.ts` | `dataModelOf`, `dataModelRefusal` |
| `src/compilation.ts` | the call into `dataModelRefusal` that raises NL3059 |

Read but not owned: `std/json-value.ts` and `std/json-tokenizer.ts` (the JSON
reader the AST and the overrides file go through, whose depth and value limits
this command sets), and the spawn the CLI shares with `nish build` (recorded in
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
followed, and the directory is removed before the command exits. Every run is `-fsyntax-only`: clang
preprocesses and checks the header and writes its AST or its errors, and
produces no object. The macro probe (`probeText`) writes, for each object-like
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
4,194,304 values (`newDocument`). For scale, under clang 18.1.3 the AST of the
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
overrides or output path that holds `"`, `\`, a byte below 0x20, 0x7f, U+2028
or U+2029 (`unsafePath`): the header's path sits inside the probe's
`#include "..."`, and all three are named in the module's first `//` lines,
which a line break would end (CI-2).

Tests: `c-import: a header whose path holds a quote is refused before clang runs`,
`c-import: ${what} is refused before clang runs, and nothing is written` (an
output name with a newline, an output name with U+2028, an overrides path with
a newline).

### What the header can write into the module

Function, parameter, field, struct, enum and macro names are C identifiers,
which clang has checked, and a name that is a Nish reserved word gets a
trailing `_`. Numbers are the values clang computed, written as decimal
literals of the declared width. A string macro is written only when its body
is one literal, with quotes only at its ends and no backslash, so it cannot
close the Nish string it is copied into; any other string, an escape or two
pieces, is listed as `a string the generator does not copy (escapes or pieces)`.
The not-bound comment is fixed text and names. A declaration from a header the
first one includes is bound only when the overrides file's `allow` names it
(`selected`).

Tests: `c-import: every tests/c-import header writes its golden module`
(`basic.h`'s `KE` and `KP`, an escape and two pieces, are listed, not
copied), `c-import: sqlite3.h binds sqlite3_open with an out class and lists what it cannot bind`.

### An override the header does not support

`readOverrides` refuses, with exit 1 and nothing written, a file that is not a
JSON object, names another header, has an unknown key, names a function,
parameter or free function the header does not declare, makes a non-pointer
nullable, sets `return` on a function that does not return a pointer (CI-3),
or binds a buffer that is not a `void *` or `char *` followed by its count.
`readonly` is refused on a buffer the header lets the function write. A stale
override cannot silently bind a renamed function.

Tests: `c-import: the override file ${json} is refused` (nineteen files, one per
refusal).

### A module for another data model

The module's third line names its data model (`dataModelOf`: ILP32 for wasm32,
LP64 for the other targets). `dataModelRefusal` makes a build for the other
model refuse the module with NL3059, rather than call C with `long` and
pointers of the wrong width.

Tests: `tests/link/c_import_data_model` (an ILP32 module in an LP64 build).

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| CI-1 | Low | `src/c-import.ts` (`readTypedef`, `resolve`) | A typedef declared again as itself (`typedef T T;`, which C11 allows) was stored over the first, so following `T` led back to `T` until a depth cap of 32 stopped it, and every function using `T` was listed as not bound. | **Fixed** before the command shipped: the first declaration is kept, so a typedef names only earlier ones and following them ends; the depth cap is gone. Before, `c-import: every tests/c-import header writes its golden module` listed `f6: returns a typedef chain deeper than 32`; after, `f6` is `declare function f6(): i64`. |
| CI-2 | Low | `src/c-import.ts` (`cImport`, `unsafePath`) | Only the header's resolved path was checked, and only for a quote, a backslash and a newline, but the overrides and output paths are also written into the module's first comment lines: a newline or U+2028 in either began a line of code in the generated module. | **Fixed** before the command shipped: every path is refused when it holds a quote, a backslash, a control byte, U+2028 or U+2029, before clang runs. Before, `c-import: ${what} is refused before clang runs, and nothing is written` wrote the module; after, each case exits 1 and writes nothing. |
| CI-3 | Low | `src/c-import.ts` (`readFunctionOverrides`) | `"return": "nullable"` (or `"nonnull"`, or `owned`) on a function that returns no pointer was accepted and ignored, so an override file that no longer matched its header was not caught. | **Fixed** before the command shipped: it is refused, naming the function. Before, `c-import: the override file { "functions": { "db_close": { "return": "nullable" } } } is refused` exited 0; after, it exits 1 with `` `db_close` does not return a pointer``. |
| CI-4 | Low | `src/c-import.ts` (`readHeader`, `readMacros`) | A header clang refuses has clang's errors printed to stderr as clang wrote them, so a header that puts escape bytes into an `#error` line writes them to the terminal. | **Open, accepted.** The same text running clang on the header prints; the module is not written. |

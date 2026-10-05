# WP3: Strings

**Status: landed** before the first release (merged as `wp3/strings`,
2f80440): string literals, concatenation, equality, `.length`, template
literals and `console.log`. The rules are normative in
[LANGUAGE.md](LANGUAGE.md) ([Template literals](LANGUAGE.md#template-literals),
[`console`](LANGUAGE.md#console),
[Arrays and strings as receivers](LANGUAGE.md#arrays-and-strings-as-receivers)),
and the IR is in [IR_COOKBOOK.md](IR_COOKBOOK.md). The checks live in
`src/expressions.ts` and `src/builtins.ts`, the lowering in
`src/emit-strings.ts`; the goldens are `tests/cases/str_*.ts`.

## Layout (ABI)

A `string` is an `i8*` to an immutable, 8-byte-aligned header:

```
{ i64 len, i8 data[len], i8 0 }
```

Every runtime string function takes the pointer to the *header*, never to the
data; the trailing NUL keeps `data` passable to C. A literal is a
`private unnamed_addr constant` of exactly this shape, used through a constant
`bitcast`, so it costs no instruction and no allocation, and identical
literals in a module share one constant. Strings built at run time come from
the arena. Because strings are immutable, a pointer is shared freely and
nothing is ever copied. `runtime/nish.h` and `src/runtime.ts` must agree on
the layout.

String parameters are `nonnull noalias readonly align 8` (immutability makes
`noalias` true), plus `nocapture` when they are never returned and never
passed to a user function that captures them; every runtime string function is
declared `nocapture`, so passing a parameter to `nish_print` or
`nish_str_concat` keeps it.

## Decisions

- **`.length` is the UTF-8 byte length.** `"héllo".length` is `6`, not
  JavaScript's `5`. This keeps `.length` one `load` with no decoding; a
  code-point or UTF-16 length would need a scan. MASTER_PLAN §3.4 records the
  decision, and every later string offset (`charCodeAt`, `slice`, `indexOf`)
  is a byte offset for the same reason.
- **No implicit string conversion.** `+` concatenates only two strings;
  `"a" + 1` is an error, and a template literal is the way to format.
- **No ordering on strings.** `<` and friends stay rejected because no
  collation has been chosen (`reject_str_lt`, `reject_str_lt_str`).
- **Equality is by content**, through `nish_str_eq`, which short-circuits on
  pointer equality and only reads, so its callers stay `readonly`.
- **`console.log(x)` takes exactly one string, number or boolean**, is `void`,
  and stands only as a statement. `nish_print` is one `write(2)` of the bytes
  and the newline, with no stdio.
- **Numbers format as JavaScript's `String(x)` does**: exact for integers, and
  since WP7 shortest round-trip digits for `f64`
  ([wp7-runtime.md](wp7-runtime.md)). Booleans need no call: a `select`
  between the interned `"true"` and `"false"`.
- **Templates chain `nish_str_concat`** left to right, with each hole
  converted first and empty constant parts dropped. A `nish_str_concat_n` was
  set aside to keep the runtime unchanged: each intermediate is a cheap arena
  bump, and templates with many holes are rare in hot loops. It is still how
  templates lower. A template that is a single string hole (`` `${s}` ``) is
  `s` itself, and escape analysis sees through it
  (`str_param_passthrough`).

## Purity facts

What each construct calls, which is what the attribute fixpoint sees:

| Construct | Facts |
| --- | --- |
| literal | none (`readnone` preserved) |
| `a + b` | `nish_str_concat` (write: it allocates) |
| `a === b`, `a !== b` | `nish_str_eq` (read) |
| `s.length` | a load through the pointer (read) |
| template | `nish_str_concat` when more than one part, a conversion per numeric hole |
| `console.log(x)` | `nish_print` (write), plus the conversion |

`runtime/runtime.c` did not grow with this package: 1,118 bytes of `.text` at
`-Oz`. [wp7-runtime.md](wp7-runtime.md) records the budget since.

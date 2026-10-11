# Types

Every value in a Nish program has one type, fixed when the program is
compiled, and that type never changes. There is no `any`, no boxing and no
implicit conversion of any kind: two values are compatible only when their
types are identical. The normative rules are in the reference's
[Types](../../LANGUAGE.md#types) section.

## Numbers

Nish names the width of a number. The ones you reach for every day are:

| Type | What it is |
| --- | --- |
| `i32` | a 32-bit signed integer |
| `i64` | a 64-bit signed integer |
| `f64` | a 64-bit IEEE-754 float, JavaScript's `number` |
| `number` | `i32` by default, or `f64` when compiled with `--number-mode f64` |

There are also `u8`, `u16`, `u32` and `u64` (unsigned, and they wrap on
overflow — handy for bytes and hashes) and `f32`. Write the explicit width when
you mean one: `i32` reads the same in either number mode, `number` does not.

```ts nish:ok
export const main = (): i32 => {
  const count: i32 = 7;
  const big: i64 = 9000000000;
  const ratio: f64 = 0.5;
  console.log(`${count} ${big} ${ratio}`);   // 7 9000000000 0.5
  return 0;
};
```

A `let` or `const` takes its type from its initializer, so in the default
number mode `count` needs no annotation. The other two do: without one,
`9000000000` would be an `i32`, which it does not fit in, and `0.5` would be
an `i32` too, which a fraction cannot be. When you write an annotation, it
must match the initializer exactly.

**Mixing widths is always an error.** `i32 + i64`, `f64 + i32`, even
`u32 + i32` are refused, because the compiler will not guess which width you
meant:

```ts nish:err NL2231
const total = (a: i32, b: i64): i64 => {
  return a + b;
};
```

Convert explicitly with `toI32`, `toI64`, `toF64` (and `toU8`, `toU16`,
`toU32`, `toU64`, `toF32`):

```ts nish:ok
const total = (a: i32, b: i64): i64 => {
  return toI64(a) + b;
};

const average = (sum: i32, n: i32): f64 => toF64(sum) / toF64(n);

export const main = (): i32 => {
  console.log(`${total(2, toI64(40))} ${average(7, 2)}`);   // 42 3.5
  return 0;
};
```

A numeric literal is an `i32` (or `f64` in f64 mode) unless the place it is
written asks for another type: an annotated declaration, a `return`, an
argument to a function, or the other side of an operator whose type is
known. That is why `const big: i64 = 9000000000` above compiles. The full
list of those places is under
[Numeric literals](../../LANGUAGE.md#numeric-literals).

Integer arithmetic is checked: what happens when a value overflows is on the
[Control flow](control-flow.md#checked-arithmetic) page.

## Booleans

`boolean` is `true` or `false`, and it is the only type a condition accepts.
Nish has no truthiness: `if (n)`, `if (s.length)` and `!xs.length` are
errors. Compare instead — `n !== 0`, `s.length !== 0`. The
[Control flow](control-flow.md#conditions) page has the details.

## Strings

`string` is an immutable sequence of UTF-8 bytes. Strings compare by content
with `===`, concatenate with `+`, and are how you print a number, through a
template literal: `` `${n}` ``. `String(n)` and `n.toString()` do not exist.
The [Arrays and strings](arrays-and-strings.md#strings) page covers what you
can do with one.

## Nullable types: `T | null`

A value that may be absent has the type `T | null`. `T` must be a class, an
interface, an array or a `string` — a number or a `boolean` can never be
null, so `i32 | null` is refused. Absence is `null`; `undefined` is not a
value a program writes (the one place it appears is a `Map` lookup — see
[Maps and sets](maps-and-sets.md)).

Before you read anything off a nullable value, test it. Inside the test, the
compiler treats the variable as plain `T`:

```ts nish:ok
const firstLong = (words: string[]): string | null => {
  for (const w of words) {
    if (w.length > 4) {
      return w;
    }
  }
  return null;
};

export const main = (): i32 => {
  const found = firstLong(["a", "tiny", "example"]);
  if (found !== null) {
    console.log(`${found} has ${found.length} bytes`);   // example has 7 bytes
  }
  const none = firstLong(["no"]);
  console.log(`${none === null}`);                       // true
  return 0;
};
```

Reading a nullable without the test is an error:

```ts nish:err-body NL2187
const s: string | null = null;
console.log(`${s.length}`);
```

A few rules shape how narrowing works:

- **It applies to a local variable or a parameter, never to a property
  path.** `if (n.next !== null) { n.next.value }` is refused: copy
  `n.next` into a local first and test that.
- **It ends at any assignment to the variable**, and it is dropped before a
  loop that assigns the variable.
- `if (p === null) { return …; }` narrows `p` for the rest of the block,
  because the `if` cannot fall through.
- `?.` and `??` are not available on a nullable; write the test.
- Two nullable values cannot be compared with each other — compare each with
  `null`.

The reference's [Nullable types](../../LANGUAGE.md#nullable-types) section
has every form a test may take. A function that can *fail*, rather than find
nothing, returns a `Result` instead — see
[Errors and `Result`](errors.md).

## Ranged integers

`integer<Lo, Hi>` is an `i32` the compiler knows stays between `Lo` and `Hi`
inclusive — a byte value as `integer<0, 255>`, a digit as `integer<0, 9>`.
Putting a literal outside the range into one is a compile error; putting any
other `i32` into one is checked once, and the program panics if it is out of
range. Taking a value out is free, and every operator reads it as a plain
`i32`. Because the compiler knows the bounds, a ranged value used as an
index can also spare the bounds check:

```ts nish:err-body NL2384
const digit: integer<0, 9> = 12;
```

The reference's [Types](../../LANGUAGE.md#types) section lists every rule
for `integer<Lo, Hi>`.

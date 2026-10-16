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
- Two nullable values cannot be compared with each other — compare each with
  `null`.

### A default with `??`

When all you want is a fallback, `a ?? fallback` gives `a` where it is not
`null` and `fallback` where it is. The result is plain `T`, so it needs no
test afterwards, and because it reads `a` only once, it works on a property
path too:

```ts nish:ok
class Node {
  value: i32;
  next: Node | null = null;
  constructor(value: i32) {
    this.value = value;
  }
}

const greet = (name: string | null): string => `hello ${name ?? "stranger"}`;

export const main = (): i32 => {
  const head = new Node(1);
  head.next = new Node(2);
  let cur = head;
  for (let i = 0; i < 5; i++) {
    cur = cur.next ?? cur;   // stays on the last node
  }
  console.log(`${greet(null)} ${cur.value}`);   // hello stranger 2
  return 0;
};
```

The fallback runs only when it is needed, as in TypeScript. If the fallback
may itself be `null`, the result stays `T | null`. One form is refused: a
default for an array element, `xs[i] ?? fallback`. TypeScript programs use it
for "past the end", where Node reads `undefined` and takes the fallback, but
Nish checks the index and stops the program instead. Test the index against
`xs.length` first:

```ts nish:err-body NL2489
const names = new Array<string | null>(2);
console.log(names[5] ?? "none");
```

### Reaching through with `?.`

To read through several nullable links, write a `?.` chain and end it with a
default. Each `?.` stops the chain when the value before it is `null`, and
the whole expression is then the default:

```ts nish:ok
class Address {
  city: string;
  constructor(city: string) {
    this.city = city;
  }
}

class Customer {
  address: Address | null = null;
}

const cityOf = (c: Customer | null): string => c?.address?.city ?? "unknown";

export const main = (): i32 => {
  const c = new Customer();
  console.log(cityOf(null));        // unknown
  console.log(cityOf(c));           // unknown
  c.address = new Address("Lyon");
  console.log(cityOf(c));           // Lyon
  return 0;
};
```

The chain can end in a field of any type, a number included, or in a method
call, and anything after a `null` link, an argument included, does not run.
Three rules keep it honest:

- **A chain must end in `??`.** On its own `c?.address` would be
  `undefined` when `c` is `null`, and Nish has no `undefined`, so
  `const a = c?.address` is refused. Use the chain where you want the
  value, with its default.
- **Only `?.` skips a `null`.** In `c?.address.city`, the `.city` reads
  `address` as it is, so if `address` may be `null` it needs a `?.` too.
- **`?.` needs something that can be `null`.** On a value that never is,
  write `.`.

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

## Enum member types

A member of an [enum](../../LANGUAGE.md#enums) is also a type. Written as an
annotation, `Kind.Array` is a slot that holds that one member and nothing
else, which is how a class records which of an enum's cases it is: a
`readonly` field of the member's type, set to the member.

```ts nish:ok
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Array;
  depth: i32 = 1;
}

const describe = (k: Kind): string => (k === Kind.Array ? "array" : "scalar");

export const main = (): i32 => {
  const n = new ArrayNode();
  console.log(describe(n.kind));    // array
  return 0;
};
```

Only the member itself goes into such a slot. Another member is a compile
error, and so is a plain `Kind` value, because the compiler cannot tell which
member that holds:

```ts nish:err NL2519
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Scalar;
}
```

Reading the slot gives you a `Kind`, so it compares, switches and passes
anywhere a `Kind` does.

A `let` with no annotation follows TypeScript. Start it from a value that
already has the member type and it keeps that type. Start it from the
member's constant and it is a `Kind`, so it can take another member later:

```ts nish:err NL2519
enum Kind {
  Scalar,
  Array,
}

const keep = (k: Kind.Array): Kind.Array => k;

export const main = (): i32 => {
  let held = keep(Kind.Array); // a Kind.Array
  held = Kind.Scalar;
  let any = Kind.Array; // a Kind
  any = Kind.Scalar;
  return any === held ? 0 : 1;
};
```

An array of a member type is built with `[]` and `push`. `new Array<T>(n)`
fills its slots with 0, which here is `Kind.Scalar`, so the compiler refuses
it for any member but the one whose value is 0:

```ts nish:err NL2520
enum Kind {
  Scalar,
  Array,
}

export const main = (): i32 => {
  const tags = new Array<Kind.Array>(4);
  return tags.length;
};
```

The reference's [Enums](../../LANGUAGE.md#enums) section has every rule.

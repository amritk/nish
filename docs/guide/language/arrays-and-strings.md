# Arrays and strings

An array holds values of one type and can grow; a string is immutable
bytes, usually UTF-8 text. Both have a short, fixed list of methods — far
fewer than in JavaScript — and both are bounds-checked. The normative rules are in the
reference's [Array literals](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#array-literals),
[Element access](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#element-access),
[Arrays and strings as receivers](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#arrays-and-strings-as-receivers)
and [Template literals](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#template-literals) sections.

## Arrays

`T[]` (or `Array<T>`) is an array of `T`. A literal's elements must all have
one type, and an empty literal `[]` needs a type to take from its context:

```ts nish:ok
export const main = (): i32 => {
  const primes = [2, 3, 5, 7];          // i32[]
  const names: string[] = [];           // [] needs the annotation
  names.push("ada");
  names.push("grace");

  primes.push(11);
  const last = primes.pop();            // 11
  primes[0] = 1;

  console.log(`${primes.length} ${last} ${primes[0]}`);   // 4 11 1
  console.log(`${primes.indexOf(5)} ${primes.indexOf(4)}`); // 2 -1
  console.log(names.join(", "));                          // ada, grace
  return 0;
};
```

Those — `length` (read-only), `push`, `pop`, `indexOf` and `join` (on a
`string[]` only) — with `set` and `fill` on arrays of numbers and `sort`
(below), are every array method there is. There is no `map`, `filter`,
`reduce`, `forEach` or `slice`, and no spread. Write the loop, or a function that takes
[a function argument](functions.md#passing-a-function-to-a-function).

`const` fixes the binding, not the contents: `primes.push(11)` and
`primes[0] = 1` above are fine on a `const`, and `primes = []` would not be.
Declare a parameter `readonly T[]` to promise the function writes nothing
into it.

### Sorting

`xs.sort(cmp)` sorts the array in place and answers it. The comparator says
how two elements compare: a negative number puts `a` first, a positive one
puts `b` first, and zero keeps them in the order they had — the sort is
stable, so the result is exactly the one Node gives.

```ts nish:ok
class Score {
  name: string;
  points: i32;
  constructor(name: string, points: i32) {
    this.name = name;
    this.points = points;
  }
}

const byPoints = (a: Score, b: Score): number => b.points - a.points;

export const main = (): i32 => {
  const xs: i32[] = [5, -2, 9, 0];
  xs.sort((a, b) => a - b);
  console.log(`${xs[0]} ${xs[3]}`);                 // -2 9

  const board: Score[] = [new Score("ada", 3), new Score("bo", 7), new Score("cy", 3)];
  board.sort(byPoints);
  const names: string[] = [];
  for (const s of board) {
    names.push(s.name);
  }
  console.log(names.join(" "));                     // bo ada cy
  return 0;
};
```

Three things are refused where JavaScript would do something surprising or
Nish cannot follow:

- `xs.sort()` with no comparator. JavaScript compares the elements as
  strings, so `[10, 9].sort()` is `[10, 9]`; Nish asks you to write
  `xs.sort((a, b) => a - b)`.
- Sorting a `readonly T[]`, or `process.argv`.
- A comparator that reads a `let` of the function it is written in. It may
  read that function's `const` locals and parameters, as any arrow argument
  may ([Functions](functions.md)): `xs.sort((a, b) => rank[a] - rank[b])` with
  a `const rank`. Bind a `let` to a `const` before the call.

`(a, b) => a - b` is checked `i32` arithmetic: on elements more than
`2^31 - 1` apart, such as `[2147483647, -1]`, it panics with
`attempt to subtract with overflow`. When the values may span the whole range,
compare instead: `(a, b) => (a > b ? 1 : a < b ? -1 : 0)`. An array holding
`NaN`, or a comparator that is not a consistent order, sorts to some
permutation of its elements, which, as in JavaScript, need not be Node's.

Each comparator compiles to its own copy of the sort, with the comparator
called directly in the inner loop. A sort uses one temporary copy of the
array, given back before `sort` returns, so sorting in a loop does not grow
memory.

### Walking an array

`for (const x of xs)` visits each element in order; use an index loop when
you need the position:

```ts nish:ok
const sum = (xs: f64[]): f64 => {
  let total: f64 = 0.0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

const largestAt = (xs: i32[]): i32 => {
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] > xs[best]) {
      best = i;
    }
  }
  return best;
};

export const main = (): i32 => {
  console.log(`${sum([1.5, 2.5, 4.0])}`);       // 8
  console.log(`${largestAt([3, 9, 4])}`);       // 1
  return 0;
};
```

### Bounds

Every `xs[i]` is checked: an index outside `0 … xs.length - 1` — a negative
one included — stops the program with `index out of range` on stderr and
exit status 1, where JavaScript would answer `undefined`. `pop()` on an
empty array stops the program the same way. The compiler removes the check
wherever it can prove the index is in range, as in the `i < xs.length` loop
above.

```ts nish:ok
export const main = (): i32 => {
  const xs = [10, 20, 30];
  const i = 3;
  console.log(`${xs[i]}`);   // stops: index out of range: 3 >= 3
  return 0;
};
```

An array of arrays is written `i32[][]`. An array of an `interface` type
that no class implements stores the records themselves back to back, which
is why holding one of its elements across a `push` onto the same array is
refused. An array of class instances, of an interface some class implements,
or of a `T | null` holds a pointer to each element instead
([Arrays of records are contiguous](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#arrays-of-records-are-contiguous)).

### Module storage

A top-level `const` holding a `new` array of a constant length is *module
storage*: a fixed block of memory, zero-filled when the program starts, that
keeps its values from one call to the next. It is the one piece of state a
module keeps, and no code runs to set it up.
([Module storage](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#module-storage)).

```ts nish:ok
const SCORES = new Int32Array(4);

const sum = (xs: Int32Array): i32 => {
  let total: i32 = 0;
  for (let i = 0; i < xs.length; i++) {
    total += xs[i];
  }
  return total;
};

export const main = (): i32 => {
  SCORES[0] = 30;
  SCORES[3] = 4;
  console.log(`${sum(SCORES)} ${SCORES[1]}`);   // 34 0
  return 0;
};
```

- **Its length is known when the program compiles**: a number, or a `const`
  the compiler can work out, from 1 to 16,777,216, and the storage holds at
  most 256 MiB. `new Array<T>(n)` and
  `new Int32Array(n)`, `Float32Array`, `Float64Array` and `BigInt64Array` all
  make one.
- **Its elements are numbers, booleans, enums, handles, or records** of
  those. A string, an array, a nullable element or a class is refused, and
  so is an enum with no member equal to zero, since every element starts at
  zero.
- **It never grows and never moves.** No method may be called on it (`push`,
  `pop` and `sort` included), nor may its `length` be assigned; keep a count
  beside it for the slots in use:

```ts nish:err NL2688
const xs = new Int32Array(4);

export const main = (): i32 => {
  xs.push(1);
  return 0;
};
```

- **It is a place, not a value.** You index it and read its `length`; you do
  not store, return or alias the array itself. The one way to hand it to
  another function is a parameter spelled with a typed-array name, such as
  `xs: Int32Array` above, which has no `push` either. An element of a
  storage of records is a place too: `bodies[i].x = 1` writes a field and
  `bodies[i] = bodies[j]` copies a whole element, but binding `bodies[i]` to
  a name or passing it to a function is refused; pass the index instead.

In a wasm module built for a page, module storage is the memory the page
reads and writes directly
([In a browser](../using-nish/interop.md#sharing-memory-with-the-page)).

## Strings

A `string` is immutable bytes, usually UTF-8 text, and Nish does not check that
they are valid UTF-8. `+` joins two strings, `===` compares them by
content, and these are its methods, all of them:

| Member | Answers |
| --- | --- |
| `s.length` | the length in **bytes** |
| `s.charCodeAt(i)` | the byte at `i`, bounds-checked |
| `s.substring(start, end?)` | the bytes from `start` up to `end`, clamped into range as in JavaScript |
| `s.slice(start, end?)` | the same, but an out-of-range or reversed pair stops the program instead of being clamped |
| `s.indexOf(sub, from?)` | the first byte offset of `sub` at or after `from` (default `0`), or `-1` |
| `s.startsWith(sub)`, `s.endsWith(sub)` | a `boolean` |
| `String.fromCharCode(c)` | the one-byte string of `c` |
| `String.fromBytes(bytes, start, end)` | the bytes of a `u8[]` from `start` up to `end` as one string; an out-of-range or reversed pair stops the program, as `slice`'s does |

`toUpperCase`, `split`, `trim`, `replace` and the rest do not exist;
build them from these, or look in the
[standard library](../using-nish/standard-library.md).

**Lengths and offsets count bytes, not characters.** An ASCII character is
one byte, but `é` is two and most emoji are four:

```ts nish:ok-body
const word = "café";
console.log(`${word.length}`);              // 5
console.log(word.substring(0, 3));          // caf
console.log(`${word.charCodeAt(0)}`);       // 99
console.log(`${word.indexOf("fé")}`);       // 2
console.log(`${word.startsWith("ca")}`);    // true
```

Since every offset is a byte offset, `substring` can cut a multi-byte
character in half; that is the cost of indexing a string in constant time.

Bytes become text the other way with `String.fromBytes`: the range of a
`u8[]`, from `start` up to `end`, as one string in one allocation. It is the
way to turn what a file or a socket handed you into a string, where a
`String.fromCharCode` per byte joined together allocates once per byte:

```ts nish:ok-body
const bytes: u8[] = [99, 97, 102, 195, 169];
console.log(String.fromBytes(bytes, 0, 5));   // café
console.log(String.fromBytes(bytes, 0, 3));   // caf
```

The bytes are copied as they are, so `é`'s two bytes are `é` again. Under
Node each byte is one character instead, as with `String.fromCharCode`, so the
two answers agree only where the bytes are ASCII.

### Template literals

A template literal is how a number becomes text: each `${…}` hole may be a
`string`, a number of any type or a `boolean`. `"n = " + n` is
refused (no implicit conversion), and so are `String(n)` and
`n.toString()`:

```ts nish:ok
export const main = (): i32 => {
  const name = "nish";
  const version = 0;
  const ok = true;
  console.log(`${name} ${version}.${version + 18} ${ok}`);   // nish 0.18 true
  return 0;
};
```

```ts nish:err-body NL2231
const n = 3;
console.log("n = " + n);
```

`console.log` takes exactly one argument, so join what you want to print
into one template.

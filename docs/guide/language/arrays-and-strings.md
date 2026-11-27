# Arrays and strings

An array holds values of one type and can grow; a string is immutable
bytes, usually UTF-8 text. Both have a short, fixed list of methods — far
fewer than in JavaScript — and both are bounds-checked. The normative rules are in the
reference's [Array literals](../../reference/language/expressions.md#array-literals),
[Element access](../../reference/language/expressions.md#element-access),
[Arrays and strings as receivers](../../reference/language/builtins.md#arrays-and-strings-as-receivers)
and [Template literals](../../reference/language/expressions.md#template-literals) sections.

## Arrays

`T[]` (or `Array<T>`) is an array of `T`. A literal's elements must all have
one type, and an empty literal `[]` needs a type to take from its context.
By default the compiler refuses a program that may panic, so the examples
here carry the guards it reads: `i < xs.length` before an index,
`xs.length > 0` before a `pop`,
`start >= 0 && start <= end && end <= xs.length` before a `slice` or a
`String.fromBytes`, and arithmetic that is bounded or done in a wider type.
Two build with
[`--allow-panics`](../using-nish/cli.md#asking-what-a-program-can-do) instead:
the one that shows an index panic, and the module storage one, since no guard
proves an index into module storage yet:

<!-- nish:ok -->
```ts
export const main = (): i32 => {
  const primes = [2, 3, 5, 7];          // i32[]
  primes[0] = 1;                        // in range: the literal has four elements
  primes.push(11);
  if (primes.length > 0) {
    const last = primes.pop();          // 11
    console.log(`${primes.length} ${last}`);                  // 4 11
  }
  console.log(`${primes.indexOf(5)} ${primes.indexOf(1)}`);   // 2 0

  const names: string[] = [];           // [] needs the annotation
  names.push("ada");
  names.push("grace");
  console.log(names.join(", "));                              // ada, grace
  return 0;
};
```

Those — `length` (read-only), `push`, `pop`, `indexOf` and `join` (on a
`string[]` only) — with `set` and `fill` on arrays of numbers, `sort`,
`map`, `filter`, `forEach`, `some`, `every`, `findIndex` and `slice` (below),
are every array method there is. There is no `find` or `reduce`, and no
spread. Write the loop, or a function that takes
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

<!-- nish:ok -->
```ts
class Score {
  name: string;
  points: i32;
  constructor(name: string, points: i32) {
    this.name = name;
    this.points = points;
  }
}

// Most points first.
const byPoints = (a: Score, b: Score): number =>
  a.points > b.points ? -1 : a.points < b.points ? 1 : 0;

export const main = (): i32 => {
  const xs: i32[] = [5, -2, 9, 0];
  xs.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  console.log(xs.map((x) => `${x}`).join(" "));     // -2 0 5 9

  const board: Score[] = [new Score("ada", 3), new Score("bo", 7), new Score("cy", 3)];
  board.sort(byPoints);
  console.log(board.map((s) => s.name).join(" "));  // bo ada cy
  return 0;
};
```

Three things are refused where JavaScript would do something surprising or
Nish cannot follow:

- `xs.sort()` with no comparator. JavaScript compares the elements as
  strings, so `[10, 9].sort()` is `[10, 9]`; Nish asks you to write
  the comparator, `xs.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))`.
- Sorting a `readonly T[]`, or `process.argv`.
- A comparator that reads a `let` of the function it is written in. It may
  read that function's `const` locals and parameters, as any arrow argument
  may ([Functions](functions.md)): `xs.sort((a, b) => (a > b ? dir : a < b ? -dir : 0))`
  with a `const dir`. Bind a `let` to a `const` before the call.

The comparator compares rather than subtracts. `(a, b) => a - b`, the usual
JavaScript one, is checked `i32` arithmetic that nothing bounds: on elements
more than `2^31 - 1` apart, such as `[2147483647, -1]`, it overflows, so the
compiler refuses it by default, and under `--allow-panics` it panics with
`attempt to subtract with overflow`. An array holding
`NaN`, or a comparator that is not a consistent order, sorts to some
permutation of its elements, which, as in JavaScript, need not be Node's.

Each comparator compiles to its own copy of the sort, with the comparator
called directly in the inner loop. A sort uses one temporary copy of the
array, given back before `sort` returns, so sorting in a loop does not grow
memory.

### `map`, `filter` and `slice`

`map`, `filter`, `forEach`, `some`, `every` and `findIndex` take a callback,
which gets the element, or the element and its index, as in TypeScript.
`slice` copies a range into a new array.

<!-- nish:ok -->
```ts
export const main = (): i32 => {
  const xs: i32[] = [3, 8, 1, 6];
  const middle = xs.slice(1, 3);                  // [8, 1]
  const doubled = xs.map((x) => toI64(x) * 2);    // [6, 16, 2, 12]: i64, where twice an i32 fits
  const big = xs.filter((x) => x > 2);            // [3, 8, 6]
  const labels = xs.map((x, i) => `${i}:${x}`);
  console.log(`${middle.length} ${doubled.length} ${big.length}`); // 2 4 3
  console.log(labels.join(" "));                            // 0:3 1:8 2:1 3:6
  console.log(`${xs.some((x) => x > 7)} ${xs.every((x) => x > 0)}`); // true true
  console.log(`${xs.findIndex((x) => x === 1)}`);           // 2
  return 0;
};
```

The callback follows the comparator's rule above: a top-level function, or an
arrow that reads only `const` locals and parameters. Each callback compiles to
its own loop that calls it directly. Three things differ from JavaScript:

- **There is no `find`.** TypeScript says it answers `T | undefined`, and Nish
  has no `undefined`. Use `findIndex` and index the array:
  `const i = xs.findIndex(f); if (i >= 0) { ... xs[i] ... }`.
- **A callback takes at most two parameters.** JavaScript passes the array as
  a third; read the array you called the method on instead.
- **`slice` checks its range**, as string `slice` does:
  `xs.slice(start, end)` needs `0 <= start <= end <= xs.length`. A guard that
  says so, `if (start >= 0 && start <= end && end <= xs.length)`, proves it to
  the compiler; a call nothing proves is refused by default, and under
  `--allow-panics` a bad range stops the program. A negative
  index does not count from the end, and an end past the length is not
  clamped. `xs.slice()` copies the whole array, and `xs.slice(start)` copies
  from `start` to the end.

### Walking an array

`for (const x of xs)` visits each element in order; use an index loop when
you need the position:

<!-- nish:ok -->
```ts
const sum = (xs: f64[]): f64 => {
  let total: f64 = 0.0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

// The position of the largest element, or -1 when there is none.
const largestAt = (xs: i32[]): i32 => {
  let best = -1;
  let max: i32 = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (best < 0 || x > max) {
      best = i;
      max = x;
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

`xs.forEach(f)` walks the array as that `for...of` loop does, with `f` written
in as its body, except that it stops at the length the array had when the call
began, as Node does, so an element `f` pushes is not visited. It answers
nothing (`void`), and `f` follows the callback rule above, so it may call,
print and `push` onto an array it can see, but not assign a local of the
function around it. To add up, write the `for...of` loop of `sum` above: a
`forEach` callback that assigns a total is refused (NL2586), and the message
says to use `for...of`.

<!-- nish:ok -->
```ts
export const main = (): i32 => {
  const xs: i32[] = [3, 8, 1];
  const seen: string[] = [];
  xs.forEach((x, i) => console.log(`${i}:${x}`));   // 0:3 1:8 2:1
  xs.forEach((x) => {
    seen.push(`#${x}`);
  });
  console.log(seen.join(" "));                       // #3 #8 #1
  return 0;
};
```

### Bounds

Every `xs[i]` is checked. The compiler must prove the index is in range, as
in the `i < xs.length` loop above, and by default it refuses the program
where it cannot; `pop()` needs an `xs.length > 0` test the same way. The
length of a fresh array literal is known, which is why `primes[0] = 1` and
`xs.slice(1, 3)` above need no test; once a call such as `push` may have
changed the array, they would. Under
`--allow-panics` the check is built in instead: an index outside
`0 … xs.length - 1` — a negative one included — stops the program with
`index out of range` on stderr and exit status 1, where JavaScript would
answer `undefined`, and `pop()` on an empty array stops it the same way.

<!-- allow-panics: shows the panic an index out of range stops with -->
<!-- nish:ok --allow-panics -->
```ts
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
([Arrays of records are contiguous](../../reference/language/expressions.md#arrays-of-records-are-contiguous)).

### Lookup tables

A top-level `const` declared `readonly u8[]` (or `u16`, `u32`, `i32`, `i64`
or `f64`) and given an array literal of constants is a *constant table*. Its
elements are worked out when the program compiles and kept as read-only
data in the binary: nothing runs to build it, and nothing can write it
([Constant tables](../../reference/language/declarations.md#constant-tables)).

<!-- nish:ok -->
```ts
const LIMIT: i32 = 100;
const SCALE: readonly i32[] = [1, 10, LIMIT, LIMIT * 10];

export const main = (): i32 => {
  let total: i32 = 0;
  for (const step of SCALE) {
    if (step < 0 || step > 1000000 || total > 1000000000) {
      return 1;   // bounds both sides of the `+=`, so it is proven to fit
    }
    total += step;
  }
  console.log(`${SCALE.length} ${total}`);   // 4 1111
  return 0;
};
```

- **Each element is a constant**: a number, another module constant, or
  arithmetic over them, and it must fit the element type; `256` in a
  `readonly u8[]` is refused. A table has at least one element.
- **It is spelled `readonly`.** Reading it — indexing, `length`, `slice`,
  `indexOf`, `map`, a `for...of` — works as on any array; writing an element,
  `push`, `sort`, or handing it where a writable `u8[]` is expected is
  refused:

<!-- nish:err NL2792 -->
```ts
const XS: i32[] = [1, 2, 3];

export const main = (): i32 => {
  return XS[0];
};
```

- **A `u8` index into a 256-entry `readonly u8[]` needs no bounds check**: a
  `u8` cannot be out of range, so `TABLE[c]` is one load. That is the shape
  of a byte classifier — one table entry per possible byte — which answers
  in one read where a chain of `if`s compares the byte several times.

### Module storage

A top-level `const` holding a `new` array of a constant length is *module
storage*: a fixed block of memory, zero-filled when the program starts, that
keeps its values from one call to the next. It is the one piece of state a
module keeps, and no code runs to set it up.
([Module storage](../../reference/language/declarations.md#module-storage)).

<!-- allow-panics: indexes module storage, which no guard the checker reads proves in range yet -->
<!-- nish:ok --allow-panics -->
```ts
const SCORES = new Int32Array(4);

// The sum of scores from 0 to 1000000, or -1 on one outside that range.
const sum = (xs: Int32Array): i32 => {
  let total: i32 = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x < 0 || x > 1000000 || total > 1000000000) {
      return -1;
    }
    total += x;
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

<!-- nish:err NL2688 -->
```ts
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
| `s.slice(start, end?)` | the same, but checked instead of clamped: refused by default, and under `--allow-panics` an out-of-range or reversed pair stops the program |
| `s.indexOf(sub, from?)` | the first byte offset of `sub` at or after `from` (default `0`), or `-1` |
| `s.startsWith(sub)`, `s.endsWith(sub)` | a `boolean` |
| `String.fromCharCode(c)` | the one-byte string of `c` |
| `String.fromBytes(bytes, start, end)` | the bytes of a `u8[]` from `start` up to `end` as one string, checked as `slice` is |

`toUpperCase`, `split`, `trim`, `replace` and the rest do not exist;
build them from these, or look in the
[standard library](../using-nish/standard-library.md).

**Lengths and offsets count bytes, not characters.** An ASCII character is
one byte, but `é` is two and most emoji are four:

<!-- nish:ok-body -->
```ts
const word = "café";
console.log(`${word.length}`);              // 5
console.log(word.substring(0, 3));          // caf
console.log(`${word.indexOf("fé")}`);       // 2
console.log(`${word.startsWith("ca")}`);    // true
if (word.length > 3) {
  console.log(`${word.charCodeAt(3)}`);     // 195, the first of é's two bytes
}
```

Since every offset is a byte offset, `substring` can cut a multi-byte
character in half; that is the cost of indexing a string in constant time.

Bytes become text the other way with `String.fromBytes`: the range of a
`u8[]`, from `start` up to `end`, as one string in one allocation. It is the
way to turn what a file or a socket handed you into a string, where a
`String.fromCharCode` per byte joined together allocates once per byte:

<!-- nish:ok-body -->
```ts
const bytes: u8[] = [99, 97, 102, 195, 169];
console.log(String.fromBytes(bytes, 0, 3));              // caf
console.log(String.fromBytes(bytes, 0, bytes.length));   // café
```

The range is checked as `slice`'s is, `0 <= start <= end <= bytes.length`. A
guard on it proves it, and so does a start the end is known not to pass: a
copy, `const start = i`, before a loop that only counts `i` up. Without one
the call is refused by default:

<!-- nish:ok -->
```ts
const word = (buf: u8[], start: i32, end: i32): string => {
  if (start >= 0 && start <= end && end <= buf.length) {
    return String.fromBytes(buf, start, end);
  }
  return "";
};

export const main = (): i32 => {
  const line: u8[] = [104, 105, 32, 116, 104, 101, 114, 101];
  console.log(word(line, 3, 8));   // there
  return 0;
};
```

The bytes are copied as they are, so `é`'s two bytes are `é` again. Under
Node each byte is one character instead, as with `String.fromCharCode`, so the
two answers agree only where the bytes are ASCII.

### Template literals

A template literal is how a number becomes text: each `${…}` hole may be a
`string`, a number of any type or a `boolean`. `"n = " + n` is
refused (no implicit conversion), and so are `String(n)` and
`n.toString()`:

<!-- nish:ok -->
```ts
export const main = (): i32 => {
  const name = "nish";
  const version = 0;
  const ok = true;
  console.log(`${name} ${version}.${version + 18} ${ok}`);   // nish 0.18 true
  return 0;
};
```

<!-- nish:err-body NL2231 -->
```ts
const n = 3;
console.log("n = " + n);
```

`console.log` takes exactly one argument, so join what you want to print
into one template.

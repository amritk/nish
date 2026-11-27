# Destructuring

A `const` or `let` can take a value apart into names: the fields of an object,
or the elements of an array. The head of a `for...of` can do the same for each
element it walks. Each name is read straight from the value, which is never
copied. The normative rules are in the reference's
[Destructuring declarations](../../reference/language/statements.md#destructuring-declarations)
section.

## Objects

An object pattern reads fields of a class or interface value. Write a field's
name to bind it under that name, or `field: name` to rename it:

<!-- nish:ok -->
```ts
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): i32 => {
  const { x, y: py } = new Point(3, 4);
  if (x < 0 || x > 10000 || py < 0 || py > 10000) {
    return 1;
  }
  console.log(`${x * x + py * py}`);
  return 0;
};
```

This prints `25`. The names a pattern binds are locals, so a test of them, as
here, is what proves `x * x + py * py` fits an `i32`. A name the class does not have is refused, as `p.z` would
be. A name you bind and never read is an error, as for any local; to keep it
on purpose, rename it inside the pattern, `{ x, y: _y }`.

Over a plain name or a field path, `const { x } = p` compiles to exactly
`const x = p.x`, and `const [a] = o.items` to `const a = o.items[0]`. Any
other value on the right, such as a call, is evaluated once and held in a
hidden local first, which the optimiser removes. An empty pattern,
`const {} = p` or `const [] = xs`, binds nothing but still evaluates the right
side once.

## Arrays

An array pattern reads elements by their position. Leave a position empty to
skip it:

<!-- nish:ok-body -->
```ts
const xs: i32[] = [10, 20, 30];
let [a, , c] = xs;
if (a < 1000000) {
  a = a + 1;
}
console.log(`${a} ${c}`);
```

This prints `11 30`. Each element is checked against the array's length like
`xs[i]` is: the compiler refuses a position it cannot prove in range, and
under `--allow-panics`, where TypeScript would bind `undefined` for an element
past the end, Nish stops with `index out of range`, because a name always
holds a value of its type.

## In a `for...of`

<!-- nish:ok -->
```ts
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): i32 => {
  const points: Point[] = [new Point(1, 2), new Point(3, 4)];
  let sum = 0;
  for (const { x, y } of points) {
    if (x < 0 || x > 1000 || y < 0 || y > 1000 || sum > 1000000000) {
      return 1;
    }
    sum = sum + x * y;
  }
  console.log(`${sum}`);
  return 0;
};
```

This prints `14`. The walk must be over an array; a `Map`'s entries are
`[key, value]` pairs of two types, which Nish does not have, so walk `keys()`
and call `get` instead ([Maps and sets](maps-and-sets.md)).

## What is not supported

Each of these is refused with its own diagnostic, and most of them say how
to write it instead:

- **Assigning to a pattern**, `[a, b] = [b, a]` or `({ x } = p)`: declare fresh names with
  `const` or `let`, or assign each name.
- **Defaults and rests**, `{ x = 0 }` and `[first, ...rest]`: every name is
  read, so read each element you need by name.
- **Nested patterns**, `{ p: { x } }`: bind the inner value to a name and
  destructure that.
- **Computed or quoted keys**, `{ ["x"]: a }`: name the field, `{ x: a }`.
- **A value that may be absent**, a `T | null` or the `V | undefined` that
  `Map.get` returns: narrow it first, as in `if (p !== null)`.
- **A `Map`, a `Set` or a `string`**: read a `Map` with `get`, a `Set` with
  `has` or a `for...of`, a `string` by index.
- **A method**, `{ norm }`: a pattern reads fields; call the method.
- **A pattern over `awaitAll`** that is not one plain name per call: an
  object pattern, a hole or a default. Name each answer, `_b` for one you do
  not read ([Async functions](async.md)).
- **Parameters and module constants**: destructure inside the function body.
  A module constant is a compile-time value the compiler folds into each
  use, so there is no receiver at run time for a pattern to read.

<!-- nish:err-body NL2775 -->
```ts
const [first, ...rest] = [1, 2, 3];
console.log(`${first}`);
```

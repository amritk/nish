# Destructuring

A `const` or `let` can take a value apart into names: the fields of an object,
or the elements of an array. The head of a `for...of` can do the same for each
element it walks. Each name is read straight from the value, which is never
copied. The normative rules are in the reference's
[Destructuring declarations](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#destructuring-declarations)
section.

## Objects

An object pattern reads fields of a class or interface value. Write a field's
name to bind it under that name, or `field: name` to rename it:

```ts nish:ok
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
  console.log(`${x * x + py * py}`);
  return 0;
};
```

This prints `25`. A name the class does not have is refused, as `p.z` would
be.

## Arrays

An array pattern reads elements by their position. Leave a position empty to
skip it:

```ts nish:ok-body
const xs: i32[] = [10, 20, 30];
let [a, , c] = xs;
a = a + 1;
console.log(`${a} ${c}`);
```

This prints `11 30`. Each element is checked against the array's length like
`xs[i]` is: where TypeScript would bind `undefined` for an element past the
end, Nish stops with `index out of range`, because a name always holds a value
of its type.

## In a `for...of`

```ts nish:ok
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

Each of these is refused with a message that says how to write it instead:

- **Assigning to a pattern**, `[a, b] = [b, a]`: declare fresh names with
  `const` or `let`, or assign each name.
- **Defaults and rests**, `{ x = 0 }` and `[first, ...rest]`: every name is
  read, so read each element you need by name.
- **Nested patterns**, `{ p: { x } }`: bind the inner value to a name and
  destructure that.
- **Computed or quoted keys**, `{ ["x"]: a }`.
- **A value that may be `null`**: narrow it first, as in `if (p !== null)`.
- **A `Map` or a `string`**: read a `Map` with `get`, a `string` by index.
- **Parameters and module constants**: destructure inside the function body.

```ts nish:err-body NL2773
const [first, ...rest] = [1, 2, 3];
console.log(`${first}`);
```

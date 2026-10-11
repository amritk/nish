# Generics

A generic function, class or interface is written once and used with many
types, with TypeScript's angle-bracket syntax. What differs from TypeScript is
what happens next: Nish compiles a separate copy for each set of types you
actually use, so a generic costs exactly what the same code written out by
hand for that type would, with no boxing and no type checks at run time. The
reference sections are
[Generic functions](../../LANGUAGE.md#generic-functions),
[Generic classes and interfaces](../../LANGUAGE.md#generic-classes-and-interfaces)
and [Generic methods](../../LANGUAGE.md#generic-methods).

## Generic functions

Both ways of writing a function take type parameters:

```ts nish:ok
const identity = <T>(x: T): T => x;

function lastOf<T>(items: T[], fallback: T): T {
  return items.length === 0 ? fallback : items[items.length - 1];
}

export const main = (): i32 => {
  console.log(`${identity(7)} ${identity("seven")}`);
  console.log(lastOf(["a", "b", "c"], "none"));
  console.log(`${lastOf([true, false], true)}`);
  return 0;
};
```

This prints `7 seven`, `c` and `false`. The program contains four functions:
`identity` at `i32` and at `string`, and `lastOf` at `string` and at
`boolean`.

**Type arguments are inferred, never written at a call.** The compiler works
`T` out from the arguments, so `identity<i32>(7)` is refused and
`identity(7)` is what you write:

```ts nish:err NL2303
const identity = <T>(x: T): T => x;

export const main = (): i32 => {
  return identity<i32>(7);
};
```

It follows that every type parameter has to appear in some parameter: a
function like `<T>(): T[]` could never be called, so its declaration is
refused.

## Generic classes and interfaces

A class or interface takes type parameters too. Here the type arguments are
always written out, after `new` or in a type annotation, because there is
nothing to infer them from:

```ts nish:ok
class Stack<T> {
  items: T[];

  constructor() {
    this.items = [];
  }

  push(item: T): void {
    this.items.push(item);
  }

  peek(fallback: T): T {
    return this.items.length === 0 ? fallback : this.items[this.items.length - 1];
  }
}

interface Pair<A, B> {
  first: A;
  second: B;
}

export const main = (): i32 => {
  const names = new Stack<string>();
  names.push("ada");
  names.push("grace");

  const entry: Pair<string, i32> = { first: names.peek(""), second: 85 };
  console.log(`${entry.first} ${entry.second}`);
  return 0;
};
```

This prints `grace 85`.

`Stack` on its own is not a type, because its layout depends on `T`: write
`Stack<string>`. A type argument can be anything a type can be, another
instantiation included (`Stack<Pair<string, i32>>`).

To return two values from a function, the standard library has this same
interface ready made: `import { Pair } from "nish/pair"`.

## Generic methods

A method can have type parameters of its own, inferred at the call like a
function's. On a generic class it can use the class's parameters as well, but
it cannot reuse their names:

```ts nish:ok
class Chooser {
  flip: boolean = false;

  pick<T>(a: T, b: T): T {
    return this.flip ? b : a;
  }
}

export const main = (): i32 => {
  const c = new Chooser();
  c.flip = true;
  console.log(`${c.pick(1, 2)} ${c.pick("left", "right")}`);
  return 0;
};
```

This prints `2 right`.

## Constraints

Inside a generic body a `T` can be passed on, stored, returned and compared,
but you cannot read a field or call a method on it, even if every type you
use it with has one:

```ts nish:err NL2329
class Square {
  area: i32;

  constructor(area: i32) {
    this.area = area;
  }
}

const areaOf = <T>(s: T): i32 => s.area;

export const main = (): i32 => areaOf(new Square(4));
```

`<T extends Shape>` says which members `T` has: exactly those of `Shape`. A
type argument then has to *be* `Shape`, or a class that declares
`implements Shape`; having fields with the same names is not enough.

```ts nish:ok
interface Shape {
  area: i32;
}

class Square implements Shape {
  area: i32;

  constructor(side: i32) {
    this.area = side * side;
  }
}

class Rect implements Shape {
  area: i32;

  constructor(w: i32, h: i32) {
    this.area = w * h;
  }
}

const larger = <T extends Shape>(a: T, b: T): T => (a.area >= b.area ? a : b);

export const main = (): i32 => {
  const s = larger(new Square(3), new Square(4));
  const r = larger(new Rect(2, 3), new Rect(1, 5));
  console.log(`${s.area} ${r.area}`);
  return 0;
};
```

This prints `16 6`. Each copy reads `area` straight out of `Square` or `Rect`;
there is no lookup at run time.

A constraint is a class or an interface. `T extends i32`, `T extends string`
and a constraint that mentions another type parameter are refused, and so are
several bounds at once (`T extends A & B`).

## What generics do not have

- **No default type arguments**: `<T = string>` is refused, since a type
  argument is inferred or written out.
- **No type parameters on a constructor**: a constructor uses its class's.
- **No type parameters on a type alias.**
- **No generic `main`**: nothing could supply its type arguments.
- **No recursion that grows the type.** A generic function that calls itself
  at `T[]`, or a class with a field of type `Nest<T[]>`, would need an endless
  series of copies, and is refused with a message that says so.

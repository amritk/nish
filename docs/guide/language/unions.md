# Discriminated unions

A discriminated union is a type that holds one of several classes or
interfaces, and a tag that says which. In Nish each variant records its tag in
its first field, a `readonly` field of an
[enum member type](types.md#enum-member-types), and the union reads that tag.
The normative rules are in the reference's
[Discriminated unions](../../LANGUAGE.md#discriminated-unions) section.

```ts nish:ok
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 4;
}

type Shape = Circle | Square;

const pick = (round: boolean): Shape => (round ? new Circle() : new Square());

const name = (s: Shape): string => (s.kind === Kind.Circle ? "circle" : "square");

export const main = (): i32 => {
  const shapes: Shape[] = [pick(true), new Square()];
  for (const s of shapes) {
    console.log(name(s)); // circle, then square
  }
  return 0;
};
```

## What makes a variant

Every variant is a class or an interface that is not generic, and its first
field is its tag: a field whose type is one member of an enum. All the
variants of one union take their tags from the same enum, give the tag the
same name, and have different tags, so the tag tells them apart. A union
names at least two different variants.

A class without such a field is not a variant:

```ts nish:err NL2523
class Point {
  x: i32 = 0;
}

class Line {
  length: i32 = 0;
}

type Thing = Point | Line;
```

The tag's type is the one member, `readonly kind: Kind.Circle = Kind.Circle`,
not the whole enum: `readonly kind: Kind = Kind.Circle` is an error (NL2551),
because every variant would then share that type and a test of it could not
tell them apart.

The tag is `readonly`, so a variant keeps the tag it was built with. A class
that implements an interface variant is not a variant itself: convert it to
the interface first, `const r: Ring = new Band()`.

Any other union, such as `i32 | string`, is refused, as before. `T | null`
still works, and so does `Shape | null`.

## Where a union goes

A union is the type of a local, a parameter, a field, a return value or an
array element, and `Shape | null` of any of those. An alias may name another
union: with `type Round = Circle | Square`, `type Shape = Round | Tri` holds
all three. A variant converts into it wherever one is expected: a
`new Circle()` passed to a `Shape` parameter, returned from a function that
answers `Shape`, or written into a `Shape[]` literal; so does a `Round` where
a `Shape` is wanted.

A union crosses modules like any exported type, but not a C header or a N-API
bridge: a sidecar has no C spelling for it yet, so an exported signature that
holds one is refused. So is a field that holds one, in any class or interface
of the program, exported or not: a header lays out every class, a private one
too.

A union is not a type argument, so `Box<Shape>`, `Map<string, Shape>`,
`Set<Shape>` and `Result<Shape, string>` are refused, and so is a call to a
generic function that would bind its type parameter to a union:

```ts nish:err NL2533
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
}

type Shape = Circle | Square;

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

export const main = (): i32 => {
  const b = new Box<Shape>(new Circle());
  return 0;
};
```

## Reading the tag

Through the union itself, the tag is the one member you can read. `s.kind`
reads it, and it compares, switches and passes as the enum. Any other field or
method of a variant is an error until a test of the tag says which variant
`s` is, and so is writing to the union's fields, even one every variant has.

```ts nish:err NL2528
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  r: i32 = 4;
}

type Shape = Circle | Square;

const radius = (s: Shape): i32 => s.r;
```

Give the tag a type when you store it, `const k: Kind = s.kind`. TypeScript
would infer the union of the variants' tags, `Kind.Circle | Kind.Square`,
which is not a type Nish has in this version.

## Narrowing by the tag

A test of the tag narrows the union, as in TypeScript. Inside
`if (s.kind === Kind.Circle) { ... }`, `s` is a `Circle`, and every field and
method of `Circle` reads through it; in the `else`, and after an `if` whose
body always leaves with `return`, `break`, `continue` or a `panic(...)`, it is
whatever variants remain. `!==`, the operands the other way round
(`Kind.Circle === s.kind`), a ternary, `&&` and `||` narrow the same way, and
so does each `case` of a `switch (s.kind)`, with `default` holding the
variants no `case` named.

```ts nish:ok
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 4;
}

type Shape = Circle | Square;

const area = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return 3 * s.r * s.r;
  }
  return s.side * s.side;
};

const perimeter = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 6 * s.r;
    default:
      return 4 * s.side;
  }
};

export const main = (): i32 => {
  const shapes: Shape[] = [new Circle(), new Square()];
  let total = 0;
  for (const s of shapes) {
    total = total + area(s) + perimeter(s);
  }
  console.log(total);
  return 0;
};
```

Where an `||` held, either side may be the one that held, so the variable is
whatever either side proved: inside
`if (s.kind === Kind.Circle || s.kind === Kind.Square)`, `s` is a
`Circle | Square`. That union still has only its tag, but its tag cannot be
`Kind.Tri`, so testing for it there is an error (NL2531). The side of an `&&`
where it failed works the same way, and so does an enum variable. A test may
also read the variable through an assignment, as in
`if ((t = next()).kind === Kind.Square)`, which narrows the `t` just stored.

An assignment to the variable drops what a test proved, so a read after it
needs a new test. A narrowing belongs to a variable or a parameter: a test of
`a.b.kind` does not narrow `a.b`, which is an error (NL2550) — copy it into a
`const` and test that. And where TypeScript would type a value `never`,
because every tag has been tested away, reading it is an error (NL2549).

A comparison the tests above it have already ruled out is an error, as in
TypeScript: after `if (s.kind === Kind.Circle) { return 1; }`, a second
`s.kind === Kind.Circle` can never be true. So is one against a tag stored in
`const k: Kind = s.kind` that no variant has, because the local holds only the
variants' members.

Any variable of an enum type narrows the same way, a parameter `k: Kind` as
much as that tag local: a test of `k === Kind.Circle` or `k !== Kind.Circle`,
in every form above and in a `switch (k)`, leaves `k` holding only the members
the test allows, so a second test it already decided is an error (NL2531).

```ts nish:err NL2531
enum Kind {
  Circle,
  Square,
  Tri,
}

const sides = (k: Kind): i32 => {
  if (k === Kind.Circle) {
    return 0;
  }
  return k === Kind.Circle ? 1 : 4;
};
```

Narrowed to one member, the variable has that member's type, so `let j = k`
is a `Kind.Square`. Narrowed to several, `const j = k` needs its annotation,
`const j: Kind = k`, for the reason the tag does (NL2530). And `s.kind === k`
narrows `s` only when `k` holds one member; to pick out several variants, test
the members themselves or `switch (s.kind)`.

A comparison that can never be true is an error, as in TypeScript:
`s.kind === Kind.Tri` when no variant has the tag `Kind.Tri`, or a `case
Kind.Tri:` in a `switch (s.kind)`.

## Declare what you store

TypeScript narrows a union-typed variable to the type of the value it was
last given: after `let s: Shape = new Circle()`, it treats `s` as a `Circle`.
This version does not track that, so it refuses a store that would narrow,
and asks for one of two things instead: declare the variable as the variant,
or give it a value of the whole union, such as a call that returns `Shape`.

```ts nish:err NL2534
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
}

type Shape = Circle | Square;

export const main = (): i32 => {
  const s: Shape = new Circle();
  return s.kind === Kind.Circle ? 0 : 1;
};
```

Checking that a `switch` covers every variant comes in a later version.

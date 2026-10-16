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

Any other union, such as `i32 | string`, is refused, as before. `T | null`
still works, and so does `Shape | null`.

## Where a union goes

A union is the type of a local, a parameter, a field, a return value or an
array element. A variant converts into it wherever one is expected: a
`new Circle()` passed to a `Shape` parameter, returned from a function that
answers `Shape`, or written into a `Shape[]` literal.

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

The tag is the one member a union has in this version. `s.kind` reads it, and
it compares, switches and passes as the enum. Any other field or method of a
variant needs the variant itself; reading it through the union is an error,
and so is writing to the union's fields.

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

Narrowing a union with `if` or `switch`, and checking that a `switch` covers
every variant, come in later versions.

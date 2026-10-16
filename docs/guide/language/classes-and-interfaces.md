# Classes and interfaces

A class is a record with a constructor and methods; an interface is a record
with fields only. Neither has a hidden header, a vtable or a parent: a class
is laid out exactly as the same struct would be in C. The normative rules are
in the reference's [Classes](../../LANGUAGE.md#classes) and
[Interfaces and object literals](../../LANGUAGE.md#interfaces-and-object-literals)
sections.

## Classes

```ts nish:ok
class Counter {
  name: string;
  count: i32 = 0;

  constructor(name: string) {
    this.name = name;
  }

  bump(by: i32): void {
    this.count = this.count + by;
  }

  describe(): string {
    return `${this.name}: ${this.count}`;
  }
}

export const main = (): i32 => {
  const c = new Counter("clicks");
  c.bump(2);
  c.bump(3);
  console.log(c.describe());   // clicks: 5
  return 0;
};
```

- **Every field has a type annotation.** A field initializer, like
  `count: i32 = 0`, must be a literal; anything computed goes in the
  constructor.
- **Every field holds a value when the constructor returns.** The compiler
  checks this, and refuses a read of `this.f` (or a method call on `this`)
  before every field is assigned. A class with no constructor initialises
  every field in its declaration.
- **At most one constructor.** `constructor(public x: i32)` shorthand is not
  supported: declare the field and assign it.
- **Methods need a return type**, and `this` is valid only inside a method or
  the constructor.
- **`===` on two objects is identity**, never a comparison of their fields.
- `public`, `private` and `protected` are accepted and ignored. `static`
  members, getters and setters are not supported: use a module `const` or a
  top-level function, and a plain method.

## `readonly`

A `readonly` field is assigned in its own class's constructor and nowhere
else:

```ts nish:err NL2181
class Account {
  readonly id: i32;
  balance: i32 = 0;
  constructor(id: i32) {
    this.id = id;
  }
}

export const main = (): i32 => {
  const a = new Account(7);
  a.id = 8;
  return 0;
};
```

## Interfaces and object literals

An interface describes a record by its fields — no methods. You create one
with an object literal, which takes its type from where it is written (an
annotation, a parameter, a return type) and must set every field exactly
once:

```ts nish:ok
interface Point {
  x: i32;
  y: i32;
}

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

export const main = (): i32 => {
  const p: Point = { x: 1, y: 2 };
  const q = add(p, { x: 10, y: 20 });
  console.log(`${q.x} ${q.y}`);   // 11 22
  return 0;
};
```

Behaviour that belongs to an interface is a top-level function that takes
it, as `add` does here. An object literal has fields only: no methods, no
spread, and no computed keys.

## `implements`

`class C implements I` says that `C`'s first fields are exactly `I`'s
fields, in the same order and with the same types; `C` may add more after
them. A `C` is then accepted anywhere an `I` is expected. This is the only
widening between class and interface types, and it goes one way: nothing
turns an `I` back into a `C`.

```ts nish:ok
interface Shape {
  width: i32;
  height: i32;
}

class Rect implements Shape {
  width: i32;
  height: i32;
  constructor(width: i32, height: i32) {
    this.width = width;
    this.height = height;
  }
}

class Frame implements Shape {
  width: i32;
  height: i32;
  border: i32;
  constructor(width: i32, height: i32, border: i32) {
    this.width = width;
    this.height = height;
    this.border = border;
  }
}

const area = (s: Shape): i32 => s.width * s.height;

export const main = (): i32 => {
  console.log(`${area(new Rect(3, 4))}`);        // 12
  console.log(`${area(new Frame(5, 5, 1))}`);    // 25
  return 0;
};
```

The order matters: a class whose fields match the interface's in some other
order, or that has them after a field of its own, is refused, because the
interface reads each field at a fixed offset.

## Why there is no inheritance

`class B extends A` and `super` are refused in every form. Without
inheritance, a method call always names exactly one function, so the
compiler calls it directly — or inlines it — and an object needs no vtable
or type tag. It also means no hidden behaviour: what a method does is
written in its own class.

What `extends` usually buys you has a direct replacement:

- **Shared fields** — declare them in an interface, repeat them as the first
  fields of each class, and write `implements`.
- **Shared behaviour** — a top-level function over the interface, like
  `area` above.
- **Shared code with a different type inside** — a generic class or function;
  see [Generics](generics.md).

```ts nish:err NL2278
class Animal {
  name: string = "";
}

class Dog extends Animal {
  barks: boolean = true;
}
```

There is no `instanceof` and no downcast either: a value's type is the one
it was declared with. Where a function needs to tell kinds of thing apart,
store the kind in a field — a numeric `enum` is the usual choice, and a
`readonly` field of an [enum member type](types.md#enum-member-types) fixes
it for every object of a class — and `switch` on it.

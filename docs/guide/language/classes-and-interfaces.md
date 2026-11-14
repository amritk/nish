# Classes and interfaces

A class is a record with a constructor and methods; an interface is a record
with fields only. Neither has a hidden header, a vtable or a parent: a class
is laid out exactly as the same struct would be in C. The normative rules are
in the reference's [Classes](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#classes) and
[Interfaces and object literals](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#interfaces-and-object-literals)
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
it, as `add` does here. An object literal has fields only: no methods and
no computed keys. It may spread another record into itself, as the next
section shows.

### A record type always has a name

If you are coming from TypeScript, you may reach for an inline object type,
or a `type` alias of one. Nish has neither: every type you write is a name,
and the parser stops at the `{`:

```ts nish:err NL0001
const getX = (p: { x: i32 }): i32 => p.x;

export const main = (): i32 => {
  return getX({ x: 1 });
};
```

`type Point = { x: i32; y: i32 }` is refused with the same message,
`` expected a type name, found `{` ``, because a `type` alias only gives a
second name to a type that already exists. Declare the shape once as an
interface, as `Point` above, and name it wherever the type is written. Nish
compares records by name rather than by shape, so two interfaces with the
same fields are still two different types.

A literal can also stand for a class without methods. A class
with methods is different: it is made only by `new`. Compiled, a literal
would get the class's methods, but under Node it is a plain object, and
calling a method on it throws. So the compiler refuses it with NL2556:

```ts nish:err NL2556
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}

export const main = (): i32 => {
  const c: Counter = { n: 5 };
  return c.get();
};
```

The message names the remedy — `` `Counter` has methods, so it is made only
by `new`: ... Write `new Counter(...)` `` — and the fix is
`const c = new Counter(5)`.

## Object spread

`{ ...base, x: 1 }` copies every field of `base` into the new literal, then
sets the fields written after it. It compiles to the same code as writing
each field out (`{ x: 1, y: base.y }`), so it costs nothing extra:

```ts nish:ok
interface Style {
  color: string;
  width: i32;
  dashed: boolean;
}

export const main = (): i32 => {
  const base: Style = { color: "red", width: 2, dashed: false };
  const dashed: Style = { ...base, dashed: true };
  console.log(`${dashed.color} ${dashed.width} ${dashed.dashed}`);   // red 2 true
  return 0;
};
```

Entries run in the order they are written, each spread once, and a later
entry wins over an earlier one. Like any object literal, the literal needs a
type from where it is written, and must end up setting every field of it.

A spread is accepted only where it means the same thing natively and under
Node, so the compiler refuses:

- a literal with no declared type (`const o = { ...s }`) — annotate it;
- a source that may be `null` — narrow it with `if (s !== null)` first;
- a union source, whose fields depend on which variant it holds;
- a source with a field the target does not declare, which Node would keep
  on the object — this includes an interface value that may hold a class
  with more fields than the interface lists;
- a field whose type differs between the two, such as `i32` into `i64`;
- a field set by name *before* a spread that overwrites it — move it after.

```ts nish:err NL2709
interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  const p: Point = { x: 1, y: 2 };
  const q = { ...p, x: 3 };
  return q.x;
};
```

A class instance spreads its fields and none of its methods, as it does under
Node; the target must be a type with fields alone. The full rules are in
[LANGUAGE.md → Interfaces and object
literals](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#interfaces-and-object-literals).

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
it for every object of a class — and `switch` on it. A
[discriminated union](unions.md) of such classes holds any one of them and
reads that field to tell which.

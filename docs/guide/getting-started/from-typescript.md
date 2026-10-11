# Coming from TypeScript

A Nish program is a TypeScript file: every line of it is TypeScript syntax.
What Nish leaves out is everything that only works because JavaScript decides
things while the program runs: what type a value has, whether an exception
unwinds, which method a call reaches. Nish decides all of that when it
compiles, so it refuses the constructs that would need a decision at run time.
This page lists what carries over, what is refused, and what to write instead
of each refused construct.

## What carries over

Most everyday TypeScript compiles as it is:

```ts nish:ok
interface Point {
  x: i32;
  y: i32;
}

enum Direction {
  Up,
  Down,
}

class Counter {
  count: i32 = 0;

  add(n: i32): void {
    this.count = this.count + n;
  }
}

const manhattan = (p: Point): i32 => {
  const ax = p.x < 0 ? -p.x : p.x;
  const ay = p.y < 0 ? -p.y : p.y;
  return ax + ay;
};

const step = (d: Direction): i32 => {
  switch (d) {
    case Direction.Up:
      return 1;
    case Direction.Down:
      return -1;
  }
  return 0;
};

export const main = (): i32 => {
  const points: Point[] = [
    { x: 3, y: -4 },
    { x: -1, y: 2 },
  ];
  const c = new Counter();
  for (const p of points) {
    c.add(manhattan(p));
  }
  c.add(step(Direction.Up));
  console.log(`total: ${c.count}`);
  return 0;
};
```

That program prints `total: 11`. It uses `const` and `let`, arrow functions,
interfaces, classes with fields and methods, numeric enums, object and array
literals, `for...of`, `switch`, the ternary operator and template literals,
all as TypeScript has them. `if`, `while`, `do...while`, `break`, `continue`,
`===` and named `import` and `export` work too. With the declarations the
package ships in `runtime/nish.d.ts` (which declare `i32`, `f64`, `Result` and
the other built-in names) on the include path, the program also type-checks
under `tsc --strict`, so your editor keeps working on it. `tsc` accepting a
program does not mean `nish` will: `nish` is the authority, as the
reference's [It is still TypeScript](../../LANGUAGE.md#it-is-still-typescript)
says.

The rest of this page is the difference. Each refusal below is shown as the
compiler reports it, with its error code.

## `number` is an integer

In Nish, `number` means `i32`, a 32-bit integer, so `7 / 2` is `3`. A
fractional value needs `f64`, the 64-bit floating-point type that a JavaScript
`number` is:

```ts nish:err NL2068
const ratio: number = 0.5;
```

```ts nish:ok
const ratio: f64 = 0.5;
```

The widths are written in the type, and there is one for each machine type:
`i32` and `i64` for signed integers, `u8`, `u16`, `u32` and `u64` for unsigned
ones, and `f32` and `f64` for floating point. Two different types never mix in
arithmetic, and nothing converts on its own:

```ts nish:err NL2102
const area = (r: f64): f64 => 3.14159 * r * r;

const total = (n: i32, r: f64): f64 => {
  return n * area(r);
};
```

Convert explicitly with `toF64`, `toI32`, `toI64`, `toU8` and the others:

```ts nish:ok
const area = (r: f64): f64 => 3.14159 * r * r;

const total = (n: i32, r: f64): f64 => {
  return toF64(n) * area(r);
};
```

Integer arithmetic is also checked: an `i32` or `i64` that overflows stops the
program instead of wrapping round. The `--number-mode f64` flag makes `number`
mean `f64` for a whole program, which is closer to JavaScript; writing `i32`
or `f64` directly reads the same in both modes. See
[Types](../language/types.md), and the reference's
[Types](../../LANGUAGE.md#types) and
[Numeric literals](../../LANGUAGE.md#numeric-literals).

## No `any`, `unknown` or union types

Every value has exactly one type, known when the program compiles.

```ts nish:err NL1013
const show = (x: any): void => {
  console.log(`${x}`);
};
```

The same goes for `unknown`, and for unions such as `i32 | string`:

```ts nish:err NL1053
const show = (x: i32 | string): void => {
  console.log(`${x}`);
};
```

Name the real type. When a function has to take more than one, write one
function per type. The one union Nish allows is `T | null`, where `T` is a
class, an interface, an array or a string; the next section covers it.
`undefined` is refused in the same way: use `null`.

## No `?.` or `??`

```ts nish:err NL1049
class Node {
  value: i32 = 0;
  next: Node | null = null;
}

const nextValue = (n: Node): i32 => {
  return n.next?.value ?? 0;
};
```

Copy the nullable value into a local, compare it with `null`, and the compiler
narrows it to the non-null type inside the branch:

```ts nish:ok
class Node {
  value: i32 = 0;
  next: Node | null = null;
}

const nextValue = (n: Node): i32 => {
  const next = n.next;
  if (next === null) {
    return 0;
  }
  return next.value;
};
```

Narrowing works on a local variable or a parameter, never on a property path
such as `n.next`, which is why the example copies `n.next` into `next` first.
`??` is refused on its own as well (`NL1048`), with one exception: the result
of `Map.get`, as in `counts.get(key) ?? 0`. See the reference's
[Nullable types](../../LANGUAGE.md#nullable-types).

## No exceptions

There is no `throw`, no `try` and no `catch`:

```ts nish:err NL1001
const half = (n: i32): i32 => {
  if (n % 2 !== 0) {
    throw new Error("odd");
  }
  return n / 2;
};
```

A function that can fail says so in its return type, with `Result<T, E>`. It
returns `Ok(value)` or `Err(error)`, and the caller has to check which before
it can read the value:

```ts nish:ok
const half = (n: i32): Result<i32, string> => {
  if (n % 2 !== 0) {
    return Err("odd");
  }
  return Ok(n / 2);
};

export const main = (): i32 => {
  const r = half(7);
  if (r.isErr()) {
    console.error(r.error);
    return 1;
  }
  console.log(`${r.value}`);
  return 0;
};
```

Seven is odd, so this program prints `odd` on stderr and exits with 1.

A `Result` cannot be ignored: a call that returns one cannot stand on its own
as a statement, and reading `r.value` before checking `r.isErr()` or
`r.isOk()` is an error. For a state the program cannot recover from, call
`panic("message")`, which prints the message and ends the program with exit
code 1. [Errors and `Result`](../language/errors.md) covers the rest,
including `orReturn()`, which passes an error up to the caller like Rust's
`?`. The reference is
[Result and error handling](../../LANGUAGE.md#result-and-error-handling).

## Classes without inheritance

Classes have fields, one constructor and methods, but no `extends`:

```ts nish:err NL2278
class Animal {
  name: string = "";
}

class Dog extends Animal {
  barks: boolean = true;
}
```

To share a shape, declare it as an interface, and have each class
`implements` it. The class lists the interface's fields first, in the same
order. Then a function that takes the interface accepts any of those classes:

```ts nish:ok
interface Animal {
  name: string;
}

class Dog implements Animal {
  name: string;
  barks: boolean = true;

  constructor(name: string) {
    this.name = name;
  }
}

class Cat implements Animal {
  name: string;
  lives: i32 = 9;

  constructor(name: string) {
    this.name = name;
  }
}

const greet = (a: Animal): void => {
  console.log(`hello, ${a.name}`);
};

export const main = (): i32 => {
  greet(new Dog("Rex"));
  greet(new Cat("Tom"));
  return 0;
};
```

An interface holds fields only, never methods: behaviour that several classes
share is a top-level function that takes the interface, like `greet` above.
There is also no `abstract`, no `static`, and no getters or setters. See
[Classes and interfaces](../language/classes-and-interfaces.md) and the
reference's [Classes](../../LANGUAGE.md#classes).

## Smaller reflexes

These come up often enough to know before you meet them:

| TypeScript | Nish refuses it with | Write instead |
| --- | --- | --- |
| `if (xs.length)` | `NL2188`: a condition must be a `boolean` | `if (xs.length !== 0)` |
| `a == b` | `NL1047`: loose equality | `a === b` |
| `xs.map(f)`, `.filter`, `.forEach` | `NL2249`: unknown method | a `for...of` loop |
| `String(n)`, `n.toString()` | `NL2247`: unknown function, `NL2249`: unknown method | `` `${n}` `` |
| `async`, `await`, `Promise` | `NL1015` for `async`: there is no event loop | the file and process functions are synchronous |

`nish --fix` rewrites the first, second and fourth of these for you, as
[Your first program](first-program.md#fixes-the-compiler-can-make-for-you)
shows.

```ts nish:err-body NL2188
const xs = [1, 2, 3];
if (xs.length) {
  console.log("non-empty");
}
```

The full list of refused constructs, each with its message and what to write
instead, is the reference's
[Forbidden constructs](../../LANGUAGE.md#forbidden-constructs-phase-0-validator)
and [Rejected by the checker](../../LANGUAGE.md#rejected-by-the-checker).

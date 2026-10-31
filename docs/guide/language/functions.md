# Functions

A Nish function is an arrow bound to a top-level `const`, with every
parameter and its return type written out. The normative rules are in the
reference's [Functions](../../LANGUAGE.md#functions),
[`main`](../../LANGUAGE.md#main) and
[Function parameters](../../LANGUAGE.md#function-parameters) sections.

## Declaring a function

```ts nish:ok
const add = (a: i32, b: i32): i32 => {
  return a + b;
};

const double = (n: i32): i32 => n * 2;   // a concise body is one `return`

const greet = (name: string): void => {
  console.log(`hello, ${name}`);
};

export const main = (): i32 => {
  greet("nish");                             // hello, nish
  console.log(`${double(add(2, 3))}`);       // 10
  return 0;
};
```

- **Annotate every parameter and the return type.** A function's signature
  is never inferred from its body.
- **Functions live at the top level.** A function declared inside another
  one is refused; so is a `let` bound to an arrow.
- **Order does not matter.** A top-level function is in scope for the whole
  file, so two functions may call each other whichever is written first.
- **A call passes every argument it has no default for**, each of exactly
  the parameter's type. See [Default and rest
  parameters](#default-and-rest-parameters); optional (`n?: i32`) and
  destructured parameters are not supported.
- **A non-`void` function returns on every path**, or ends in
  `panic(message)` or `process.exit(code)`.

The `function` keyword is accepted too, and compiles to exactly the same
thing; the arrow is the house style.

## Default and rest parameters

A trailing parameter may have a **default**, which a call that leaves it out
passes. A default is a constant — a number, `true`/`false`, a string, an enum
member — or the name of an earlier parameter, and the parameter keeps its type
annotation:

```ts nish:ok
const scale = (x: i32, by: i32 = 2): i32 => x * by;
const area = (w: i32, h: i32 = w): i32 => w * h;

export const main = (): i32 => {
  console.log(`${scale(3)} ${scale(3, 5)}`);   // 6 15
  console.log(`${area(4)} ${area(4, 2)}`);     // 16 8
  return 0;
};
```

The last parameter may instead be a **rest parameter**, an array that gathers
every remaining argument. A call with none passes an empty array:

```ts nish:ok
const total = (...xs: i32[]): i32 => {
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  return sum;
};

export const main = (): i32 => {
  console.log(`${total()} ${total(1, 2, 3)}`);  // 0 6
  return 0;
};
```

The call fills both in, so a function with a default costs nothing when it is
given every argument. Methods and constructors take them too. A function
has a default or a rest parameter, not both.

Optional parameters (`n?: i32`) are refused; write a default instead:

```ts nish:err NL2603
const greet = (name?: string): string => "hi";
```

A call never spreads an array into arguments; pass the array to a parameter
of array type:

```ts nish:err-body NL2604
const xs: i32[] = [1, 2];
console.log(`${Math.max(...xs)}`);
```

## Parameters are read-only

Assigning to a parameter is an error. Copy it into a `let` when you need a
value that changes:

```ts nish:err NL2179
const countdown = (n: i32): i32 => {
  n = n - 1;
  return n;
};
```

```ts nish:ok
const countdown = (n: i32): i32 => {
  let left = n;
  while (left > 0) {
    left--;
  }
  return left;
};
```

## `main`

A program starts at `export const main` in the file you compile. It takes no
parameters and returns either `void` (exit status 0) or an `i32`, which is
the process's exit status:

```ts nish:ok
export const main = (): i32 => {
  if (process.argv.length < 2) {
    console.error("usage: greet <name>");
    return 2;
  }
  console.log(`hello, ${process.argv[1]}`);
  return 0;
};
```

The command line is `process.argv`, a read-only `string[]`. Its first
element is the program's own path, so the first argument you pass is
`process.argv[1]` — one index earlier than under Node, where `argv[0]` is
`node` itself.

## Passing a function to a function

A function is not a value in Nish: you cannot store one in a variable, a
field or an array, or return one. What you *can* do is give a top-level
function a **parameter of function type**, and pass it either a named
top-level function or an arrow written right at the call:

```ts nish:ok
const countWhere = (xs: i32[], keep: (x: i32) => boolean): i32 => {
  let n = 0;
  for (const x of xs) {
    if (keep(x)) {
      n++;
    }
  }
  return n;
};

const isEven = (x: i32): boolean => x % 2 === 0;

export const main = (): i32 => {
  const xs = [1, 2, 3, 4, 5, 6];
  console.log(`${countWhere(xs, isEven)}`);               // 3
  console.log(`${countWhere(xs, (x) => x > 4)}`);          // 2
  return 0;
};
```

The compiler resolves each such argument when it compiles the call and makes
a copy of `countWhere` that calls it directly, so there is no function
pointer and nothing to allocate at run time. That decides the rules:

- **The parameter can only be called, or passed on** to another function
  parameter.
- **An arrow may read the `const` locals and the parameters of the function
  it is written in.** The compiler hands each one to the copy as one more
  argument, so it is still a direct call with nothing allocated. A captured
  array or object may be written through (`hits.push(x)`), because the arrow
  runs during the call, on the same thread:

```ts nish:ok
const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

export const main = (): i32 => {
  const limit = 3;
  const hits: i32[] = [];
  each([1, 5, 2, 7], (x) => {
    if (x > limit) {
      hits.push(x);
    }
  });
  console.log(`${hits.length}`);   // 2
  return 0;
};
```

- **What it captures is read, never reassigned**, and it may not read a
  `let`, which could change before the arrow runs; bind it to a `const`
  first (`nish --fix` does). It may not read `this` (bind `const self = this`),
  or the function's own function parameters. An arrow inside another arrow
  reads only its own parameters, and an arrow given to a method or a
  constructor, or to `expose`, captures nothing:

```ts nish:err NL2585
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  let k = 3;
  k = k + 1;
  return apply((x) => x + k, 1);
};
```

- **The argument's type must match exactly**, parameter for parameter and
  the return type too.

Combined with type parameters, this is how you write `map` or `fold` for
yourself, since arrays have no `.map` or `.filter` methods — see
[Generics](generics.md).

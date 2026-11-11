# Function references

A top-level function is a value: you can keep one in a variable, a field or
an array, return it from a function, pass it on, call it later and compare
two of them. Such a value is a **function reference**. It names a function
you declared at the top level of a module and nothing more, so it carries no
captured variables. The normative rules are in the reference's
[Function references](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#function-references)
section.

## Keeping a function in a field

Give the function type a name with `type`, and use it like any other type:

```ts nish:ok
type Op = (x: i32) => i32;

const double = (x: i32): i32 => x * 2;
const negate = (x: i32): i32 => 0 - x;

class Stage {
  op: Op;
  constructor(op: Op) {
    this.op = op;
  }
  run(x: i32): i32 {
    return this.op(x);
  }
}

export const main = (): i32 => {
  const s = new Stage(double);
  console.log(`${s.run(5)}`);   // 10
  s.op = negate;
  console.log(`${s.run(5)}`);   // -5
  return 0;
};
```

`new Stage(double)` names `double` without calling it, and `this.op(x)` calls
whichever function the field holds at that moment.

## Arrays, returns and comparison

A reference goes anywhere a value of its type can: a local, a field of a
class or an interface, an array element, a return value, and a parameter
whose type is the alias, of a function, a method or a constructor. You call
it with the usual syntax, `h(3)` or `this.op(4)`, or call an element in place
as below, and `===` and `!==` tell you whether two references name the same
function:

```ts nish:ok
type Step = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;
const square = (x: i32): i32 => x * x;
const half = (x: i32): i32 => x / 2;

const pick = (name: string): Step => {
  if (name === "inc") {
    return inc;
  }
  return square;
};

export const main = (): i32 => {
  const steps: Step[] = [inc, square];
  steps.push(half);
  let x = 3;
  for (const step of steps) {
    x = step(x);
  }
  console.log(`${x}`);                    // 8
  console.log(`${steps[1](7)}`);          // 49
  const s = pick("inc");
  console.log(`${s(1)}`);                 // 2
  console.log(`${s === inc}`);            // true
  console.log(`${s !== square}`);         // true
  return 0;
};
```

A reference has no empty value, so a variable of a function type is
initialised where it is declared, and an array of them is built from `[]` or
a literal and `push` (`fill`, `unshift` and `splice` are not available on
it). `new Array<Op>(n)`, which would fill the array with zeros, is refused:

```ts nish:err NL2730
type Op = (x: i32) => i32;

export const main = (): i32 => {
  const ops = new Array<Op>(4);
  return ops.length;
};
```

## What a reference can name

A reference names a function declared at the top level of a module, with
`const f = (...) => ...` or `function f(...)`. These cannot be referenced,
and naming one where a value is expected is an error:

- a **generic** function (`NL2725`), an **`async`** function (`NL2727`), a
  function declared in C (`NL2728`), a function with a **rest parameter**
  (`NL2729`), and a function that takes a function parameter (`NL2726`);
- a function that takes a **`MutexGuard`** (`NL2739`): a guard goes only to
  a helper named at the call;
- a **function type** with a rest, optional or defaulted parameter, such as
  `(x: i32, y?: i32) => i32` (`NL2729`): a call through a reference passes
  every parameter;
- a **method**, `c.step`, which needs its object (`NL2732`);
- an **arrow written inside a function**. One that reads a variable of the
  function around it would need to carry that variable with it, which a
  reference cannot (`NL2731`); one that reads nothing is refused too
  (`NL2336`): declare it at the top level and name it.

```ts nish:err NL2731
export const main = (): i32 => {
  const k = 3;
  const addK = (x: i32): i32 => x + k;
  return addK(1);
};
```

Pass `k` as an argument instead, or, when the function is only handed to
another function, write the arrow at that call; there it may read `k`
([Passing a function to a function](functions.md#passing-a-function-to-a-function)).

## What a reference does

A reference is called, compared, stored and passed, and nothing else. In
particular it cannot be printed or put in a template string, because a
native program has no source text to show for it:

```ts nish:err NL2737
type Op = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;

export const main = (): i32 => {
  const f: Op = inc;
  console.log(`${f}`);
  return 0;
};
```

It cannot be ordered with `<`, joined or encoded as JSON; store an index or
an enum beside it when you need one of those.

## A reference that may be `null`

`Op | null` holds a function or nothing. A field of that type starts as
`null`, and `new Array<Op | null>(n)` holds `n` of them. Call it only after a
test proves it holds a function; a nullable field is read into a `const`
first, and the test is on the `const`:

```ts nish:ok
type Op = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;

class Slot {
  op: Op | null = null;
}

export const main = (): i32 => {
  const s = new Slot();
  s.op = inc;
  const h = s.op;
  if (h !== null) {
    console.log(`${h(4)}`);              // 5
  }
  return 0;
};
```

A call with no test before it is refused (`NL2740`):

```ts nish:err NL2740
type Op = (x: i32) => i32;

export const run = (h: Op | null): i32 => h(1);

export const main = (): i32 => run(null);
```

## In a `Map`

A `Map` value can be a reference, an array of them, or a nullable of either.
A call through what `get` returns can reach every function of that type the
program stores anywhere, so it is a choice among all of them:

```ts nish:ok
type Op = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;
const dec = (x: i32): i32 => x - 1;

export const main = (): i32 => {
  const byName = new Map<string, Op>();
  byName.set("inc", inc);
  byName.set("dec", dec);
  const f = byName.get("dec");
  if (f !== undefined) {
    console.log(`${f(5)}`);              // 4
  }
  return 0;
};
```

A reference cannot be a `Map` key.

## As a function argument

A parameter whose function type is written out in the parameter list, as in
`apply` below, takes a function's name, an arrow, or a variable, field or
array element holding a reference. The call passes an arrow that calls the
reference:

```ts nish:ok
type F = (x: i32) => i32;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const inc = (x: i32): i32 => x + 1;

export const main = (): i32 => {
  const h: F = inc;
  console.log(`${apply(h, 1)}`);         // 2
  return 0;
};
```

The builtins that check the body they are handed, such as `parallelMap`, a
scope's `spawn`, `expose` and `region`, take only a function's name or an
arrow (`NL2734`).

## Calls through a reference

A call through a reference compiles to a choice among the functions that
variable, field or array can hold, followed by an ordinary direct call: there
is no function pointer. When only one function can reach it, there is no
choice to make. More than eight is a warning (`NL9017`), because that call is
then a branch over all of them where a direct call would not branch.

Built with `--profile debug`, a call through a reference also checks that
the reference holds one of those functions, and panics if it does not.

Under a debugger, a program built with `-g` prints a reference as the
function it holds. Stepping into a call through one takes two steps: the
first stops in the generated chooser, named `$ref.` and the call's signature,
the second in the function. To step straight through, tell gdb to skip the
choosers:

```
(gdb) skip -rfu '^\$ref\.'
```

A reference stays inside your program. A library built with `-o` cannot
export a function whose parameter or return type holds one, or whose
classes have a field of one, because code outside the program could hand back a value
that names no function (`NL2733`). A program built from several modules
together with `--link` may pass references between them.

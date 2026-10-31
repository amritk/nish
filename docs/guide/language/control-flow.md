# Control flow

`if`, the loops, `switch` and the conditional operator work as they do in
TypeScript, with two differences that matter: a condition must be a
`boolean`, and integer arithmetic is checked. The normative rules are in the
reference's [Statements](../../LANGUAGE.md#statements) and
[Operators](../../LANGUAGE.md#operators) sections.

## Conditions

Every condition — in `if`, `while`, `for`, the conditional operator, `&&`,
`||` and `!` — must be a `boolean`. There is no truthiness:

```ts nish:err-body NL2188
const xs = [1, 2, 3];
if (xs.length) {
  console.log("non-empty");
}
```

Say what you are testing:

```ts nish:ok-body
const xs = [1, 2, 3];
if (xs.length !== 0) {
  console.log("non-empty");
}
```

Equality is `===` and `!==`; `==` and `!=` are refused. Numbers and
booleans compare by value, strings by content, and arrays and objects by
identity. `<`, `<=`, `>` and `>=` take two numbers of the same type and
nothing else.

## `if` and the conditional operator

```ts nish:ok
const sign = (n: i32): string => {
  if (n > 0) {
    return "positive";
  } else if (n < 0) {
    return "negative";
  }
  return "zero";
};

export const main = (): i32 => {
  const n = -4;
  const size = n > -10 && n < 10 ? "small" : "large";
  console.log(`${sign(n)} ${size}`);   // negative small
  return 0;
};
```

Both arms of `c ? a : b` must have the same type.

## Loops

`while`, `do … while`, `for (init; cond; update)` and `for (const x of xs)`
are all there, with `break` and `continue`:

```ts nish:ok
export const main = (): i32 => {
  let steps = 0;
  let n = 27;
  while (n !== 1) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    steps++;
  }

  let odd = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      continue;
    }
    odd = odd + i;
  }

  let total = 0;
  for (const x of [5, 10, 15]) {
    total = total + x;
  }

  console.log(`${steps} ${odd} ${total}`);   // 111 25 30
  return 0;
};
```

`for...of` walks an array (and a `Map`'s or `Set`'s keys or values — see
[Maps and sets](maps-and-sets.md)); it does not walk a string. `for...in`
is refused.

### Labels

A label on a loop lets `break` and `continue` reach past an inner loop:
`break outer` leaves the loop named `outer`, and `continue outer` starts its
next turn. A label can also name a block, which `break` leaves early, or a
`switch`. Each jump compiles to a plain branch, with no flag:

```ts nish:ok
const firstPair = (limit: i32, target: i32): i32 => {
  let found: i32 = -1;
  outer: for (let i: i32 = 0; i < limit; i++) {
    for (let j: i32 = 0; j < limit; j++) {
      if (i * j === target) {
        found = i * 100 + j;
        break outer;
      }
    }
  }
  return found;
};

const sign = (n: i32): string => {
  let out = "positive";
  check: {
    if (n < 0) {
      out = "negative";
      break check;
    }
    if (n === 0) {
      out = "zero";
    }
  }
  return out;
};

export const main = (): i32 => {
  console.log(`${firstPair(10, 12)} ${sign(-3)} ${sign(0)}`);   // 206 negative zero
  return 0;
};
```

A label on any other statement is refused, `continue` must name a loop, and a
jump cannot leave an arrow function for a label outside it.

## `switch`

A `switch` takes an integer or an [enum](../../LANGUAGE.md#enums), and every
`case` label is a constant: a literal, a module constant or an enum member.
A clause falls through into the next one, as in TypeScript, unless it ends in
`break`, `return`, `continue` or `process.exit`. An empty clause falls through
too, which is how several labels share one body:

```ts nish:ok
const kind = (day: i32): string => {
  switch (day) {
    case 0:
    case 6:
      return "weekend";
    default:
      return "weekday";
  }
};

export const main = (): i32 => {
  console.log(`${kind(6)} ${kind(2)}`);   // weekend weekday
  return 0;
};
```

A clause with statements falls through the same way, so leaving out a
`break` runs the next clause as well:

```ts nish:ok
const points = (stars: i32): i32 => {
  let total = 0;
  switch (stars) {
    case 3:
      total += 100;
    case 2:
      total += 10;
    case 1:
      total += 1;
      break;
    default:
      total = -1;
  }
  return total;
};

export const main = (): i32 => {
  console.log(`${points(3)} ${points(1)} ${points(7)}`);   // 111 1 -1
  return 0;
};
```

A clause reached by falling into it can be reached with either label's value,
so a `case` on a union's tag does not narrow there.

To declare a variable inside a clause, wrap its body in a block. A `switch`
on a string is refused; write an `if` / `else if` chain.

A `switch` without a `default` lets a value no label names fall past it, so
a function that returns a value needs a `return` after it, even when the
labels name every member of an enum. The exception is a `switch` on a
[union's tag](unions.md#a-switch-that-covers-every-variant) whose labels name
every variant: nothing else can reach its end.

## Unreachable code is an error

Code after a `return`, `break`, `continue`, `panic(…)` or `process.exit(…)`
— or after an `if` whose branches all return, or a `switch` that cannot fall
through — is refused rather than
warned about. The same analysis is what checks that a non-`void` function
returns on every path.

## Checked arithmetic

On `i32` and `i64`, `+`, `-`, `*`, unary `-`, `++`, `--` and the compound
assignments are **checked**: a result that does not fit stops the program
with a message on stderr and exit status 1. It never wraps silently, and it
is never undefined behaviour:

```ts nish:ok
const square = (n: i32): i32 => n * n;

export const main = (): i32 => {
  console.log(`${square(46340)}`);   // 2147395600
  console.log(`${square(46341)}`);   // stops: attempt to multiply with overflow
  return 0;
};
```

Run it and the second line never prints: the program writes
`attempt to multiply with overflow` to stderr and exits with status 1.
Integer `/` and `%` are checked the same way — a zero divisor prints
`attempt to divide by zero`. The check costs a compare and a branch, and the
compiler removes it wherever it can prove the result fits, such as a loop
counter under `i < n`.

When wrapping is what you want — a hash, a checksum, a random-number
generator — use an unsigned type, whose arithmetic always wraps, or the
`wrappingAdd`, `wrappingSub` and `wrappingMul` functions from `nish:unsafe`:

```ts nish:ok
import { wrappingMul } from "nish:unsafe";

export const main = (): i32 => {
  const h: u32 = 4000000000;
  console.log(`${h + 500000000}`);            // 205032704
  console.log(`${wrappingMul(46341, 46341)}`); // -2147479015
  return 0;
};
```

Floating-point arithmetic is never checked: dividing an `f64` by zero gives
`Infinity`, as in JavaScript. The reference's
[Checked integer division](../../LANGUAGE.md#checked-integer-division) and
[Semantics decisions](../../LANGUAGE.md#semantics-decisions) sections have
the exact rules.

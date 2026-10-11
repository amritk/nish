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
are all there, with unlabelled `break` and `continue`:

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
and labelled statements are refused.

## `switch`

A `switch` takes an integer or an [enum](../../LANGUAGE.md#enums), and every
`case` label is a constant: a literal, a module constant or an enum member.
**There is no implicit fallthrough** — a clause with statements must end in
`break`, `return`, `continue` or `process.exit`. An *empty* clause still
falls through, which is how several labels share one body:

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

Forgetting the `break` is a compile error, not a bug to find later:

```ts nish:err NL2166
const classify = (n: i32): string => {
  switch (n) {
    case 0:
      console.log("zero");
    case 1:
      return "one";
    default:
      return "many";
  }
};
```

To declare a variable inside a clause, wrap its body in a block. A `switch`
on a string is refused; write an `if` / `else if` chain.

## Unreachable code is an error

Code after a `return`, `break`, `continue`, `panic(…)` or `process.exit(…)`
— or after an `if` whose branches all return — is refused rather than
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

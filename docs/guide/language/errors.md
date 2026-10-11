# Errors and Result

Nish has no exceptions. There is no `throw`, no `try` and no `catch`: a
function that can fail says so in its return type by returning a
`Result<T, E>`, and the compiler makes every caller decide what happens to the
failure before it can touch the success value. The rules here are defined in
the reference under
[Result and error handling](../../LANGUAGE.md#result-and-error-handling).

## A function that can fail

A `Result<T, E>` is either a success carrying a `T` or a failure carrying an
`E`. You build one with `Ok(value)` or `Err(error)`, and both take their type
from the function's return type:

```ts nish:ok
const parseDigit = (c: string): Result<i32, string> => {
  if (c.length !== 1) {
    return Err(`'${c}' is not one character`);
  }
  const code = c.charCodeAt(0);
  if (code < 48 || code > 57) {
    return Err(`'${c}' is not a digit`);
  }
  return Ok(code - 48);
};

export const main = (): i32 => {
  const good = parseDigit("7");
  if (good.isOk()) {
    console.log(`parsed ${good.value}`);
  }
  const bad = parseDigit("x");
  if (bad.isErr()) {
    console.log(`failed: ${bad.error}`);
  }
  return 0;
};
```

This prints `parsed 7` and then `failed: 'x' is not a digit`.

The error type is yours to choose: a `string` is the simplest, an `enum` or a
class lets a caller tell failures apart. An operation that can fail but has
nothing to hand back on success returns `Result<void, E>` and succeeds with
`Ok()`.

## Reading a Result

| You write | You get |
| --- | --- |
| `r.isOk()`, `r.isErr()`, `r.ok` | whether it succeeded; each one is also a test the compiler understands |
| `r.value` | the `T`, only where a test proved `r` is a success |
| `r.error` | the `E`, only where a test proved `r` is a failure |
| `r.orReturn()` | the `T`, or else return the failure from the current function |
| `r.unwrapOr(d)` | the `T`, or `d` if `r` is a failure |
| `r.expect(message)` | the `T`, or else print `message` and exit with status 1 |

## The rules that stop a failure being ignored

TypeScript lets you forget about an exception. Nish turns each way of
forgetting about a failure into a compile error.

**You cannot reach the value without checking first.** `r.value` compiles only
inside code that a test of `r` has proved is the success case, so the error
path is always written before the success path:

```ts nish:err NL2044
const half = (n: i32): Result<i32, string> => {
  return Ok(n / 2);
};

export const main = (): i32 => {
  const r = half(8);
  console.log(`${r.value}`);
  return 0;
};
```

The test can be `if (r.isOk())`, `if (r.ok)`, `r.isOk() && …`, a ternary, or
an early exit: after `if (r.isErr()) { return 1; }` the rest of the function
knows `r` succeeded. As with [nullable types](types.md), the test applies to a
local variable, not to a field: copy `obj.result` into a `const` and test that.

**You cannot drop one.** Calling a function that returns a `Result` and
ignoring the answer is an error, and so is storing it in a local that is never
read:

```ts nish:err NL2025
const save = (name: string): Result<void, string> => {
  if (name.length === 0) {
    return Err("no name");
  }
  return Ok();
};

export const main = (): i32 => {
  save("notes.txt");
  return 0;
};
```

Passing a `Result` to another function or returning it counts as using it: the
responsibility moves with the value.

## Passing a failure up

Most of the time the right thing to do with a failure is to hand it to your
own caller. `orReturn()` does that in one call, as `?` does in Rust: it gives
you the success value, or returns the failure from the enclosing function.

```ts nish:ok
const half = (n: i32): Result<i32, string> => {
  if (n % 2 !== 0) {
    return Err(`${n} is odd`);
  }
  return Ok(n / 2);
};

const quarter = (n: i32): Result<i32, string> => {
  const h = half(n).orReturn();
  return half(h);
};

export const main = (): i32 => {
  const r = quarter(6);
  if (r.isErr()) {
    console.error(r.error);
    return 1;
  }
  console.log(`${r.value}`);
  return 0;
};
```

`quarter(6)` halves 6 to 3, then fails on the odd 3, so this prints `3 is odd`
on stderr and exits with status 1.

Because `orReturn()` returns early, it is allowed only in a function that
itself returns a `Result` whose error type matches. A function that passes a
failure on has to admit it in its own signature:

```ts nish:err NL2037
const half = (n: i32): Result<i32, string> => {
  return Ok(n / 2);
};

export const main = (): i32 => {
  const h = half(8).orReturn();
  return h;
};
```

There is no automatic conversion between error types. When a callee fails with
one type and your function reports another, convert it yourself:

```ts nish:ok
enum ConfigError {
  BadPort,
}

const parsePort = (text: string): Result<i32, string> => {
  if (text !== "8080") {
    return Err(`cannot parse '${text}'`);
  }
  return Ok(8080);
};

const loadPort = (text: string): Result<i32, ConfigError> => {
  const r = parsePort(text);
  if (r.isErr()) {
    return Err(ConfigError.BadPort);
  }
  return Ok(r.value);
};

export const main = (): i32 => {
  return loadPort("8080").unwrapOr(80) === 8080 ? 0 : 1;
};
```

## When failure is not an option: `panic`

`throw` is refused, with a message that names the two replacements:

```ts nish:err NL1001
export const main = (): i32 => {
  throw new Error("unreachable");
};
```

A failure a caller could handle is a `Result`. A situation that means the
program itself is wrong, an invariant that cannot hold, is `panic(message)`:
it prints the message on stderr and ends the process with status 1. `panic`
never returns, so a function may end with it where it would otherwise need a
`return`. `r.expect(message)` is the same ending for a `Result` you are
certain succeeded, and it insists on a reason, which is why there is no
`unwrap()`.

```ts nish:ok
const daysIn = (month: i32): i32 => {
  if (month === 2) {
    return 28;
  }
  if (month >= 1 && month <= 12) {
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
  }
  panic(`month ${month} does not exist`);
};

export const main = (): i32 => {
  console.log(`${daysIn(9)}`);
  return 0;
};
```

There are no `map`, `andThen` or `orElse` methods on a `Result`, because they
would take a function as an argument and Nish has no function values; a test
and `orReturn()` cover what they are for.

## It still type-checks as TypeScript

Every program on this page is valid TypeScript. With the declarations in
[`runtime/nish.d.ts`](../../../runtime/nish.d.ts) on the include path, `tsc`
and your editor model `Result` as a tagged union and refuse `r.value` before a
test, just as `nish` does. `nish` stays the authority: `tsc` cannot see that a
`Result` was dropped, or that `orReturn()` returns early.

# Async functions

An `async` function is one that may wait — on a socket, a timer or another
`async` function — while the rest of the program carries on. Nish writes it as
TypeScript does, with `async`, `Promise<T>` and `await`, but it never lets a
promise become a value: every `await` is on a call, written where the call is
made. That is what lets the compiler know, before the program runs, how much
memory each waiting task needs. The rules are in the reference under
[Async functions](../../LANGUAGE.md#async-functions-async-and-await).

> [!NOTE]
> In this release the tasks of a program run one after another inside the
> process and nothing waits on a socket or a timer yet, so every task runs to
> its end. Waiting on the network comes with a later release.

## Writing one

The return type is `Promise<T>`, with the answer `T` inside it
(`Promise<void>` for none). Inside, `await` a call to another `async`
function and use its answer. `main` may be `async` too: the program runs it to
its end, then finishes every task it started, and exits with its answer.

A call that can fail answers `Promise<Result<T, E>>`. There is no `throw` and
no rejected promise: read the `Result` after the `await`, as you would any
other ([Errors and `Result`](errors.md)):

```ts nish:ok
async function parsePort(s: string): Promise<Result<i32, string>> {
  if (s.length === 0) {
    return Err("empty");
  }
  return Ok(8080);
}

export async function main(): Promise<i32> {
  const port = await parsePort("8080");
  if (port.isErr()) {
    console.log(port.error);
    return 1;
  }
  console.log(port.value);
  return 0;
}
```

An answer that cannot fail is a plain `Promise<T>`:

```ts nish:ok
async function double(x: i32): Promise<i32> {
  return x * 2;
}

export async function main(): Promise<void> {
  const a = await double(3);
  let b: i32 = 0;
  b = await double(a);
  console.log(b);
}
```

A top-level `function` or an arrow may be `async`. A method may not, because a
task never keeps a `this`.

## Where `await` goes

`await` is written at the top of a statement: on its own, as a `const` or
`let` initializer, after `return`, or on the right of a plain `=`. Inside
anything larger — an argument, a condition, an arithmetic operand — it is
refused, so bind the answer to a name first:

```ts nish:err NL2642
async function load(id: i32): Promise<i32> {
  return id;
}

async function run(): Promise<void> {
  console.log(await load(1));
}

export const main = (): i32 => 0;
```

Write `const n = await load(1);` and then `console.log(n);`.

## A promise is never a value

A call to an `async` function is awaited where it is made. You cannot keep it
in a variable to await later, pass it to a function, or chain `.then` on it,
and `Promise<T>` cannot be the type of a parameter, a field or a local:

```ts nish:err NL2645
async function load(id: i32): Promise<i32> {
  return id;
}

async function run(): Promise<void> {
  load(1);
}

export const main = (): i32 => 0;
```

`Promise.all` and `for await` are refused for the same reason. To wait on
several calls at once, or start one without waiting, use `nish:async`.

## `awaitAll` and `spawn`

The built-in module `nish:async` has two functions, available only through the
import:

- `awaitAll(f(x), g(y))` runs two to eight calls together and waits for all of
  them. Its answers are bound one name per call:
  `const [a, b] = await awaitAll(f(x), g(y));`.
- `spawn(f(x))` starts `f` as a task of its own and does not wait for it.
  Nothing reads its answer, so `f` answers `void`, or a `Result` it reports
  itself.

```ts nish:ok
import { awaitAll, spawn } from "nish:async";

async function price(id: i32): Promise<i32> {
  return id * 100;
}

async function report(total: i32): Promise<void> {
  console.log(total);
}

export async function main(): Promise<void> {
  const [a, b] = await awaitAll(price(1), price(2));
  spawn(report(a + b));
}
```

## No recursion through `await`

An awaited call's memory sits inside its caller's, so a function that awaits
itself, directly or through others, would need memory without end. It is
refused; write it as a loop:

```ts nish:err NL2648
async function countdown(n: i32): Promise<void> {
  if (n > 0) {
    await countdown(n - 1);
  }
}

export const main = (): i32 => 0;
```

## Passing an `async` arrow

A function-typed parameter whose type answers `Promise<T>` takes an `async`
arrow or an `async` function, and the function that receives it awaits each
call. A plain function cannot go there, and an `async` arrow cannot go where
the type answers a plain value.

## Not on WebAssembly

A waiting task is resumed by the native event loop, which a WebAssembly
module does not have, so `async` is refused under `--target wasm32` and
`--profile wasi`.

## Where it differs from Node

The same file runs under Node, but tasks resume in a different order:

- An `await` on a call that finishes without waiting carries on at once;
  Node always yields to its microtask queue first.
- Waiting tasks resume in the order their sockets and timers become ready, not
  in Node's microtask order.
- `spawn(f(x))` starts `f` at once and runs it until it first waits on a
  socket or a timer before carrying on; Node runs `f` only to its first
  `await` and the rest after the current task yields. A task that never waits
  has finished, and printed, before `spawn` returns.
- There is no `throw`, so nothing is rejected: a call that can fail answers a
  `Result` or `null`, as any other Nish call does
  ([Errors and `Result`](errors.md)).

A program whose output does not depend on which task runs first prints the
same under both.

`nish --emit-ts` writes an async program as the async/await it already is, so
its output runs on Node's own and resumes in Node's order, as listed above.
`awaitAll` is `Promise.all`, and the written `entry.ts` waits for every task
`spawn` started before it exits, so none is cut off; only the order of what
spawned tasks print can differ
([Back to TypeScript](../using-nish/to-typescript.md)).

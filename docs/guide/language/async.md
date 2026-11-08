# Async functions

An `async` function is one that may wait — on a socket, a timer or another
`async` function — while the rest of the program carries on. Nish writes it as
TypeScript does, with `async`, `Promise<T>` and `await`, but it never lets a
promise become a value: every `await` is on a call, written where the call is
made. That is what lets the compiler know, before the program runs, how much
memory each waiting task needs. The rules are in the reference under
[Async functions](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#async-functions-async-and-await).

## Writing one

The return type is `Promise<T>`, with the answer `T` inside it
(`Promise<void>` for none). Inside, `await` a call to another `async`
function and use its answer. `main` may be `async` too: the program runs it to
its end, then runs every task it started until none is left waiting, and exits
with its answer. A `main` that awaits nothing is called like a plain one, and
the tasks it started run after it returns.

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

The built-in module `nish:async` holds these two and the waits below, each
available only through the import:

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

## Waiting on a timer or a socket

Three more functions in `nish:async` are where a task actually waits. Each is
written only as `await f(...)`, and while it waits the other tasks run:

| Call | Waits until | Answers |
| --- | --- | --- |
| `await sleep(ms)` | `ms` milliseconds have passed | `true`; `false` at once for a negative `ms` |
| `await readable(fd)` | the descriptor has data, or its peer closed it | `true`; `false` at once for a descriptor it cannot wait on |
| `await writable(fd)` | a write to the descriptor would not block | the same |

A descriptor is the number `nish:net` hands back for a socket. After
`readable` answers `true`, read the socket as you would anywhere else. Tasks
woken together resume in the order their sockets became ready, then their
timers, earliest first.

```ts nish:ok
import { sleep, spawn } from "nish:async";

async function tick(label: string, ms: i32): Promise<void> {
  await sleep(ms);
  console.log(label);
}

export async function main(): Promise<void> {
  spawn(tick("second", 20));
  spawn(tick("first", 5));
  await sleep(40);
  console.log("done");
}
```

It prints `first`, `second`, then `done`. The program exits once `main` has
returned and no task is waiting. A wait has no deadline: a socket whose peer
never sends and never closes keeps its task, and the program, waiting.

`sleep`, `readable` and `writable` are not values: calling one without
`await` is refused.

```ts nish:err NL2671
import { sleep } from "nish:async";

async function run(): Promise<void> {
  sleep(10);
}

export const main = (): i32 => 0;
```

## What `spawn` may pass

A spawned task can outlive the function that started it, so its arguments must
outlive it too. A number, a `boolean`, an enum or a `string` may be passed: a
string is copied for the task. An array, an object or anything else holding
memory of the spawner's is refused; pass what the task needs as strings and
numbers, or have the task build it.

```ts nish:err NL2673
import { spawn } from "nish:async";

async function total(xs: i32[]): Promise<void> {
  console.log(xs.length);
}

export async function main(): Promise<void> {
  spawn(total([1, 2, 3]));
}
```

Each spawned task has memory of its own, which is given back when the task
finishes, so a long-running program does not grow with every task it has run.

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

```ts nish:ok
async function twice(f: (n: i32) => Promise<i32>): Promise<i32> {
  const a = await f(1);
  const b = await f(2);
  return a + b;
}

export async function main(): Promise<void> {
  const total = await twice(async (n: i32): Promise<i32> => n * 10);
  console.log(total);   // 30
}
```

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
- A task does not give way until it awaits: one that computes for a long time
  holds up every other task, as it would in Node.
- Node keeps running while a timer or a socket is open; a Nish program exits
  once `main` has returned and no task is waiting on anything.
- There is no `throw`, so nothing is rejected: a call that can fail answers a
  `Result` or `null`, as any other Nish call does
  ([Errors and `Result`](errors.md)).

A program whose output does not depend on which task runs first prints the
same under both.

`nish --emit-ts` writes an async program as the async/await it already is, so
its output runs on Node's own and resumes in Node's order, as listed above.
`awaitAll` is `Promise.all`, `sleep` is a `setTimeout`, and the written `entry.ts` waits for every task
`spawn` started before it exits, so none is cut off; only the order of what
spawned tasks print can differ
([Back to TypeScript](../using-nish/to-typescript.md)). A program that waits
on a socket with `readable` or `writable` cannot be written out that way yet,
and `nish --emit-ts` refuses it.

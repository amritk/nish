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
  Each call that waits keeps its memory apart from the others', so calls that
  hold large arrays or strings across an `await` cannot disturb each other.
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
returned and no task is waiting. `readable` and `writable` have no deadline:
a socket whose peer never sends and never closes keeps its task, and the
program, waiting. `readableWithin(fd, ms)` and `writableWithin(fd, ms)` give
up after `ms` milliseconds and answer `false`.

A task can also be cancelled. `taskId()` answers the running task's handle;
`cancel(handle)` cancels it now and `cancelAfter(handle, ms)` later. A
cancelled task is not stopped mid-line: every wait it is parked on, and every
one it makes later, answers `false` at once, so it runs on to its end, and
`cancelled()` tells it why. `main` is never cancelled. Because those waits
answer at once, a loop that awaits must stop when one answers `false` or
`cancelled()` is true: it would otherwise run without ever giving way to
another task.

```ts nish:ok
import { cancelAfter, cancelled, sleep, spawn, taskId } from "nish:async";

async function nap(): Promise<void> {
  cancelAfter(taskId(), 10);
  const slept = await sleep(1000);
  console.log(`slept ${slept}, cancelled ${cancelled()}`);
}

export async function main(): Promise<i32> {
  spawn(nap());
  return 0;
}
```

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
outlive it too. A number, a `boolean` or an enum is copied, and a `string` is
copied for the task. An object, an array, a `Map` or a `Set` is shared: the
task works on the spawner's own, and the spawner keeps it alive for as long
as any task holds it.

```ts nish:ok
import { sleep, spawn } from "nish:async";

class Tally {
  hits: i32 = 0;
}

async function count(tally: Tally, n: i32): Promise<void> {
  await sleep(n);
  tally.hits = tally.hits + n;
  console.log(tally.hits);
}

async function start(): Promise<Tally> {
  const tally = new Tally();
  spawn(count(tally, 5));
  spawn(count(tally, 10));
  return tally;
}

export async function main(): Promise<void> {
  const tally = await start();
  await sleep(20);
  console.log(tally.hits);
}
```

A task's own memory is given back when it ends, so it may store numbers into
what it shares, but not an object or a string it made, and it may not grow a
shared array, `Map` or `Set`. That holds through a call too: a function or
method handed both a shared object it writes into and a string or object the
task made is refused, as it may keep the one in the other:

```ts nish:err NL2609
import { spawn } from "nish:async";

class Box {
  label: string = "";
}

async function rename(box: Box, n: i32): Promise<void> {
  box.label = `task ${n}`;
}

export async function main(): Promise<void> {
  spawn(rename(new Box(), 1));
}
```

```ts nish:err NL2615
import { spawn } from "nish:async";

async function add(xs: i32[], n: i32): Promise<void> {
  xs.push(n);
}

export async function main(): Promise<void> {
  spawn(add([1, 2, 3], 4));
}
```

Nor may the task keep a shared object in memory of its own: putting it into
a new object, an array, a `Map` or a `Set` the task made is refused (NL2610),
since the task could then store its own memory into the shared object through
what it built. Read and update the shared object in place instead:

```ts nish:err NL2610
import { spawn } from "nish:async";

class Tally {
  hits: i32 = 0;
}

async function keep(tally: Tally, n: i32): Promise<void> {
  const all: Tally[] = [tally];
  all[0].hits = n;
}

export async function main(): Promise<void> {
  spawn(keep(new Tally(), 1));
}
```

A function argument is a top-level function or an arrow written at the call.
The arrow may read locals of the function it is written in when each is a
number, a `boolean`, an enum, or an object or array the task could be handed
itself; the task then shares that object as it would an argument. A capture
of anything else, such as a `string`, is refused (NL2690): pass it to the task
as an argument of its own. Any other argument, such as an `Item | null`, is
refused (NL2673); pass the value itself.

```ts nish:ok
import { sleep, spawn } from "nish:async";

class Board {
  hits: i32 = 0;
}

async function later(handle: (n: i32) => Promise<void>, n: i32): Promise<void> {
  await sleep(n);
  await handle(n);
}

export async function main(): Promise<i32> {
  const board = new Board();
  spawn(later(async (n: i32): Promise<void> => {
    board.hits = board.hits + n;
  }, 5));
  await sleep(20);
  console.log(`${board.hits}`); // 5
  return 0;
}
```

An arrow that reads a `string` of its spawner is refused, since the string is
the spawner's and the task may run after it returns:

```ts nish:err NL2690
import { sleep, spawn } from "nish:async";

class Board {
  hits: i32 = 0;
}

async function later(handle: (n: i32) => void, n: i32): Promise<void> {
  await sleep(n);
  handle(n);
}

export async function main(): Promise<i32> {
  const board = new Board();
  const label = `run ${board.hits}`;
  spawn(later((n: i32): void => {
    board.hits = board.hits + label.length + n;
  }, 5));
  await sleep(20);
  return 0;
}
```

The arrow runs in the task, so it follows the task's rules for what it
captured: it may change its numbers and call its methods, but storing a
string or object it made into the captured object, or growing an array of
it, is refused (NL2609, NL2615), as is spawning a further task with it
(NL2689).

A shared object may not hold anything its spawner frees, wipes or closes on
its own schedule: a `Region`, a `Secret`, a handle a `using` block closes,
or a lock, scope, guard or channel of `nish/threads`. The spawn names the
part it found (NL2691); pass the task the numbers or strings it needs
instead.

```ts nish:err NL2691
import { sleep, spawn } from "nish:async";
import { Region, region } from "nish:region";

class Box {
  r: Region<i32[]>;
  constructor(r: Region<i32[]>) {
    this.r = r;
  }
}

const build = (): i32[] => {
  const xs: i32[] = [1, 2, 3];
  return xs;
};

async function later(box: Box): Promise<void> {
  await sleep(5);
}

export async function main(): Promise<void> {
  spawn(later(new Box(region(build))));
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

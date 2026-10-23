# Back to TypeScript

A Nish program is TypeScript with fixed-width numbers, so a team can take a
module back out of the compiler and run it in JavaScript. What it then needs is
the meaning of Nish's builtins: `toI64`, a string's length in UTF-8 bytes,
`Result`, `console.log`, `panic`. The `nish` package gives them as an ordinary ES
module, in three entry points:

| Import | What it is | Loads in |
| --- | --- | --- |
| `nish/runtime` | The builtins: integer and float helpers, UTF-8 string helpers, arrays, `Result`, `Ok`, `Err`, `Secret`, `log`, `panic`, `exit`, and the file, process and clock calls | any engine with ES modules |
| `nish/runtime/node` | Installs the Node answers to every call that reaches outside the program | Node |
| `nish/runtime/browser` | Installs the answers a web page can give | a page, a worker, any engine with `console`, `performance` and `queueMicrotask` |

`nish/runtime` names no Node module, so it bundles for a browser; it reads
the web `crypto`, `TextEncoder` and `TextDecoder` globals as it loads, which
Node 20 and every browser have. On its own it
computes — `toI64`, `strLen`, `Ok(7).unwrapOr(0)` — but anything that needs the
outside world (`log`, a file, the clock) throws `NishNoHost` until one of the
other two has been imported. Import a host once, first, from the program's
entry point:

```js
import "nish/runtime/node"; // or "nish/runtime/browser"
import { log, strLen, toI64 } from "nish/runtime";

log(strLen("héllo")); // 6: the length is in UTF-8 bytes, as in Nish
log(toI64(2.9)); // 2
```

Take this Nish module:

```ts nish:ok
export const describe = (name: string): Result<i64, string> => {
  if (name.length === 0) {
    return Err("empty");
  }
  return Ok(toI64(name.length));
};

export const main = (): void => {
  const r = describe("héllo");
  if (r.ok) {
    console.log(r.value);
  }
};
```

The translation is written by hand today. As TypeScript, it imports the builtins it uses from `nish/runtime`, spells a
string's length with `strLen`, which counts UTF-8 bytes as Nish does, and
prints with `log`, which is Nish's `console.log`:

```ts
import "nish/runtime/node";
import { Err, log, Ok, strLen, toI64, type i64, type Result } from "nish/runtime";

export const describe = (name: string): Result<i64, string> => {
  if (strLen(name) === 0) {
    return Err("empty");
  }
  return Ok(toI64(strLen(name)));
};

export const main = (): void => {
  const r = describe("héllo");
  if (r.ok) {
    log(r.value); // 6
  }
};
```

## The types

Each entry point ships its declarations, so TypeScript with
`"moduleResolution": "nodenext"` finds them with no
configuration. They follow what the helpers return at run time:

- `i64` and `u64` are `bigint`: a 64-bit integer does not fit a JavaScript
  `number`, so `toI64` answers a `bigint` and 64-bit arithmetic stays exact.
- Every other width (`i32`, `u8`, `u16`, `u32`, `f32`, `f64`) is `number`.
- `Result<T, E>` is `{ ok: true, value: T } | { ok: false, error: E }` with
  the methods a Nish `Result` has (`isOk`, `isErr`, `unwrapOr`, `expect`,
  `orReturn`).

## What each host answers

| Call | Node | Browser |
| --- | --- | --- |
| `log`, `write` | standard output | `console.log`, a line at a time |
| `error`, `writeError`, `panic`'s message | standard error | `console.error`, a line at a time |
| `exit(code)` | ends the process with `code` | throws a `NishExit` whose `code` is the 8-bit status |
| `panic(message)` | prints and exits 1 | prints and throws a `NishExit` with code 1 |
| `monotonicNanos()` | `process.hrtime.bigint()` | `performance.now()`, in nanoseconds |
| `getenv(name)` | the environment | `null` |
| `argv()` | the process's arguments | `["main"]` |
| a file, process or machine call (`readFileSync`, `spawnSync`, …) | Node's `fs`, `child_process` and `os` | panics, naming the call: `readFileSync is not available in a browser` |

`spawn`, `waitPid`, `signalFd` and `readSignal` have no synchronous reading in
JavaScript, so under either host they throw an `Error` that says so.

In a browser, output that `write` leaves without a newline waits for the next
newline, for `exit`, or for the program to yield, and is then printed as its
own line. A page cannot end itself, so the code that starts the program
catches the `NishExit`:

```js
import "nish/runtime/browser";
import { main } from "./program.js";

try {
  main();
} catch (e) {
  if (e.name !== "NishExit") throw e;
  console.info(`exited with ${e.code}`);
}
```

## Bun and other hosts

Bun is untested. It runs ES modules and has `performance` and `console`, so
`nish/runtime` with `nish/runtime/browser` is the combination to try first;
`nish/runtime/node` relies on Node's `node:fs` and `node:child_process`
behaving as Node's do.

To run an unmodified Nish source file under Node, with the builtins as
globals rather than imports, see
[Running a Nish program under Node](../../RUN_UNDER_NODE.md). The builtins
themselves are specified in [Builtins](../../LANGUAGE.md#builtins).

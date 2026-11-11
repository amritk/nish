---
name: writing-nish
description: Write a program in Nish, the strictly static subset of TypeScript that compiles ahead of time to native code through LLVM, and get it accepted by the `nish` compiler. Use when asked to write, port, fix or explain a `.ts` program meant for `nish`, when `nish` rejects a program with an `NL` diagnostic code, or when a TypeScript habit (truthiness, `throw`, `any`, casts, `reduce`, callbacks in variables) needs its Nish replacement.
---

# Writing Nish

Nish programs are legal TypeScript syntax, and with `runtime/nish.d.ts` on the
include path they type-check under `tsc --strict`. That is the trap: **your
TypeScript instincts produce programs that `tsc` accepts and `nish` rejects.**
The subset is much smaller than it looks.

This skill is the short form. The whole language, stated as rules for a model,
is the rules card,
[`docs/AI.md`](https://github.com/amritk/nish/blob/main/docs/AI.md); the
normative reference is
[`docs/LANGUAGE.md`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md).
Where this page and those disagree, they win.

## The loop: compile, read the code, fix

Do not reason about whether a program is legal. Ask the compiler; it is fast
and it is the only authority. Install it with `npm install -g nish`.

```bash
nish program.ts --json            # one JSON object per diagnostic, on stdout
nish --fix program.ts             # apply every machine-applicable fix, in place, then report the rest
nish run program.ts a b           # build into a cache, then run it with `a b`
nish program.ts --link prog       # build a native binary (needs clang)
nish --help                       # every flag
```

- **Key on `code`, never on `message`.** `NL2249` means the same rule next
  release; the prose may change.
- A warning (`"performance"`, `"portability"`, `"deprecation"`) never changes
  the exit code.
- Exit codes: `0` ok, `1` the program was rejected, `2` usage, `3` the C
  toolchain is unusable, `70` a bug in `nish` worth reporting.
- `nish --fix` rewrites files with no backup: run it on a committed tree.
- When it compiles, check the native build against the TypeScript reading:
  `nish program.ts --emit-ts out/` then `node out/entry.ts`. Both must print
  the same and exit the same.

## The shape of a program

```ts nish:ok
const gcd = (a: i32, b: i32): i32 => {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
};

export const main = (): i32 => {
  console.log(`gcd = ${gcd(1071, 462)}`);
  return 0;
};
```

Top-level `const` arrows, an exported `main` returning the exit code, explicit
types everywhere, a template literal instead of `String(n)`. A module holds only
declarations at the top level: functions, `class`, `interface`, module `const`s,
`type` aliases, numeric `enum`s and `import`s.

## Failure is a `Result`

There is no `throw`, no `try` and no unwinding. A function that can fail says
so in its return type.

```ts nish:ok
const half = (n: i32): Result<i32, string> => {
  if (n % 2 !== 0) {
    return Err("odd");
  }
  return Ok(n / 2);
};

export const main = (): i32 => {
  const outcome = half(7);
  if (outcome.isErr()) {
    console.error(outcome.error);
    return 1;
  }
  console.log(`${outcome.value}`);
  return 0;
};
```

`r.orReturn()` propagates an error like Rust's `?`. `panic(m)` ends the process.

## What you must unlearn

| Your reflex | Write instead |
| --- | --- |
| `if (xs.length)`, `!s.length` (no truthiness) | `if (xs.length !== 0)`, `s.length === 0` |
| `x == y` | `x === y` |
| `throw`, `try` / `catch` | `return Err(m)`, `isErr()`, or `panic(m)` |
| `any`, `unknown`, `undefined` | name the real type; `T \| null` for absence |
| `x as T`, `x!`, `typeof`, `instanceof` | there are no casts and no runtime types |
| `xs.reduce`, `.forEach`, `.find` | a `for` loop; `map`, `filter`, `some`, `every`, `findIndex`, `slice` work |
| `s.split()`, `s.trim()`, `s.toUpperCase()` | index bytes with `charCodeAt` / `substring` |
| `String(n)`, `n.toString()` | `` `${n}` `` |
| a callback in a variable or field | there are no function values; pass an arrow straight to a function-typed parameter |
| `class B extends A`, `static`, getters | repeat the fields and `implements` an interface; module `const`s and plain methods |
| `A \| B` of anything but tagged variants | a discriminated union, a tag field first in each variant |
| top-level `let`, top-level code | a module `const`, or a local inside `main` |
| destructuring, optional parameters, spread arguments | one name per binding; `n: i32 = 1` for a default |
| `import fs from "fs"`, `export default` | `readFileSync` is a global (or `nish:fs`); a named `export const` |
| `let v = m.get(k)` on a `Map` | `m.get(k) ?? 0`, or narrow with `!== undefined` first |
| `JSON.parse`, `RegExp`, `Promise`, `new Date()` | `nish/json-typed`, `nish/regex`, `await` at the call, `Date.now()` |

The most common rejection, NL2188:

```ts nish:err-body NL2188
const xs = [1, 2, 3];
if (xs.length) {
  console.log("non-empty");
}
```

## Before you say it compiles

1. Did you **run the compiler**? Nothing else counts.
2. Is every condition a `boolean`?
3. Is every method you call a real builtin? The list is in
   [the rules card](https://github.com/amritk/nish/blob/main/docs/AI.md#the-builtins-in-full).
4. Is every parameter, return type, field and module constant annotated, and
   does every numeric width match exactly (no `i32` meeting `i64`)?
5. Is every `Result` read, and every `.value` behind an `isOk()`?
6. Is every nullable narrowed with `!== null` before it is touched?
7. Does it reach only what you meant? `nish run --capabilities file.ts` lists
   the files, network, processes and C calls it can reach.

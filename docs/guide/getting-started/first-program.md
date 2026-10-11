# Your first program

This page writes a program, runs it, compiles it to a native binary, and then
breaks it on purpose to show what the compiler says when something is wrong.
It assumes `nish` and LLVM are installed as described in
[Installation](installation.md).

## Hello, world

Make an empty directory and save this as `hello.ts` inside it:

```ts nish:ok
export const main = (): i32 => {
  console.log("hello from Nish");
  return 0;
};
```

A Nish program starts at `main`, which is exported from the file you compile.
It takes no parameters. Its return value is the program's exit status, so
`return 0` means success. `i32` is a 32-bit integer: Nish writes the width of
a number in its type, and [Coming from TypeScript](from-typescript.md)
explains why. A `main` with nothing to report can return `void` instead, and
then exits with 0. The rules for `main` are in the reference's
[`main`](../../LANGUAGE.md#main) section.

## Run it

```bash
nish run hello.ts
```

```
hello from Nish
```

`nish run` compiles the file, links it, and starts it. Anything after the file
name is passed to the program as its arguments, which it reads from
`process.argv`. The binary is kept in a cache under `~/.cache/nish/run`, so
running the file again without changing it reuses that binary instead of
linking a new one.

## Compile it to a native binary

```bash
nish hello.ts --link hello
./hello
```

```
wrote hello.ll
linked hello: 4712 bytes (speed)
hello from Nish
```

The first two lines come from `nish`. It wrote `hello.ll`, the LLVM IR for the
program, then linked an executable named `hello` beside it. The byte count
depends on your platform and version. `speed` is the default optimisation
profile; `--profile size` makes the smallest binary and `--profile debug`
keeps debug symbols. The last line is `./hello` running. The binary needs
nothing installed beside the system's C library: no Node, no runtime and no
garbage collector.

To stop at the IR, ask for it with `-o`:

```bash
nish hello.ts -o hello.ll
```

## When it does not compile

Save this as `greet.ts`. It has a mistake on line 8: `"3"` is a string where
`greet` takes a number.

```ts nish:err NL2117
const greet = (name: string, times: i32): void => {
  for (let i = 0; i < times; i++) {
    console.log(`hello, ${name}`);
  }
};

export const main = (): i32 => {
  greet("Nish", "3");
  return 0;
};
```

```bash
nish run greet.ts
```

```
greet.ts:8:17: error: Argument 2 of `greet`: expected i32, got string
  8 |   greet("Nish", "3");
    |                 ^~~
```

An error names the file, the line and the column (`greet.ts:8:17`), says what
is wrong, and underlines the place. Nothing runs, and `nish` exits with 1.
When a file has several errors, the compiler reports as many as it can find,
up to 20, in the order they appear in the file.

Every error also has a **code**, a stable name for the rule that was broken.
Add `--json` to see it. With `nish run`, flags go before the file name:

```bash
nish run --json greet.ts
```

```json
{"file":"greet.ts","line":8,"column":17,"endLine":8,"endColumn":20,"severity":"error","code":"NL2117","message":"Argument 2 of `greet`: expected i32, got string"}
```

The code here is `NL2117`. The wording of a message can improve from one
release to the next, but a code always means the same rule. That makes it the
thing to search for, and the thing an editor or a script should key on. The
first digit says which stage of the compiler refused the program: `NL1…` for
syntax Nish forbids outright, `NL2…` for the type checker, `NL3…` for modules
and packages. The reference's
[Rejected by the checker](../../LANGUAGE.md#rejected-by-the-checker) and
[Forbidden constructs](../../LANGUAGE.md#forbidden-constructs-phase-0-validator)
sections list the rules.

Change `"3"` to `3`, and `nish run greet.ts` prints `hello, Nish` three times.

### Fixes the compiler can make for you

Some errors have only one sensible repair, and the compiler can apply it
itself. Save this as `check.ts`:

```ts nish:err NL2188
export const main = (): i32 => {
  const xs = [1, 2, 3];
  if (xs.length) {
    console.log("non-empty");
  }
  return 0;
};
```

Nish has no truthiness, so `if (xs.length)` is an error: a condition has to
be a `boolean`. Ask for the fix:

```bash
nish --fix check.ts
```

```
fixed check.ts (1 edit)
```

The file now reads `if (xs.length !== 0)`, and `nish run check.ts` prints
`non-empty`. `--fix` rewrites the file in place without a backup, so use it on
files you have saved or committed. Anything it could not repair is then
reported as usual.

## Exit codes

`nish` uses its exit status to say what happened:

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: a compile error, or an input file that does not exist |
| 2 | the command line was wrong: an unknown flag, a missing argument, no input file |
| 3 | the C toolchain is missing or failed: `--link` found no `clang`, or the link step failed |
| 70 | an internal compiler error. This is a bug in `nish`, not in your program; please [report it](https://github.com/amritk/nish/issues) with the file and the command line |

`nish run` answers with these codes until your program starts. After that, the
exit status is your program's own: whatever `main` returns.

A program can also stop with a **panic**. A panic is how Nish ends a program
that reached a state it cannot continue from, such as reading past the end of
an array, or arithmetic that overflows. Integer arithmetic is checked, so this
program, saved as `overflow.ts`, stops rather than wrap round to a negative
number:

```ts nish:ok
export const main = (): i32 => {
  let n: i32 = 2147483600;
  for (let i = 0; i < 100; i++) {
    n = n + 1;
  }
  console.log(`${n}`);
  return 0;
};
```

```bash
nish run overflow.ts
```

```
attempt to add with overflow
```

The message goes to stderr, and the program exits with 1. A program can also
panic deliberately by calling `panic("message")`. A failure the caller is
expected to handle is reported with a `Result` instead; see
[Errors and `Result`](../language/errors.md).

## Next

- [Coming from TypeScript](from-typescript.md): what carries over, what Nish
  refuses, and what to write instead.
- [The command-line interface](../using-nish/cli.md): every flag `nish`
  takes.

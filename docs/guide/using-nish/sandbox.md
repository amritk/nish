# The sandbox

`--capabilities` tells you what a program can reach, and `--allow` / `--deny`
refuse at compile time a program that reaches more than you grant. Neither
holds the program once it runs: a `declare function` into C can open any file
or socket libc can. `--sandbox` closes that gap on Linux. The binary asks the
kernel, before any of your code runs, to refuse everything its `main` does not
reach — for your Nish code, your dependencies, every C function you call and
every C constructor alike.

The rules are in the reference, under
[The sandbox](../../LANGUAGE.md#the-sandbox).

## Building a sandboxed program

Pass the flag where you would build or run the program:

```sh
nish --link app.ts --sandbox -o app
nish run --sandbox app.ts
nish app.ts --sandbox          # IR only: the .ll carries the sandbox
```

Take a program that reads one file and does nothing else:

```ts nish:ok
import { readFileSync } from "nish:fs"

export const main = (): number => {
  const text = readFileSync("/etc/hostname")
  console.log(text.length > 0)
  return 0
}
```

Its `main` reaches `fs.read` and nothing more (`nish run --capabilities`
prints `capabilities: fs.read (not deterministic)`), so built with `--sandbox` it can still read
any file the user can, but it cannot write one, start a process or open a
socket — not from Nish, and not from a C library it links.

## What is withheld

Each capability `main` does not reach is withheld:

| Not reached | What the kernel refuses |
| --- | --- |
| `fs.read` | opening a file or a directory to read it |
| `fs.write` | writing, creating, removing, renaming and truncating files, and changing their mode, owner, times or extended attributes |
| `process.spawn` | starting a program or forking a process (threads are fine), and executing a file |
| `net` | creating, connecting, binding and accepting sockets |

Reaching `process.spawn` grants back executing, reading and device `ioctl`s
on every file beneath `/`, since a child has to load its program and
libraries. So a program that reaches `process.spawn` can read any file the
user can, even when its `main` does not reach `fs.read`.

A Unix-domain listener on a path makes a socket file, which the kernel counts
as a write: under `net` alone, `unixListen("app.sock", …)` answers -13 and
makes nothing. Reaching `net` does not reach `fs.write` for you, because the
path is data the compiler cannot see. Reach `fs.write` as well, or listen on
an abstract name (`"@app"`), which makes no file
([Unix sockets](unix-sockets.md)).

Connecting is different. The kernel has no rule for connecting to a socket
file, so a program that reaches `net` can `unixConnect` to any Unix socket on
a path whose permissions let the user in, a system daemon's included, with or
without `fs.read` or `fs.write`. The sandbox stops a connect only to an
abstract name created outside it, and only from Landlock ABI 6 (below). If
the program must not talk to the machine's daemons, do not let `main` reach
`net`.

A few things are refused whatever `main` reaches: attaching to, reading or
writing another process (`ptrace`, `process_vm_readv`, `process_vm_writev`)
and taking its descriptors (`pidfd_getfd`), x32 system calls and system calls
of another architecture (a 32-bit `int 0x80`), and io_uring unless the
program reaches both `net` and `process.spawn`. On a kernel whose Landlock
is ABI 6 or later, so is signalling a process outside the sandbox and
connecting to an abstract Unix socket created outside it, even when `main`
reaches `signal`; the program can still signal itself. The other
capabilities — `clock`, `entropy`, `env`, `exit`, `tty`, `ffi`, `unsafe` —
withhold nothing.

A refused file operation fails with an error your program sees, as a missing
permission would. A refused process or socket call **ends the program** with
`SIGSYS`, which a shell reports as exit status 159:

```text
$ ./app
Bad system call
$ echo $?
159
```

## When the sandbox cannot be applied

The sandbox needs Linux's Landlock and seccomp. A program that cannot apply
it prints one line and exits with status **126**, before `main` runs:

```text
nish: --sandbox: this kernel has no Landlock; build with --sandbox=best-effort to run with seccomp alone
```

`--sandbox=best-effort` runs anyway on such a kernel, with what it could
apply, and says what it could not:

```text
nish: --sandbox: no Landlock, files are not confined
```

On an older Landlock it names the rights it could not withhold, for example
`nish: --sandbox: this kernel's Landlock cannot withhold TRUNCATE, IOCTL_DEV,
the signal and abstract socket scopes, so they are not confined`.

A program built with `--sandbox` also refuses to run, with status 126, if its
C library skipped the step that applies the sandbox (musl does), or if its
`.ll` is linked on a platform other than Linux. On such a C library every
constructor, in your program and the libraries it links, has already run
unconfined by the time it refuses.

## Where it does not apply

- **macOS** has neither Landlock nor seccomp, so a darwin target refuses the
  flag (NL3044).
- **WebAssembly** targets accept it and add nothing: the host already decides
  what a module may import.
- `--emit-ast`, `--emit-checked`, `--emit-ts`, `--fix`, `--emit-napi` and
  `--emit-napi-async` refuse it, and so does a program with no `main`: there
  is nothing to confine.

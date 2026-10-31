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

A descriptor that arrives already open is not checked either. Landlock rules
apply when a path is opened, so a file another process opens and passes over a
Unix socket with `sendFd` reaches `recvFd` usable as it was opened, whatever
`fs.read` or `fs.write` say; sending and receiving such a descriptor are not
filtered, only making the socket is. The same holds for what a sandboxed
parent hands a child with `spawnWithFds`: the child holds whatever the parent
held. Treat a socket that can pass descriptors as a door into the sandbox, and
check who is on the other end with `peerCredentials`
([Unix sockets](unix-sockets.md#passing-a-descriptor)).

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

## Granting one directory

`fs.read` and `fs.write` reach every file the user can. Under `--sandbox`
you can grant either beneath one directory instead, with a scope in
`--allow`:

```sh
nish --link app.ts --sandbox --allow fs.read=/srv/data -o app
nish --link app.ts --sandbox --allow fs.read=/srv/data,fs.write=/srv/data/out -o app
```

Built with `--allow fs.read=/srv/data`, the program above could read
`/srv/data/notes.txt` but no longer `/etc/hostname`: that open fails with
`EACCES`, as a missing permission would. Name a capability more than once to
grant it beneath several directories (`--allow fs.read=/srv/a,fs.read=/srv/b`).

A scope is an `--allow` list like any other, so it also names every other
capability the program reaches; leaving one out is refused at compile time,
as without the scope. If the program calls C (`ffi`), the scopes you grant
are what the C code can reach too.

Each directory is resolved, symbolic links and all, when you build, and must
exist then:

```text
compile: `fs.read=/srv/dta` names no directory; a scope is a directory that exists when the program is built
```

Only `fs.read` and `fs.write` take a scope, only in `--allow`, and only with
`--sandbox`, the one thing that enforces it; each of the others is refused
with exit status 2. A directory with a comma in its name cannot be named.

## Narrowing what a dependency is granted

A dependency under `node_modules` needs your `package.json` to grant it
`fs.read`, `fs.write`, `net`, `process.spawn`, `ffi` or `unsafe` (see
[A dependency's capabilities](../../LANGUAGE.md#a-dependencys-capabilities)).
The grant can name what it is for, after an `=`: a directory for `fs.read`
and `fs.write`, a program for `process.spawn`, an IP address for `net`.

```json
{
  "nish": {
    "capabilities": {
      "dependencies": {
        "pkg_tool": ["fs.read=./data", "process.spawn=git", "net=127.0.0.1"]
      }
    }
  }
}
```

The directory is found from the folder your `package.json` is in, the
program on your `PATH`, and both must exist when you build. A host is an
address, not a name to look up. A grant without an `=` grants the whole
capability, as it always did.

The build checks what it can see. A dependency that passes a fixed path,
program or address outside its grant stops the build, at that string:

```text
node_modules/pkg_conf/src/index.ts:2:38: error: the dependency `pkg_conf` hands `readFileSync` "/etc/passwd", which its `fs.read` grant does not cover: it is granted fs.read=data; name it in the grant, or grant `fs.read` whole
```

A path or program the dependency works out while it runs is beyond the
build. Build with `--sandbox` and the kernel holds it instead: the granted
directories become the program's `fs.read` and `fs.write` scopes, as
`--allow fs.read=<dir>` makes them, and the granted programs the only ones it
may start. A dependency granted `fs.read=./data` that is handed
`/etc/passwd` at run time gets an error from `readFileSync`; one granted
`process.spawn=git` that tries to start `sh` gets `-1` from `spawnSync`.

The sandbox narrows a capability this way only when it can tell the
grant is all of it: every dependency that reaches it names an argument,
your own code does not reach it, `--allow` gives it no scope of its own and
`main` does not call C. Otherwise the capability stays whole, as it was
before. The scopes hold for the whole process, not one package: any
dependency that reads files may read every granted directory.

Addresses are checked at build time only. The kernel cannot see which
address a socket call is given, so a `net=<host>` grant does not stop a
dependency that builds its address at run time. Grant `net` to a dependency
you have read.

`nish-capabilities.lock.json` records the arguments too
(`"pkg_conf": ["fs.read=data"]`). Widening a grant past them — a new
directory, program or address, or the whole capability — stops the build
until you review it and run `--update-capability-lock` again.

If the directory is gone when the program runs, `--sandbox` refuses to run,
status 126, naming it:

```text
nish: --sandbox: cannot open the directory /srv/data (ENOENT)
```

and `--sandbox=best-effort` runs with nothing granted beneath it, saying so
once.

Inside a write scope a program can create, write, rename and remove files,
but changing a file's mode, owner, times or extended attributes is still
refused (`EPERM`): that check cannot see which directory a file is in. A
program that reaches `process.spawn` can still read every file beneath `/`,
scope or not, as above.

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

A write scope needs Landlock ABI 3 (Linux 6.2); on an older kernel
`--sandbox` refuses a program built with one, and best-effort runs it with
`TRUNCATE` unconfined.

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

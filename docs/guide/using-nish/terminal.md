# Terminal input

`nish:term` lets a program read keys the moment they are pressed. That is what
a full-screen terminal program needs: an editor, a menu, or a game that has to
redraw many times a second. It has six functions:

- `readStdin` reads the bytes that are waiting on stdin;
- `waitStdin` waits for some to arrive, or for a timeout to pass;
- `isTerminal` asks whether a descriptor is a terminal;
- `terminalSize` asks how big the terminal is;
- `setRawMode` turns off echo and line editing, and turns them back on;
- `setTerminalRestore` sets the bytes the program leaves the terminal with.

The rules are in the reference, under
[`nish:term`](../../LANGUAGE.md#nishterm-terminal-input). It reads the
terminal; drawing on it is the standard library's
[`nish/term`](standard-library.md#nishterm), whose `KeyDecoder` turns the
bytes `readStdin` returns into key events.

Every function is also a global, as every `nish:` export is, but importing
them says where they come from. A program that calls any of them carries the
`tty` [capability](../../LANGUAGE.md#capabilities), not `net`; `nish run
--capabilities` shows it.

## Errors are numbers

The functions that can fail answer a number, in the same shape as
[`nish:net`](networking.md#errors-are-numbers): zero or more is success, and
a negative number is a failure. Three of the failures are the same number on
every platform, so a program can branch on them:

| Answer | Meaning |
| --- | --- |
| `-7` | `setTerminalRestore`: more than 4,096 bytes, checked before the terminal is |
| `-11` | `readStdin`: nothing is waiting yet |
| `-25` | not a terminal: a pipe or a file — stdin for `setRawMode`, stdout for `setTerminalRestore`, stdout and stderr both for `terminalSize` |

`terminalSize()` answers a pair, `[columns, rows]`. When there is no terminal
the first number is the error and the second is `0`, so `[-25, 0]` means "not
a terminal". A terminal that no one gave a size, such as one a test harness
opens, answers `[0, 0]`.

## Reading keys

`readStdin(buf, off, len)` copies at most `len` bytes into `buf`, starting at
`off`. It never waits. It answers how many bytes it read, `0` when stdin has
ended, or `-11` when nothing has arrived yet. Any other negative number means
reading stdin failed, and the loop should stop as it does at the end. Ask for
at least one byte: a `len` of `0` reads nothing and answers `0`, which looks
like the end.

`waitStdin(timeoutMs)` waits until there is something to read, or until
`timeoutMs` milliseconds have passed. It answers `true` when stdin is ready
(its end and an error count, so the read after it answers at once) and `false`
when the time ran out or a signal ended the wait first. A Ctrl-Z and `fg`
after `setRawMode(true)` do not end it: the wait goes on until its timeout.
Before raw mode, whether a stop ends the wait depends on the system, so treat
`false` as "nothing to read yet" rather than as the time having run out. A
negative timeout waits for ever.

Together they make the loop of an interactive program. Each pass waits up to
one frame for a key, handles what came, and draws. A key that arrives early
ends the wait at once, and a frame with no key still ends on time.

## Raw mode

A terminal normally keeps what you type until you press Enter, and echoes it
as you go. `setRawMode(true)` turns that off: each key arrives as soon as it is
pressed, and nothing is echoed. A key arrives as its bytes. A letter is one
byte, and an arrow key is three: `27`, `91` and then `65` to `68` for up, down,
right and left.

Three things do not change:

- **Ctrl-C still ends the program.** It is still a signal, not a byte, and
  so are Ctrl-\ and Ctrl-Z. A program stuck in a loop can always be stopped
  from the keyboard. So `nish/term`'s `KEY_CTRL_C` never comes from a
  terminal `setRawMode` set up.
- **`"\n"` still starts a new line**, so `console.log` works as it always does.
- **The terminal is always put back.** `setRawMode(false)` restores it, and
  so does returning from `main`, `process.exit`, a panic or a crash, a
  Ctrl-C or `kill`, and a closed pipe on the other end of stdout. Ctrl-Z
  puts it back while the program is stopped, and `fg` puts raw mode back on.
  Only `kill -9`, `kill -STOP`, and a stack overflow on a thread other
  than the one that called `setRawMode(true)`, leave the terminal in raw
  mode; type `stty sane` to fix it.

Ctrl-D is a byte in raw mode, `4`, not the end of stdin. Treat it as a key if
you want it to quit.

`setRawMode` answers `0`, or `-25` when stdin is not a terminal. Calling it
for the mode the terminal is already in does nothing, so `setRawMode(false)`
is always safe.

A program you start in the background, with `app &`, is stopped by the shell
when it calls `setRawMode(true)`, the way any program that changes the
terminal is. Type `fg` and it goes on, in raw mode.

## A key-echo loop

This program prints the number of each key you press. It stops on `q`, on
Ctrl-D, or when stdin ends or fails. Run it in a terminal and press an arrow key to see
its three bytes.

```ts nish:ok
import { isTerminal, readStdin, setRawMode, waitStdin } from "nish:term";

export const main = (): i32 => {
  if (!isTerminal(0)) {
    console.log("stdin is not a terminal; the keys arrive as they were piped");
  }
  setRawMode(true);
  const keys = new Array<u8>(16);
  let running = true;
  while (running) {
    if (waitStdin(100)) {
      const n = readStdin(keys, 0, keys.length);
      if (n === 0 || (n < 0 && n !== -11)) {
        running = false;
      }
      for (let i = 0; i < n && i < keys.length; i++) {
        const key = keys[i];
        console.log(`key ${key}`);
        if (key === 113 || key === 4) {
          running = false;
        }
      }
    }
  }
  setRawMode(false);
  return 0;
};
```

It also works with a pipe, `printf 'hiq' | ./echo`. `setRawMode(true)` answers
`-25` there and changes nothing, and the loop reads the piped bytes as keys.

## Leaving the screen as you found it

A full-screen program changes more than the mode: it switches to the
alternate screen, hides the cursor, maybe turns on mouse reporting. Those are
escapes it writes itself, and the escapes that undo them have to go out
however the program ends. `setTerminalRestore(bytes)` hands them to the
runtime, which writes them once, on the same paths that put raw mode back:
returning from `main`, `process.exit`, a panic or a crash, Ctrl-C or `kill`.
It writes them first, then restores the terminal settings.

```ts nish:ok
import { write } from "nish:io";
import { setRawMode, setTerminalRestore } from "nish:term";

export const main = (): i32 => {
  setRawMode(true);
  // The alternate screen, with the cursor hidden; then the bytes that undo both.
  write("\u001b[?1049h\u001b[?25l");
  setTerminalRestore("\u001b[?25h\u001b[?1049l");
  console.log("drawn on the alternate screen");
  return 0;
};
```

Each call replaces the bytes from the last one, so set them again whenever
the program turns another mode on, and `setTerminalRestore("")` once it has
undone them all itself. It answers `0`, `-25` when stdout is not a terminal
(nothing is kept then), and `-7` for more than 4096 bytes. Ctrl-Z and
`setRawMode(false)` do not end the program, so they leave the bytes unwritten.

## The size of the terminal

`terminalSize()` answers a new pair each time you call it. Call it again on
each frame to notice when the window is resized.

```ts nish:ok
import { isTerminal, terminalSize } from "nish:term";

export const main = (): i32 => {
  const size = terminalSize();
  if (size[0] < 0) {
    console.log(`not a terminal (${size[0]})`);
    return 0;
  }
  console.log(`${size[0]} columns, ${size[1]} rows; stdout is a terminal: ${isTerminal(1)}`);
  return 0;
};
```

## Where it runs

`nish:term` works on Linux and macOS. Under WebAssembly (`--profile wasi`)
there is no terminal: `readStdin` waits for its bytes instead of answering
`-11`, so call `waitStdin` first, as the loop above does; there it waits at
least 10 ms, even for `waitStdin(0)`. The other four answer "not a terminal". A freestanding `--target wasm32` build has no stdin
at all, so the compiler refuses all six there. When a program is run under
Node, `isTerminal` and `terminalSize` work, and the other four throw; in a
browser the two answer "not a terminal".

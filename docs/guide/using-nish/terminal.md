# Terminal programs

A full-screen terminal program — a game, an editor, a dashboard — reads keys
the moment they are pressed and redraws many times a second. Nish gives it two
layers:

- [`nish/term-io`](#a-frame-loop), in the standard library, is the whole
  loop. It opens the terminal, finds out what it can draw, runs your program
  at a fixed step, sends as many frames as the terminal and the link to it
  can take, and leaves the terminal as it found it however the program ends.
- [`nish:term`](#nishterm-underneath) is what it is built on: six functions
  that read stdin without waiting, set raw mode and say how big the terminal
  is.

Start with the first. Reach for the second when you want a loop of your own.

## A frame loop

`runTerminal(options, state, update, render)` runs a program. `update` is
called a fixed number of times a second (`options.stepsPerSecond`, 60) with
the events since the last step, and answers `false` to stop. `render` is
called whenever a frame may go out, and draws into the frame's `screen` (text
cells) and `framebuffer` (pixels, when the options ask for one). This program
bounces a square across the screen until you press `q`:

```ts nish:ok
import { ACTION_PRESS, ATTR_NONE, COLOR_DEFAULT, EVENT_KEY, KEY_CHAR } from "nish/term";
import { Frame, TermInput, defaultTerminalOptions, runTerminal } from "nish/term-io";

class Ball {
  x: i32 = 0;
  dx: i32 = 1;
}

const update = (b: Ball, input: TermInput): boolean => {
  for (const e of input.events) {
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS && e.key === KEY_CHAR && e.code === 113) {
      return false; // q
    }
  }
  if (b.x + b.dx < 0 || b.x + b.dx > 150) {
    b.dx = -b.dx;
  }
  b.x = b.x + b.dx;
  return true;
};

const render = (b: Ball, frame: Frame): void => {
  frame.framebuffer.fill(0x102040);
  for (let y = 40; y < 50; y++) {
    for (let x = b.x; x < b.x + 10; x++) {
      frame.framebuffer.set(x, y, 0xffcc00);
    }
  }
  frame.screen.clear(COLOR_DEFAULT);
  frame.screen.text(0, 0, `${frame.stats.tier} fps, q quits`, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE);
};

export const main = (): i32 => {
  const options = defaultTerminalOptions();
  options.framebufferWidth = 160;
  options.framebufferHeight = 90;
  const ran = runTerminal(options, new Ball(), update, render);
  if (ran.isErr()) {
    writeError(`${ran.error}\n`);
    return 1;
  }
  return 0;
};
```

The state is yours: any class, passed to both functions. Because `update`
runs at a fixed step and `render` only when a frame can go out, the square
moves at the same speed on a fast terminal and on a slow one; the slow one
just shows fewer of its positions. `frame.alpha` says how far the clock is
past the last step, to draw between two positions.

`input.events` holds `nish/term`'s `TermEvent`s: keys (with releases, on a
terminal that has the kitty keyboard protocol), mouse reports when
`options.mouse` asks for them, pastes, focus changes, and `EVENT_RESIZE` when
the window changes size, with the screen already resized. `input.isDown(key,
code)` asks whether a key is held, for movement that lasts as long as the
key. The program also stops on Ctrl-C, and the terminal is put back.

`runTerminal` answers `Err` with one sentence when it cannot start, and the
program above prints it. A pipe on either side is the usual reason:

```
$ ./ball < /dev/null
stdin is not a terminal (a pipe or CI?)
```

For a loop of your own, `openTerminal(options)` answers the `Terminal` that
`runTerminal` drives: `readEvents(waitMs, events)` waits for input and
decodes it, `present()` sends the screen and framebuffer, `stats()` says how
the link is doing, and `close()` puts the terminal back (a second `close` does
nothing).

## Opening and closing

Opening the terminal turns raw mode on, switches to the alternate screen,
hides the cursor and asks the terminal what it can do (below). Then it turns
on what the options ask for and the terminal has: the kitty keyboard protocol,
mouse reports, bracketed paste and focus reports. Before each of those reaches
the terminal, the bytes that undo everything so far are handed to the runtime
([`setTerminalRestore`](#leaving-the-screen-as-you-found-it)), in reverse
order. So a panic in `render`, a Ctrl-C, or a `kill` leaves the terminal as it
was, with the cursor back and the screen you started from.

## What it detects, and what it falls back to

The questions go out in one write and the answers come back in a few
milliseconds; a terminal that answers nothing is given up on after a quarter
of a second. A key you press while it asks is kept and given to the program
first. What it finds:

| What | Where it comes from | Without it |
| --- | --- | --- |
| Pixels: kitty graphics | the terminal answers a kitty graphics query | sixel |
| Pixels: sixel | the terminal reports 256 or more sixel colour registers | half blocks, two pixels to a cell (`▀`) |
| Pixels: half blocks | any terminal but `TERM=dumb` and the Linux console | ASCII shading |
| True colour | `COLORTERM=truecolor` or `24bit`, or the terminal reads a 24-bit colour back | 256 colours with `256color` in `TERM`, else 16 |
| Key releases, Ctrl-C as a key | the kitty keyboard protocol | a key counts as released `options.releaseGapMs` after its last repeat |
| Tear-free frames | synchronized output (mode 2026) | frames are drawn as they arrive |
| Mouse in pixels | mode 1016, and the terminal reports its cell size | mouse in cells |

`frame.caps` holds what was found, and `frame.stats.backend` the pixel
backend in force. The Linux console (`TERM=linux`) gets 16 colours and ASCII,
whatever it answers.

## How the frame rate adapts

Each frame is followed by a status query, and the terminal's answer says the
frame has been read. From those answers `nish/term-rate` measures the round
trip, the bytes a second the link carries and what a frame costs to build, and
picks a frame rate from 60, 30, 20, 15, 10 and 5 that fits all three with
room to spare. At most one frame is unanswered at a time, so a slow link
shows fewer frames instead of a growing backlog, and a key you press is never
queued behind seconds of drawing. Below `options.minFps` (10), it draws with
less detail instead: a cheaper pixel backend, a coarser framebuffer, 256
colours. `options.prefer = DETAIL_FIRST` cuts the rate first.

It starts at 30 frames a second, or 15 when an `SSH_*` variable says the
session is remote and the first answer was slow, and settles within a few
seconds. `frame.stats` shows the numbers; `options.overlay` draws them in a
corner.

**Under SSH and multiplexers the measure is only as good as the answer.**
tmux and GNU screen answer the status query themselves, so inside them the
round trip is the multiplexer's, not the terminal's at the end of the link,
and the rate can come out higher than the outer terminal keeps up with. mosh
answers on the remote host, so it reads as a fast local link and its own
limit (about 50 frames a second) does the pacing. Under tmux, kitty graphics
and sixel work only where tmux passes them through. If a program looks wrong
there, fix the rate or the backend with the overrides below.

## Overriding it

| Setting | Effect |
| --- | --- |
| `options.fixedFps` | a fixed frame rate; the measuring stops choosing |
| `options.minFps`, `options.maxFps`, `options.allow120` | the range the rate is chosen in (10 to 60; 120 only when allowed) |
| `options.prefer` | `RATE_FIRST` (cut detail below `minFps`) or `DETAIL_FIRST` (cut the rate first) |
| `options.mouse`, `paste`, `focus`, `kittyKeyboard`, `quitOnCtrlC` | what is turned on: mouse `1000` clicks, `1002` drags, `1003` all motion, `0` none |
| `NO_COLOR` set to anything | 16 colours, nothing else changed |
| `NISH_TERM_GRAPHICS` | `kitty`, `sixel`, `halfblock` or `ascii` instead of what was detected; a pixel backend the terminal did not answer for is refused under a multiplexer, on the Linux console, or when nothing answered |
| `NISH_TERM_FPS` | a fixed frame rate, over everything else |

The variables are the user's: they let someone running your program fix it
for their terminal without a rebuild.

## Reporting a terminal that draws wrong

[`examples/term-probe.ts`](../../../examples/term-probe.ts)
prints everything the probe found, one field a line, and then a line of
frame-rate measurements every second for five seconds. Run it in the terminal
that draws wrong and put its output in the bug report:

```
nish run examples/term-probe.ts
```

## `nish:term`, underneath

`nish:term` lets a program read keys the moment they are pressed. It has six
functions:

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

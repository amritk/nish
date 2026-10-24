# Security record: `nish:term` (raw mode, stdin reads, terminal size) and `std/term`

The record covers the terminal module added in #854 (dd4df49) and the
`std/term` screen and key decoder it serves. Anchors are at `804120e`.

**Result.** Five findings (one Medium, four Low), all fixed. There is no
memory-safety finding. `readStdin`'s range is checked
before `read`. The ioctl result is copied field by field into a two-element
answer. Every index in `std/term` is checked. Two Low findings break the
documented guarantee that the terminal is put back on every fatal signal:
the caught-signal list is incomplete (TERM-1), and a signal can land between
the `tcsetattr` and the flag (TERM-2). One Medium finding is a panic on attacker input: a pty
resized to a large size makes `Screen.resize` overflow an i32 multiply or
run out of memory (TERM-3). One Low finding is a CSI parameter run the key
decoder holds without a cap (TERM-4). One Low finding is doc drift in this
area's runtime record (TERM-5).

## Scope

| File | Functions |
| --- | --- |
| `runtime/runtime-term.c` | `nish_stdin_ready`, `nish_read_stdin`, `nish_wait_stdin`, `nish_terminal_size`, `nish_term_mask`/`hold`/`drop`, `nish_term_restore`, `nish_term_leave`, `nish_term_enter`, `nish_term_catch`, `nish_term_on_signal`, `nish_term_set`, `nish_set_raw_mode` |
| `runtime/runtime.c` | `nish_fatal_hook`, `nish_fatal_exit`, the panic paths that reach them |
| `runtime/runtime-host.c` | `nish_signal_fd` (only where it replaces term's handlers) |
| `std/term.ts` | `Screen` (`resize`, `put`, `flush`), `Canvas` constructor, `KeyDecoder` (`feed`, `poll`), `termDecodeKeys` |
| `src/` | the `nish:term` builtins' checker rules (capability `tty`, the wasm refusal, aliasing) and the slice check emitted before `nish_read_stdin` |

Added after the audit, with `setTerminalRestore` (#876, at `b528555`):
`nish_set_terminal_restore`, `nish_term_write_out`, `nish_term_finish` and
`nish_term_arm`, read for the same threat model. The bytes they write come
from the program, not from stdin or a signal. They are refused past
`NISH_TERM_RESTORE_MAX` (4,096) before the `memcpy` into a buffer of that
size, published by swapping one word after the copy so a handler sees the
old bytes or the new ones, and written once, by `write` alone, with every
signal blocked. No finding. The handlers it arms are TERM-1's, so the
restore bytes go out on every signal TERM-1's fix catches.

Out of scope: the rendering of `std/term` output by the terminal emulator;
`runtime/nish.mjs`'s browser and Node adapters beyond the parity checks
named below; WASI hosts' own stdin; threads other than the one that armed raw
mode, whose stack overflow is documented as not restored.

## Threat model

The attacker writes the bytes on stdin, which can be a terminal, a pipe or a
file. The attacker can send the process any signal its user can send, and
can resize the terminal (`TIOCSWINSZ` on the pty, or a terminal emulator
with an arbitrary window). The attacker does not control the program text
or its arguments. A win is:

- memory read or written out of bounds;
- a panic, unbounded loop or unbounded allocation on input;
- the terminal left in raw mode after the process ends;
- an EINTR or short-read bug;
- an ioctl size trusted;
- wrong behaviour when stdin is not a terminal;
- a capability bypass;
- a break of docs/security/runtime.md's invariants.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| TERM-1 | Low | `runtime/runtime-term.c:364-371` (`nish_term_set`) | The terminal is restored only for the signals in a fixed list. SIGIO/SIGPOLL, SIGPWR, SIGSTKFLT, SIGRTMIN..SIGRTMAX (and SIGEMT on Darwin) also end the process by default, are not caught, and leave the terminal raw. This contradicts `docs/LANGUAGE.md:7784` and `docs/guide/using-nish/terminal.md:82` | Fixed. `nish_term_arm` (in `nish_term_set` at the anchor; #876 moved it into its own function) catches every signal from 1 to `SIGRTMAX` that is at `SIG_DFL` and whose default ends the program; the ones a default ignores or that stop it are skipped by name ("term_pty: SIGIO, SIGPWR, SIGSTKFLT and SIGRTMIN each leave the terminal as it was") |
| TERM-2 | Low | `runtime/runtime-term.c:270-275` (`nish_term_enter`), reached from `:326` and `:373` | `nish_term_raw` is set after `tcsetattr` returns. A fatal signal that lands between the kernel's switch and the store finds the flag clear, restores nothing, and dies with the terminal raw. Measured: 6 of 300 SIGTERMs sent to a loop of `setRawMode(true/false)`. The order is deliberate, so that a signal during a TCSAFLUSH drain or a SIGTTOU stop does not call `tcsetattr` from the background | Fixed. `nish_term_entering` is set across the `tcsetattr`; while it is set, `nish_term_restore` asks `tcgetattr`, which is allowed from the background, and restores only if the terminal already holds the raw settings. 0 of 300 after the fix ("term_pty: SIGTERM sent while a loop enters and leaves raw mode never leaves the terminal raw (200 tries)") |
| TERM-3 | Medium | `std/term.ts:437`, `:448` (`Screen.resize`); `:810` (`Canvas`) | `terminalSize()` answers `ws_col`/`ws_row` up to 65535 each. `width * height` and `cells * 64 + 64` are checked i32 arithmetic. A size above about 5793 x 5793 panics with `attempt to multiply with overflow`, and 20000 x 20000 panics with `nish: out of memory`. The panic restores the terminal, and nothing is read or written out of bounds | Fixed. `resize` clamps each side to `TERM_MAX_SIDE` (4096) and the cell count to `TERM_MAX_CELLS` (1,048,576), and `Canvas` takes its size from the clamped screen; `docs/guide/` states the caps ("link/std_term: exits with 0 and stdout matches expected.out", the line "a 65535 x 65535 screen is 4096 x 256") |
| TERM-4 | Low | `std/term.ts:1151-1160` (`termDecodeKeys`), `:984` (`KeyDecoder.feed`) | An `ESC [` followed by parameter bytes (0x20-0x3F) is held until a final byte arrives or `escapeTimeoutMs` passes, with no cap on length. Each `feed` copies the held bytes again. Measured with 4096-byte reads and a real clock: 344,064 bytes held at most, 16.8 ms for the worst `feed`, about 5x the time of plain input. It is bounded only by the timeout, so a caller whose `nowMs` does not advance holds input without limit | Fixed. A run longer than `TERM_MAX_CSI_PARAMS` (32) gives the ESC up as `KEY_ESCAPE` at once and decodes what follows as plain input ("link/std_term: exits with 0 and stdout matches expected.out", the lines "ESC [ 32 parameters A" and "ESC [ and 4000 parameters: 4002 keys, the first escape") |
| TERM-5 | Low | `docs/security/runtime.md:7-17`, `:143` | The scope table has no `runtime-term.c` row. The `waitpid` row says "the only handler the runtime installs is `SA_RESTART`", written before the term handlers existed. They are `SA_RESTART` too, so the property holds, but the reason is stale | Fixed. `runtime.md` has the row, and the `waitpid` reason names every handler the runtime installs |

## Properties verified

**`readStdin` cannot read past its buffer.** `offset < 0`, `count < 0`,
`offset + count > length` and an overflowing `offset + count` each panic with
`slice out of range` before `read` is called, and `count == 0` answers 0.
Checked by a scratch program. `--unchecked-indexing` removes the check, as it
removes every bounds check, by design. The emitted check is pinned
("term_calls: IR matches golden", "term_import: IR matches golden"), but no
run-time negative test exercises it.

**`terminalSize` trusts no ioctl size.** `TIOCGWINSZ` fills a stack
`struct winsize`, and only `ws_col`/`ws_row` are copied into the two-element
answer. Off a terminal it answers `[-25, 0]` ("caps_tty: under the prelude
terminalSize answers -25 off a terminal, as natively").

**Off a terminal nothing is changed.** `setRawMode` answers -25 and the
reads still work over a pipe ("term_calls: over a pipe readStdin reads the
four bytes waiting, waitStdin sees the end, and the terminal questions
answer false and -25"; "term_calls: over a pipe held open with nothing in it
readStdin answers -11 and waitStdin(50) times out after at least 50 ms";
"term_import: waitStdin and readStdin drain a thousand piped bytes and stop
at the end of the stream").

**A stop does not end a wait early, and EINTR loses no read.** After a
SIGTSTP stop, `nish_stdin_ready` works out the time left and waits again.
Any other signal ends the wait with `false`, which the docs say it does.
`read` retries EINTR, and a readiness check that a signal interrupts answers
-11 rather than falling through to a `read` that blocks ("term_pty: under a pseudo-terminal raw mode takes, and returning, a
panic, SIGTERM and SIGSEGV each leave the terminal as it was, and so does a
stop by SIGTSTP, through `bg` too, after which `fg` gives raw mode back and
the wait goes on rather than ending early, and once stopped mid-wait only
until its deadline").

**The terminal is put back on return, panic, SIGTERM, SIGSEGV and SIGTSTP**
(the same term_pty check), on every other signal whose default ends the
program, and on one that lands while raw mode is entered (TERM-1, TERM-2). A scratch program also found it put back after a
slice panic, an index panic, a divide-by-zero panic, a real stack overflow
on the main thread, and `process.exit(3)`. None of these is pinned beyond
the panic case.

**The capability cannot be bypassed.** An aliased import, a call with no
import, a use as a value and a namespace import are all refused. `--deny tty`
refuses the program, and `--emit-capabilities` names `tty`
("caps_tty: --emit-capabilities matches .caps.json byte for byte"). The
aliased form is pinned by no test.

**The key decoder decodes the same however its input is split.** 20,000
rounds of random bytes, fed whole and fed in random splits within the
timeout, gave the same events. No surrogate, C1 control or value above
U+10FFFF came out as `KEY_CHAR`. This was checked by a scratch fuzzer and is
pinned by no test. The fixed cases in `tests/link/std_term/main.ts` cover
splits, a lone ESC and `poll`.

**A size or a key sequence from the terminal cannot exhaust memory.** A
screen holds at most 4096 x 4096 sides and 1,048,576 cells, so `cells * 64 + 64`
cannot overflow, and the key decoder holds at most 34 bytes of a CSI
(TERM-3, TERM-4).

**A frame loop does not grow the heap** ("link/std_term: a frame loop's
`flush` is taken back every pass, and nothing in main piles up").

Tests:
- `term_calls: over a pipe readStdin reads the four bytes waiting, waitStdin sees the end, and the terminal questions answer false and -25`
- `term_calls: over a pipe held open with nothing in it readStdin answers -11 and waitStdin(50) times out after at least 50 ms`
- `term_import: waitStdin and readStdin drain a thousand piped bytes and stop at the end of the stream`
- `term_pty: under a pseudo-terminal raw mode takes, and returning, a panic, SIGTERM and SIGSEGV each leave the terminal as it was, and so does a stop by SIGTSTP, through \`bg\` too, after which \`fg\` gives raw mode back and the wait goes on rather than ending early, and once stopped mid-wait only until its deadline`
- `caps_tty: under the prelude terminalSize answers -25 off a terminal, as natively`
- `caps_tty: --emit-capabilities matches .caps.json byte for byte`
- `term_calls: under the prelude readStdin fails loudly rather than answering`
- `term_calls: IR matches golden`
- `term_import: IR matches golden`
- `link/std_term: a frame loop's \`flush\` is taken back every pass, and nothing in main piles up`
- `term_pty: SIGIO, SIGPWR, SIGSTKFLT and SIGRTMIN each leave the terminal as it was` (TERM-1)
- `term_pty: SIGTERM sent while a loop enters and leaves raw mode never leaves the terminal raw (200 tries)` (TERM-2)
- `link/std_term: exits with 0 and stdout matches expected.out` (TERM-3, TERM-4)

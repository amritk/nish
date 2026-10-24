# Security record: `nish/runtime/browser` — the browser host

The record of `runtime/browser.mjs` (#851): the host that a hand translation
of a Nish program to TypeScript ("Back to TypeScript",
`docs/guide/using-nish/to-typescript.md`) installs on `runtime/core.mjs` to
run in a page or a worker. It says what the host answers, what it refuses,
how output and exit reach the page, and the test that pins each property. It
is written against `main` at `804120e`. Lines are cited at that commit.

**Result.** The host fails closed.

- It names no `node:` module and reads only `console`, `performance`,
  `queueMicrotask` and `crypto`.
- Every host call it does not answer panics, naming itself.
- Output goes through `"%s"`, so program text is never a format string.

There are four findings. Two are fixed: BROWSER-1 (Medium) and BROWSER-3
(Low). Two Low ones are accepted, and the guide states each with what a
caller does about it: BROWSER-2 and BROWSER-4.

- **BROWSER-1:** a run of writes with no newline costs time quadratic in its
  length, enough to stall a page. Medium where a program writes attacker-sized
  data without a newline, Low otherwise; it is counted as Medium.
- **BROWSER-2:** a caught `NishExit` leaves the module's state where the
  program stopped.
- **BROWSER-3:** `NishExit` cannot be told apart from any error with the same
  `name`.
- **BROWSER-4:** a lone surrogate from the page reads as U+FFFD to the core
  but not to `===`.

## Scope

| File | Functions |
| --- | --- |
| `runtime/browser.mjs` | `NishExit`, `lineStream` (`write`, `flush`), the `installHost` answers (`writeOut`, `writeErr`, `exit`, `argv`, `call`) |
| `runtime/core/host.mjs` | `installHost`, `panic`, the web-crypto random source |
| `runtime/core/checks.mjs`, `arrays.mjs`, `strings.mjs` | the index checks and the UTF-8 byte view the translated program runs on |
| `runtime/host.d.ts`, `package.json` (`exports`, `files`), `.github/workflows/release.yml` (`SHA256SUMS`) | what is shipped and how it is named |

Out of scope:

- The Node host (`runtime/node.mjs`).
- The translation itself, which a person writes.
- WebAssembly. This host runs JavaScript, so linear memory, detached buffers and WASI imports do not arise; see Divergences.

## Threat model

The attacker supplies the data a page passes to the translated module's
exported functions: strings of any length and content (lone surrogates
included), numbers (NaN, fractions, negatives) and property names.

A win is any of:

- a host call that does something other than answer or panic;
- program text read as a console format directive;
- time or memory the page spends without a bound the program set;
- an exit the caller cannot recognise reliably;
- state that a caller who follows the guide goes on using after the program
  has stopped;
- two readings of one string that disagree.

The page that imports the host and the program that was translated are trusted.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| BROWSER-1 | Medium | `runtime/browser.mjs:42`–`:45` (`lineStream.write`) | Each `write` splits the whole pending line on `"\n"`, so k writes with no newline cost O(k²). 400,000 one-byte writes took 30 s on the page's thread; 1,000,000 with the fix take 71 ms. | **Fixed.** `write` splits only `s`, and only when it holds a newline; the rest is appended to the pending line ("runtime-hosts: the core and the browser adapter run with only web globals", which asserts that 400,000 one-byte writes are one line, printed whole, in under a second). |
| BROWSER-2 | Low | `runtime/browser.mjs:61`–`:65`; `docs/guide/using-nish/to-typescript.md:101`–`:116` | `exit`, and every panic through it, throws `NishExit` out of the middle of the program. The guide's example catches it and continues. A later call runs on the state the program stopped in: a transfer that panics between debit and credit leaves the total at 90 of 100. A native exit ends the process, so nothing sees that state. | **Accepted.** A latch would refuse the module's next call but not undo the state, so it changes no outcome for a caller who goes on. `docs/guide/using-nish/to-typescript.md` says not to call the module again after a `NishExit`, and to run a program more than once in a `Worker` it `terminate`s. |
| BROWSER-3 | Low | `runtime/browser.mjs:21`; `runtime/host.d.ts` | `NishExit` is neither exported nor declared, so a caller recognises it by `e.name === "NishExit"`, which any thrown object can carry. | **Fixed.** `runtime/browser.mjs` exports `NishExit`, `runtime/browser.d.ts` declares it (named by `package.json`'s `types` for `./runtime/browser`), and the guide uses `instanceof` ("runtime-hosts: the core and the browser adapter run with only web globals", which asserts that an `Error` named `NishExit` is not an instance). |
| BROWSER-4 | Low | `runtime/core/strings.mjs` (the `TextEncoder` byte view) | `"\uD800"`, `"\uDC00"` and `"�"` have the same bytes (EF BF BD) to the core but differ under `===`. `indexOf("x\uD800", "�")` is 1. A native Nish string is always valid UTF-8. | **Accepted.** Making every string well-formed would cost the core a pass over each string the page hands it. The guide says to pass `s.toWellFormed()` where a string from outside reaches the program. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding,
except where it says otherwise.

**Only web globals.**

- The core and the adapter import no `node:` module and name no `process`
  or `Buffer`.
- The two load and run in a `vm` context that holds only web globals, under
  a loader that refuses `node:`.
- Pinned by `runtime-hosts: the core imports no node: module and names no process or Buffer` and `runtime-hosts: the core and the browser adapter run with only web globals` (`tests/runtime/web-context.mjs`).

**Output is text, a line at a time.**

- Each line reaches `console.log` or `console.error` as `("%s", line)`.
- What is left without a newline is printed at `exit` or when the program
  yields (a microtask).
- Pinned by the web-context check above, which asserts the `"%s"` lines and the flush of a partial line.

**The host fails closed.**

- `getenv` answers `null` and `argv()` answers `["main"]`.
- `isTerminal` answers `false` and `terminalSize` answers `[-25, 0]`.
- `monotonicNanos` reads `performance.now()`.
- Every other call panics with `` `${name}` is not available in a browser ``.
- Pinned by the web-context check above, which asserts the file-system panic.

**An exit is recognisable.** `NishExit` is exported and declared, and an
object that only carries its name is not an instance (BROWSER-3). Pinned by
the web-context check above.

**Output costs time linear in its length.** A write with no newline appends
and splits nothing (BROWSER-1). Pinned by the web-context check above.

**The exit code is 8 bits.** `NishExit.code` is `code & 0xff`, so 259
exits 3. Pinned by the web-context check above, which asserts the codes 1, 3
and 1.

**No host, no call.** The core alone computes, and throws `NishNoHost` at the
first call that needs a host. Pinned by `runtime-hosts: runtime/core.mjs alone computes, and throws NishNoHost at the first call that needs a host`.

**The index checks refuse what is not an index.**

- Element access checks `!(k >= 0 && k < len)`, which refuses NaN, a
  fraction, a negative number and a string such as `"__proto__"`, and panics.
- Verified by reading and by probes. The NaN and property-name cases are not
  pinned by a check of their own.

**Randomness fails closed.**

- The random source reads `globalThis.crypto.getRandomValues`, bound when the
  module loads, and has no `Math.random` fallback.
- Verified by reading. Not pinned by a browser-specific check.

**What ships.**

- `package.json` exports `./runtime/browser`, and `files` includes `runtime/`.
- The release's `SHA256SUMS` covers `runtime/browser.mjs` (SC-18).
- Pinned by `runtime-hosts: the package resolves nish/runtime, /node and /browser`.

Tests:

- `runtime-hosts: the core imports no node: module and names no process or Buffer`
- `runtime-hosts: the core and the browser adapter run with only web globals`
- `runtime-hosts: runtime/core.mjs alone computes, and throws NishNoHost at the first call that needs a host`
- `runtime-hosts: the package resolves nish/runtime, /node and /browser`
- `runtime-hosts: core.d.ts declares every name the core exports, and agrees with nish.d.ts`

All of them are in `tests/run.js`. The web-context check runs
`tests/runtime/web-context.mjs`, which also asserts the BROWSER-1 and
BROWSER-3 fixes.

## Divergences from the native build

- **Exit.** A native `exit` ends the process. The browser host throws
  `NishExit`, and the module's state survives it (BROWSER-2).
- **Strings.** A native string is valid UTF-8. A string from the page may
  hold a lone surrogate, which the core reads as U+FFFD (BROWSER-4).
- **No WebAssembly.** The program runs as JavaScript on JS arrays and strings,
  so there is no linear memory to bound, no buffer to detach and no WASI
  import to stub. An index outside an array is the core's panic, not a trap.
- **No file system, process, environment or terminal.** Those calls panic, or
  answer as a pipe does (`isTerminal`, `terminalSize`), as listed above.

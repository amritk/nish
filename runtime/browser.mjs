/**
 * The browser host (WP33 R3): importing this installs, on the core in
 * `runtime/core.mjs`, the answers a web page can give. It names no `node:`
 * module and reads only web globals (`console`, `performance`,
 * `queueMicrotask`), so it loads in a page, a worker or any engine that has
 * those.
 *
 *   - Output goes to the console a line at a time: what `write` leaves without
 *     a newline waits for the next one, for `exit`, or for the program to yield.
 *   - `exit(code)` throws a `NishExit` carrying the code, since a page cannot
 *     end itself; the caller that started the program catches it, and does
 *     not call the module again (docs/security/runtime-browser.md, BROWSER-2).
 *   - `monotonicNanos` reads `performance.now()`, `getenv` answers `null`,
 *     `isTerminal` answers `false` and `terminalSize` `[-25, 0]`, and `argv()`
 *     is the program alone.
 *   - Every file-system, process and machine call panics, naming itself and
 *     the browser.
 */
import { installHost, panic } from "./core/host.mjs";

/**
 * What `exit(code)` throws: `code` is the 8-bit status a native exit would
 * leave. Exported so a caller tells it apart with `instanceof`, which a thrown
 * object that only carries the name does not pass.
 */
export class NishExit extends Error {
  constructor(code) {
    super(`the program exited with ${code}`);
    this.name = "NishExit";
    this.code = code & 0xff;
  }
}

/**
 * One console stream, buffered to the next newline. The `"%s"` keeps a `%d`
 * or `%o` in the program's text from being read as a format directive.
 */
function lineStream(print) {
  let pending = "";
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    if (pending !== "") print("%s", pending);
    pending = "";
  };
  return {
    write(s) {
      // Only the text up to the last newline is split, so a run of writes
      // with no newline costs their length once, not once per write.
      const text = String(s);
      const last = text.lastIndexOf("\n");
      if (last < 0) {
        pending += text;
      } else {
        const lines = (pending + text.slice(0, last)).split("\n");
        pending = text.slice(last + 1);
        for (const line of lines) print("%s", line);
      }
      if (pending !== "" && !scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
    flush,
  };
}

const out = lineStream((...a) => console.log(...a));
const err = lineStream((...a) => console.error(...a));

installHost({
  writeOut: out.write,
  writeErr: err.write,
  exit(code) {
    out.flush();
    err.flush();
    throw new NishExit(code);
  },
  argv: () => ["main"],
  call(name) {
    if (name === "getenv") return null;
    if (name === "monotonicNanos") return BigInt(Math.round(performance.now() * 1e6));
    // A page has no terminal, which `nish:term` answers as a pipe does.
    if (name === "isTerminal") return false;
    if (name === "terminalSize") return [-25, 0];
    return panic(`${name} is not available in a browser`);
  },
});

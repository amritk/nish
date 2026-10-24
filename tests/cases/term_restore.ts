// `setTerminalRestore`, the bytes the runtime writes to stdout on the way out.
// With no argument, as the case runner starts it (stdout a pipe), stdout is not
// a terminal: bytes answer -25 and keep nothing, "" clears and answers 0 there
// too, and 4,096 bytes are within the cap where 4,097 answer -7 before the
// terminal is asked. Under `tests/run.js`'s pseudo-terminal each mode keeps
// `<old>`, is refused 4,097 bytes, enters raw mode and replaces `<old>` with
// `BYTES`, prints its last line, and leaves: `exit` returns, `panic` fails a
// bounds check, `hold` waits until a signal ends it, and `cleared` clears the
// bytes first, so nothing follows its last line. `hold` says `ready` on
// stderr, because stdout must stay the terminal, and reads and drops what
// comes meanwhile, as `term_pty` does.
const BYTES: string = "\u001b[?25h<bye>";

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  const parts: string[] = [];
  for (let i = 0; i < 4096; i++) {
    parts.push("a");
  }
  const full = parts.join("");
  if (mode === "") {
    const kept = setTerminalRestore(BYTES);
    const cleared = setTerminalRestore("");
    console.log(`${kept} ${cleared} ${setTerminalRestore(full)} ${setTerminalRestore(`${full}a`)}`);
    return 0;
  }
  const old = setTerminalRestore("<old>");
  const over = setTerminalRestore(`${full}a`);
  console.log(`set ${old} ${over} ${setRawMode(true)} ${setTerminalRestore(BYTES)}`);
  if (mode === "cleared") {
    setTerminalRestore("");
  }
  console.log(`last ${mode}`);
  if (mode === "panic") {
    const xs: i32[] = [1, 2, 3];
    console.log(xs[process.argv.length + 4]);
  }
  if (mode === "hold") {
    writeError("ready\n");
    const buf: u8[] = new Array<u8>(16);
    let n = -11;
    while (n > 0 || n === -11) {
      if (waitStdin(600000)) {
        n = readStdin(buf, 0, 16);
      }
    }
  }
  return 0;
};

// What `tests/run.js` asks of a pseudo-terminal, one mode per argument. With
// none, as the case runner starts it (stdin `/dev/null`, stdout a pipe), it
// only prints what it is attached to. `probe` reports a terminal and enters raw
// mode twice, the second a no-op; `exit` returns in raw mode, so the atexit
// handler restores; `panic` fails a bounds check in raw mode, so the panic
// path restores; `hold` waits in raw mode until SIGTERM, which the handler
// restores before it lets the signal end the program.
const probe = (): number => {
  const size = terminalSize();
  console.log(`${isTerminal(0)} ${isTerminal(1)} ${size[0] >= 0} ${size[1] >= 0}`);
  console.log(`${setRawMode(true)} ${setRawMode(true)} ${setRawMode(false)} ${setRawMode(false)}`);
  return 0;
};

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  if (mode === "probe") {
    return probe();
  }
  if (mode === "") {
    console.log(`${isTerminal(0)} ${setRawMode(true)}`);
    return 0;
  }
  console.log(`raw ${setRawMode(true)}`);
  if (mode === "panic") {
    const xs: i32[] = [1, 2, 3];
    console.log(xs[process.argv.length + 4]);
  }
  if (mode === "hold") {
    console.log("ready");
    waitStdin(-1);
  }
  return 0;
};

// `nish:term` is a builtin module like `nish:io`: an imported name, a renamed
// one included, is the same builtin as the global and lowers to the same call.
// This is the shape of a key-echo loop: wait for stdin, read what is there and
// stop at the end of the stream, which `/dev/null` reaches on the first read.
import { isTerminal as tty, readStdin, setRawMode, waitStdin } from "nish:term";

export const main = (): number => {
  const raw = tty(0) ? setRawMode(true) : -25;
  console.log(raw);
  const buf: u8[] = new Array<u8>(16);
  let total = 0;
  while (waitStdin(1000)) {
    const n = readStdin(buf, 0, buf.length);
    if (n <= 0) {
      break;
    }
    total += n;
  }
  console.log(total);
  setRawMode(false);
  return 0;
};

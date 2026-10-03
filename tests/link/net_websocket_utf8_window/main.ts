// `websocketIsUtf8` with a window outside its buffer panics (exit 1,
// "websocketIsUtf8: the window is outside the buffer" on stderr) rather than
// answering for bytes it was not given. Stdout stops at the line before the
// call.
import { websocketIsUtf8 } from "nish/net/websocket";

export const main = (): i32 => {
  const text: u8[] = [104, 105];
  const off: i32 = 3;
  const len: i32 = 0;
  console.log("checking a window that starts past the end");
  const ok: boolean = websocketIsUtf8(text, off, len);
  console.log(`unreachable: ${ok ? "valid" : "invalid"}`);
  return 0;
};

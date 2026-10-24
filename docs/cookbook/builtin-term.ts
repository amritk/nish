// `nish:term`: one call into runtime-term.c each. `readStdin` is `netRead`
// without the descriptor: the same range check through the slice panic first,
// and a buffer that is `nocapture` but not `readonly`. It and `waitStdin` are
// not `willreturn`, since a wait can last for ever; `isTerminal` and
// `terminalSize` are, and the size is a fresh `i32[]` from the arena.
import { isTerminal, readStdin, setRawMode, terminalSize, waitStdin } from "nish:term"

export const nextKeys = (buf: u8[], frameMs: i32): i32 =>
  waitStdin(frameMs) ? readStdin(buf, 0, buf.length) : -11

export const columns = (): i32 => (isTerminal(1) ? terminalSize()[0] : 80)

export const enterRaw = (): i32 => setRawMode(true)

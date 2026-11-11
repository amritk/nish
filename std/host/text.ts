/**
 * `nish/host/text` — text in module storage, for a wasm module and the page
 * that drives it (`docs/wp50-wasm-host.md` §7).
 *
 * A string crosses out of a module as an export's result or a host import's
 * argument, but an export cannot take one: the page writes text into a `u8[]`
 * the module declares as module storage and passes the byte count. These are
 * the module's halves of both directions:
 *
 *     import { textRead, textWrite, textWriteInt } from "nish/host/text";
 *
 *     export const INBOX = new Array<u8>(256);
 *     export const OUTBOX = new Array<u8>(256);
 *
 *     // The page: n = new TextEncoder().encodeInto(text, views.INBOX).written
 *     export function echo(n: i32): i32 {
 *       const text = textRead(INBOX, n);
 *       if (text === null) return -1;
 *       return textWriteInt(OUTBOX, textWrite(OUTBOX, 0, text), toI64(n));
 *     }
 *     // The page: new TextDecoder().decode(views.OUTBOX.subarray(0, count))
 *
 * A writer takes the offset to write at and returns the offset after what it
 * wrote, so writes chain. Text that does not fit writes nothing and returns
 * -1, and every writer passes a -1 offset straight through, so a chain that
 * overflowed anywhere ends in -1 with the bytes before the failed write left
 * as they were. Nothing here traps on what a page wrote.
 */

/**
 * Writes `s` as its UTF-8 bytes at offset `at`, or nothing when it does not fit.
 *
 * @param buf - the text's storage
 * @param at - the offset to write at; a negative one is an earlier failure
 * @param s - the text
 * @returns the offset after the text, or -1 when `at` is negative or past the
 *   buffer, or the text does not fit
 */
export const textWrite = (buf: u8[], at: i32, s: string): i32 => {
  const length: i32 = toI32(buf.length)
  const n: i32 = toI32(s.length)
  if (at < 0 || at > length || n > length - at) {
    return -1
  }
  for (let i: i32 = 0; i < n; i++) {
    buf[at + i] = toU8(s.charCodeAt(i))
  }
  return at + n
}

/**
 * Writes `n` in decimal, as a template literal formats it.
 *
 * @param buf - the text's storage
 * @param at - the offset to write at; a negative one is an earlier failure
 * @param n - the integer
 * @returns the offset after the digits, or -1 as `textWrite` answers it
 */
export const textWriteInt = (buf: u8[], at: i32, n: i64): i32 => textWrite(buf, at, `${n}`)

/**
 * Writes `x` in its shortest round-tripping form, as a template literal
 * formats it: `0.30000000000000004`, `1e+21`, `NaN`, `-Infinity`.
 *
 * @param buf - the text's storage
 * @param at - the offset to write at; a negative one is an earlier failure
 * @param x - the number
 * @returns the offset after the text, or -1 as `textWrite` answers it
 */
export const textWriteF64 = (buf: u8[], at: i32, x: f64): i32 => textWrite(buf, at, `${x}`)

/**
 * The first `n` bytes of `buf` as a string: what a page's `encodeInto` wrote.
 * The bytes are not checked as UTF-8; a sequence that is not becomes U+FFFD
 * when the string next crosses to the page.
 *
 * @param buf - the text's storage
 * @param n - the byte count the page passed
 * @returns the string, or null when `n` is negative or past the buffer
 */
export const textRead = (buf: readonly u8[], n: i32): string | null => {
  if (n < 0 || n > toI32(buf.length)) {
    return null
  }
  return String.fromBytes(buf, 0, n)
}

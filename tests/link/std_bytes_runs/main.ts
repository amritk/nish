// `nish/bytes`'s runs and `copyBytes`: natively each run is a runtime kernel
// and the copy one `llvm.memmove`, so every answer here is the kernel's, held
// to the walk Node runs. Runs are long enough to cross the 16- and 32-byte
// blocks, every clamp is taken, and both overlapping copies are made.
import { copyBytes, skipBlank, skipDigits, skipJsonText } from "nish/bytes"

/** The bytes of `b` in decimal, a space between each. */
const spaced = (b: u8[]): string => {
  let out: string = ""
  for (let i: i32 = 0; i < toI32(b.length); i += 1) {
    out = i === 0 ? `${b[i]}` : `${out} ${b[i]}`
  }
  return out
}

/** `n` copies of `byte` followed by `tail`. */
const run = (byte: i32, n: i32, tail: u8[]): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(byte))
  }
  for (const t of tail) {
    out.push(t)
  }
  return out
}

/** The four blanks in turn, `n` of them, then `x`. */
const blanks = (n: i32): u8[] => {
  const out: u8[] = []
  const kinds: u8[] = [toU8(32), toU8(9), toU8(10), toU8(13)]
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(kinds[i % 4])
  }
  out.push(toU8(120))
  return out
}

export const main = (): i32 => {
  // Blanks: every length from 0 to 70 stops on the `x`.
  let blankOk: i32 = 0
  for (let n: i32 = 0; n <= 70; n += 1) {
    if (skipBlank(blanks(n), 0, n + 1) === n) {
      blankOk += 1
    }
  }
  console.log(`blank runs: ${blankOk} of 71`)
  const b: u8[] = blanks(40)
  console.log(`blank from 5: ${skipBlank(b, 5, 41)}, to 20: ${skipBlank(b, 0, 20)}`)
  console.log(`blank clamps: ${skipBlank(b, -3, 1000)} ${skipBlank(b, 30, 10)} ${skipBlank(b, 41, 41)} ${skipBlank(b, 99, 99)}`)

  // Digits: a run of 50 then a colon, and a slash (one below `0`) stops it.
  const d: u8[] = run(55, 50, [toU8(58)])
  console.log(`digits: ${skipDigits(d, 0, 51)} ${skipDigits(d, 7, 51)} ${skipDigits([toU8(48), toU8(47)], 0, 2)}`)

  // JSON text: ASCII runs stop at a quote, a backslash and a control byte, not at DEL.
  console.log(`text quote: ${skipJsonText(run(97, 45, [toU8(34)]), 0, 46)}`)
  console.log(`text backslash: ${skipJsonText(run(97, 33, [toU8(92)]), 0, 34)}`)
  console.log(`text control: ${skipJsonText(run(97, 17, [toU8(31)]), 0, 18)}`)
  console.log(`text del: ${skipJsonText(run(127, 20, [toU8(34)]), 0, 21)}`)
  // Well-formed UTF-8 of two, three and four bytes is text; the run ends at the quote.
  const utf8: u8[] = run(97, 20, [
    toU8(0xc3), toU8(0xa9),
    toU8(0xe2), toU8(0x82), toU8(0xac),
    toU8(0xf0), toU8(0x9f), toU8(0x98), toU8(0x80),
    toU8(98), toU8(34),
  ])
  console.log(`text utf8: ${skipJsonText(utf8, 0, toI32(utf8.length))}`)
  // Malformed sequences stop on their lead byte: overlong, surrogate, past U+10FFFF,
  // a stray continuation, and a sequence cut short by `to`.
  const overlong: u8[] = run(97, 18, [toU8(0xc0), toU8(0x80), toU8(34)])
  const surrogate: u8[] = run(97, 18, [toU8(0xed), toU8(0xa0), toU8(0x80), toU8(34)])
  const tooHigh: u8[] = run(97, 18, [toU8(0xf4), toU8(0x90), toU8(0x80), toU8(0x80), toU8(34)])
  const stray: u8[] = run(97, 18, [toU8(0x80), toU8(34)])
  const cut: u8[] = run(97, 18, [toU8(0xe2), toU8(0x82), toU8(0xac)])
  console.log(
    `text malformed: ${skipJsonText(overlong, 0, 21)} ${skipJsonText(surrogate, 0, 22)} ${skipJsonText(tooHigh, 0, 23)} ${skipJsonText(stray, 0, 20)} ${skipJsonText(cut, 0, 20)} ${skipJsonText(cut, 0, 21)}`
  )

  // copyBytes: a window into another array, then both overlaps within one.
  const src: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]
  const dst: u8[] = [toU8(0), toU8(0), toU8(0), toU8(0)]
  copyBytes(dst, 1, src, 4, 3)
  console.log(`copy window: ${spaced(dst)}`)
  const up: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]
  copyBytes(up, 2, up, 0, 6)
  console.log(`copy up: ${spaced(up)}`)
  const down: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]
  copyBytes(down, 0, down, 2, 6)
  console.log(`copy down: ${spaced(down)}`)
  copyBytes(down, 8, src, 8, 0)
  console.log(`copy none: ${spaced(down)}`)
  return 0
}

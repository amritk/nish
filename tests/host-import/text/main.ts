// WP50 stage 4: strings between a wasm module and its page. A host import takes
// a string as its UTF-8 bytes, lent for the call; an export answers one, which
// the loader decodes before the call's arena mark is released; and
// `nish/host/text` reads and writes text in module storage.
import { measure, say } from "./host"
import { textRead, textWrite, textWriteF64, textWriteInt } from "nish/host/text"

export const INBOX = new Array<u8>(32)
export const OUTBOX = new Array<u8>(16)

export const speak = (n: i32, x: f64): i32 => {
  say("plain ascii")
  say("hello, " + `${n}` + "!")
  say(`n=${n} x=${x}`)
  say("clef \u{1D11E} é")
  say("")
  return measure("é\u{1D11E}", n)
}

export const label = (n: i32): string => `#${n} é\u{1D11E}`

export const fixed = (): string => "constant"

export const nothing = (): string => ""

export const takes = (s: string): i32 => toI32(s.length)

export const compose = (n: i32, x: f64): i32 => {
  let at: i32 = textWrite(OUTBOX, 0, "n=")
  at = textWriteInt(OUTBOX, at, toI64(n))
  at = textWrite(OUTBOX, at, " x=")
  return textWriteF64(OUTBOX, at, x)
}

export const echo = (n: i32): i32 => {
  const text = textRead(INBOX, n)
  if (text === null) {
    return -1
  }
  return textWrite(OUTBOX, 0, text)
}

export const readBack = (n: i32): string => {
  const text = textRead(INBOX, n)
  return text === null ? "refused" : `[${text}]`
}

// A leading U+FEFF is text, not a byte-order mark: the loader keeps it both ways.
export const bom = (): string => {
  say("\u{FEFF}A")
  return "\u{FEFF}A"
}

// A -1 offset passes through every writer; the end of the buffer takes only
// the empty text, and past it nothing.
export const chained = (): string =>
  `${textWrite(OUTBOX, -1, "a")} ${textWriteInt(OUTBOX, -1, toI64(1))} ${textWriteF64(OUTBOX, -1, 1.5)} ${textWrite(OUTBOX, 16, "")} ${textWrite(OUTBOX, 16, "a")} ${textWrite(OUTBOX, 17, "")}`

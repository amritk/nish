// The cache half of the strings.mjs pins (tests/run.js, emit-ts section):
//
//   node --import tests/emit-ts/encodes/count.mjs tests/emit-ts/encodes/cache.mjs [strings.mjs]
//
// Each case below states one thing `bytesOf`'s cache and the helpers over it
// must keep: ASCII strings are read through their units and never encoded,
// the `""` every slot starts as answers as the empty string, a ninth string
// evicts the oldest without changing any answer, a lone surrogate counts as
// the three bytes of U+FFFD, and a NaN substring index cuts nothing on either
// path. Prints one line per case that fails and exits 1 when any does, 0
// otherwise. A case that would panic is not run: a panic exits the process.
import path from "node:path"
import { pathToFileURL } from "node:url"

import { encodes } from "./count.mjs"

const file = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "..", "..", "runtime", "core", "strings.mjs"))
const { charCodeAt, strLen, substring } = await import(pathToFileURL(file).href)

const failed = []
/** Record `name` as failed unless `ok`, with what was seen. */
const expect = (name, ok, seen) => {
  if (!ok) failed.push(`${name}: ${seen}`)
}

// The empty string is what every slot holds before the first read, so it is
// looked up, not encoded, and its length is 0.
{
  const before = encodes()
  expect('"" before any other string has length 0', strLen("") === 0, strLen(""))
  expect('"" is not encoded', encodes() === before, encodes() - before)
}

// ASCII: units are bytes, nothing is encoded however often it is read.
{
  const ascii = "key: value # comment\n".repeat(50)
  const before = encodes()
  let sum = 0
  for (let i = 0; i < strLen(ascii); i++) sum += charCodeAt(ascii, i)
  let want = 0
  for (let i = 0; i < ascii.length; i++) want += ascii.charCodeAt(i)
  expect("an ASCII string's bytes are its units", sum === want, `${sum} against ${want}`)
  expect("an ASCII string's length is its units", strLen(ascii) === ascii.length, strLen(ascii))
  expect("an ASCII substring cuts by units", substring(ascii, 5, 10) === "value", substring(ascii, 5, 10))
  expect("an ASCII substring swaps a reversed range", substring(ascii, 10, 5) === "value", substring(ascii, 10, 5))
  expect("an ASCII string is never encoded", encodes() === before, encodes() - before)
}

// A NaN index cuts nothing, on the ASCII path and the encoded one alike.
{
  expect("an ASCII substring from NaN is empty", substring("abc", NaN) === "", JSON.stringify(substring("abc", NaN)))
  expect("an ASCII substring to NaN is empty", substring("abc", 1, NaN) === "", JSON.stringify(substring("abc", 1, NaN)))
  expect("a UTF-8 substring from NaN is empty", substring("äbc", NaN) === "", JSON.stringify(substring("äbc", NaN)))
  expect("a UTF-8 substring to NaN is empty", substring("äbc", 1, NaN) === "", JSON.stringify(substring("äbc", 1, NaN)))
}

// Eviction: nine strings not ASCII, read in turn, overflow the eight slots.
// The answers stay right, and the ninth read of a round re-encodes.
{
  const words = Array.from({ length: 9 }, (_, k) => `wörd ${k}`)
  const before = encodes()
  for (const w of words) strLen(w)
  expect("nine new strings are encoded once each", encodes() - before === 9, encodes() - before)
  const again = encodes()
  strLen(words[0])
  expect("the oldest of nine is evicted and encoded again", encodes() - again === 1, encodes() - again)
  const kept = encodes()
  strLen(words[8])
  strLen(words[0])
  expect("a string read since stays cached", encodes() === kept, encodes() - kept)
  for (const [k, w] of words.entries()) {
    const bytes = new TextEncoder().encode(w)
    expect(`word ${k} keeps its length past eviction`, strLen(w) === bytes.length, strLen(w))
    expect(`word ${k} keeps its bytes past eviction`, charCodeAt(w, 1) === bytes[1], charCodeAt(w, 1))
  }
}

// A lone surrogate is not ASCII and encodes to U+FFFD's three bytes.
{
  for (const lone of ["\ud800", "\udc00"]) {
    const name = `lone ${lone.charCodeAt(0).toString(16)}`
    expect(`${name} is three bytes`, strLen(lone) === 3, strLen(lone))
    const got = [0, 1, 2].map((i) => charCodeAt(lone, i))
    expect(`${name} reads as U+FFFD`, got.join() === "239,191,189", got.join())
  }
  const mixed = `a\ud800b`
  expect("a lone surrogate between ASCII is five bytes", strLen(mixed) === 5, strLen(mixed))
  expect("the byte after a lone surrogate is the next unit", charCodeAt(mixed, 4) === 98, charCodeAt(mixed, 4))
}

for (const line of failed) console.log(line)
process.exit(failed.length === 0 ? 0 : 1)

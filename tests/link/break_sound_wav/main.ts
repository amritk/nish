// The WAV bytes of every sound of the brick breaker (`src/break-sound.ts`),
// pinned by hash: the synthesis behind them moved to `nish/synth`, and each
// file must stay byte for byte what it was. One line per sound id: its length
// in bytes and the 32-bit FNV-1a of those bytes. The negative is an id past
// the last, which must answer the top break pitch's bytes and never panic.
import { SOUND_BREAK, SOUND_COUNT } from "../../../src/break-game"
import { soundSamples, wavBytes } from "../../../src/break-sound"

/** The 32-bit FNV-1a hash of `b`, as eight hex digits. */
const fnv = (b: u8[]): string => {
  let h: i32 = -2128831035
  for (const x of b) {
    h = h ^ toI32(x)
    h = Math.imul(h, 16777619)
  }
  let s: string = ""
  for (let i: i32 = 7; i >= 0; i--) {
    s = s + String.fromCharCode("0123456789abcdef".charCodeAt((h >> (i * 4)) & 15))
  }
  return s
}

export const main = (): number => {
  for (let id: i32 = 0; id < SOUND_COUNT; id++) {
    const b: u8[] = wavBytes(soundSamples(id))
    console.log(`${id} ${b.length} ${fnv(b)}`)
  }
  const past: u8[] = wavBytes(soundSamples(SOUND_COUNT + 40))
  const top: u8[] = wavBytes(soundSamples(SOUND_BREAK + 5))
  console.log(`past the last: ${fnv(past) === fnv(top) ? "the top break pitch" : "something else"}`)
  return 0
}

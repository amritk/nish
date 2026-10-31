// The sounds of `nish break` (`src/break-sound.ts`): every sound synthesized
// short, audible and inside -1..1, the WAV file around it, and the rationing
// that keeps a busy step from starting a player per brick. The player here is
// `true`, which ignores its file, so the test plays nothing aloud. The
// negatives are ids out of range, which must play nothing and never panic,
// and a sound player that was never found.
import { Suite } from "../../../std/testing"
import { SOUND_BREAK, SOUND_CLEAR, SOUND_COUNT, SOUND_EXPLODE, SOUND_PADDLE, SOUND_WALL } from "../../../src/break-game"
import { BreakSound, closeSound, playSound, soundPlayer, soundReady, soundSamples, wavBytes } from "../../../src/break-sound"

/** The little-endian value of `bytes` bytes of `b` from `at`. */
const little = (b: u8[], at: i32, bytes: i32): i32 => {
  let v: i32 = 0
  for (let i: i32 = bytes - 1; i >= 0; i--) {
    v = (v << 8) | toI32(b[at + i])
  }
  return v
}

/** The four bytes of `b` from `at` as text. */
const tag = (b: u8[], at: i32): string => {
  let s: string = ""
  for (let i: i32 = 0; i < 4; i++) {
    s = s + String.fromCharCode(toI32(b[at + i]))
  }
  return s
}

/** A milliseconds count as monotonic nanoseconds. */
const ms = (n: i32): i64 => toI64(n) * toI64(1000000)

const testSamples = (t: Suite): void => {
  let longest: i32 = 0
  let quietest: f64 = 1.0
  let loudest: f64 = 0.0
  for (let id: i32 = 0; id < SOUND_COUNT; id++) {
    const samples: f64[] = soundSamples(id)
    longest = Math.max(longest, toI32(samples.length))
    let peak: f64 = 0.0
    for (const x of samples) {
      peak = Math.max(peak, Math.abs(x))
    }
    quietest = Math.min(quietest, peak)
    loudest = Math.max(loudest, peak)
  }
  t.ok("every sound is under a second", longest > 0 && longest < 22050)
  t.ok("every sound is heard", quietest > 0.05)
  t.ok("no sound clips", loudest <= 1.0)
  t.eqI32("a paddle knock is 70 ms", toI32(soundSamples(SOUND_PADDLE).length), 1543)
  t.ok("an id past the last is the top break pitch", soundSamples(99).length === soundSamples(SOUND_BREAK + 5).length)
  t.ok("a negative id still answers samples", soundSamples(-1).length > 0)
}

const testWav = (t: Suite): void => {
  const samples: f64[] = [0.0, 1.0, -1.0, 2.0, -0.5]
  const b: u8[] = wavBytes(samples)
  t.eqI32("a header of 44 bytes and two a sample", toI32(b.length), 44 + 10)
  t.eqStr("RIFF", tag(b, 0), "RIFF")
  t.eqI32("the RIFF size is the file less 8", little(b, 4, 4), toI32(b.length) - 8)
  t.eqStr("WAVE", tag(b, 8), "WAVE")
  t.eqStr("fmt", tag(b, 12), "fmt ")
  t.eqI32("PCM", little(b, 20, 2), 1)
  t.eqI32("one channel", little(b, 22, 2), 1)
  t.eqI32("22050 Hz", little(b, 24, 4), 22050)
  t.eqI32("bytes a second", little(b, 28, 4), 44100)
  t.eqI32("16 bits", little(b, 34, 2), 16)
  t.eqStr("data", tag(b, 36), "data")
  t.eqI32("the data size", little(b, 40, 4), 10)
  t.eqI32("silence is 0", little(b, 44, 2), 0)
  t.eqI32("1.0 is the top", little(b, 46, 2), 32767)
  t.eqI32("-1.0 is the bottom but one", little(b, 48, 2), 0x8001)
  t.eqI32("past 1.0 clips to the top", little(b, 50, 2), 32767)
  t.eqI32("-0.5 rounds half up, as Math.round does", little(b, 52, 2), 0x10000 - 16383)
  t.eqI32("no samples is a header alone", toI32(wavBytes([]).length), 44)
}

const testRationing = (t: Suite): void => {
  const none = new BreakSound()
  t.eqBool("no player, no sound", soundReady(none), false)
  t.eqStr("and no player's name", soundPlayer(none), "")
  playSound(none, SOUND_WALL, ms(1000))
  t.ok("playing without a player starts nothing", none.lastAny === toI64(0))
  closeSound(none)
  t.eqStr("closing with nothing written is a no-op", none.dir, "")

  const s = new BreakSound()
  s.player = ["true"]
  s.dir = "/nonexistent"
  t.eqBool("a player and a directory are ready", soundReady(s), true)
  t.eqStr("the player's name", soundPlayer(s), "true")
  playSound(s, SOUND_WALL, ms(1000))
  t.ok("a sound starts", s.lastStart[SOUND_WALL] === ms(1000))
  playSound(s, SOUND_WALL, ms(1040))
  t.ok("the same sound 40 ms later waits", s.lastStart[SOUND_WALL] === ms(1000))
  playSound(s, SOUND_WALL, ms(1070))
  t.ok("70 ms later it starts again", s.lastStart[SOUND_WALL] === ms(1070))
  playSound(s, SOUND_PADDLE, ms(1075))
  t.ok("a minor sound 5 ms after another waits", s.lastStart[SOUND_PADDLE] === toI64(0))
  playSound(s, SOUND_EXPLODE, ms(1076))
  t.ok("a major sound does not", s.lastStart[SOUND_EXPLODE] === ms(1076))
  playSound(s, SOUND_PADDLE, ms(1100))
  t.ok("a minor sound 24 ms after the last starts", s.lastStart[SOUND_PADDLE] === ms(1100))
  playSound(s, -1, ms(2000))
  playSound(s, SOUND_COUNT, ms(2000))
  t.ok("ids out of range start nothing", s.lastAny === ms(1100))
  playSound(s, SOUND_CLEAR, ms(2000))
  t.ok("the clear starts", s.lastAny === ms(2000))
}

export const main = (): i32 => {
  const t = new Suite("break-sound")
  testSamples(t)
  testWav(t)
  testRationing(t)
  return t.done()
}

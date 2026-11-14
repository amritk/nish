// `nish/synth`: silence's length, each voice's shape and loudness, voices
// adding into what is there, a voice stopping at the end of the array, the
// refusals (a rate, start, length or pitch that is not positive, or too long
// to count) adding nothing, noise following its generator level for level and repeating call for call,
// and semitones.
import { SYNTH_NOISE, SYNTH_SQUARE, SYNTH_TRIANGLE, synthSemitone, synthSilence, synthTone } from "nish/synth"
import { Suite } from "nish/testing"

const ZERO: f64 = 0.0
const HALF: f64 = 0.5
const ONE: f64 = 1.0
const RATE: i32 = 1000

/** The largest magnitude in `a`. */
const peak = (a: f64[]): f64 => {
  let m: f64 = 0.0
  for (const x of a) {
    m = Math.max(m, Math.abs(x))
  }
  return m
}

/** How many samples of `a` are not zero. */
const sounding = (a: f64[]): i32 => {
  let n: i32 = 0
  for (const x of a) {
    if (x !== 0.0) {
      n++
    }
  }
  return n
}

/** Whether two sample arrays are equal sample for sample. */
const same = (a: f64[], b: f64[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/** The noise voice's levels worked out apart from the module: xorshift from its seed, one level a period. */
const noiseLevel = (k: i32): f64 => {
  let x: i32 = 22695477
  for (let i: i32 = 0; i <= k; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >> 17)
    x = x ^ (x << 5)
  }
  return toF64(x & 65535) / 32767.5 - 1.0
}

export const main = (): number => {
  const t = new Suite("synth")

  t.eqI32("silence: seconds × rate samples", toI32(synthSilence(HALF, RATE).length), 500)
  t.eqI32("silence: zero seconds is one sample", toI32(synthSilence(ZERO, RATE).length), 1)
  t.eqI32("silence: NaN is one sample", toI32(synthSilence(ZERO / ZERO, RATE).length), 1)
  t.eqI32("silence: too long to count is one sample", toI32(synthSilence(ONE * 1e12, RATE).length), 1)
  t.eqI32("silence: all zero", sounding(synthSilence(HALF, RATE)), 0)

  const sq: f64[] = synthSilence(ONE, RATE)
  synthTone(sq, RATE, ZERO, ONE, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  t.ok("square: inside the volume", peak(sq) <= HALF)
  t.eqF64("square: full volume after the attack, first half up", sq[10], HALF)
  t.eqF64("square: second half of the period down", sq[60], -HALF)

  const tri: f64[] = synthSilence(ONE, RATE)
  synthTone(tri, RATE, ZERO, ONE, ONE * 10.0, ONE * 10.0, SYNTH_TRIANGLE, ONE, ZERO)
  t.ok("triangle: inside the volume", peak(tri) <= ONE)
  t.ok("triangle: rises through its first quarter", tri[10] < tri[20])
  t.ok("triangle: falls through its third", tri[60] < tri[50])

  const decayed: f64[] = synthSilence(ONE, RATE)
  synthTone(decayed, RATE, ZERO, ONE, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, ONE, ONE * 4.0)
  t.ok("decay: later is quieter", Math.abs(decayed[900]) < Math.abs(decayed[10]) * HALF)

  const mixed: f64[] = synthSilence(ONE, RATE)
  synthTone(mixed, RATE, ZERO, ONE, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(mixed, RATE, ZERO, ONE, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  t.eqF64("add: a second voice adds into the first", mixed[10], ONE)

  const late: f64[] = synthSilence(HALF, RATE)
  synthTone(late, RATE, ONE * 0.4, ONE, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  t.eqI32("end: the array does not grow", toI32(late.length), 500)
  t.eqF64("end: nothing before the start", late[399], ZERO)
  t.ok("end: sound from the start", late[410] !== 0.0)

  const quiet: f64[] = synthSilence(HALF, RATE)
  synthTone(quiet, 0, ZERO, HALF, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, -HALF, HALF, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, ZERO, ZERO, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, ZERO, HALF, ZERO, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, ZERO, HALF, ONE * 10.0, -ONE, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, ZERO, ZERO / ZERO, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  synthTone(quiet, RATE, ZERO, ONE * 1e12, ONE * 10.0, ONE * 10.0, SYNTH_SQUARE, HALF, ZERO)
  t.eqI32("refused: no rate, a negative start, no length, no pitch, NaN, too long", sounding(quiet), 0)

  const a: f64[] = synthSilence(HALF, RATE)
  const b: f64[] = synthSilence(HALF, RATE)
  synthTone(a, RATE, ZERO, HALF, ONE * 200.0, ONE * 20.0, SYNTH_NOISE, HALF, ONE * 2.0)
  synthTone(b, RATE, ZERO, HALF, ONE * 200.0, ONE * 20.0, SYNTH_NOISE, HALF, ONE * 2.0)
  t.ok("noise: sounds", sounding(a) > 400)
  t.ok("noise: inside the volume", peak(a) <= HALF)
  t.ok("noise: the same call, the same samples", same(a, b))
  const levels: f64[] = synthSilence(HALF, RATE)
  synthTone(levels, RATE, ZERO, HALF, ONE * 100.0, ONE * 100.0, SYNTH_NOISE, ONE, ZERO)
  for (let k: i32 = 0; k < 5; k++) {
    t.eqF64(`noise: period ${k} holds the generator's level ${k}`, levels[10 * k + 5], noiseLevel(k))
  }
  t.ok("noise: the levels differ", levels[5] !== levels[15] && levels[15] !== levels[25])
  const other: f64[] = synthSilence(HALF, RATE)
  synthTone(other, RATE, ZERO, HALF, ONE * 200.0, ONE * 20.0, 7, HALF, ONE * 2.0)
  t.ok("noise: an unknown wave is noise", same(a, other))

  t.eqF64("semitone: an octave doubles", synthSemitone(ONE * 440.0, 12), ONE * 880.0)
  t.eqF64("semitone: none is the base", synthSemitone(ONE * 440.0, 0), ONE * 440.0)
  t.ok("semitone: a fifth", Math.abs(synthSemitone(ONE * 440.0, 7) - ONE * 659.2551) < ONE * 0.001)
  t.eqF64("semitone: down an octave halves", synthSemitone(ONE * 440.0, -12), ONE * 220.0)
  return t.done()
}

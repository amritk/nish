/**
 * `nish/synth` — short sounds made from nothing: square, triangle and noise
 * voices with a pitch slide and a decaying envelope, mixed into an array of
 * `f64` samples. Nothing is sampled or copied; a sound is arithmetic.
 *
 * A sound starts as silence of its length and gains voices one at a time,
 * each added into the samples already there:
 *
 *     import { SYNTH_SQUARE, SYNTH_TRIANGLE, synthSemitone, synthSilence, synthTone } from "nish/synth";
 *
 *     const RATE: i32 = 22050;
 *     const out: f64[] = synthSilence(0.2, RATE);
 *     synthTone(out, RATE, 0.0, 0.2, 440.0, 220.0, SYNTH_SQUARE, 0.25, 8.0);
 *     synthTone(out, RATE, 0.05, 0.1, synthSemitone(440.0, 7), synthSemitone(440.0, 7), SYNTH_TRIANGLE, 0.2, 12.0);
 *
 * The samples are not clipped: a voice stays inside `-volume..volume`, so
 * voices whose volumes sum to at most 1 stay inside `-1..1`, and what plays
 * them (a WAV writer, a page's audio buffer) clips the rest. The sample rate
 * is the caller's, passed to every function, so one program can make sounds
 * for a 22050 Hz file and a 48000 Hz page alike.
 *
 * Pure: no capability, no I/O and no clock. The noise voice is a fixed
 * xorshift sequence, so the same call gives the same samples every time.
 */

/** A square wave: +1 for the first half of each period, -1 for the second. */
export const SYNTH_SQUARE: i32 = 0

/** A triangle wave: a straight rise from -1 to +1 and a straight fall back. */
export const SYNTH_TRIANGLE: i32 = 1

/** Noise: a fresh random level each period of the pitch, so a falling pitch rumbles. */
export const SYNTH_NOISE: i32 = 2

/** The noise voice's starting state. */
const SYNTH_NOISE_SEED: i32 = 22695477

/** A position or length in samples past this is refused rather than converted. */
const SYNTH_SAMPLE_LIMIT: f64 = 2147483647.0

/**
 * `seconds` of silence: an array of zero samples, one at least.
 *
 * @param seconds - how long; zero, negative or NaN is one sample
 * @param sampleRate - samples a second
 * @returns `seconds × sampleRate` samples of 0.0, at least one
 */
export const synthSilence = (seconds: f64, sampleRate: i32): f64[] => {
  const want: f64 = seconds * toF64(sampleRate)
  const n: i32 = want >= 1.0 && want < SYNTH_SAMPLE_LIMIT ? toI32(want) : 1
  const out: f64[] = new Array<f64>(n)
  out.fill(0.0)
  return out
}

/** The next value of the noise voice's xorshift generator. */
const synthXorshift = (x: i32): i32 => {
  let y: i32 = x ^ (x << 13)
  y = y ^ (y >> 17)
  return y ^ (y << 5)
}

/**
 * Add a voice into `out` from `start` seconds for `length` seconds. Its pitch
 * slides from `f0` to `f1` Hz on a log scale, and its loudness starts at
 * `volume` and falls by a factor of e every `1 / decay` seconds. A 2 ms attack
 * and a 5 ms release keep the ends from clicking. The voice stops at the end
 * of `out`; it never grows the array.
 *
 * Nothing is added for a sample rate, start or length that is not positive
 * (a start of 0 is fine), for a frequency that is not positive, or for a
 * start or length too long to count in samples.
 *
 * @param out - the samples to add into
 * @param sampleRate - samples a second that `out` is at
 * @param start - where the voice begins, in seconds from the first sample
 * @param length - how long the voice lasts, in seconds
 * @param f0 - the starting pitch in Hz
 * @param f1 - the ending pitch in Hz
 * @param wave - `SYNTH_SQUARE`, `SYNTH_TRIANGLE` or `SYNTH_NOISE`; any other value is noise
 * @param volume - the starting peak level; a negative level inverts the wave
 * @param decay - how fast the level falls, per second; 0 holds it
 */
export const synthTone = (
  out: f64[],
  sampleRate: i32,
  start: f64,
  length: f64,
  f0: f64,
  f1: f64,
  wave: i32,
  volume: f64,
  decay: f64
): void => {
  const rate: f64 = toF64(sampleRate)
  if (!(rate > 0.0 && start >= 0.0 && length > 0.0 && f0 > 0.0 && f1 > 0.0)) {
    return
  }
  if (!(start * rate < SYNTH_SAMPLE_LIMIT && length * rate < SYNTH_SAMPLE_LIMIT)) {
    return
  }
  const from: i32 = toI32(start * rate)
  const n: i32 = toI32(length * rate)
  const ratio: f64 = Math.log(f1 / f0)
  let phase: f64 = 0.0
  let noise: i32 = SYNTH_NOISE_SEED
  let held: f64 = 0.0
  for (let i: i32 = 0; i < n && from + i < toI32(out.length); i++) {
    const t: f64 = toF64(i) / rate
    const f: f64 = f0 * Math.exp((ratio * toF64(i)) / toF64(n))
    const before: f64 = phase
    phase = phase + f / rate
    if (phase >= 1.0) {
      phase = phase - Math.floor(phase)
    }
    let v: f64 = 0.0
    if (wave === SYNTH_SQUARE) {
      v = phase < 0.5 ? 1.0 : -1.0
    } else if (wave === SYNTH_TRIANGLE) {
      const rise: f64 = 4.0 * phase
      v = phase < 0.5 ? rise - 1.0 : 3.0 - rise
    } else {
      if (phase < before || i === 0) {
        noise = synthXorshift(noise)
        held = toF64(noise & 65535) / 32767.5 - 1.0
      }
      v = held
    }
    const attack: f64 = Math.min(t / 0.002, 1.0)
    const release: f64 = Math.min((length - t) / 0.005, 1.0)
    out[from + i] = out[from + i] + v * volume * attack * release * Math.exp(-t * decay)
  }
}

/**
 * The frequency `semitones` equal-tempered steps above `base`.
 *
 * @param base - the starting frequency in Hz
 * @param semitones - how many steps up; negative steps go down
 * @returns `base × 2^(semitones / 12)`
 */
export const synthSemitone = (base: f64, semitones: i32): f64 =>
  base * Math.exp((toF64(semitones) * Math.log(2.0)) / 12.0)

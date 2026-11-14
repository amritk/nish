// The voices of `nish break`: each sound's samples, synthesized with
// `nish/synth` (square, triangle and noise voices with a pitch sweep and a
// decaying envelope; nothing is sampled or copied). Nothing here reaches the
// OS, so the native game (break-sound.ts writes these as WAV files) and the
// docs site's wasm build (examples/break-web) share it.

import {
  BREAK_PITCHES,
  SOUND_ADVANCE,
  SOUND_BREAK,
  SOUND_CAPSULE,
  SOUND_CLEAR,
  SOUND_CRACK,
  SOUND_EXPLODE,
  SOUND_FIREWORK,
  SOUND_LAUNCH,
  SOUND_LOSE,
  SOUND_OVER,
  SOUND_PADDLE,
  SOUND_STEEL,
  SOUND_WALL,
} from "./break-game"
import {
  SYNTH_NOISE,
  SYNTH_SQUARE,
  SYNTH_TRIANGLE,
  synthSemitone,
  synthSilence,
  synthTone,
} from "../std/synth"

/** The sample rate every sound is made at: plenty for square waves under 3 kHz. */
export const SAMPLE_RATE: i32 = 22050

/** The sound played when sound is turned on, so the player is heard to work. */
export const SOUND_HELLO: i32 = SOUND_CAPSULE

// ---- Synthesis --------------------------------------------------------------
//
// The voices are `nish/synth`'s; the scale, the arpeggios and the choice of
// voices for each sound are the game's.

/** The steps of a major pentatonic scale, for the breaking bricks' climb. */
const pentatonic = (step: i32): i32 => {
  if (step <= 0) {
    return 0
  }
  if (step === 1) {
    return 2
  }
  if (step === 2) {
    return 4
  }
  if (step === 3) {
    return 7
  }
  return step === 4 ? 9 : 12
}

/** Notes one after another, each `each` seconds, starting at `base` and stepping by the given semitones. */
const arpeggio = (
  out: f64[],
  base: f64,
  a: i32,
  b: i32,
  c: i32,
  d: i32,
  each: f64,
  last: f64,
  wave: i32,
  volume: f64
): void => {
  synthTone(out, SAMPLE_RATE, 0.0, each, synthSemitone(base, a), synthSemitone(base, a), wave, volume, 6.0)
  synthTone(out, SAMPLE_RATE, each, each, synthSemitone(base, b), synthSemitone(base, b), wave, volume, 6.0)
  synthTone(
    out,
    SAMPLE_RATE,
    each * 2.0,
    each,
    synthSemitone(base, c),
    synthSemitone(base, c),
    wave,
    volume,
    6.0
  )
  synthTone(
    out,
    SAMPLE_RATE,
    each * 3.0,
    last,
    synthSemitone(base, d),
    synthSemitone(base, d),
    wave,
    volume,
    4.0
  )
}

/** Sound `id`'s samples, each in -1..1 before clipping. */
export const voiceSamples = (id: i32): f64[] => {
  if (id === SOUND_PADDLE) {
    const out: f64[] = synthSilence(0.07, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.07, 392.0, 370.0, SYNTH_SQUARE, 0.3, 30.0)
    return out
  }
  if (id === SOUND_WALL) {
    const out: f64[] = synthSilence(0.045, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.045, 247.0, 233.0, SYNTH_SQUARE, 0.22, 40.0)
    return out
  }
  if (id === SOUND_CRACK) {
    const out: f64[] = synthSilence(0.06, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.06, 660.0, 520.0, SYNTH_SQUARE, 0.25, 35.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.03, 4000.0, 2000.0, SYNTH_NOISE, 0.12, 60.0)
    return out
  }
  if (id === SOUND_STEEL) {
    const out: f64[] = synthSilence(0.22, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.22, 1320.0, 1310.0, SYNTH_TRIANGLE, 0.32, 16.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.22, 1980.0, 1970.0, SYNTH_TRIANGLE, 0.18, 22.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.08, 2640.0, 2640.0, SYNTH_SQUARE, 0.05, 40.0)
    return out
  }
  if (id === SOUND_EXPLODE) {
    const out: f64[] = synthSilence(0.5, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.5, 1800.0, 90.0, SYNTH_NOISE, 0.55, 6.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.25, 110.0, 55.0, SYNTH_TRIANGLE, 0.35, 8.0)
    return out
  }
  if (id === SOUND_CAPSULE) {
    const out: f64[] = synthSilence(0.24, SAMPLE_RATE)
    arpeggio(out, 523.25, 0, 4, 7, 12, 0.045, 0.1, SYNTH_SQUARE, 0.2)
    return out
  }
  if (id === SOUND_LAUNCH) {
    const out: f64[] = synthSilence(0.08, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.08, 262.0, 523.0, SYNTH_SQUARE, 0.2, 18.0)
    return out
  }
  if (id === SOUND_LOSE) {
    const out: f64[] = synthSilence(0.65, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.65, 440.0, 98.0, SYNTH_SQUARE, 0.25, 2.5)
    synthTone(out, SAMPLE_RATE, 0.0, 0.65, 220.0, 49.0, SYNTH_TRIANGLE, 0.3, 2.5)
    return out
  }
  if (id === SOUND_ADVANCE) {
    const out: f64[] = synthSilence(0.3, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.3, 98.0, 62.0, SYNTH_TRIANGLE, 0.45, 7.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.15, 400.0, 150.0, SYNTH_NOISE, 0.18, 14.0)
    return out
  }
  if (id === SOUND_CLEAR) {
    const out: f64[] = synthSilence(0.6, SAMPLE_RATE)
    arpeggio(out, 523.25, 0, 4, 7, 12, 0.09, 0.33, SYNTH_SQUARE, 0.2)
    arpeggio(out, 261.63, 0, 4, 7, 12, 0.09, 0.33, SYNTH_TRIANGLE, 0.25)
    return out
  }
  if (id === SOUND_OVER) {
    const out: f64[] = synthSilence(0.95, SAMPLE_RATE)
    arpeggio(out, 196.0, 12, 8, 3, 0, 0.18, 0.4, SYNTH_TRIANGLE, 0.35)
    arpeggio(out, 392.0, 12, 8, 3, 0, 0.18, 0.4, SYNTH_SQUARE, 0.12)
    return out
  }
  if (id === SOUND_FIREWORK) {
    const out: f64[] = synthSilence(0.45, SAMPLE_RATE)
    synthTone(out, SAMPLE_RATE, 0.0, 0.45, 3200.0, 700.0, SYNTH_NOISE, 0.3, 7.0)
    synthTone(out, SAMPLE_RATE, 0.0, 0.12, 900.0, 1500.0, SYNTH_TRIANGLE, 0.12, 12.0)
    return out
  }
  // A breaking brick, a step up the scale for each brick of the combo.
  const step: i32 = Math.min(Math.max(id - SOUND_BREAK, 0), BREAK_PITCHES - 1)
  const f: f64 = synthSemitone(523.25, pentatonic(step))
  const out: f64[] = synthSilence(0.09, SAMPLE_RATE)
  synthTone(out, SAMPLE_RATE, 0.0, 0.09, f, f * 0.94, SYNTH_SQUARE, 0.24, 26.0)
  synthTone(out, SAMPLE_RATE, 0.0, 0.04, f * 2.0, f * 2.0, SYNTH_TRIANGLE, 0.12, 40.0)
  return out
}

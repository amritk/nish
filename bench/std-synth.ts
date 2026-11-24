// The sound synthesiser (std/synth.ts) and the host modules a browser game
// hands its output through (std/host/game.ts, std/host/ring.ts and
// std/host/text.ts) under an instruction count. Each round builds
// examples/game-starter's three sounds as it does: a buffer from
// `synthSilence`, a square, a triangle and a noise tone from `synthTone`, the
// buffer handed to the page by `gameWriteSamples`; then queues sound ids
// through `gamePlaySound` and drains `GAME_SOUNDS` with `ringShift`, and
// writes and reads back a line of text with `textWrite`, `textWriteInt` and
// `textRead`. A fix to a panic site the std/ ratchet counts in those functions
// shows here as a count that holds or falls. It prints a checksum of the
// samples, ids and text.
import { GAME_SAMPLES, GAME_SOUNDS, gamePlaySound, gameWriteSamples } from "nish/host/game"
import { ringShift, ringSize } from "nish/host/ring"
import { textRead, textWrite, textWriteInt } from "nish/host/text"
import { SYNTH_NOISE, SYNTH_SQUARE, SYNTH_TRIANGLE, synthSemitone, synthSilence, synthTone } from "nish/synth"

/** game-starter's sample rate. */
const RATE: i32 = 22050

/** One of the three sounds, its pitch moved by `shift` semitones, written to the page. */
const sound = (id: i32, shift: i32): i32 => {
  const out = synthSilence(0.25, RATE)
  if (id === 0) {
    synthTone(out, RATE, 0.0, 0.08, synthSemitone(660.0, shift), 880.0, SYNTH_SQUARE, 0.25, 30.0)
  } else if (id === 1) {
    synthTone(out, RATE, 0.0, 0.05, synthSemitone(440.0, shift), 440.0, SYNTH_TRIANGLE, 0.3, 40.0)
  } else {
    synthTone(out, RATE, 0.0, 0.25, 300.0, synthSemitone(80.0, shift), SYNTH_NOISE, 0.3, 8.0)
  }
  // A second tone over the first, starting part-way and running past the end.
  synthTone(out, RATE, 0.2, 0.1, 220.0, 110.0, SYNTH_TRIANGLE, 0.2, 10.0)
  return gameWriteSamples(out, RATE)
}

export const main = (): i32 => {
  const n: i32 = 60 // bench:n
  const buf = new Array<u8>(64)
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let id: i32 = 0; id < 3; id++) {
      const count: i32 = sound(id, round % 12)
      sum += toI64(count)
      for (let i: i32 = 0; i < count && i < toI32(GAME_SAMPLES.length); i += 97) {
        sum += toI64(toI32(toF64(GAME_SAMPLES[i]) * 1000.0))
      }
    }
    for (let k: i32 = 0; k < 40; k++) {
      if (!gamePlaySound((round + k) % 3)) {
        break
      }
    }
    while (ringSize(GAME_SOUNDS) > 0) {
      sum += toI64(ringShift(GAME_SOUNDS))
    }
    const at: i32 = textWriteInt(buf, textWrite(buf, 0, "round "), toI64(round))
    const back: string | null = textRead(buf, at)
    if (back === null) {
      panic("std-synth: the text did not fit")
    }
    sum += toI64(back.length)
  }
  console.log(`${sum}`)
  return 0
}

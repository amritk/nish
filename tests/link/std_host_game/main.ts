// `nish/host/game`, as a page drives it: built for wasm32 with
// `--deterministic` (the `args` file), so nothing reaches a terminal, file or
// clock. The test plays the page's part, pushing input records onto
// `GAME_INPUT` and reading `GAME_SOUNDS`, `GAME_SAMPLES` and `GAME_INFO`. It
// covers a held key and its release, a pointer press in frame pixels, a lost
// focus releasing everything, a record of an unknown kind, a part-record, the
// sound queue filling up, clipped samples, the size limits, and a frame drawn
// through `nish/raster`.
import {
  GAME_EVENT_WORDS,
  GAME_FRAME,
  GAME_INFO,
  GAME_INFO_RATE,
  GAME_INFO_SAMPLES,
  GAME_INPUT,
  GAME_MAX_HEIGHT,
  GAME_MAX_WIDTH,
  GAME_SAMPLE_LIMIT,
  GAME_SAMPLES,
  GAME_SOUND_SLOTS,
  GAME_SOUNDS,
  gameHeight,
  gamePlaySound,
  gameReadInput,
  gameSetSize,
  gameWidth,
  gameWriteSamples,
} from "nish/host/game"
import { ringFree, ringPush, ringShift, ringSize } from "nish/host/ring"
import { StepInput } from "nish/input"
import { RASTER_SOLID, rasterRect } from "nish/raster"
import { Suite } from "nish/testing"
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  EVENT_FOCUS,
  EVENT_KEY,
  EVENT_MOUSE,
  KEY_CHAR,
  KEY_LEFT,
  KeyState,
  MOD_SHIFT,
  MOUSE_LEFT,
} from "nish/term"

/** Push one input record, as a page does. */
const push = (type: i32, what: i32, code: i32, mods: i32, action: i32, x: i32, y: i32): void => {
  ringPush(GAME_INPUT, type)
  ringPush(GAME_INPUT, what)
  ringPush(GAME_INPUT, code)
  ringPush(GAME_INPUT, mods)
  ringPush(GAME_INPUT, action)
  ringPush(GAME_INPUT, x)
  ringPush(GAME_INPUT, y)
}

export const main = (): i32 => {
  const t = new Suite("game")
  const half: f64 = 0.5
  const one: f64 = 1.0
  const quarter: f64 = 0.25
  const zero: f64 = 0.0
  const input = new StepInput(new KeyState())

  t.eqI32("input: a record is seven words", GAME_EVENT_WORDS, 7)
  push(EVENT_KEY, KEY_LEFT, 0, 0, ACTION_PRESS, 0, 0)
  push(EVENT_KEY, KEY_CHAR, 97, MOD_SHIFT, ACTION_PRESS, 0, 0)
  gameReadInput(input, zero)
  t.eqI32("press: two events", toI32(input.events.length), 2)
  t.eqI32("press: the first is the arrow", input.events[0].key, KEY_LEFT)
  t.eqI32("press: the second's code", input.events[1].code, 97)
  t.eqI32("press: the second's modifiers", input.events[1].modifiers, MOD_SHIFT)
  t.eqI32("press: the ring is drained", ringSize(GAME_INPUT), 0)
  t.ok("press: the arrow is held", input.isDown(KEY_LEFT, 0))
  t.ok("press: the letter is held", input.isDown(KEY_CHAR, 97))

  gameReadInput(input, toF64(5000))
  t.eqI32("held: a quiet step has no events", toI32(input.events.length), 0)
  t.ok("held: the arrow stays down, since releases are real", input.isDown(KEY_LEFT, 0))

  push(EVENT_KEY, KEY_LEFT, 0, 0, ACTION_RELEASE, 0, 0)
  gameReadInput(input, toF64(5016))
  t.eqI32("release: one event", toI32(input.events.length), 1)
  t.eqI32("release: its action", input.events[0].action, ACTION_RELEASE)
  t.eqBool("release: the arrow is up", input.isDown(KEY_LEFT, 0), false)
  t.ok("release: the letter is still down", input.isDown(KEY_CHAR, 97))

  push(EVENT_MOUSE, MOUSE_LEFT, 0, 0, ACTION_PRESS, 300, 120)
  gameReadInput(input, toF64(5032))
  t.eqI32("pointer: one event", toI32(input.events.length), 1)
  t.eqI32("pointer: the button", input.events[0].button, MOUSE_LEFT)
  t.eqI32("pointer: x in pixels", input.events[0].px, 300)
  t.eqI32("pointer: y in pixels", input.events[0].py, 120)
  t.eqI32("pointer: x as the cell", input.events[0].x, 300)

  push(EVENT_FOCUS, 0, 0, 0, 0, 0, 0)
  gameReadInput(input, toF64(5048))
  t.ok("blur: the focus event arrives", input.events.length > 0)
  t.eqBool("blur: the letter is let go", input.isDown(KEY_CHAR, 97), false)

  push(99, 1, 2, 3, 4, 5, 6)
  push(EVENT_KEY, KEY_LEFT, 0, 0, ACTION_PRESS, 0, 0)
  ringPush(GAME_INPUT, EVENT_KEY)
  ringPush(GAME_INPUT, KEY_CHAR)
  gameReadInput(input, toF64(5064))
  t.eqI32("unknown: dropped, and the next record still reads", toI32(input.events.length), 1)
  t.eqI32("unknown: the record after it", input.events[0].key, KEY_LEFT)
  t.eqI32("part-record: dropped, leaving the ring empty", ringSize(GAME_INPUT), 0)

  for (let i: i32 = 0; i < GAME_SOUND_SLOTS; i++) {
    t.ok(`sound: queued ${i}`, gamePlaySound(i))
  }
  t.eqBool("sound: a full queue drops the next", gamePlaySound(99), false)
  t.eqI32("sound: no room left", ringFree(GAME_SOUNDS), 0)
  t.eqI32("sound: first in, first out", ringShift(GAME_SOUNDS), 0)
  t.eqI32("sound: then the second", ringShift(GAME_SOUNDS), 1)

  const samples: f64[] = [half, one * 2.0, -one * 3.0, -quarter, zero / zero]
  t.eqI32("samples: all five written", gameWriteSamples(samples, 22050), 5)
  t.eqF64("samples: inside the range kept", toF64(GAME_SAMPLES[0]), half)
  t.eqF64("samples: above clipped to 1", toF64(GAME_SAMPLES[1]), one)
  t.eqF64("samples: below clipped to -1", toF64(GAME_SAMPLES[2]), -one)
  t.eqF64("samples: a negative kept", toF64(GAME_SAMPLES[3]), -quarter)
  t.eqF64("samples: NaN is silence", toF64(GAME_SAMPLES[4]), zero)
  t.eqI32("samples: the count recorded", GAME_INFO[GAME_INFO_SAMPLES], 5)
  t.eqI32("samples: the rate recorded", GAME_INFO[GAME_INFO_RATE], 22050)
  const long: f64[] = new Array<f64>(GAME_SAMPLE_LIMIT + 10)
  long.fill(quarter)
  t.eqI32("samples: cut off at the limit", gameWriteSamples(long, 48000), GAME_SAMPLE_LIMIT)

  gameSetSize(4000, -3)
  t.eqI32("size: the width held to the most", gameWidth(), GAME_MAX_WIDTH)
  t.eqI32("size: the height held to 0", gameHeight(), 0)
  GAME_INFO[1] = 99999
  t.eqI32("size: a word the page wrote still reads in range", gameHeight(), GAME_MAX_HEIGHT)

  gameSetSize(8, 4)
  rasterRect(GAME_FRAME, gameWidth(), gameHeight(), 0, 0, 8, 4, 0x102030, RASTER_SOLID)
  rasterRect(GAME_FRAME, gameWidth(), gameHeight(), 2, 1, 5, 3, 0xff8000, RASTER_SOLID)
  t.eqI32("frame: the background", GAME_FRAME[0], 0x102030)
  t.eqI32("frame: inside the box, a row is the width", GAME_FRAME[1 * 8 + 2], 0xff8000)
  t.eqI32("frame: the box's far corner", GAME_FRAME[2 * 8 + 4], 0xff8000)
  t.eqI32("frame: just past it", GAME_FRAME[2 * 8 + 5], 0x102030)
  t.eqI32("frame: past the size is untouched", GAME_FRAME[8 * 4], 0)
  return t.done()
}

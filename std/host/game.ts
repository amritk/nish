/**
 * `nish/host/game` — the memory a game built for `wasm32` shares with the page
 * that runs it: the frame it draws, the input the page feeds it, the sounds it
 * asks for and the samples the page plays them from. Every piece is module
 * storage, so the page reaches it in place through the loader's
 * `views().storage` (the keys below are the storage's names) and nothing is
 * copied across the boundary in either direction.
 *
 * | Storage | Words | Written by | Holds |
 * | --- | --- | --- | --- |
 * | `GAME_FRAME` | `Int32Array(960 × 540)` | the game | the frame, `0xRRGGBB`, row-major, `width` words a row |
 * | `GAME_INFO` | `Int32Array(4)` | the game | `[width, height, samples, sampleRate]` |
 * | `GAME_INPUT` | `Int32Array(2 + 7 × 64)` | the page | a `nish/host/ring` of input events, 7 words each |
 * | `GAME_SOUNDS` | `Int32Array(2 + 32)` | the game | a `nish/host/ring` of sound ids to start |
 * | `GAME_SAMPLES` | `Float32Array(96000)` | the game | one sound's samples, `-1..1` |
 *
 * **The frame.** The game picks its size with `gameSetSize` (at most
 * `GAME_MAX_WIDTH × GAME_MAX_HEIGHT`) and draws into `GAME_FRAME`, for
 * instance by lending it to `nish/raster` with `gameWidth()` and
 * `gameHeight()`. The page reads `GAME_INFO[0]` and `[1]` and copies the first
 * `width × height` words into its canvas, setting each pixel's alpha to 255
 * as it does. Storage cannot be returned or aliased, so a program names
 * `GAME_FRAME` itself rather than asking a function for it.
 *
 * **Input.** The page pushes one record of `GAME_EVENT_WORDS` words per event
 * onto `GAME_INPUT`, and pushes a record only when the ring has room for all
 * of it. The words are:
 *
 * | Word | Key event | Pointer event | Focus event |
 * | --- | --- | --- | --- |
 * | 0 | `EVENT_KEY` | `EVENT_MOUSE` | `EVENT_FOCUS` |
 * | 1 | the `KEY_` kind | the `MOUSE_` button, `MOUSE_NONE` for a move | 1 gained, 0 lost |
 * | 2 | the code point, for `KEY_CHAR` | 0 | 0 |
 * | 3 | the `MOD_` bits | the `MOD_` bits | 0 |
 * | 4 | `ACTION_PRESS`, `ACTION_REPEAT` or `ACTION_RELEASE` | `ACTION_PRESS`, `ACTION_RELEASE` or `ACTION_MOVE` | 0 |
 * | 5 | 0 | x, in frame pixels | 0 |
 * | 6 | 0 | y, in frame pixels | 0 |
 *
 * The constants are `nish/term`'s, so a step reads the page's keys exactly as
 * it reads a terminal's. Each step the game calls `gameReadInput`, which
 * drains the ring into a `nish/input` `StepInput`: its `events` become this
 * step's events and its `keys` (a `KeyState`) keep which keys are held, for
 * `isDown`. A page sees every key go up, so it sends a release for every press
 * (`keyup`) and a lost focus on `blur`, which releases every held key; the
 * reader turns `KeyState`'s synthetic releases off. A pointer event's x and y
 * are set as both the event's cell (`x`, `y`) and its pixel (`px`, `py`).
 * A record with an unknown kind is dropped, and so is a trailing part-record
 * a page pushed out of protocol.
 *
 * **Sound.** The game names its sounds by small ids and asks for one with
 * `gamePlaySound`, which queues the id on `GAME_SOUNDS`; the page shifts the
 * ring after each step and starts each id's buffer. To build those buffers,
 * the page calls an export of the game's once per id at start, which
 * synthesizes the sound (with `nish/synth`, say) and hands it to
 * `gameWriteSamples`; the page then reads `GAME_INFO[2]` samples of
 * `GAME_SAMPLES` at `GAME_INFO[3]` Hz into an `AudioBuffer`.
 *
 *     import { GAME_FRAME, gameHeight, gamePlaySound, gameReadInput, gameSetSize, gameWidth, gameWriteSamples } from "nish/host/game";
 *     import { KeyState } from "nish/term";
 *     import { StepInput } from "nish/input";
 *     import { rasterRect } from "nish/raster";
 *     import { SYNTH_SQUARE, synthSilence, synthTone } from "nish/synth";
 *
 *     const input = new StepInput(new KeyState());
 *
 *     export const start = (): void => gameSetSize(320, 180);
 *
 *     export const sound = (id: i32): i32 => {
 *       const out = synthSilence(0.1, 22050);
 *       synthTone(out, 22050, 0.0, 0.1, 440.0 + toF64(id) * 110.0, 220.0, SYNTH_SQUARE, 0.3, 20.0);
 *       return gameWriteSamples(out, 22050);
 *     };
 *
 *     export const step = (nowMs: f64): void => {
 *       gameReadInput(input, nowMs);
 *       if (input.events.length > 0) gamePlaySound(0);
 *       rasterRect(GAME_FRAME, gameWidth(), gameHeight(), 0, 0, 320, 180, 0x101830, 256);
 *     };
 *
 * The module is ordinary Nish everywhere: a native build has the same
 * storage, so a test can push records onto `GAME_INPUT` and read the frame
 * back without a page. It needs no capability and does no I/O.
 */
import { ringClear, ringPush, ringShift, ringSize } from "nish/host/ring"
import { StepInput } from "nish/input"
import { EVENT_FOCUS, EVENT_KEY, EVENT_MOUSE, TermEvent } from "nish/term"

/** The widest frame `GAME_FRAME` holds, in pixels. */
export const GAME_MAX_WIDTH: i32 = 960

/** The tallest frame `GAME_FRAME` holds, in pixels. */
export const GAME_MAX_HEIGHT: i32 = 540

/** The words of one input record on `GAME_INPUT`. */
export const GAME_EVENT_WORDS: i32 = 7

/** The input records `GAME_INPUT` holds at once. */
export const GAME_INPUT_EVENTS: i32 = 64

/** The sound ids `GAME_SOUNDS` holds at once. */
export const GAME_SOUND_SLOTS: i32 = 32

/** The samples `GAME_SAMPLES` holds: two seconds at 48000 Hz. */
export const GAME_SAMPLE_LIMIT: i32 = 96000

/** `GAME_INFO`'s word for the frame's width in pixels. */
export const GAME_INFO_WIDTH: i32 = 0

/** `GAME_INFO`'s word for the frame's height in pixels. */
export const GAME_INFO_HEIGHT: i32 = 1

/** `GAME_INFO`'s word for how many samples `gameWriteSamples` last wrote. */
export const GAME_INFO_SAMPLES: i32 = 2

/** `GAME_INFO`'s word for the sample rate of those samples, in Hz. */
export const GAME_INFO_RATE: i32 = 3

/** The frame: `0xRRGGBB` pixels, row-major, `GAME_INFO[GAME_INFO_WIDTH]` words a row. */
export const GAME_FRAME = new Int32Array(960 * 540)

/** The frame's size and the last sound's sample count and rate; see `GAME_INFO_WIDTH` and the rest. */
export const GAME_INFO = new Int32Array(4)

/** The page's input events: a `nish/host/ring` of `GAME_EVENT_WORDS`-word records. */
export const GAME_INPUT = new Int32Array(2 + 7 * 64)

/** The sound ids the game asked for since the page last looked: a `nish/host/ring`. */
export const GAME_SOUNDS = new Int32Array(2 + 32)

/** One sound's samples, written by `gameWriteSamples` for the page to copy. */
export const GAME_SAMPLES = new Float32Array(96000)

/** `v` held to `0..most`. */
const gameClamp = (v: i32, most: i32): i32 => Math.min(Math.max(v, 0), most)

/**
 * Set the frame's size, which the page reads to know how much of `GAME_FRAME`
 * to show. Each side is held to `0..GAME_MAX_WIDTH` and `0..GAME_MAX_HEIGHT`.
 * The pixels are not touched: the next frame draws over them.
 *
 * @param width - the frame's width in pixels
 * @param height - the frame's height in pixels
 */
export const gameSetSize = (width: i32, height: i32): void => {
  GAME_INFO[GAME_INFO_WIDTH] = gameClamp(width, GAME_MAX_WIDTH)
  GAME_INFO[GAME_INFO_HEIGHT] = gameClamp(height, GAME_MAX_HEIGHT)
}

/**
 * The frame's width, as `gameSetSize` set it.
 *
 * @returns the width in pixels, held to `0..GAME_MAX_WIDTH` even if the page wrote the word
 */
export const gameWidth = (): i32 => gameClamp(GAME_INFO[GAME_INFO_WIDTH], GAME_MAX_WIDTH)

/**
 * The frame's height, as `gameSetSize` set it.
 *
 * @returns the height in pixels, held to `0..GAME_MAX_HEIGHT` even if the page wrote the word
 */
export const gameHeight = (): i32 => gameClamp(GAME_INFO[GAME_INFO_HEIGHT], GAME_MAX_HEIGHT)

/** The next record on `GAME_INPUT` as a `TermEvent`, or null for a kind the reader does not know. */
const gameEventOf = (): TermEvent | null => {
  const type: i32 = ringShift(GAME_INPUT)
  const what: i32 = ringShift(GAME_INPUT)
  const code: i32 = ringShift(GAME_INPUT)
  const modifiers: i32 = ringShift(GAME_INPUT)
  const action: i32 = ringShift(GAME_INPUT)
  const x: i32 = ringShift(GAME_INPUT)
  const y: i32 = ringShift(GAME_INPUT)
  if (type !== EVENT_KEY && type !== EVENT_MOUSE && type !== EVENT_FOCUS) {
    return null
  }
  const e = new TermEvent(type)
  if (type === EVENT_FOCUS) {
    e.gained = what !== 0
    return e
  }
  e.modifiers = modifiers
  e.action = action
  if (type === EVENT_KEY) {
    e.key = what
    e.code = code
    return e
  }
  e.button = what
  e.x = x
  e.y = y
  e.px = x
  e.py = y
  return e
}

/**
 * Drain the page's input into `input`: every whole record on `GAME_INPUT`
 * becomes a `TermEvent`, and `input.events` becomes what `input.keys.apply`
 * makes of them at `nowMs`, so `input.isDown` answers for the keys still held.
 * The page sends real key releases, so the key state's synthetic releases are
 * turned off. A trailing part-record is dropped.
 *
 * @param input - the step's input, kept by the game from step to step
 * @param nowMs - the step's clock in milliseconds, for the key state
 */
export const gameReadInput = (input: StepInput, nowMs: f64): void => {
  input.keys.releasesAreSynthetic = false
  const read: TermEvent[] = []
  while (ringSize(GAME_INPUT) >= GAME_EVENT_WORDS) {
    const e = gameEventOf()
    if (e !== null) {
      read.push(e)
    }
  }
  if (ringSize(GAME_INPUT) > 0) {
    ringClear(GAME_INPUT)
  }
  input.events = input.keys.apply(read, nowMs)
}

/**
 * Ask the page to start a sound: `id` goes on `GAME_SOUNDS`, which the page
 * drains after the step. A full queue drops the id, since a sound late by a
 * frame is worse than one missed.
 *
 * @param id - the sound's id, the one the page fetched its samples by
 * @returns whether the id was queued
 */
export const gamePlaySound = (id: i32): boolean => ringPush(GAME_SOUNDS, id)

/**
 * Hand one sound's samples to the page: each is clipped to `-1..1` and written
 * to `GAME_SAMPLES` as an `f32`, and `GAME_INFO` records how many and at what
 * rate. Samples past `GAME_SAMPLE_LIMIT` are cut off.
 *
 * @param samples - the sound, at `sampleRate` samples a second
 * @param sampleRate - the samples' rate in Hz
 * @returns how many samples were written
 */
export const gameWriteSamples = (samples: f64[], sampleRate: i32): i32 => {
  const n: i32 = Math.min(toI32(samples.length), GAME_SAMPLE_LIMIT)
  for (let i: i32 = 0; i < n && i < samples.length; i++) {
    let x: f64 = samples[i]
    if (x > 1.0) {
      x = 1.0
    } else if (x < -1.0) {
      x = -1.0
    } else if (x !== x) {
      x = 0.0
    }
    GAME_SAMPLES[i] = toF32(x)
  }
  GAME_INFO[GAME_INFO_SAMPLES] = n
  GAME_INFO[GAME_INFO_RATE] = sampleRate
  return n
}

// The sounds of `nish break`, off unless asked for. Each is synthesized with
// `nish/synth` (square, triangle and noise voices with a pitch sweep and a
// decaying envelope; nothing is sampled or copied), made a short WAV here and
// written once to a private directory under $TMPDIR. A sound is played by
// starting the system's own player on its file in the background, detached
// from the terminal, so the game never waits on audio and the player can never
// write over a frame.
//
// A process start costs about a millisecond, so starts are rationed: a sound
// is not started again within `SAME_GAP_NS` of itself, nor any minor sound
// within `ANY_GAP_NS` of another. With no player on PATH, or under WASI, where
// `spawnSync` answers -1, nothing is written and nothing plays.

import {
  BREAK_PITCHES,
  SOUND_ADVANCE,
  SOUND_BREAK,
  SOUND_CAPSULE,
  SOUND_CLEAR,
  SOUND_COUNT,
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

/** The sample rate every sound is written at: plenty for square waves under 3 kHz. */
const SAMPLE_RATE: i32 = 22050

/** A sound waits this long after it last started before it starts again (60 ms). */
const SAME_GAP_NS: i64 = 60000000

/** A minor sound waits this long after any sound started (15 ms). */
const ANY_GAP_NS: i64 = 15000000

/** The sound played when sound is turned on, so the player is heard to work. */
export const SOUND_HELLO: i32 = SOUND_CAPSULE

/** What the director keeps to play sounds: the player found and where its files are. */
export class BreakSound {
  /** Whether `prepareSound` has run; it runs once, found or not. */
  prepared: boolean
  /** The player's argument vector before the file, empty when none was found. */
  player: string[]
  /** The private directory the sounds were written to, "" when there is none. */
  dir: string
  /** When each sound last started, in monotonic nanoseconds; 0 for never. */
  lastStart: i64[]
  /** When any sound last started. */
  lastAny: i64

  /** Nothing found and nothing written yet. */
  constructor() {
    this.prepared = false
    this.player = []
    this.dir = ""
    this.lastStart = new Array<i64>(SOUND_COUNT)
    this.lastStart.fill(toI64(0))
    this.lastAny = toI64(0)
  }
}

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
export const soundSamples = (id: i32): f64[] => {
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

/** Append `v`'s low `bytes` bytes, least significant first. */
const pushLittle = (out: u8[], v: i32, bytes: i32): void => {
  for (let i: i32 = 0; i < bytes; i++) {
    out.push(toU8((v >> (i * 8)) & 255))
  }
}

/** Append the four ASCII letters of `tag`. */
const pushTag = (out: u8[], tag: string): void => {
  for (let i: i32 = 0; i < toI32(tag.length); i++) {
    out.push(toU8(tag.charCodeAt(i)))
  }
}

/** `samples` as a WAV file: RIFF, one channel of 16-bit PCM at `SAMPLE_RATE`, each sample clipped to -1..1. */
export const wavBytes = (samples: f64[]): u8[] => {
  const n: i32 = toI32(samples.length)
  const out: u8[] = []
  pushTag(out, "RIFF")
  pushLittle(out, 36 + n * 2, 4)
  pushTag(out, "WAVE")
  pushTag(out, "fmt ")
  pushLittle(out, 16, 4)
  pushLittle(out, 1, 2)
  pushLittle(out, 1, 2)
  pushLittle(out, SAMPLE_RATE, 4)
  pushLittle(out, SAMPLE_RATE * 2, 4)
  pushLittle(out, 2, 2)
  pushLittle(out, 16, 2)
  pushTag(out, "data")
  pushLittle(out, n * 2, 4)
  for (const x of samples) {
    const v: i32 = toI32(Math.round(Math.min(Math.max(x, -1.0), 1.0) * 32767.0))
    pushLittle(out, v, 2)
  }
  return out
}

// ---- Playing ----------------------------------------------------------------

/** Whether `name` is a command on PATH, asked of the shell, which knows PATH's rules. */
const onPath = (name: string): boolean => {
  const argv: string[] = []
  argv.push("/bin/sh")
  argv.push("-c")
  argv.push(`command -v ${name}`)
  return spawnSyncTo(argv, "/dev/null", "/dev/null") === 0
}

/**
 * The first audio player on PATH, as the argument vector before a file: macOS's
 * afplay, PipeWire's pw-play, PulseAudio's paplay, ALSA's aplay, then ffplay.
 * Empty when there is none.
 */
const findPlayer = (): string[] => {
  const argv: string[] = []
  if (onPath("afplay")) {
    argv.push("afplay")
  } else if (onPath("pw-play")) {
    argv.push("pw-play")
  } else if (onPath("paplay")) {
    argv.push("paplay")
  } else if (onPath("aplay")) {
    argv.push("aplay")
    argv.push("-q")
  } else if (onPath("ffplay")) {
    argv.push("ffplay")
    argv.push("-nodisp")
    argv.push("-autoexit")
    argv.push("-loglevel")
    argv.push("quiet")
  }
  return argv
}

/** $TMPDIR without a trailing slash, or /tmp. */
const tempRoot = (): string => {
  const v: string | null = getenv("TMPDIR")
  if (v === null || v === "") {
    return "/tmp"
  }
  return v.endsWith("/") && v.length > 1 ? v.slice(0, v.length - 1) : v
}

/** Sound `id`'s file in `dir`. */
const soundFile = (dir: string, id: i32): string => `${dir}/${id}.wav`

/**
 * A new directory only this user can enter, under $TMPDIR, named from `now`;
 * a name already taken is never reused, so another user's directory or link
 * is never written into. "" when none could be made.
 */
const makeDir = (now: i64): string => {
  const root: string = tempRoot()
  for (let attempt: i32 = 0; attempt < 8; attempt++) {
    const dir: string = `${root}/nish-break-sound-${now}-${attempt}`
    if (mkdirSyncMode(dir, 0o700) === 0) {
      return dir
    }
  }
  return ""
}

/**
 * Find a player and write every sound for it, once: later calls answer what
 * the first found. True when sounds can play.
 */
export const prepareSound = (s: BreakSound, now: i64): boolean => {
  if (s.prepared) {
    return soundReady(s)
  }
  s.prepared = true
  s.player = findPlayer()
  if (s.player.length === 0) {
    return false
  }
  const dir: string = makeDir(now)
  if (dir === "") {
    s.player = []
    return false
  }
  s.dir = dir
  if (!writeSounds(dir)) {
    closeSound(s)
    s.player = []
    return false
  }
  return true
}

/** Write every sound's WAV file into `dir`; false if one could not be written. */
const writeSounds = (dir: string): boolean => {
  for (let id: i32 = 0; id < SOUND_COUNT; id++) {
    if (writeFileBytesSync(soundFile(dir, id), wavBytes(soundSamples(id))) < 0) {
      return false
    }
  }
  return true
}

/** Whether sounds can play: a player was found and the files are written. */
export const soundReady = (s: BreakSound): boolean => s.player.length > 0 && s.dir !== ""

/** The player's name, for a toast; "" when there is none. */
export const soundPlayer = (s: BreakSound): string => (s.player.length > 0 ? s.player[0] : "")

/** Whether `id` is heard however busy the moment: the events a player must not miss. */
const major = (id: i32): boolean =>
  id === SOUND_EXPLODE ||
  id === SOUND_CAPSULE ||
  id === SOUND_LOSE ||
  id === SOUND_CLEAR ||
  id === SOUND_OVER ||
  id === SOUND_ADVANCE

/**
 * Start sound `id` at `now` in the background, unless it started within
 * `SAME_GAP_NS` or, a minor sound, any sound started within `ANY_GAP_NS`.
 * The shell detaches the player with its streams on /dev/null and is waited
 * for at once, so no child is left to reap and nothing reaches the screen.
 */
export const playSound = (s: BreakSound, id: i32, now: i64): void => {
  if (!soundReady(s) || id < 0 || id >= SOUND_COUNT || id >= toI32(s.lastStart.length)) {
    return
  }
  if (s.lastStart[id] !== toI64(0) && now - s.lastStart[id] < SAME_GAP_NS) {
    return
  }
  if (!major(id) && s.lastAny !== toI64(0) && now - s.lastAny < ANY_GAP_NS) {
    return
  }
  s.lastStart[id] = now
  s.lastAny = now
  const argv: string[] = []
  argv.push("/bin/sh")
  argv.push("-c")
  argv.push('exec "$@" >/dev/null 2>&1 </dev/null &')
  argv.push("sh")
  for (const a of s.player) {
    argv.push(a)
  }
  argv.push(soundFile(s.dir, id))
  spawnSync(argv)
}

/** Remove the sound files and their directory; a player still playing one keeps it open until it ends. */
export const closeSound = (s: BreakSound): void => {
  if (s.dir === "") {
    return
  }
  for (let id: i32 = 0; id < SOUND_COUNT; id++) {
    unlinkSync(soundFile(s.dir, id))
  }
  const argv: string[] = []
  argv.push("rmdir")
  argv.push(s.dir)
  spawnSyncTo(argv, "/dev/null", "/dev/null")
  s.dir = ""
}

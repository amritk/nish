// The sounds of `nish break`, off unless asked for. Each is synthesized by
// break-voices.ts, made a short WAV here and
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
  SOUND_ADVANCE,
  SOUND_CAPSULE,
  SOUND_CLEAR,
  SOUND_COUNT,
  SOUND_EXPLODE,
  SOUND_LOSE,
  SOUND_OVER,
} from "./break-game"
import { SAMPLE_RATE, voiceSamples } from "./break-voices"

/** A sound waits this long after it last started before it starts again (60 ms). */
const SAME_GAP_NS: i64 = 60000000

/** A minor sound waits this long after any sound started (15 ms). */
const ANY_GAP_NS: i64 = 15000000

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

/** Sound `id`'s samples, each in -1..1 before clipping: break-voices.ts makes them. */
export const soundSamples = (id: i32): f64[] => voiceSamples(id)

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

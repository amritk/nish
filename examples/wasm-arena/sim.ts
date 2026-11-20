// Opt-out (`--allow-panics`): it indexes the `BODIES` and `SHOTS` records in
// module storage, which the checker cannot yet prove in range (client.ts's
// header has the follow-up).
//
// The simulation of examples/wasm-arena (docs/wp50-wasm-host.md §10, W9): a
// fixed-step arena of bodies, a ship the input steers, and its shots. Every
// pool is module storage sized from the caps below, so a tick allocates
// nothing, and every float the state holds goes into `simHash`.
//
// The same file is compiled three ways: into client.ts's page module, and with
// `--deterministic` into replay.ts natively, on wasm32 and as the `--emit-ts`
// reading. The page module may not take the flag, because client.ts imports
// a host module (NL3054), so this file is written to need nothing the flag
// would add: a page module already calls std/math.ts for `Math.sin` and
// `Math.cos`, and the hash quiets a NaN itself rather than relying on the
// flag's `f64ToBits`.

/** The bodies in the arena. */
export const BODY_CAP: i32 = 256
/** The shots in flight at once. */
export const SHOT_CAP: i32 = 64
/** The ticks a shot lives. */
const SHOT_LIFE: f64 = 90.0
/** The ticks between two shots. */
const SHOT_GAP: f64 = 6.0
/** The fixed tick, in seconds. */
export const TICK_SECONDS: f64 = 1.0 / 60.0
/** The arena's width and height. */
export const ARENA_W: f64 = 960.0
export const ARENA_H: f64 = 540.0

/** The bits of one tick's input word. */
export const IN_THRUST: i32 = 1
export const IN_BRAKE: i32 = 2
export const IN_LEFT: i32 = 4
export const IN_RIGHT: i32 = 8
export const IN_FIRE: i32 = 16

/** A body: a disc that drifts, bounces off the walls and off other bodies. */
interface Body {
  x: f64
  y: f64
  vx: f64
  vy: f64
  r: f64
  heat: f64
}

/** A shot: a point with a velocity and the ticks it has left. */
interface Shot {
  x: f64
  y: f64
  vx: f64
  vy: f64
  life: f64
}

export const BODIES = new Array<Body>(BODY_CAP)
export const SHOTS = new Array<Shot>(SHOT_CAP)
/** The ship: x, y, heading, speed, cooldown, score, then the tick count. */
export const SHIP = new Float64Array(7)

// The functions below take the ship as `ship`, lent from `SHIP`: the checker
// proves an index in range under a test of a parameter's length, not an index
// into module storage, so each opens with that test or counts to the length.
// `SHIP` is always 7 long, so those tests never return early. `BODIES` and `SHOTS` hold records,
// which storage never lends, so they are indexed in place.

/** The next value of a 32-bit LCG; unsigned arithmetic wraps. */
const lcg = (s: u32): u32 => s * toU32(1664525) + toU32(1013904223)

/** `s` as a fraction in [0, 1). */
const unit = (s: u32): f64 => toF64(s >> toU32(8)) / 16777216.0

/**
 * Puts every body at a place drawn from `seed`, the ship in the middle, and
 * clears the shots and the tick count.
 *
 * @param seed - the LCG's start
 */
export const simReset = (seed: u32): void => {
  let s: u32 = seed
  for (let i = 0; i < BODY_CAP; i++) {
    s = lcg(s)
    BODIES[i].x = unit(s) * (ARENA_W - 40.0) + 20.0
    s = lcg(s)
    BODIES[i].y = unit(s) * (ARENA_H - 40.0) + 20.0
    s = lcg(s)
    BODIES[i].vx = (unit(s) - 0.5) * 120.0
    s = lcg(s)
    BODIES[i].vy = (unit(s) - 0.5) * 120.0
    s = lcg(s)
    BODIES[i].r = unit(s) * 5.0 + 3.0
    BODIES[i].heat = 0.0
  }
  for (let i = 0; i < SHOT_CAP; i++) {
    SHOTS[i].x = 0.0
    SHOTS[i].y = 0.0
    SHOTS[i].vx = 0.0
    SHOTS[i].vy = 0.0
    SHOTS[i].life = 0.0
  }
  park(SHIP)
}

/** Puts the ship in the middle, at rest, with no score and no ticks. */
const park = (ship: Float64Array): void => {
  if (ship.length < 7) {
    return
  }
  ship[0] = ARENA_W / 2.0
  ship[1] = ARENA_H / 2.0
  ship[2] = 0.0
  ship[3] = 0.0
  ship[4] = 0.0
  ship[5] = 0.0
  ship[6] = 0.0
}

/** Keeps `v` off a wall: the position folded back inside, the velocity turned. */
const bounce = (i: i32): void => {
  const r: f64 = BODIES[i].r
  if (BODIES[i].x < r) {
    BODIES[i].x = r + (r - BODIES[i].x)
    BODIES[i].vx = -BODIES[i].vx
  } else if (BODIES[i].x > ARENA_W - r) {
    BODIES[i].x = ARENA_W - r - (BODIES[i].x - (ARENA_W - r))
    BODIES[i].vx = -BODIES[i].vx
  }
  if (BODIES[i].y < r) {
    BODIES[i].y = r + (r - BODIES[i].y)
    BODIES[i].vy = -BODIES[i].vy
  } else if (BODIES[i].y > ARENA_H - r) {
    BODIES[i].y = ARENA_H - r - (BODIES[i].y - (ARENA_H - r))
    BODIES[i].vy = -BODIES[i].vy
  }
}

/** Two overlapping bodies exchange the part of their velocity along the line between them. */
const collide = (i: i32, j: i32): void => {
  const dx: f64 = BODIES[j].x - BODIES[i].x
  const dy: f64 = BODIES[j].y - BODIES[i].y
  const reach: f64 = BODIES[i].r + BODIES[j].r
  const d2: f64 = dx * dx + dy * dy
  if (d2 >= reach * reach || d2 === 0.0) {
    return
  }
  const d: f64 = Math.sqrt(d2)
  const nx: f64 = dx / d
  const ny: f64 = dy / d
  const closing: f64 = (BODIES[i].vx - BODIES[j].vx) * nx + (BODIES[i].vy - BODIES[j].vy) * ny
  if (closing <= 0.0) {
    return
  }
  BODIES[i].vx = BODIES[i].vx - closing * nx
  BODIES[i].vy = BODIES[i].vy - closing * ny
  BODIES[j].vx = BODIES[j].vx + closing * nx
  BODIES[j].vy = BODIES[j].vy + closing * ny
  BODIES[i].heat = BODIES[i].heat + closing
  BODIES[j].heat = BODIES[j].heat + closing
}

/** The ship turns, thrusts and fires as `input`'s bits say. */
const steer = (ship: Float64Array, input: i32): void => {
  if (ship.length < 7) {
    return
  }
  if ((input & IN_LEFT) !== 0) {
    ship[2] = ship[2] - 0.08
  }
  if ((input & IN_RIGHT) !== 0) {
    ship[2] = ship[2] + 0.08
  }
  if ((input & IN_THRUST) !== 0) {
    ship[3] = ship[3] + 6.0
  }
  if ((input & IN_BRAKE) !== 0) {
    ship[3] = ship[3] * 0.9
  }
  const c: f64 = Math.cos(ship[2])
  const s: f64 = Math.sin(ship[2])
  ship[0] = ship[0] + c * ship[3] * TICK_SECONDS
  ship[1] = ship[1] + s * ship[3] * TICK_SECONDS
  // The arena wraps for the ship: `%` is fmodF64 on a page module and under the flag.
  ship[0] = (ship[0] + ARENA_W) % ARENA_W
  ship[1] = (ship[1] + ARENA_H) % ARENA_H
  ship[3] = ship[3] * 0.99
  ship[4] = ship[4] > 0.0 ? ship[4] - 1.0 : 0.0
  if ((input & IN_FIRE) !== 0 && ship[4] === 0.0) {
    for (let k = 0; k < SHOT_CAP; k++) {
      if (SHOTS[k].life === 0.0) {
        SHOTS[k].x = ship[0]
        SHOTS[k].y = ship[1]
        SHOTS[k].vx = c * 420.0
        SHOTS[k].vy = s * 420.0
        SHOTS[k].life = SHOT_LIFE
        ship[4] = SHOT_GAP
        return
      }
    }
  }
}

/** A live shot moves, and pushes and heats the first body it is inside. */
const fly = (ship: Float64Array, k: i32): void => {
  if (ship.length < 7) {
    return
  }
  if (SHOTS[k].life === 0.0) {
    return
  }
  SHOTS[k].x = SHOTS[k].x + SHOTS[k].vx * TICK_SECONDS
  SHOTS[k].y = SHOTS[k].y + SHOTS[k].vy * TICK_SECONDS
  SHOTS[k].life = SHOTS[k].life - 1.0
  if (SHOTS[k].x < 0.0 || SHOTS[k].x > ARENA_W || SHOTS[k].y < 0.0 || SHOTS[k].y > ARENA_H) {
    SHOTS[k].life = 0.0
    return
  }
  for (let i = 0; i < BODY_CAP; i++) {
    const dx: f64 = BODIES[i].x - SHOTS[k].x
    const dy: f64 = BODIES[i].y - SHOTS[k].y
    if (dx * dx + dy * dy < BODIES[i].r * BODIES[i].r) {
      BODIES[i].vx = BODIES[i].vx + SHOTS[k].vx * 0.25
      BODIES[i].vy = BODIES[i].vy + SHOTS[k].vy * 0.25
      BODIES[i].heat = BODIES[i].heat + 50.0
      SHOTS[k].life = 0.0
      ship[5] = ship[5] + 1.0
      return
    }
  }
}

/**
 * Advances the arena one fixed tick under `input`.
 *
 * @param input - the tick's input word: the `IN_*` bits held
 */
export const simStep = (input: i32): void => {
  step(SHIP, input)
}

/** `simStep` on the ship in `ship`. */
const step = (ship: Float64Array, input: i32): void => {
  if (ship.length < 7) {
    return
  }
  steer(ship, input)
  // A slow wind across the arena, so the bodies never settle.
  const wind: f64 = Math.sin(ship[6] * 0.01) * 4.0
  for (let i = 0; i < BODY_CAP; i++) {
    BODIES[i].vx = (BODIES[i].vx + wind * TICK_SECONDS) * 0.999
    BODIES[i].vy = BODIES[i].vy * 0.999
    BODIES[i].x = BODIES[i].x + BODIES[i].vx * TICK_SECONDS
    BODIES[i].y = BODIES[i].y + BODIES[i].vy * TICK_SECONDS
    BODIES[i].heat = BODIES[i].heat * 0.95
    bounce(i)
  }
  for (let i = 0; i < BODY_CAP; i++) {
    for (let j = i + 1; j < BODY_CAP; j++) {
      collide(i, j)
    }
  }
  for (let k = 0; k < SHOT_CAP; k++) {
    fly(ship, k)
  }
  ship[6] = ship[6] + 1.0
}

/** The ticks stepped since the last reset. */
export const simTicks = (): i32 => toI32(SHIP[6])

/** FNV-1a's 64-bit prime (a module constant is a number, so a function answers a u64). */
const fnvPrime = (): u64 => {
  const p: u64 = 1099511628211
  return p
}

/** `h` with the eight bytes of `x`'s bits folded in, low byte first; every NaN reads as the canonical one. */
const fold = (h: u64, x: f64): u64 => {
  const quiet: u64 = toU64(32760) << toU64(48) // 0x7ff8000000000000
  // biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
  let bits: u64 = x !== x ? quiet : toU64(f64ToBits(x))
  let out: u64 = h
  for (let b = 0; b < 8; b++) {
    out = (out ^ (bits & toU64(255))) * fnvPrime()
    bits = bits >> toU64(8)
  }
  return out
}

/**
 * FNV-1a over the bits of every field of the state: the bodies, the shots,
 * then the ship.
 *
 * @returns the 64-bit hash
 */
export const simHash = (): u64 => {
  // FNV-1a's 64-bit offset basis, 0xcbf29ce484222325.
  const high: u64 = 3421674724
  const low: u64 = 2216829733
  let h: u64 = (high << toU64(32)) | low
  for (let i = 0; i < BODY_CAP; i++) {
    h = fold(h, BODIES[i].x)
    h = fold(h, BODIES[i].y)
    h = fold(h, BODIES[i].vx)
    h = fold(h, BODIES[i].vy)
    h = fold(h, BODIES[i].r)
    h = fold(h, BODIES[i].heat)
  }
  for (let k = 0; k < SHOT_CAP; k++) {
    h = fold(h, SHOTS[k].x)
    h = fold(h, SHOTS[k].y)
    h = fold(h, SHOTS[k].vx)
    h = fold(h, SHOTS[k].vy)
    h = fold(h, SHOTS[k].life)
  }
  return foldAll(h, SHIP)
}

/** `h` with every float of `xs` folded in, in order. */
const foldAll = (h: u64, xs: Float64Array): u64 => {
  let out: u64 = h
  for (let f = 0; f < toI32(xs.length); f++) {
    out = fold(out, xs[f])
  }
  return out
}

/** The hash's high 32 bits, for a page that keeps to numbers. */
export const simHashHi = (): u32 => toU32(simHash() >> toU64(32))

/** The hash's low 32 bits. */
export const simHashLo = (): u32 => {
  const low: u64 = 4294967295
  return toU32(simHash() & low)
}

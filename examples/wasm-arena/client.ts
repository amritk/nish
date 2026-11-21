// Opt-out (`--allow-panics`): calls into `std/host/ring` and `std/math` reach
// their panic sites, and sim.ts indexes the `BODIES` and `SHOTS` records in
// module storage, which the checker cannot yet prove in range or lend to a
// helper. Follow-up: make those modules panic-free and teach the prover
// module-storage bounds, then build this file without `--allow-panics`.
//
// The page module of examples/wasm-arena (docs/wp50-wasm-host.md §10, W9). It
// owns the input ring the page writes, steps sim.ts at a fixed tick, and lays
// out one instance per body and shot in module storage, which the page hands
// to the GPU with no copy of its own. Nothing here allocates per frame: every
// array is module storage, and the shader text is built once, at `init`.
import { ringShift, ringSize } from "nish/host/ring"
import { glCreateProgram, gpuCreateShader } from "./host"
import {
  BODIES,
  BODY_CAP,
  SHIP,
  SHOT_CAP,
  SHOTS,
  simHashHi,
  simHashLo,
  simReset,
  simStep,
  simTicks,
  TICK_SECONDS,
} from "./sim"

/** The most ticks one frame steps; a longer frame drops the rest of its time. */
export const MAX_STEPS: i32 = 8
/** The floats per instance: x, y, radius, heat. */
export const INSTANCE_FLOATS: i32 = 4
/** Every body, every shot and the ship. */
export const INSTANCE_CAP: i32 = BODY_CAP + SHOT_CAP + 1

/**
 * The input ring (`nish/host/ring`): head, tail, then 256 words. A word's low
 * byte is the `IN_*` bits pressed, its second byte the bits released.
 */
export const INPUT = new Int32Array(2 + 256)
/** The instance list the page writes to the GPU after each frame. */
export const INSTANCES = new Float32Array(INSTANCE_FLOATS * INSTANCE_CAP)
/** The ticks the last frame stepped: their count, then each tick's input word. */
export const STEPPED = new Int32Array(1 + MAX_STEPS)
/** The time not yet stepped, in milliseconds, and the bits held. */
const CLOCK = new Float64Array(1)
const HELD = new Int32Array(1)

// The functions below take the storage as parameters, lent from the exports:
// the checker proves an index into a parameter under a test of its length,
// not an index into module storage, so each opens with one. The storage is
// always as long as those tests ask, so they never return early. `BODIES` and
// `SHOTS` hold records, which storage never lends, so they are indexed in place.

/**
 * Resets the arena from `seed` and hands the page its shaders: WGSL, or the
 * GLSL pair when the page has no WebGPU.
 *
 * @param seed - the simulation's seed
 * @returns 1 when the page renders with WebGPU, 0 with WebGL 2
 */
export const init = (seed: u32): i32 => {
  simReset(seed)
  clear(CLOCK, HELD, STEPPED)
  // The shader text is built here, in the call, so it lives in the call's
  // scratch and is released when the call returns.
  const webgpu: i32 = gpuCreateShader(
    `// examples/wasm-arena: ${INSTANCE_CAP} instances of ${INSTANCE_FLOATS} floats
struct Instance { pos: vec2f, radius: f32, heat: f32 }
@group(0) @binding(0) var<storage, read> instances: array<Instance, ${INSTANCE_CAP}>;
struct Out { @builtin(position) at: vec4f, @location(0) uv: vec2f, @location(1) heat: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Out {
  let corner = vec2f(f32(v & 1u), f32(v >> 1u)) * 2.0 - 1.0;
  let it = instances[i];
  let world = it.pos + corner * it.radius;
  var out: Out;
  out.at = vec4f(world.x / ${960 / 2}.0 - 1.0, 1.0 - world.y / ${540 / 2}.0, 0.0, 1.0);
  out.uv = corner;
  out.heat = it.heat;
  return out;
}
@fragment fn fs(o: Out) -> @location(0) vec4f {
  if (dot(o.uv, o.uv) > 1.0) { discard; }
  let h = clamp(o.heat / 200.0, 0.0, 1.0);
  return vec4f(0.3 + 0.7 * h, 0.6, 1.0 - h, 1.0);
}
`
  )
  if (webgpu === 0) {
    glCreateProgram(
      `#version 300 es
// examples/wasm-arena: ${INSTANCE_CAP} instances of ${INSTANCE_FLOATS} floats
layout(location = 0) in vec4 instance;
out vec2 uv;
out float heat;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 world = instance.xy + corner * instance.z;
  gl_Position = vec4(world.x / ${960 / 2}.0 - 1.0, 1.0 - world.y / ${540 / 2}.0, 0.0, 1.0);
  uv = corner;
  heat = instance.w;
}
`,
      `#version 300 es
precision mediump float;
in vec2 uv;
in float heat;
out vec4 color;
void main() {
  if (dot(uv, uv) > 1.0) { discard; }
  float h = clamp(heat / 200.0, 0.0, 1.0);
  color = vec4(0.3 + 0.7 * h, 0.6, 1.0 - h, 1.0);
}
`
    )
  }
  return webgpu
}

/** No time pending, no bits held, no ticks stepped. */
const clear = (clock: Float64Array, held: Int32Array, stepped: Int32Array): void => {
  if (clock.length <= 0 || held.length <= 0 || stepped.length <= 0) {
    return
  }
  clock[0] = 0.0
  held[0] = 0
  stepped[0] = 0
}

/** The bits held once the ring's words are applied to `held`, in the order they were put. */
const drain = (held: i32): i32 => {
  let bits: i32 = held
  while (ringSize(INPUT) > 0) {
    const word: i32 = ringShift(INPUT)
    bits = (bits | (word & 255)) & ~((word >> 8) & 255)
  }
  return bits
}

/**
 * Steps as many fixed ticks as `dtMs` and the time in `clock` cover, at most
 * `MAX_STEPS`, keeping the bits held in `held` and each tick's word in `stepped`.
 */
const advance = (clock: Float64Array, held: Int32Array, stepped: Int32Array, dtMs: f64): void => {
  if (clock.length <= 0 || held.length <= 0 || stepped.length <= 0) {
    return
  }
  const tickMs: f64 = TICK_SECONDS * 1000.0
  let pending: f64 = clock[0] + (dtMs > 0.0 ? dtMs : 0.0)
  let steps: i32 = 0
  while (pending >= tickMs && steps < MAX_STEPS) {
    const word: i32 = drain(held[0])
    held[0] = word
    simStep(word)
    steps++
    // `stepped` holds `1 + MAX_STEPS` words, so the test always holds.
    if (steps < toI32(stepped.length)) {
      stepped[steps] = word
    }
    pending = pending - tickMs
  }
  stepped[0] = steps
  clock[0] = pending >= tickMs ? 0.0 : pending
}

/** One instance: four floats at slot `n`, below `INSTANCE_CAP` (321). */
const put = (instances: Float32Array, n: integer<0, 320>, x: f64, y: f64, r: f64, heat: f64): void => {
  const at: i32 = n * INSTANCE_FLOATS
  // `instances` holds `INSTANCE_CAP` slots, so this never returns.
  if (at + 3 >= toI32(instances.length)) {
    return
  }
  instances[at] = toF32(x)
  instances[at + 1] = toF32(y)
  instances[at + 2] = toF32(r)
  instances[at + 3] = toF32(heat)
}

/** The ship's instance, at slot `n`. */
const putShip = (instances: Float32Array, n: integer<0, 320>, ship: Float64Array): void => {
  if (ship.length < 2) {
    return
  }
  put(instances, n, ship[0], ship[1], 6.0, 0.0)
}

/**
 * Steps as many fixed ticks as `dtMs` and the time left over cover, at most
 * `MAX_STEPS`, draining the input ring before each, then lays out the
 * instances.
 *
 * @param dtMs - the milliseconds since the last frame
 * @returns the number of instances in `INSTANCES`
 */
export const frame = (dtMs: f64): i32 => {
  advance(CLOCK, HELD, STEPPED, dtMs)
  let n: i32 = 0
  // The loops count to `BODY_CAP` and `SHOT_CAP` as literals: the checker bounds `n` by
  // a literal loop bound, where it does not read a constant's value.
  for (let i = 0; i < 256; i++) {
    put(INSTANCES, n, BODIES[i].x, BODIES[i].y, BODIES[i].r, BODIES[i].heat)
    n++
  }
  for (let k = 0; k < 64; k++) {
    if (SHOTS[k].life > 0.0) {
      put(INSTANCES, n, SHOTS[k].x, SHOTS[k].y, 1.5, 200.0)
      n++
    }
  }
  putShip(INSTANCES, n, SHIP)
  return n + 1
}

/** The ticks stepped since `init`. */
export const ticks = (): i32 => simTicks()

/** The high 32 bits of the state's hash (sim.ts's `simHash`). */
export const hashHi = (): u32 => simHashHi()

/** The low 32 bits of the state's hash. */
export const hashLo = (): u32 => simHashLo()

// smoke: args --allow-panics

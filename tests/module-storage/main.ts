// WP50 stage 3: module storage a page reads and writes in place. The world is
// zero-filled at link time; each export reads and writes it, and the page
// builds its views from `layout`, which `--emit-dts` types and the loader fills.
export const SLOTS: i32 = 8

interface Body {
  x: f32
  vx: f32
  hits: u32
  alive: boolean
}

export const bodies = new Array<Body>(SLOTS)
export const input = new Array<u32>(4)
export const scale = new Float64Array(2)

/** Advance every live body by its velocity; answers how many moved. */
export const step = (): i32 => {
  let moved = 0
  for (let i = 0; i < bodies.length; i++) {
    if (bodies[i].alive) {
      bodies[i].x = bodies[i].x + bodies[i].vx
      bodies[i].hits += input[0]
      moved += 1
    }
  }
  scale[1] = scale[1] + scale[0]
  return moved
}

/** Wake body `i` with velocity `vx`. */
export const spawn = (i: i32, vx: f32): void => {
  bodies[i].alive = true
  bodies[i].vx = vx
}

/** The position of body `i`. */
export const xOf = (i: i32): f32 => bodies[i].x

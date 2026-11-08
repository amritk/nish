// WP50 stage 3: a top-level `new` with a constant length is module storage —
// zero-filled globals, no initialiser code, state that outlives each call.
const SLOTS: i32 = 4

interface Sim {
  speed: f64
  tick: i32
  live: boolean
}

const sim = new Array<Sim>(SLOTS)
const totals = new Float64Array(SLOTS * 2)
const marks: u8[] = new Array<u8>(3)

const step = (i: i32): void => {
  sim[i].tick += 1
  sim[i].speed = sim[i].speed + 0.5
  sim[i].live = true
  totals[i] = totals[i] + sim[i].speed
}

const tickOf = (i: i32): i32 => sim[i].tick

export const main = (): void => {
  step(1)
  step(1)
  step(2)
  sim[3] = sim[1]
  let ticks = 0
  for (let i = 0; i < sim.length; i++) {
    ticks += tickOf(i)
  }
  marks[2] = 255
  console.log(`${ticks} ${sim[3].speed} ${sim[0].live} ${totals[1]} ${totals.length} ${marks[2]}`)
}

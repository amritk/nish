// WP31 §9, the linkage condition. `pick` is exported, so a host may call it
// with any `int32_t`: it checks `day` in its prologue, and `run`'s call passes
// `n` with no check of its own. `twice` is not exported, so every caller is in
// view and the check stays at the call site, where the facts are. A method of
// an exported class is exported with it, so `Clock.set` checks `h` itself.
export const pick = (base: i32, day: integer<1, 7>): i32 => base * 10 + day

const twice = (d: integer<0, 9>): i32 => d * 2

export class Clock {
  hours: i32 = 0

  constructor() {}

  set(h: integer<0, 23>): i32 {
    this.hours = h
    return this.hours
  }
}

export const run = (n: i32): i32 => {
  const clock = new Clock()
  return pick(n, n) + twice(n) + clock.set(n + 4)
}

export const test = (): i32 => run(3)

// WP31 §9: ranged parameters at the host boundary. Each exported function with
// a ranged parameter checks it on entry, because a C, N-API or wasm host may
// pass any `int32_t`. `interop_rng_host.c` calls them from C, where leaving the
// range is the panic it is anywhere else; tests/run.js ("interop_rng") writes
// every sidecar from this file and calls them from Node, where the bridges
// throw a RangeError before the call instead.
export const getByte = (buf: u8[], i: integer<0, 255>): u8 => buf[i]

export const pick = (base: i32, day: integer<1, 7>): i32 => base * 10 + day

export const low = (x: integer<-128, 127>): i32 => x + 128

// A string beside the range: the N-API call is arena-scoped.
export const labelLength = (name: string, day: integer<1, 7>): i32 => name.length + day

// A ranged result needs nothing at the boundary: it is already in its range.
export const lastDigit = (n: i32): integer<0, 9> => ((n % 10) + 10) % 10

// Not described: a range inside data a host writes, which nothing checks on entry.
export const count = (xs: integer<0, 9>[]): i32 => xs.length

export class Slot {
  day: integer<1, 7> = 1

  constructor() {}
}

export const slotDay = (s: Slot): i32 => s.day

export const pick = (base: i32, day: integer<1, 7>): i32 => base * 10 + day

export const weekly = (n: i32): i32 => pick(n, n)

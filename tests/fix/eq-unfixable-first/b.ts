// Loaded and fixed although the root before it is refused. Its `any`, which
// no fix answers, is reported only by a load that reaches this file: the
// plain report stops at `a.ts`, and so must the report of `--fix`.
export const b = (x: i32, y: i32): boolean => x == y
export const c = (z: any): i32 => 0

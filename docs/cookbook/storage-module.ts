const SCORES = new Int32Array(8)

export function bump(i: u32): i32 {
  SCORES[i] += 1
  return SCORES[i]
}

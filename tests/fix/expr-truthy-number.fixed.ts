// NL2188: an integer condition is truthy when it is not `0`, so its fix is
// `!== 0`, the same test under `tsc`. A member, a call and arithmetic bind
// tighter than `!==` and stay as written; `&` and an assignment bind looser
// and are parenthesised. Each kind of condition takes the same fix.
const count = (xs: i32[]): i32 => xs.length
export const test = (): number => {
  const xs: i32[] = [1, 2, 3]
  let n: i32 = 0
  if (xs.length !== 0) {
    n = n + 1
  }
  while (count(xs) - n !== 0) {
    n = n + 1
  }
  const flag: i64 = 6
  const bits = (flag & 2) !== 0 ? 1 : 0
  let m: i32 = 0
  do {
    n = n - 1
  } while ((m = n) !== 0)
  for (let i: i32 = 3; i !== 0; i = i - 1) {
    m = m + i
  }
  return n + m + bits
}

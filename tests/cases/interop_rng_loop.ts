// WP31 §9 and §8: an argument entering a parameter its callee checks in its own
// prologue is not checked at the call, so a loop that passes one is not told
// to guard it: no guard at the call removes the callee's check. `pick` is
// exported and checks `day` itself; `twice` is not, so its argument keeps the
// check at the call and the loop is warned about that one alone.
export const pick = (base: i32, day: integer<0, 6>): i32 => base * 7 + day

const twice = (d: integer<0, 9>): i32 => d * 2

export const main = (): number => {
  const xs = [1, 5, 2, 6]
  let total = 0
  for (let k = 0; k < xs.length; k++) {
    total = total + pick(k, xs[k]) + twice(xs[k])
  }
  console.log(`${total}`)
  return 0
}

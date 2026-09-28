// WP31 §6: a value of one range entering another that does not contain it is
// checked like an `i32`: `integer<-5, 5>` into `integer<0, 9>` is one
// `icmp ult i32 %v, 10`. 4 passes, and -3, below the target's lower bound,
// panics before the second line prints.
const digit = (d: integer<0, 9>): i32 => d

const pass = (v: integer<-5, 5>): i32 => digit(v)

export const main = (): number => {
  const up: integer<-5, 5> = 4
  const down: integer<-5, 5> = -3
  console.log(`${pass(up)}`)
  console.log(`${pass(down)}`)
  return 0
}

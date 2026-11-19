// What `formatI64` saves over `${x}`: the same 1 Mi `i64` values written to a
// string both ways. `templ` is `` `${x}` ``, which calls the runtime's C
// formatter (`nish_str_from_i64`); `nishA` and `nishB` call `std/text.ts`'s
// `formatI64`, and are the same code, so the distance between those two is the
// noise band of the run. The values are a fixed xorshift in four kinds: a full
// `i64`, one below 1000, one below 10^7 and one in `i32` range, each a quarter.
// Every pass sums the lengths and the first bytes of its strings, so none of
// them can be left unbuilt, and each pass is a function of its own, whose
// automatic arena scope frees its strings. The three are timed in alternating
// rounds inside one process and the minimum of each is printed:
//
//   build/nish bench/int-format.ts --link build/int-format --profile speed
//   taskset -c 2 build/int-format

import { formatI64 } from "../std/text.ts"

const ROUNDS: i32 = 9
const COUNT: i32 = 1048576

const templ = (values: readonly i64[]): i64 => {
  let sum: i64 = 0
  for (let i = 0; i < values.length; i++) {
    const s = `${values[i]}`
    sum = sum + toI64(s.length) + toI64(s.charCodeAt(0))
  }
  return sum
}

const nishA = (values: readonly i64[]): i64 => {
  let sum: i64 = 0
  for (let i = 0; i < values.length; i++) {
    const s = formatI64(values[i])
    sum = sum + toI64(s.length) + toI64(s.charCodeAt(0))
  }
  return sum
}

const nishB = (values: readonly i64[]): i64 => {
  let sum: i64 = 0
  for (let i = 0; i < values.length; i++) {
    const s = formatI64(values[i])
    sum = sum + toI64(s.length) + toI64(s.charCodeAt(0))
  }
  return sum
}

export const main = (): i32 => {
  const values: i64[] = new Array<i64>(COUNT)
  let s: u64 = toU64(0x2545f491) * toU64(0x4f6cdd1d) + toU64(1)
  for (let i = 0; i < values.length; i++) {
    s = s ^ (s << toU64(13))
    s = s ^ (s >> toU64(7))
    s = s ^ (s << toU64(17))
    const x: i64 = toI64(s)
    const kind = i % 4
    if (kind === 0) {
      values[i] = x
    } else if (kind === 1) {
      values[i] = x % toI64(1000)
    } else if (kind === 2) {
      values[i] = x % toI64(10000000)
    } else {
      values[i] = toI64(toI32(x % toI64(2147483647)))
    }
  }
  let tSum: i64 = 0
  let aSum: i64 = 0
  let bSum: i64 = 0
  let tUs: i64 = 0
  let aUs: i64 = 0
  let bUs: i64 = 0
  for (let round = 0; round < ROUNDS; round++) {
    const t0 = monotonicNanos()
    tSum = templ(values)
    const t1 = monotonicNanos()
    aSum = nishA(values)
    const t2 = monotonicNanos()
    bSum = nishB(values)
    const t3 = monotonicNanos()
    const tt = (t1 - t0) / 1000
    const ta = (t2 - t1) / 1000
    const tb = (t3 - t2) / 1000
    if (round === 0 || tt < tUs) {
      tUs = tt
    }
    if (round === 0 || ta < aUs) {
      aUs = ta
    }
    if (round === 0 || tb < bUs) {
      bUs = tb
    }
  }
  console.log(`templ ${tUs} us`)
  console.log(`nishA ${aUs} us`)
  console.log(`nishB ${bUs} us`)
  console.log(`templ/nishA ${toF64(tUs) / toF64(aUs)}`)
  console.log(`nishB/nishA ${toF64(bUs) / toF64(aUs)}`)
  console.log(`sum ${tSum} agree ${tSum === aSum && aSum === bSum}`)
  return 0
}

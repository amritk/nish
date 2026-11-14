// What a constant table is worth (#1628): one byte classifier written two
// ways over the same 4 MiB buffer. `tableA` and `tableB` index the 256-entry
// `readonly u8[]` below with the byte itself, which `src/bounds.ts` proves in
// range, so each is one load per byte; `chain` answers the same class with a
// chain of compares. `tableB` is `tableA` byte for byte, so the distance
// between those two is the noise band of the run. The three are timed in
// alternating rounds inside one process and the minimum of each is printed:
//
//   build/nish bench/const-table.ts --link build/const-table --profile speed
//   taskset -c 2 build/const-table

// 0 other, 1 white space, 2 digit, 3 identifier byte (a letter or `_`).
const CLASS: readonly u8[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0,
  0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 3,
  0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]

const ROUNDS: i32 = 9
const PASSES: i32 = 40
const SIZE: i32 = 4194304

const tableA = (buf: u8[], counts: i32[]): void => {
  for (let i = 0; i < buf.length; i++) {
    const k = toI32(CLASS[buf[i]]) & 3
    counts[k] += 1
  }
}

const tableB = (buf: u8[], counts: i32[]): void => {
  for (let i = 0; i < buf.length; i++) {
    const k = toI32(CLASS[buf[i]]) & 3
    counts[k] += 1
  }
}

const classOf = (b: u8): i32 => {
  if (b === 9 || b === 10 || b === 13 || b === 32) {
    return 1
  }
  if (b >= 48 && b <= 57) {
    return 2
  }
  if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 95) {
    return 3
  }
  return 0
}

const chain = (buf: u8[], counts: i32[]): void => {
  for (let i = 0; i < buf.length; i++) {
    const k = toI32(classOf(buf[i])) & 3
    counts[k] += 1
  }
}

export const main = (): i32 => {
  const buf: u8[] = new Array<u8>(SIZE)
  // Text-like bytes from a fixed xorshift, so the compares of `chain` are not
  // all predicted by one branch.
  let x: u32 = 2463534242
  for (let i = 0; i < buf.length; i++) {
    x = x ^ (x << 13)
    x = x ^ (x >> 17)
    x = x ^ (x << 5)
    buf[i] = toU8(x & 127)
  }
  const a: i32[] = [0, 0, 0, 0]
  const b: i32[] = [0, 0, 0, 0]
  const c: i32[] = [0, 0, 0, 0]
  let aUs: i64 = 0
  let bUs: i64 = 0
  let cUs: i64 = 0
  for (let round = 0; round < ROUNDS; round++) {
    const t0 = monotonicNanos()
    for (let p = 0; p < PASSES; p++) {
      tableA(buf, a)
    }
    const t1 = monotonicNanos()
    for (let p = 0; p < PASSES; p++) {
      chain(buf, c)
    }
    const t2 = monotonicNanos()
    for (let p = 0; p < PASSES; p++) {
      tableB(buf, b)
    }
    const t3 = monotonicNanos()
    const ta = (t1 - t0) / 1000
    const tc = (t2 - t1) / 1000
    const tb = (t3 - t2) / 1000
    if (round === 0 || ta < aUs) {
      aUs = ta
    }
    if (round === 0 || tb < bUs) {
      bUs = tb
    }
    if (round === 0 || tc < cUs) {
      cUs = tc
    }
    buf[0] = toU8(round)
  }
  console.log(`tableA ${aUs} us`)
  console.log(`tableB ${bUs} us`)
  console.log(`chain  ${cUs} us`)
  console.log(`chain/tableA  ${toF64(cUs) / toF64(aUs)}`)
  console.log(`tableB/tableA ${toF64(bUs) / toF64(aUs)}`)
  console.log(`classes ${a[0]} ${a[1]} ${a[2]} ${a[3]} agree ${a[3] === b[3] && a[3] === c[3]}`)
  return 0
}

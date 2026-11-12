// S6, shape 2: a parser that throws once in `every` records (a thousand in
// the headline row; 0 for never). A record is three fields of four decimal
// digits, read a byte at a time from a stream `byteAt` computes rather than
// stores (so the kernel needs no array and its landing-pad twin no runtime);
// the last record of every `every` has an `x` where a digit belongs. The
// failure starts three calls below the loop that handles it, `parseDigit` under `parseField` under `parseRecord`, and the loop counts
// it and goes on to the next record.
//
// This is the program the desugaring would produce from
//
//   const parseDigit = (c: i32): i32 => {
//     if (c < 48 || c > 57) { throw c }
//     return c - 48
//   }
//   const parseField = (h: i32, bad: i32, first: i32): i32 => {
//     let v = 0
//     for (let k = 0; k < 4; k++) { v = v * 10 + parseDigit(byteAt(h, bad, first + k)) }
//     return v
//   }
//   const parseRecord = (rec: i32, key: i32, poison: boolean): i32 => {
//     const h = mix(rec, key)
//     const bad = poison ? h & 7 : -1
//     return (parseField(h, bad, 0) + parseField(h, bad, 4) + parseField(h, bad, 8)) & 0xffff
//   }
//   export const parse = (n: i32, seed: i32, every: i32): i32 => {
//     let sum = seed & 0xffff
//     let failed = 0
//     let until = every
//     for (let rec = 0; rec < n; rec++) {
//       const poison = until === 1
//       until = poison ? every : until - 1
//       try { sum = (sum + parseRecord(rec, sum, poison)) & 0xffff }
//       catch (e) { failed = (failed + e) & 0x7fff }
//     }
//     return failed * 65536 + sum
//   }
//
// Each record's bytes depend on the sum so far, so the loop carries a
// dependency. parse.ll is the same program on landing pads.
const mix = (rec: i32, key: i32): i32 => {
  const h = Math.imul(rec ^ (key << 16), 0x2c1b3c6d)
  return h ^ (h >> 15)
}

const byteAt = (h: i32, bad: i32, pos: i32): i32 => {
  if (pos === bad) {
    return 120
  }
  return 48 + (((h >> pos) & 15) % 10)
}

const parseDigit = (c: i32): Result<i32, i32> => {
  if (c < 48 || c > 57) {
    return Err(c)
  }
  return Ok(c - 48)
}

const parseField = (h: i32, bad: i32, first: i32): Result<i32, i32> => {
  let v: i32 = 0
  for (let k: i32 = 0; k < 4; k++) {
    const d = parseDigit(byteAt(h, bad, first + k)).orReturn()
    v = v * 10 + d
  }
  return Ok(v)
}

const parseRecord = (rec: i32, key: i32, poison: boolean): Result<i32, i32> => {
  const h = mix(rec, key)
  const bad: i32 = poison ? h & 7 : -1
  const a = parseField(h, bad, 0).orReturn()
  const b = parseField(h, bad, 4).orReturn()
  const c = parseField(h, bad, 8).orReturn()
  return Ok((a + b + c) & 0xffff)
}

export const parse = (n: i32, seed: i32, every: i32): i32 => {
  let sum: i32 = seed & 0xffff
  let failed: i32 = 0
  let until: i32 = every
  for (let rec: i32 = 0; rec < n; rec++) {
    const poison = until === 1
    until = poison ? every : until - 1
    const r = parseRecord(rec, sum, poison)
    if (r.isErr()) {
      failed = (failed + r.error) & 0x7fff
      continue
    }
    sum = (sum + r.value) & 0xffff
  }
  return failed * 65536 + sum
}

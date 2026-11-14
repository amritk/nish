// Self-recursive sums over the unsigned widths are not the checked-sum loop
// (src/accumulate.ts, `hasCheckedSum`): their `+` wraps by definition, so
// there is no overflow check to defer, and each compiles as the plain
// recursion it is (no `rec.head` in acc_width_unsigned.ll). Each sum below
// passes its width's MAX and wraps, as the recursion's adds do.

const sum8 = (n: i32): u8 => {
  if (n <= 0) {
    return 0
  }
  const x: u8 = 200
  return x + sum8(n - 1)
}

const sum16 = (n: i32): u16 => {
  if (n <= 0) {
    return 0
  }
  const x: u16 = 60000
  return x + sum16(n - 1)
}

const sum32 = (n: i32, x: u32): u32 => {
  if (n <= 0) {
    return 0
  }
  return sum32(n - 1, x) + x
}

const sum64 = (n: i32, x: u64): u64 => {
  if (n <= 0) {
    return 0
  }
  return x + sum64(n - 1, x)
}

export const main = (): i32 => {
  const x32: u32 = 4000000000
  const zero: u64 = 0
  const one: u64 = 1
  // 2 * 200 = 144 (mod 2^8); 2 * 60000 = 54464 (mod 2^16);
  // 3 * 4000000000 = 3410065408 (mod 2^32); 3 * (2^64 - 1) = 2^64 - 3 (mod 2^64).
  console.log(`${sum8(2)} ${sum16(2)} ${sum32(3, x32)} ${sum64(3, zero - one)}`)
  return 0
}

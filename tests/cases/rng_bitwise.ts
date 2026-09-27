// WP31 §7: a bitwise compound assignment into a ranged local, field or element
// computes on the base `i32` and enters the range again before the store. A
// shift by a count that is not a constant masks the count to the width of that
// base, `and i32 %n, 31`, as every `i32` shift does, so no shift is ever wider
// than its operand.
class Flags {
  bits: integer<0, 255> = 0

  set(n: i32): void {
    this.bits |= 1 << n
    this.bits <<= n
    this.bits >>= n
  }
}

export const main = (): number => {
  let mask: integer<0, 255> = 255
  const n = 2
  mask &= 60
  mask ^= 12
  mask >>= n
  mask <<= n
  mask >>>= n
  const f = new Flags()
  f.set(n)
  const cells: integer<0, 15>[] = [7, 8]
  cells[0] |= 8
  cells[1] >>= n
  console.log(`${mask} ${f.bits} ${cells[0]} ${cells[1]}`)
  return 0
}

// Under `--number-mode f64` plain `number` is a double, so the bit operators
// are out of reach; the message says which flag put it there rather than
// leaving a reader to wonder why `number` is not an integer.
function test(a: number, b: number): number {
  return a ^ b;
}

// A forward into a caller contract that one `new` does not prove
// (docs/LANGUAGE.md, "Panic sites"). `Grid`'s constructor forwards into
// `area` as `caller_contract_forward`'s does, but `square`'s `new Grid(n, n)` takes
// a size its caller chooses, so not every call into `Grid` is proven, the
// constructor's call into `area` is not either, and `area`'s first `panic`
// stays its own: `--deny-panics` (`args`) refuses it.
const area = (who: string, width: i32, height: i32): i32 => {
  if (width < 0 || height < 0) {
    panic(`${who}: a negative size`)
  }
  const size: i64 = toI64(width) * toI64(height)
  if (size > toI64(2147483647)) {
    panic(`${who}: more than 2^31 - 1 cells`)
  }
  return toI32(size)
}

class Grid {
  cells: i32

  constructor(width: i32, height: i32) {
    const cells: i32 = area("Grid", width, height)
    this.cells = cells
  }
}

const square = (n: i32): Grid => new Grid(n, n)

export const main = (): i32 => {
  const small = new Grid(2, 3)
  const big = square(3)
  return small.cells > 0 && big.cells > 0 ? 0 : 1
}

// The elements of a constant table are folded at compile time, so each must
// be a constant expression.
const f = (): i32 => 3

const XS: readonly i32[] = [1, f()]

// NL2177: `MIN / -1` is refused while folding a constant, the same failure the emitted divisor check catches.
const X: i32 = -2147483648 / -1;

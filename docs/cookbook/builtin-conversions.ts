const widen = (n: number): i64 => toI64(n);

const narrow = (x: f64): number => toI32(x);

const toDouble = (n: number): f64 => toF64(n);

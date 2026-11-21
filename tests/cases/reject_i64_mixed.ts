// No implicit widening: an i64 and an i32 `number` need an explicit toI64/toI32.
const f = (x: i64, n: number): i64 => {
  return x + n;
};

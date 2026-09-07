// The bit builtins reinterpret, so they take exactly the type whose bits they read.
export function test(): number {
  const n: i32 = 1;
  return toI32(f64ToBits(n));
}

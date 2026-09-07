// The unsigned divisor check is one compare, and it still fires: a zero
// divisor prints "attempt to divide by zero" and exits 1, exactly as the
// signed check does. (`attempt to divide with overflow` is unreachable here:
// unsigned division has no overflow case.)
export function main(): number {
  const n: u32 = 0;
  const big: u32 = 4000000000;
  console.log("before");
  console.log(`${big / n}`);
  return 0;
}

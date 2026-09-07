// The ABI change is a lowering, not a loosening: a `Result` that fits in a
// register is still a `Result`, so `value` needs the same proof it always did.
function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

export function main(): i32 {
  const r = half(7);
  return r.value;
}

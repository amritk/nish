// WP17: `Result<i32, i32>` is small enough to travel in a register, so `half`
// is `define ... i64` and its two `return`s are a shift and an `or` rather than
// an arena bump. The caller unpacks the word into its own entry-block object,
// which is what every WP16 construct — `isErr()`, `.value`, `.error` — reads,
// so nothing below the ABI boundary changed. There is no `sts_alloc_struct` in
// this golden at all.
function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

export function main(): i32 {
  const good = half(8);
  if (good.isErr()) {
    console.log(good.error);
    return 1;
  }
  console.log(good.value);

  const bad = half(7);
  if (bad.ok) {
    console.log(bad.value);
    return 1;
  }
  console.log(bad.error);
  return 0;
}

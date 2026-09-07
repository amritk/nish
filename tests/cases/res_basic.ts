// `Result<T, E>` (WP16): the discriminant test is what unlocks the payload, so
// the golden pins one `load i1` plus a branch, and the two payload loads in the
// blocks the branch guards. Nothing reaches `value` without passing the test.
function half(n: i32): Result<i32, string> {
  if (n % 2 !== 0) {
    return Err("odd");
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

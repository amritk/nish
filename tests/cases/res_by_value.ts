// WP17: `Result<i32, i32>` is small enough to travel in registers, so each of
// `half`'s two `return`s is one `insertvalue` rather than an arena bump. `half`
// is not exported, so what it answers is the private ABI's `{ i1, i32, i32 }`
// (WP15 §7b): the tag, the ok slot and the error slot, with the arm that is not
// live left `undef` — which is why neither `define` carries a `noundef` return
// attribute. An exported function packs the same value into one `i64` instead;
// `res_export` is the golden for that.
//
// The caller unpacks into its own entry-block object, which is what every WP16
// construct — `isErr()`, `.value`, `.error` — reads, so nothing below the ABI
// boundary changed. There is no `nish_alloc_struct` in this golden at all.
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

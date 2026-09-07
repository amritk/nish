// `orReturn()` is Rust's `?`: the error arm returns `Err(r.error)` from *this*
// function, which is why `quarter` has to return a `Result` of its own. The
// golden pins the early `ret` in `res.propagate` and the payload load in
// `res.ok`, which is where the rest of the body continues.
function half(n: i32): Result<i32, string> {
  if (n % 2 !== 0) {
    return Err(`${n} is odd`);
  }
  return Ok(n / 2);
}

function quarter(n: i32): Result<i32, string> {
  const h = half(n).orReturn();
  return half(h);
}

export function main(): i32 {
  const good = quarter(8);
  if (good.isOk()) {
    console.log(good.value);
  }
  const bad = quarter(6);
  if (bad.isErr()) {
    console.log(bad.error);
  }
  return 0;
}

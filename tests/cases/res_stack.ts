// A `Result` that never leaves its function: WP6 escape analysis proves it and
// lowers each arm to an entry-block `alloca`, so the golden has no
// `nish_alloc_struct` call and the fallible path costs nothing to allocate.
function tenth(n: i32): i32 {
  const r: Result<i32, string> = n >= 10 ? Ok(n / 10) : Err("too small");
  return r.unwrapOr(0);
}

export function main(): i32 {
  console.log(tenth(250));
  console.log(tenth(4));
  return 0;
}

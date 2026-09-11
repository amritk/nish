// The other three shapes a by-value `Result` has to cover. `Result<void, i32>`
// has no success payload, so `Ok()` is the bare constant
// `{ i1 true, i32 undef, i32 undef }` and needs no instruction at all.
// `orReturn()` in a by-value function builds the propagated error straight into
// the return registers instead of building an `Err` object. And `return r` on a
// variable loads all three slots and carries both arms: under the private ABI
// (WP15 §7b) there is no `select`, because each arm has a slot of its own and
// whoever ignores the dead one discards it.
function checkPort(port: i32): Result<void, i32> {
  if (port <= 0) {
    return Err(port);
  }
  return Ok();
}

function firstHalf(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

function quarter(n: i32): Result<i32, i32> {
  const h = firstHalf(n).orReturn();
  return firstHalf(h);
}

function again(n: i32): Result<i32, i32> {
  const r = firstHalf(n);
  return r;
}

export function main(): i32 {
  const bad = checkPort(0);
  if (bad.isErr()) {
    console.log(bad.error);
  }
  checkPort(443).expect("443 is a port");

  console.log(quarter(8).unwrapOr(-1));
  console.log(quarter(6).unwrapOr(-1));
  console.log(again(10).unwrapOr(-1));
  console.log(again(11).unwrapOr(-1));
  return 0;
}

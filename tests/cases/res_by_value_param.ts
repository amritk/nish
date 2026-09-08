// WP17: a `Result` small enough to pack travels by value in *both* directions,
// so `describe` is `define ... i32 @describe(i64 %r)` and the caller packs the
// argument the same way a `return` packs. The word is unpacked once, in the
// prologue, into the object every WP16 construct reads.
//
// Which memory that object lives in is the escape analysis's decision, exactly
// as for a `Result` the body builds itself: `describe` only reads its argument,
// so the unpack is an entry-block `alloca`; `boxed` stores it into an object
// literal that outlives the frame, so its unpack is an arena bump instead.
interface Box {
  r: Result<i32, i32>;
}

function describe(r: Result<i32, i32>): i32 {
  if (r.isErr()) {
    return -r.error;
  }
  return r.value;
}

function boxed(r: Result<i32, i32>): Box {
  return { r: r };
}

function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

export function main(): i32 {
  // A construction written out at the call site is packed without ever being
  // built, and a callee's word is unpacked and repacked (which the optimiser
  // folds away entirely).
  console.log(describe(Ok(41)));
  console.log(describe(half(8)));
  console.log(describe(half(7)));

  const kept = boxed(Ok(5));
  const inner = kept.r;
  if (inner.isOk()) {
    console.log(inner.value);
  }
  return 0;
}

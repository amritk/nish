// A `Result` payload is checked with no contextual type, so in f64 mode the
// bare `3` is an `f64` and does not match a `Result<i32, string>`.
// `docs/LANGUAGE.md` grants a literal its context's type only in the positions
// its table names, and an `Ok(...)` argument is not one of them — write
// `Ok(toI32(3))` when the payload has to be an i32. `tests/run.js --parity`
// found the two compilers disagreeing here (WP19 §A2): stage1 was threading
// the payload type down as a hint.
function status(): Result<i32, string> {
  return Ok(3);
}

export function main(): i32 {
  const r = status();
  return r.isOk() ? 0 : 1;
}

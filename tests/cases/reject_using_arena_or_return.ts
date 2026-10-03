// `orReturn()` inside a `using a = arena()` block builds the propagated
// `Result` in the arena when it is too large for a register, and the block
// releases before the function returns.
const parse = (s: string): Result<string, string> => (s.length > 0 ? Ok(s) : Err(`empty ${s.length}`));

const first = (s: string): Result<string, string> => {
  using a = arena();
  const v = parse(s).orReturn();
  return Ok(v);
};

export const main = (): i32 => {
  console.log(first("x").unwrapOr("none"));
  return 0;
};

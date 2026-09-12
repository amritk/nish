// NL2034: `Ok(...)` in a position whose contextual type is not a `Result` names what it is instead.
export const main = (): i32 => {
  const n: i32 = Ok(1);
  return n;
};

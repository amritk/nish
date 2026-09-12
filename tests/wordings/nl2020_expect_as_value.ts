// NL2020: A `Result<void, E>` method answers nothing, so using its call as a value is refused.
const work = (): Result<void, string> => Ok();

export const main = (): i32 => {
  const r = work();
  const x: i32 = r.expect("boom");
  return 0;
};

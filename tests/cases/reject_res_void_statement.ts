// A `Result<void, E>` method answers nothing, so its call is a statement.
export const run = (r: Result<void, string>): number => {
  const value = r.expect("failed");
  return 0;
};

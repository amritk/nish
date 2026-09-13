// A `Result<void, E>` carries nothing on success, so it has no `value`.
export const run = (r: Result<void, string>): number => {
  if (r.isOk()) {
    return r.value;
  }
  return 0;
};

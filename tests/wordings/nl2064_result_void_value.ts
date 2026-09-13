// NL2064: `Result<void, E>` carries nothing on success, so `.value` has nothing to read.
const work = (): Result<void, string> => Ok();

export const main = (): i32 => {
  const r = work();
  if (r.isOk()) {
    const v = r.value;
  }
  return 0;
};

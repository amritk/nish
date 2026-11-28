// examples-strict S7e: under the no-panic default, `crypto.getRandomValues`
// is an `io-exit` site, since it exits when the system cannot supply entropy,
// and the refusal names its twin `crypto.tryGetRandomValues`, which answers
// `false` instead. The twin is not refused: `tests/link/deny_panics_entropy_try`
// builds the same fill through it under the same default. `strict` keeps the
// harness from passing `--allow-panics`.
const key = (): u8[] => {
  const bytes = new Array<u8>(32);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const main = (): i32 => {
  return key().length;
};

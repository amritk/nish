// examples-strict S7e: under the no-panic default, `crypto.getRandomValues`
// is an `io-exit` site, since it exits when the system cannot supply entropy,
// and the refusal names its twin `crypto.tryGetRandomValues`, which answers
// `false` instead. `nonce` is the same fill through the twin and is not
// refused; `strict` keeps the harness from passing `--allow-panics`.
const key = (): u8[] => {
  const bytes = new Array<u8>(32);
  crypto.getRandomValues(bytes);
  return bytes;
};

const nonce = (): Result<u8[], string> => {
  const bytes = new Array<u8>(12);
  if (!crypto.tryGetRandomValues(bytes)) {
    return Err("the system could not supply entropy");
  }
  return Ok(bytes);
};

export const main = (): i32 => {
  const n = nonce();
  return n.ok ? n.value.length : key().length;
};

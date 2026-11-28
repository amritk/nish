// The fill through the twin, in a module of its own: every module of this
// package is held to the no-panic default, and this one builds.
export const nonce = (): Result<u8[], string> => {
  const bytes = new Array<u8>(12);
  if (!crypto.tryGetRandomValues(bytes)) {
    return Err("the system could not supply entropy");
  }
  return Ok(bytes);
};

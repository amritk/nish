// examples-strict S7e: the answering twin. The same fill as `getRandomValues`,
// answered as an `i1` rather than ended in an exit, so a caller held to no
// panic turns a failing source into its own `Err`.
export const nonce = (bytes: u8[]): Result<i32, string> => {
  if (!crypto.tryGetRandomValues(bytes)) {
    return Err("no entropy")
  }
  return Ok(bytes.length)
}

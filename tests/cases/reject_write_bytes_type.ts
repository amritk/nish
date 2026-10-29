// The bytes are a `u8[]`: a string goes through `write`.
export function main(): number {
  return writeBytes("ab", 0, 2);
}

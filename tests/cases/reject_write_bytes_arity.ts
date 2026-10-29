// `writeBytes` takes the range as `netWrite` does: the array, an offset and
// a length. The whole array is not implied.
export function main(): number {
  const bytes: u8[] = [1, 2];
  return writeBytes(bytes);
}

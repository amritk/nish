// The path is a string; there is no conversion from a number.
export function main(): number {
  return mkdirSyncMode(7, 0o700);
}

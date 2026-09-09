// The name is a string; there is no conversion from a number.
export function main(): number {
  const v = getenv(7);
  return v === null ? 1 : 0;
}

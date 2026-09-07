// `process.argv` is read-only, and `pop` would shorten it.
export function main(): number {
  const first = process.argv.pop();
  return first.length;
}

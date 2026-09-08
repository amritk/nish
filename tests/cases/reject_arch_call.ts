// `process.arch` is a value, not a function: it takes no arguments and
// there is nothing to call.
export function main(): number {
  return process.arch() === "x64" ? 0 : 1;
}

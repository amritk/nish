// One path, and no fallback: `realpathSync` answers `null` instead of taking a
// default, so a caller writes the fallback with `!== null` (`io_realpath`).
// Nothing is bound here, so the arity error is the only one: a `const` would
// cascade into `Unknown identifier` and make this a weaker test than it looks.
export function main(): number {
  return realpathSync("bin/nish", "/opt") === null ? 1 : 0;
}

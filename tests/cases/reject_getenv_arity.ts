// One name, and no default: `getenv` answers `null` instead of taking a
// fallback, so a caller writes the fallback with `!== null` (`io_getenv`).
// Nothing is bound here, so the arity error is the only one: a `const` would
// cascade into `Unknown identifier` and make this a weaker test than it looks.
export function main(): number {
  return getenv("CC", "clang") === null ? 1 : 0;
}

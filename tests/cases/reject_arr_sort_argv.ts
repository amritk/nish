// `process.argv` is read-only, so sorting it in place is refused, as `push` is.
export const main = (): number => {
  process.argv.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return 0
};

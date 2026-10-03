// NL2188: `string | null` has no fix: `""` and `null` are both falsy, and only
// the author knows whether the test was for one, the other or both.
export const test = (s: string | null): number => {
  if (s) {
    return 1
  }
  return 0
}

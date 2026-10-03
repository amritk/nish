// NL2361: a nullable value type has two ways to be absent, and a zero would
// hide which one the author meant, so it has no fix.
export const test = (): number => {
  const names = new Map<i32, string | null>()
  let name = names.get(1)
  return 0
}

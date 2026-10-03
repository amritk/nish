// NL2249: only a number or a boolean prints the same in a template literal as
// through `toString`; a `void` call has no value to print, so there is no fix.
const nothing = (): void => {}
export const test = (): number => {
  const s = nothing().toString()
  return s.length
}

// NL2247: the argument is a call, whose type the fix does not check, and a
// `void` call has no value for a template hole; there is no fix.
const nothing = (): void => {}
export const test = (): number => {
  const s = String(nothing())
  return s.length
}

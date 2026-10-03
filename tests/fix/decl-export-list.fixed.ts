// `export { ... }` (NL2128): the list goes, and `export` goes before each
// declaration it names, whatever kind of declaration that is.
export function f(): i32 {
  return 1
}
export const g = (): i32 => 2
export interface P {
  x: i32
}
export type N = i32

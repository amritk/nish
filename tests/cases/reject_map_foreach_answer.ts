// `forEach` on a `Map` answers `void`, as it does on an array.
export const main = (): i32 => {
  const m = new Map<string, i32>()
  return m.forEach((v) => console.log(v))
}

// `bad` binds its parameter, where a `T[]` spelling could resize it.
export function bad(a: Int32Array): void {
  const b = a
  b[0] = 1
}

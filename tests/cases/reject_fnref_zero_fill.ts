// WP51 §2.3: a reference has no zero value, so an array of references is not
// made by length, whose elements would start as one.
type F = (x: i32) => i32

export const main = (): i32 => {
  const fs: F[] = new Array<F>(4)
  return fs.length
}

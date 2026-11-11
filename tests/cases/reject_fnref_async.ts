// WP51 §2.2: an async function's call makes a promise, and a promise is not a
// value, so a reference cannot hold it.
type F = (x: i32) => i32

const later = async (x: i32): Promise<i32> => x

export const main = (): i32 => {
  const f: F = later
  return f(1)
}

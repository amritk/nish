import { square } from "./math"

// `export const main` is the program entry. Its return value is the exit
// code, so `./build/multi; echo $?` prints 49. An overflowing square is
// reported on stderr and exits 1.
// smoke: exit 49
export const main = (): i32 => {
  const r = square(7)
  if (r.isErr()) {
    console.error("square(7) overflows i32")
    return 1
  }
  return r.value
}

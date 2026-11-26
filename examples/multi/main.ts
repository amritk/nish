import { square } from "./math"

// `export const main` is the program entry. Its return value is the exit
// code, so `./build/multi; echo $?` prints 49.
// Opt-out (`--allow-panics`): math.ts's `n * n` may overflow (see its first
// lines).
// smoke: args --allow-panics
// smoke: exit 49
export const main = (): number => square(7)

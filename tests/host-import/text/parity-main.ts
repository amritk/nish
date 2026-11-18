// The native half of the parity corpus: the same `corpus` printed by a process.
import { corpus } from "./parity"

export const main = (): void => {
  console.log(corpus())
}

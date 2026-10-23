import type { i32 } from "nish/runtime"
/* Code follows this comment on its line, so the import goes above it. */ const three: i32 = 3

export const main = (): number => {
  console.log(`${three + 1}`)
  return 0
}

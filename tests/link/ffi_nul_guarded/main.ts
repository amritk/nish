import { measure, measureInside } from "./nul.ts"

export const main = (): i32 => {
  console.log(measure("abc"))
  console.log(measure("a\u0000b"))
  console.log(measureInside("abcd"))
  console.log(measureInside("\u0000"))
  return 0
}

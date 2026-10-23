// `parseInt`, `parseFloat` and `Number` of a string parse as the native
// runtime does, through the core's helpers rather than the globals.
import { parseInt, parseFloat, number } from "nish/runtime"

export const main = (): number => {
  const text: string = " 42 "
  console.log(`${parseInt("17")} ${parseInt("-8")}`)
  console.log(`${parseFloat("2.5")} ${parseFloat("1e3")}`)
  console.log(`${number(text)} ${number("0.25")} ${number("x")}`)
  return 0
}

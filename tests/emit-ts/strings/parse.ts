// `parseInt`, `parseFloat` and `Number` of a string parse as the native
// runtime does, through the core's helpers rather than the globals.

export const main = (): number => {
  const text: string = " 42 "
  console.log(`${parseInt("17")} ${parseInt("-8")}`)
  console.log(`${parseFloat("2.5")} ${parseFloat("1e3")}`)
  console.log(`${Number(text)} ${Number("0.25")} ${Number("x")}`)
  return 0
}

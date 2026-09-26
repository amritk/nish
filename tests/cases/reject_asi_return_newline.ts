// `return` and then a line break returns nothing, as it does in TypeScript, so
// the call on the next line is unreachable code rather than the return value.
const log = (): void => {
  console.log("never")
}

const run = (): void => {
  return
    log()
}

export const main = (): number => {
  run()
  return 0
}

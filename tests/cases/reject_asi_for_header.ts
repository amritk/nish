// The two semicolons of a `for` header are never inserted, even at a line break.
export const main = (): number => {
  for (let i: i32 = 0
    i < 3
    i++) {
    console.log(`${i}`)
  }
  return 0
}

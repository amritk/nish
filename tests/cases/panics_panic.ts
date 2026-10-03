// Panic sites: `panic(message)` is one, wherever it is written. Nothing
// proves it away; a path the program never takes is still a site.
const checked = (n: i32): i32 => {
  if (n < 0) {
    panic("negative")
  }
  return n * 2
}

export const main = (): number => {
  console.log(checked(21))
  return 0
}

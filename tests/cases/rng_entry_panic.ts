// WP31 §7's loop-counter trap: the counter has to reach 256 to leave the loop,
// and 256 is outside `integer<0, 255>`, so the last `i++` fails its entry
// check and the program exits 1 before it prints. Under Node the type is a
// `number` alias and the loop runs to the end, which is the divergence
// docs/RUN_UNDER_NODE.md records.
export const main = (): number => {
  let sum = 0
  for (let i: integer<0, 255> = 0; i < 256; i++) {
    sum = sum + i
  }
  console.log(`${sum}`)
  return 0
}

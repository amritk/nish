// A `/=` on a ranged target gets no review edit: the edit is offered only
// where the target's type is exactly the conversion's, and `r`'s is the range.
export const main = (): i32 => {
  let r: integer<0, 100> = 100
  r /= 3
  console.log(`${r}`)
  return 0
}

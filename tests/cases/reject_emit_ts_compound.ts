// WP33 R4: a compound assignment `--emit-ts` writes as `x = x op e` reads its
// target twice, so one whose index holds a call or an element read is refused
// (NL4012): the call would run twice, and the read could differ the second time.
const at = (k: i32[]): i32 => {
  k[0] = k[0] + 1
  return 0
}

export const main = (): number => {
  const hist: u8[] = [250, 0]
  const data: i32[] = [0]
  hist[data[0]] += 10
  const k: i32[] = [0]
  const a: i32[] = [7, 9]
  a[at(k)] /= 2
  console.log(`${hist[0]} ${a[0]} ${k[0]}`)
  return 0
}

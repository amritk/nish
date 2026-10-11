const sum4 = (xs: i32[]): i32 => {
  let s = 0
  for (let i = 0; i + 3 < xs.length; i = i + 4) {
    s = s + xs[i] + xs[i + 1] + xs[i + 2] + xs[i + 3]
  }
  return s
}

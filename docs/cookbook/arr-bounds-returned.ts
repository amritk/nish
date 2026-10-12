const filled = (n: i32): i32[] => {
  const arr = new Array<i32>(n)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i
  }
  return arr
}

const span = (): i32 => {
  const xs = filled(4)
  return xs[3] - xs[0]
}

// The same bound as `storage_index_const_bound`, held in a function `const`
// (#2316). `i <= top` lets `i` reach 4, one past the storage's last slot, so
// `BOX[i]` stays unproven and is refused in `main.ts`, which `noPanic` lists.
const BOX = new Int32Array(4)

const at = (i: i32): void => {
  const top: i32 = 4
  if (i >= 0 && i <= top) {
    BOX[i] = 1
  }
}

export const main = (): i32 => {
  at(parseInt("4"))
  return BOX[0]
}

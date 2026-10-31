const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export function main(): i32 {
  let k = 3
  k = k + 1
  console.log(apply((x: i32): i32 => {
    k = x
    return k
  }, 5))
  return 0
}

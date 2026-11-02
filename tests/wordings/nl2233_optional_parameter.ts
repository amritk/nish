// NL2233: An arrow written as a value gives no parameter a default: only a declaration's own list does.
export function main(): void {
  const xs = [1, 2]
  console.log(xs.map((x: i32, i: i32 = 0): i32 => x + i).length)
}

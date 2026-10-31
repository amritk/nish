// An arrow expression's parameters end in no rest.
export function main(): void {
  const xs = [1, 2]
  console.log(xs.map((x: i32, ...r: i32[]): i32 => x + r.length).length)
}

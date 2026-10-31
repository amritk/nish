// NL2235: An arrow written as a value ends in no rest: only a declaration's own list does.
export function main(): void {
  const xs = [1, 2]
  console.log(xs.map((x: i32, ...r: i32[]): i32 => x + r.length).length)
}

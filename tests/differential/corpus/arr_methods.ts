// `push` / `pop` / `indexOf` / `join` against Node. `pop` on an empty array
// panics here and returns `undefined` there, so the empty case is the last
// thing the program does.
export function main(): number {
  const parts: string[] = [];
  for (let i = 0; i < 5; i++) {
    parts.push(`p${i}`);
  }
  console.log(parts.join(", "));
  console.log(parts.join(""));
  console.log(parts.join());
  console.log(`${parts.indexOf("p3")} ${parts.indexOf("p9")} ${parts.length}`);
  console.log(`${parts.pop()} ${parts.pop()} ${parts.length} ${parts.join("|")}`);

  const nums: number[] = [4, 8, 15, 16, 23];
  console.log(`${nums.indexOf(16)} ${nums.indexOf(7)} ${nums.pop()}`);
  const wide: i64[] = [1, 2, 3];
  console.log(`${wide.indexOf(3)} ${wide.pop()}`);

  const single: string[] = ["only"];
  console.log(`[${single.join("--")}]`);
  const none: string[] = [];
  console.log(`[${none.join("--")}] ${none.indexOf("x")}`);
  none.push(single.pop());
  console.log(none.join("+"));
  return 0;
}

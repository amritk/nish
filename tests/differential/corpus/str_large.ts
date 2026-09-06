// Strings and arrays that outgrow the first 64 KB arena chunk several times over.
function checksum(s: string): number {
  return s.length * 31 + (s === "" ? 0 : 1);
}

export function main(): number {
  let s = "0123456789";
  let doublings = 0;
  while (s.length < 300000) {
    s = s + s;
    doublings++;
  }
  console.log(doublings);
  console.log(s.length);
  console.log(checksum(s));
  console.log(s === s + "");
  let t = "";
  for (let i = 0; i < 20000; i++) {
    t = `${t}${i % 10}`;
  }
  console.log(t.length);
  console.log(t === t + "");
  const xs: number[] = [];
  for (let i = 0; i < 200000; i++) {
    xs.push(i);
  }
  console.log(xs.length);
  console.log(xs[199999]);
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  console.log(sum);
  const strs: string[] = [];
  for (let i = 0; i < 5000; i++) {
    strs.push(`item-${i}`);
  }
  let total = 0;
  for (const w of strs) {
    total += w.length;
  }
  console.log(total);
  console.log(strs[4999]);
  return 0;
}

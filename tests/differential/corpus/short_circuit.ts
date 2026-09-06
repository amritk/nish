// && and || evaluate the right operand only when needed; ++ inside them proves it.
function positive(x: number): boolean {
  return x > 0;
}

export function main(): number {
  let calls = 0;
  const a = false && calls++ > -1;
  console.log(`${a} ${calls}`);
  const b = true && calls++ > -1;
  console.log(`${b} ${calls}`);
  const c = true || calls++ > -1;
  console.log(`${c} ${calls}`);
  const d = false || calls++ > -1;
  console.log(`${d} ${calls}`);
  let hits = 0;
  for (let i = -3; i <= 3; i++) {
    if (positive(i) && ++hits > 0) {
      console.log(`positive ${i} hits ${hits}`);
    }
    if (!positive(i) || hits++ < 0) {
      console.log(`non-positive ${i} hits ${hits}`);
    }
  }
  console.log(hits);
  let n = 0;
  const chain = (n++ === 0 && n++ === 1 && n++ === 5) || n++ === 3;
  console.log(`${chain} ${n}`);
  let m = 0;
  const mixed = (m++ === 0 || m++ === 100) && (m++ === 1 || m++ === 2);
  console.log(`${mixed} ${m}`);
  let k = 10;
  let steps = 0;
  while (k > 0 && steps++ < 100) {
    k -= 3;
  }
  console.log(`${k} ${steps}`);
  const notFirst = !(k > 0) && !(steps > 100);
  console.log(notFirst);
  return 0;
}

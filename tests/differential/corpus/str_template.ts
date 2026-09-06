// Template literals with every hole type: string, i32, f64, boolean, i64, expressions, nesting.
function describe(name: string, n: number, ok: boolean): string {
  return `${name}: n=${n}, ok=${ok}!`;
}

export function main(): number {
  console.log(describe("answer", 42, true));
  console.log(describe("", -1, false));
  const tenth: f64 = 0.1;
  const f = tenth + 0.2;
  const big: i64 = 3000000000;
  const flag = 3 > 2;
  console.log(`f=${f} big=${big} flag=${flag}`);
  console.log(`${big * big}`);
  console.log(`${-big}`);
  console.log(`${f * 10}`);
  console.log(`${1 + 2}${3 + 4}`);
  console.log(`${"solo"}`);
  console.log(`${"a" + "b"}${"c"}`);
  console.log(`${`inner ${1}`} outer ${2}`);
  console.log(`${`${`${"deep"}`}`}`);
  console.log(`empty:${""}:end`);
  console.log(``);
  console.log(`${!flag} ${flag && !flag} ${flag || !flag}`);
  console.log(`${2147483647 + 1} ${-2147483647 - 1}`);
  console.log(`${7 / 2} ${-7 % 3}`);
  console.log(`${toF64(7) / 2} ${toI64(7) * 1000000000}`);
  let line = "";
  for (let i = 0; i < 5; i++) {
    line = `${line}[${i}:${i * i}]`;
  }
  console.log(line);
  console.log(`${line.length}`);
  const e21: f64 = 1e21;
  const e7: f64 = 1e-7;
  const half: f64 = 0.5;
  console.log(`${e21 * 1} ${e7 * 1} ${half * 0}`);
  const z: f64 = 0;
  console.log(`${z / z} ${1 / z} ${-1 / z}`);
  return 0;
}

// Ternary chains of every result type, nested ternaries, ternaries as call arguments.
function sign(x: number): number {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}

function grade(score: number): string {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

function fizzbuzz(n: number): string {
  return n % 15 === 0 ? "FizzBuzz" : n % 3 === 0 ? "Fizz" : n % 5 === 0 ? "Buzz" : `${n}`;
}

export function main(): number {
  console.log(sign(-2147483647 - 1));
  console.log(sign(0));
  console.log(sign(42));
  console.log(grade(95));
  console.log(grade(85));
  console.log(grade(75));
  console.log(grade(65));
  console.log(grade(5));
  let line = "";
  for (let i = 1; i <= 15; i++) {
    line = `${line}${fizzbuzz(i)} `;
  }
  console.log(line);
  const a = 3;
  const b = 4;
  const bigger = a > b ? a : b;
  const smaller = a > b ? b : a;
  console.log(bigger * 10 + smaller);
  const flag = a < b ? a * 2 === 6 : false;
  console.log(flag);
  console.log(flag ? (a === 3 ? "three" : "other") : "no");
  const onePointFive: f64 = 1.5;
  const f = a > b ? onePointFive : -onePointFive;
  console.log(f);
  const one: i64 = 1;
  const three: i64 = 3000000000;
  const big = a > b ? one : three;
  console.log(big);
  console.log(sign(a > b ? -5 : 5) + sign(b > a ? -5 : 5));
  const xs = a > b ? [1, 2] : [3, 4, 5];
  console.log(xs.length);
  const t = true ? (false ? 1 : 2) : 3;
  console.log(t);
  return 0;
}

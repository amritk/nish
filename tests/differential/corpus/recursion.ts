// Recursion: fib, ackermann, factorial (wrapping), gcd, mutual recursion, power by squaring.
function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

function ackermann(m: number, n: number): number {
  if (m === 0) {
    return n + 1;
  }
  if (n === 0) {
    return ackermann(m - 1, 1);
  }
  return ackermann(m - 1, ackermann(m, n - 1));
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function isEven(n: number): boolean {
  return n === 0 ? true : isOdd(n - 1);
}

function isOdd(n: number): boolean {
  return n === 0 ? false : isEven(n - 1);
}

function power(base: number, exp: number): number {
  if (exp === 0) {
    return 1;
  }
  const half = power(base, exp / 2);
  return exp % 2 === 0 ? half * half : half * half * base;
}

function sumTo(n: number): number {
  if (n === 0) {
    return 0;
  }
  return n + sumTo(n - 1);
}

export function main(): number {
  for (let i = 0; i <= 20; i++) {
    console.log(`fib(${i}) = ${fib(i)}`);
  }
  console.log(fib(25));
  console.log(ackermann(2, 3));
  console.log(ackermann(3, 3));
  console.log(ackermann(3, 5));
  for (let i = 10; i <= 15; i++) {
    console.log(`${i}! = ${factorial(i)}`);
  }
  console.log(gcd(1071, 462));
  console.log(gcd(-48, 18));
  console.log(gcd(0, 7));
  console.log(isEven(10));
  console.log(isOdd(7));
  console.log(isEven(1001));
  console.log(power(3, 20));
  console.log(power(2, 31));
  console.log(power(7, 30));
  console.log(power(-2, 31));
  console.log(sumTo(1000));
  return 0;
}

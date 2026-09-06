// Digit sums, reversal, and palindromes with while loops, / and %.
function digitSum(n: number): number {
  let s = 0;
  let r = n;
  while (r !== 0) {
    s += r % 10;
    r /= 10;
  }
  return s;
}

function reverse(n: number): number {
  let r = 0;
  let x = n;
  while (x !== 0) {
    r = r * 10 + (x % 10);
    x /= 10;
  }
  return r;
}

function isPalindrome(n: number): boolean {
  return n === reverse(n);
}

export function main(): number {
  console.log(digitSum(12345));
  console.log(digitSum(-987));
  console.log(digitSum(2147483647));
  console.log(reverse(12345));
  console.log(reverse(-120));
  console.log(reverse(1000000001));
  console.log(reverse(2147483647));
  let count = 0;
  for (let i = 1; i < 2000; i++) {
    if (isPalindrome(i)) {
      count++;
    }
  }
  console.log(count);
  console.log(isPalindrome(12321));
  console.log(isPalindrome(12322));
  return 0;
}
